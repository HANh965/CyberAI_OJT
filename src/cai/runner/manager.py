"""Reverse Runner Manager for CAI.

Coordinates remote command execution on isolated Kali Linux VMs (VMware / VirtualBox)
that connect back to CAI via outbound WebSockets or HTTP long-polling.
"""

from __future__ import annotations

import asyncio
import logging
import os
import secrets
import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("cai.runner")


class RunnerTask:
    """Represents a command dispatched to a remote runner."""

    def __init__(
        self,
        task_id: str,
        command: str,
        timeout: int = 120,
        stream_callback: Optional[Callable[[str], None]] = None,
    ):
        self.task_id = task_id
        self.command = command
        self.timeout = timeout
        self.stream_callback = stream_callback
        self.created_at = time.time()
        self.completed = False
        self.output_chunks: List[str] = []
        self.return_code: Optional[int] = None
        self.error: Optional[str] = None
        self.done_event = threading.Event()
        self.async_future: Optional[asyncio.Future] = None


class RunnerSession:
    """Represents a connected remote Kali VM runner."""

    def __init__(
        self,
        runner_id: str,
        hostname: str,
        os_info: str,
        tools: List[str],
        client_ip: str,
        transport: str = "http",
        ws: Any = None,
    ):
        self.runner_id = runner_id
        self.hostname = hostname
        self.os_info = os_info
        self.tools = tools
        self.client_ip = client_ip
        self.transport = transport
        self.ws = ws
        self.connected_at = time.time()
        self.last_seen = time.time()
        # For HTTP long polling task queue
        self.task_queue: List[RunnerTask] = []
        self.queue_condition = threading.Condition()


