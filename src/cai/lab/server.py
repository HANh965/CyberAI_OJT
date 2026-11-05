"""
Server Lifecycle Manager for the Built-in Mock Vulnerable Lab.

Supports starting, stopping, and querying the Mock Lab server both programmatically
from the CAI API / WebUI and via standalone CLI scripts.
"""

from __future__ import annotations

import logging
import os
import socket
import threading
import time
from typing import Any, Dict, Optional

import uvicorn

logger = logging.getLogger("cai.lab.server")


class MockLabManager:
    """Singleton manager for the Mock Lab server."""

    _instance: Optional[MockLabManager] = None
    _lock = threading.Lock()

    def __new__(cls) -> MockLabManager:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._init_manager()
        return cls._instance

    def _init_manager(self) -> None:
        self.host = os.getenv("CAI_MOCK_LAB_HOST", "0.0.0.0")
        self.port = int(os.getenv("CAI_MOCK_LAB_PORT", "8888"))
        self._server: Optional[uvicorn.Server] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False

    def is_running(self) -> bool:
        """Check if server is active by socket probe or thread state."""
        if self._running and self._thread and self._thread.is_alive():
            return True
        # Probe port directly
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                res = s.connect_ex(("127.0.0.1", self.port))
                return res == 0
        except Exception:
            return False

    def start(self, host: Optional[str] = None, port: Optional[int] = None) -> Dict[str, Any]:
        """Start Mock Lab server in a background thread."""
        with self._lock:
            if self.is_running():
                return {
                    "status": "already_running",
                    "host": self.host,
                    "port": self.port,
                    "url": f"http://127.0.0.1:{self.port}",
                }

            if host:
                self.host = host
            if port:
                self.port = port

            from .app import app

            config = uvicorn.Config(
                app=app,
                host=self.host,
                port=self.port,
                log_level="warning",
                access_log=False,
            )
            self._server = uvicorn.Server(config)

            def _run():
                logger.info(f"Mock Lab starting on {self.host}:{self.port}")
                self._running = True
                try:
                    self._server.run()
                finally:
                    self._running = False

            self._thread = threading.Thread(target=_run, daemon=True, name="cai-mock-lab")
            self._thread.start()

            # Wait briefly for server to bind
            for _ in range(15):
                time.sleep(0.2)
                if self.is_running():
                    break

            return {
                "status": "started",
                "host": self.host,
                "port": self.port,
                "url": f"http://127.0.0.1:{self.port}",
            }

    def stop(self) -> Dict[str, Any]:
        """Stop background server."""
        with self._lock:
            if self._server:
                self._server.should_exit = True
            self._running = False
            return {"status": "stopped", "port": self.port}

    def get_status(self) -> Dict[str, Any]:
        """Return status dictionary for WebUI / API."""
        running = self.is_running()
        url = f"http://127.0.0.1:{self.port}" if running else None

        from .app import CHALLENGE_FLAGS, SOLVED_FLAGS

        return {
            "running": running,
            "host": self.host,
            "port": self.port,
            "url": url,
            "challenges_total": len(CHALLENGE_FLAGS),
            "challenges_solved": len(SOLVED_FLAGS),
            "solved_flags": list(SOLVED_FLAGS),
        }


mock_lab_manager = MockLabManager()


def run_mock_lab_server(host: str = "0.0.0.0", port: int = 8888) -> None:
    """Run server blocking in the current process (for standalone .bat / CLI)."""
    from .app import app

    print("==================================================================")
    print(f"      Acme Corp Security Portal — Mock Pentest Lab")
    print("==================================================================")
    print(f"[*] Lab URL: http://127.0.0.1:{port}")
    print(f"[*] Bound to: {host}:{port} (Accessible from Kali VM)")
    print(f"[*] Press CTRL+C to stop.")
    print("==================================================================")
    uvicorn.run(app, host=host, port=port, log_level="info")

