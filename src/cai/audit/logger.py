"""Persistent Audit Logger and Pentest Report Generator for CAI.

Ensures every command, tool execution, LLM reasoning turn, scope check,
and security finding is persistently saved to disk (logs/sessions/<session_id>.jsonl).
Generates comprehensive Markdown penetration testing reports upon session completion
or on-demand. Survives restarts and crashes.
"""

from __future__ import annotations

import contextvars
import json
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Thread-local / async-task session ID context
active_session_var: contextvars.ContextVar[str] = contextvars.ContextVar("active_session_id", default="")


def set_active_session_id(session_id: str) -> None:
    """Set active session ID for current execution thread/task."""
    active_session_var.set(session_id)
    os.environ["CAI_CURRENT_SESSION_ID"] = session_id


def get_active_session_id() -> str:
    """Retrieve active session ID or fallback to date-based session."""
    sid = active_session_var.get()
    if sid:
        return sid
    env_sid = os.getenv("CAI_CURRENT_SESSION_ID", "").strip()
    if env_sid:
        return env_sid
    return "session_" + datetime.now().strftime("%Y%m%d")


class AuditLogger:
    """Manages persistent session logging and executive report generation."""

    def __init__(self, log_dir: Optional[Path] = None) -> None:
        if log_dir is None:
            # Default to <workspace_root>/logs/sessions
            root_dir = Path(__file__).resolve().parents[3]
            self.log_dir = root_dir / "logs" / "sessions"
        else:
            self.log_dir = Path(log_dir)

        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._active_sessions: Dict[str, Dict[str, Any]] = {}

    def _get_jsonl_path(self, session_id: str) -> Path:
        clean_id = re.sub(r"[^A-Za-z0-9_-]", "_", session_id)
        return self.log_dir / f"{clean_id}.jsonl"

    def _get_report_path(self, session_id: str) -> Path:
        clean_id = re.sub(r"[^A-Za-z0-9_-]", "_", session_id)
        return self.log_dir / f"{clean_id}_report.md"

    def log_event(self, session_id: Optional[str], event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Write a structured event line to the session's JSONL file."""
        sid = session_id or get_active_session_id()
        if not sid:
            return

        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": sid,
            "type": event_type,
        }
        if data:
            payload.update(data)

        line = json.dumps(payload, default=str) + "\n"
        filepath = self._get_jsonl_path(sid)

        with self._lock:
            try:
                with open(filepath, "a", encoding="utf-8") as f:
                    f.write(line)
            except Exception as e:
                logger.error(f"[AuditLogger] Failed to write event to {filepath}: {e}")

    # --- Convenience Logging Helpers ---

    def log_session_start(
        self,
        session_id: str,
        agent_name: str,
        model_name: str,
        target_scope: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self._lock:
            self._active_sessions[session_id] = {
                "start_time": time.time(),
                "agent": agent_name,
                "model": model_name,
                "target": target_scope,
            }

        self.log_event(
            session_id,
            "session_start",
            {
                "agent": agent_name,
                "model": model_name,
                "target_scope": target_scope,
                "metadata": metadata or {},
            },
        )

    def log_user_prompt(self, session_id: str, prompt: str) -> None:
        self.log_event(session_id, "user_input", {"prompt": prompt})

    def log_tool_start(self, session_id: str, tool_name: str, command: str, call_id: str = "") -> None:
        self.log_event(
            session_id,
            "tool_start",
            {"tool": tool_name, "command": command, "call_id": call_id},
        )

    def log_tool_complete(
        self,
        session_id: str,
        tool_name: str,
        command: str,
        output: str,
        return_code: int = 0,
        duration: float = 0.0,
        call_id: str = "",
    ) -> None:
        self.log_event(
            session_id,
            "tool_complete",
            {
                "tool": tool_name,
                "command": command,
                "output": output,
                "return_code": return_code,
                "duration_seconds": round(duration, 3),
                "call_id": call_id,
            },
        )

    def log_scope_violation(self, session_id: str, command: str, reason: str) -> None:
        self.log_event(
            session_id,
            "scope_violation",
            {"command": command, "reason": reason, "severity": "warning"},
        )

    def log_llm_turn(self, session_id: str, content: str, is_reasoning: bool = False) -> None:
        if not content or not content.strip():
            return
        self.log_event(
            session_id,
            "llm_turn",
            {"content": content, "is_reasoning": is_reasoning},
        )

    def log_session_end(self, session_id: str, status: str = "completed") -> None:
        with self._lock:
            meta = self._active_sessions.pop(session_id, {})
            duration = round(time.time() - meta.get("start_time", time.time()), 2)

        self.log_event(
            session_id,
            "session_end",
            {"status": status, "duration_seconds": duration},
        )
        # Automatically generate markdown report on session end
        try:
            self.generate_report(session_id)
        except Exception as e:
            logger.error(f"[AuditLogger] Auto-report generation error: {e}")

    # --- Query & Inspection ---

    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all audit logs found on disk, newest first."""
        sessions = []
        if not self.log_dir.is_dir():
            return sessions

        for f in self.log_dir.glob("*.jsonl"):
            session_id = f.stem
            try:
                # Read first and last lines
                with open(f, "r", encoding="utf-8") as jf:
                    lines = [ln.strip() for ln in jf if ln.strip()]
                if not lines:
                    continue

                first = json.loads(lines[0])
                last = json.loads(lines[-1]) if len(lines) > 1 else first

                # Count tools
                tool_count = sum(1 for ln in lines if '"type": "tool_complete"' in ln or '"type":"tool_complete"' in ln)

                sessions.append(
                    {
                        "session_id": session_id,
                        "created_at": first.get("timestamp"),
                        "updated_at": last.get("timestamp"),
                        "agent": first.get("agent", "unknown"),
                        "model": first.get("model", "unknown"),
                        "target": first.get("target_scope", "—"),
                        "event_count": len(lines),
                        "tool_executions": tool_count,
                        "status": last.get("status", "in_progress" if last.get("type") != "session_end" else "ended"),
                        "has_report": self._get_report_path(session_id).is_file(),
                    }
                )
            except Exception:
                continue

        # Sort newest first
        sessions.sort(key=lambda s: s.get("created_at") or "", reverse=True)
        return sessions

    def get_session_events(self, session_id: str) -> List[Dict[str, Any]]:
        """Return all raw events for a session."""
        filepath = self._get_jsonl_path(session_id)
        if not filepath.is_file():
            return []

        events = []
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except Exception:
                        pass
        return events

    def get_or_generate_report(self, session_id: str) -> str:
        report_path = self._get_report_path(session_id)
        if report_path.is_file():
            return report_path.read_text(encoding="utf-8")
        return self.generate_report(session_id)

    # --- Markdown Report Generator ---

    def generate_report(self, session_id: str) -> str:
        """Synthesize an executive penetration testing report in Markdown."""
        events = self.get_session_events(session_id)
        if not events:
            return f"# Pentest Report - {session_id}\n\nNo recorded events found."

        # Extract stats
        start_ev = next((e for e in events if e.get("type") == "session_start"), {})
        end_ev = next((e for e in events if e.get("type") == "session_end"), {})
        user_prompts = [e.get("prompt") for e in events if e.get("type") == "user_input" and e.get("prompt")]
        tool_events = [e for e in events if e.get("type") == "tool_complete"]
        violations = [e for e in events if e.get("type") == "scope_violation"]

        agent = start_ev.get("agent", "CAI Pentest Agent")
        model = start_ev.get("model", "default")
        target = start_ev.get("target_scope") or "Unspecified"
        start_time = start_ev.get("timestamp", datetime.now(timezone.utc).isoformat())
        duration = end_ev.get("duration_seconds", 0)

        # Parse ports and services from tool outputs
        open_ports: List[Dict[str, str]] = []
        findings: List[Dict[str, str]] = []

        port_re = re.compile(r"^(\d+/(?:tcp|udp))\s+(\w+)\s+([^\n]+)", re.MULTILINE)
        cve_re = re.compile(r"(CVE-\d{4}-\d+)", re.IGNORECASE)

        for te in tool_events:
            out = te.get("output", "")
            # Look for Nmap open ports
            for m in port_re.finditer(out):
                p_port, p_state, p_svc = m.groups()
                if p_state.lower() == "open":
                    open_ports.append({"port": p_port, "service": p_svc.strip()})

            # Look for vulnerabilities / CVEs
            for cve in set(cve_re.findall(out)):
                findings.append(
                    {
                        "level": "HIGH",
                        "title": f"Discovered Reference {cve.upper()}",
                        "source": te.get("tool", "scan"),
                    }
                )

            # Heuristics for high severity keywords
            if re.search(r"\b(sqli|sql injection|remote code execution|unauthorized access|default password)\b", out, re.I):
                findings.append(
                    {
                        "level": "CRITICAL",
                        "title": f"Potential High Severity Vulnerability in {te.get('tool')}",
                        "source": te.get("command", "")[:60],
                    }
                )

        # Build Markdown
        md = []
        md.append(f"# BÁO CÁO ĐÁNH GIÁ AN NINH HỆ THỐNG (PENTEST REPORT)")
        md.append(f"**Phiên kiểm thử:** `{session_id}`  ")
        md.append(f"**Thời gian:** `{start_time}` | **Thời lượng:** `{duration}s`  ")
        md.append(f"**Agent thực thi:** `{agent}` | **Mô hình LLM:** `{model}`  ")
        md.append(f"**Phạm vi ủy quyền (Scope):** `{target}`\n")
        md.append("---\n")

        md.append("## 1. Tóm tắt điều hành (Executive Summary)")
        if user_prompts:
            md.append(f"**Yêu cầu ban đầu:**\n> {user_prompts[0]}\n")
        md.append(
            f"Trong phiên làm việc này, AI Pentest Agent đã thực hiện tổng cộng **{len(tool_events)}** lệnh công cụ kiểm thử. "
            f"Phát hiện **{len(open_ports)}** dịch vụ mở và ghi nhận **{len(findings)}** cảnh báo bảo mật tiềm tàng."
        )
        if violations:
            md.append(
                f"\n⚠️ **Lưu ý:** Scope Guard đã ngăn chặn **{len(violations)}** hành vi nhắm mục tiêu nằm ngoài phạm vi cho phép."
            )
        md.append("\n---\n")

        md.append("## 2. Cổng và dịch vụ phát hiện (Discovered Services)")
        if open_ports:
            md.append("| Cổng / Giao thức | Dịch vụ nhận diện |")
            md.append("| :--- | :--- |")
            for op in open_ports[:20]:
                md.append(f"| `{op['port']}` | {op['service']} |")
        else:
            md.append("*Không ghi nhận cổng mở nào trong kết quả trích xuất.*")
        md.append("\n---\n")

        md.append("## 3. Các phát hiện an ninh (Security Findings)")
        if findings:
            md.append("| Mức độ | Tiêu đề | Nguồn phát hiện |")
            md.append("| :--- | :--- | :--- |")
            for f in findings[:15]:
                md.append(f"| **{f['level']}** | {f['title']} | `{f['source']}` |")
        else:
            md.append("*Không có lỗ hổng nghiêm trọng nào được xác nhận tự động.*")
        md.append("\n---\n")

        md.append("## 4. Nhật ký thực thi công cụ (Execution Timeline)")
        if tool_events:
            md.append("| Thời gian | Công cụ | Lệnh thực thi | Thời lượng | Mã thoát |")
            md.append("| :--- | :--- | :--- | :--- | :--- |")
            for te in tool_events:
                ts = te.get("timestamp", "").split("T")[-1][:8]
                cmd = te.get("command", "")[:45].replace("|", "\\|")
                tool = te.get("tool", "")
                dur = f"{te.get('duration_seconds', 0)}s"
                rc = te.get("return_code", 0)
                rc_str = f"✅ 0" if rc == 0 else f"❌ {rc}"
                md.append(f"| `{ts}` | `{tool}` | `{cmd}...` | `{dur}` | {rc_str} |")
        else:
            md.append("*Chưa có lệnh nào được thực thi.*")

        md.append("\n---\n")
        md.append(f"*Báo cáo được khởi tạo tự động bởi CAI Autonomous Pentesting Framework lúc {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}.*")

        content = "\n".join(md)

        # Write to disk
        report_path = self._get_report_path(session_id)
        with self._lock:
            try:
                report_path.write_text(content, encoding="utf-8")
            except Exception as e:
                logger.error(f"[AuditLogger] Failed to write report file: {e}")

        return content


# Global singleton instance
audit_logger = AuditLogger()


class AuditOutputHandler:
    """Subscribes to OUTPUT bus and records lifecycle events into AuditLogger."""

    def handle(self, event: Any) -> None:
        try:
            etype = type(event).__name__
            sid = getattr(event, "agent_id", "") or get_active_session_id()
            if etype == "ToolStartEvent":
                audit_logger.log_tool_start(sid, getattr(event, "tool_name", ""), "", getattr(event, "call_id", ""))
            elif etype == "ToolCompleteEvent":
                audit_logger.log_tool_complete(
                    sid,
                    getattr(event, "tool_name", ""),
                    "",
                    getattr(event, "output", ""),
                    getattr(event, "exit_code", 0),
                    getattr(event, "duration_seconds", 0.0),
                    getattr(event, "call_id", ""),
                )
            elif etype == "ToolErrorEvent":
                audit_logger.log_tool_complete(
                    sid,
                    getattr(event, "tool_name", ""),
                    "",
                    f"[ERROR] {getattr(event, 'error', '')}",
                    1,
                    0.0,
                    getattr(event, "call_id", ""),
                )
            elif etype == "LLMCompleteEvent":
                audit_logger.log_llm_turn(sid, getattr(event, "content", ""), is_reasoning=False)
        except Exception:
            pass


try:
    from cai.output import OUTPUT

    OUTPUT.subscribe(AuditOutputHandler())
except Exception:
    pass