class RunnerManager:
    """Singleton manager for Reverse Runner connections."""

    _instance: Optional[RunnerManager] = None
    _lock = threading.Lock()

    def __new__(cls) -> RunnerManager:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._init_manager()
        return cls._instance

    def _init_manager(self) -> None:
        self._runners: Dict[str, RunnerSession] = {}
        self._tasks: Dict[str, RunnerTask] = {}
        self._terminal_events: List[Dict[str, Any]] = []
        self._terminal_seq: int = 0
        self._state_lock = threading.Lock()
        # Shared secret token
        env_token = os.getenv("CAI_RUNNER_TOKEN", "").strip()
        if not env_token:
            self._token = "cai-kali-secret"
        else:
            self._token = env_token

    def _append_terminal_event(
        self,
        kind: str,
        text: str,
        source: str = "agent",
        task_id: str = "",
    ) -> int:
        """Append an event to the live terminal stream buffer (max 400 items)."""
        with self._state_lock:
            self._terminal_seq += 1
            seq = self._terminal_seq
            self._terminal_events.append(
                {
                    "seq": seq,
                    "timestamp": time.time(),
                    "kind": kind,
                    "source": source,
                    "task_id": task_id,
                    "text": text,
                }
            )
            if len(self._terminal_events) > 400:
                self._terminal_events = self._terminal_events[-400:]
            return seq

    def get_terminal_logs(self, since_seq: int = 0) -> Dict[str, Any]:
        """Retrieve terminal log events newer than since_seq."""
        active = self.is_active()
        with self._state_lock:
            events = [e for e in self._terminal_events if e["seq"] > since_seq]
            return {
                "last_seq": self._terminal_seq,
                "runner_active": active,
                "events": events,
            }

    def clear_terminal_logs(self) -> None:
        """Clear the live terminal event buffer."""
        with self._state_lock:
            self._terminal_events.clear()

    @property
    def token(self) -> str:
        return self._token

    def verify_token(self, candidate_token: str) -> bool:
        """Constant-time token verification."""
        if not candidate_token:
            return False
        return secrets.compare_digest(candidate_token.strip(), self._token)

    def is_active(self) -> bool:
        """Check if at least one Kali VM runner is currently connected."""
        with self._state_lock:
            now = time.time()
            # Clean up stale runners (no ping in > 45s)
            stale = [
                rid
                for rid, r in self._runners.items()
                if now - r.last_seen > 45 and r.transport == "http"
            ]
            for rid in stale:
                logger.info(f"Removing stale runner {rid}")
                del self._runners[rid]
            return len(self._runners) > 0

    def get_status(self) -> Dict[str, Any]:
        """Return status dictionary for WebUI and CLI."""
        with self._state_lock:
            runners_info = []
            for r in self._runners.values():
                runners_info.append(
                    {
                        "runner_id": r.runner_id,
                        "hostname": r.hostname,
                        "os": r.os_info,
                        "ip": r.client_ip,
                        "tools": r.tools,
                        "transport": r.transport,
                        "uptime_seconds": int(time.time() - r.connected_at),
                        "last_seen_seconds": int(time.time() - r.last_seen),
                    }
                )
            # Detect controller host IPs for 1-click Kali connection command
            controller_ips: List[str] = []
            try:
                import socket
                for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
                    if not ip.startswith("127."):
                        controller_ips.append(ip)
            except Exception:
                pass
            # Prefer 192.168.x.x (VMnet / LAN) first
            controller_ips.sort(key=lambda x: (0 if x.startswith("192.168.") else 1, x))
            preferred_ip = controller_ips[0] if controller_ips else "127.0.0.1"

            return {
                "active": len(runners_info) > 0,
                "count": len(runners_info),
                "runners": runners_info,
                "token": self._token,
                "controller_ips": controller_ips,
                "preferred_ip": preferred_ip,
            }

    def register_runner(
        self,
        runner_id: str,
        hostname: str,
        os_info: str,
        tools: List[str],
        client_ip: str,
        transport: str = "http",
        ws: Any = None,
    ) -> RunnerSession:
        """Register or update a connected runner."""
        with self._state_lock:
            session = RunnerSession(
                runner_id=runner_id,
                hostname=hostname,
                os_info=os_info,
                tools=tools,
                client_ip=client_ip,
                transport=transport,
                ws=ws,
            )
            self._runners[runner_id] = session
            logger.info(
                f"[RunnerManager] Registered {session.hostname} ({client_ip}) via {transport} with {len(tools)} tools."
            )
            return session

    def touch_runner(self, runner_id: str) -> None:
        """Update last seen timestamp for a runner."""
        with self._state_lock:
            if runner_id in self._runners:
                self._runners[runner_id].last_seen = time.time()

    def unregister_runner(self, runner_id: str) -> None:
        """Remove a disconnected runner."""
        with self._state_lock:
            if runner_id in self._runners:
                r = self._runners.pop(runner_id)
                logger.info(f"[RunnerManager] Unregistered runner {r.hostname} ({runner_id})")

    def _get_primary_runner(self) -> Optional[RunnerSession]:
        with self._state_lock:
            if not self._runners:
                return None
            # Return most recently seen runner
            return sorted(self._runners.values(), key=lambda r: r.last_seen, reverse=True)[0]

    # ------------------------------------------------------------------
    # HTTP Long-polling methods
    # ------------------------------------------------------------------

    def get_next_task_for_runner(self, runner_id: str, timeout: float = 25.0) -> Optional[Dict[str, Any]]:
        """Used by HTTP long polling runner on Kali to fetch next task."""
        self.touch_runner(runner_id)
        with self._state_lock:
            runner = self._runners.get(runner_id)
            if not runner:
                return None

        with runner.queue_condition:
            if not runner.task_queue:
                runner.queue_condition.wait(timeout=timeout)

            self.touch_runner(runner_id)
            if runner.task_queue:
                task = runner.task_queue.pop(0)
                return {
                    "task_id": task.task_id,
                    "command": task.command,
                    "timeout": task.timeout,
                }
            return None

    def post_task_update(
        self,
        task_id: str,
        chunk: Optional[str] = None,
        completed: bool = False,
        return_code: Optional[int] = None,
        error: Optional[str] = None,
    ) -> bool:
        """Receive stdout/stderr chunk or task completion from Kali."""
        with self._state_lock:
            task = self._tasks.get(task_id)
            if not task:
                return False

        if chunk:
            task.output_chunks.append(chunk)
            self._append_terminal_event("output", chunk, source=getattr(task, "source", "agent"), task_id=task_id)
            if task.stream_callback:
                try:
                    task.stream_callback(chunk)
                except Exception as e:
                    logger.debug(f"Error in stream callback: {e}")

        if completed:
            task.completed = True
            task.return_code = return_code if return_code is not None else 0
            task.error = error
            task.done_event.set()
            if task.async_future and not task.async_future.done():
                try:
                    full_out = "".join(task.output_chunks)
                    task.async_future.get_loop().call_soon_threadsafe(
                        task.async_future.set_result,
                        (full_out, task.return_code, task.error),
                    )
                except Exception as e:
                    logger.debug(f"Error setting async future: {e}")

        return True

    # ------------------------------------------------------------------
    # Dispatch execution (used by CAI executor)
    # ------------------------------------------------------------------

    def execute_sync(
        self,
        command: str,
        timeout: int = 120,
        stream_callback: Optional[Callable[[str], None]] = None,
        source: str = "agent",
    ) -> Dict[str, Any]:
        """Synchronously execute a command on the remote Kali VM runner."""
        runner = self._get_primary_runner()
        if not runner:
            return {
                "output": "[ERROR] No Kali Reverse Runner connected! Please start cai_runner.py on Kali VM.",
                "return_code": 127,
                "duration": 0.0,
                "error": "No runner connected",
            }

        task_id = str(uuid.uuid4())[:12]
        task = RunnerTask(
            task_id=task_id,
            command=command,
            timeout=timeout,
            stream_callback=stream_callback,
        )
        setattr(task, "source", source)
        self._append_terminal_event("command", command, source=source, task_id=task_id)

        with self._state_lock:
            self._tasks[task_id] = task

        start_time = time.time()

        # If WebSocket runner
        if runner.transport == "ws" and runner.ws:
            import json
            try:
                msg = json.dumps(
                    {
                        "action": "execute",
                        "task_id": task_id,
                        "command": command,
                        "timeout": timeout,
                    }
                )
                loop = asyncio.get_event_loop()
                loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(runner.ws.send_text(msg))
                )
            except Exception as e:
                logger.error(f"Failed to send task via WS: {e}")
                # fallback to queue
                with runner.queue_condition:
                    runner.task_queue.append(task)
                    runner.queue_condition.notify()
        else:
            # HTTP long polling queue
            with runner.queue_condition:
                runner.task_queue.append(task)
                runner.queue_condition.notify()

        # Wait for task completion with timeout
        signaled = task.done_event.wait(timeout=timeout + 5)
        duration = time.time() - start_time

        with self._state_lock:
            self._tasks.pop(task_id, None)

        if not signaled:
            return {
                "output": "".join(task.output_chunks) + f"\n[ERROR] Command timed out on Kali after {timeout}s",
                "return_code": 124,
                "duration": duration,
                "error": "Timeout",
            }

        full_output = "".join(task.output_chunks)
        return {
            "output": full_output,
            "return_code": task.return_code if task.return_code is not None else 0,
            "duration": duration,
            "error": task.error,
        }

    async def execute_async(
        self,
        command: str,
        timeout: int = 120,
        stream_callback: Optional[Callable[[str], None]] = None,
    ) -> Dict[str, Any]:
        """Asynchronously execute a command on the remote Kali VM runner."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            self.execute_sync,
            command,
            timeout,
            stream_callback,
        )

    def execute_manual(
        self,
        command: str,
        timeout: int = 60,
        allow_local_fallback: bool = True,
    ) -> Dict[str, Any]:
        """Execute a manual user command from the WebUI Terminal (on Kali or local fallback)."""
        cmd = (command or "").strip()
        if not cmd:
            return {"output": "", "return_code": 0, "duration": 0.0, "runner": "none"}

        if self.is_active():
            res = self.execute_sync(cmd, timeout=timeout, source="manual")
            res["runner"] = "kali"
            return res

        if not allow_local_fallback:
            return {
                "output": "[ERROR] Chưa có Kali Runner kết nối.",
                "return_code": 127,
                "duration": 0.0,
                "runner": "none",
            }

        import subprocess
        task_id = f"local_{str(uuid.uuid4())[:8]}"
        self._append_terminal_event("command", cmd, source="manual", task_id=task_id)
        start_time = time.time()
        try:
            proc = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding="utf-8",
                errors="replace",
            )
            out = (proc.stdout or "") + (proc.stderr or "")
            rc = proc.returncode
        except subprocess.TimeoutExpired:
            out = f"[ERROR] Command timed out after {timeout}s\n"
            rc = 124
        except Exception as exc:
            out = f"[ERROR] {exc}\n"
            rc = 1

        duration = time.time() - start_time
        if out:
            self._append_terminal_event("output", out, source="manual", task_id=task_id)
        return {
            "output": out,
            "return_code": rc,
            "duration": duration,
            "runner": "local",
        }


runner_manager = RunnerManager()

