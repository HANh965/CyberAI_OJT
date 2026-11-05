"""SQLite Campaign State Store (Phase 3 — Trí nhớ chiến dịch dài hạn).

Persists structured cybersecurity intelligence across turns and across sessions:
- Hosts (IP/domain, hostname, OS guess)
- Open Ports & Services (port, protocol, service, version banner)
- Web Endpoints & Directories (URLs, HTTP status codes)
- Credentials & Flags (usernames, passwords/hashes, tokens, CTF flags)
- Security Findings & Vulnerabilities (severity, title, CVE, evidence)

Automatically ingests tool outputs in real-time and synthesizes a compact
Campaign Memory Context Block so agents can chain multi-stage assessments
without forgetting prior discoveries or re-scanning known targets.
"""

from __future__ import annotations

import logging
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class CampaignMemoryStore:
    """Thread-safe SQLite state store for autonomous pentesting campaigns."""

    _PORT_RE = re.compile(
        r"^(\d+)/(tcp|udp)\s+open\s+(\S+)(?:\s+([^\n\r]+))?",
        re.MULTILINE | re.IGNORECASE,
    )
    _URL_RE = re.compile(r"(https?://[a-zA-Z0-9.\-_]+(?::\d+)?(?:/[^\s\"'<>)]*)?)")
    _GOBUSTER_RE = re.compile(
        r"^(/[^\s(]+)\s+\(Status:\s*(\d{3})\)",
        re.MULTILINE,
    )
    _FLAG_RE = re.compile(
        r"\b((?:flag|CTF|HTB|THM|picoCTF|FLAG)\{[A-Za-z0-9_@!#$%^&*()+=\-\.?/\\]{3,120}\})"
    )
    _HYDRA_RE = re.compile(
        r"\[(\d+)\]\[([^\]]+)\]\s+host:\s*(\S+)\s+login:\s*(\S+)\s+password:\s*(\S+)",
        re.IGNORECASE,
    )
    _CVE_RE = re.compile(r"\b(CVE-\d{4}-\d{4,7})\b", re.IGNORECASE)
    _IPV4_RE = re.compile(
        r"\b((?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?))\b"
    )

    def __init__(self, db_path: Optional[Path] = None) -> None:
        if db_path is None:
            root_dir = Path(__file__).resolve().parents[3]
            log_dir = root_dir / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = log_dir / "campaign_memory.db"
        else:
            self.db_path = Path(db_path)
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS hosts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        host TEXT UNIQUE NOT NULL,
                        hostname TEXT DEFAULT '',
                        os_guess TEXT DEFAULT '',
                        first_seen TEXT NOT NULL,
                        last_seen TEXT NOT NULL,
                        session_id TEXT DEFAULT ''
                    );

                    CREATE TABLE IF NOT EXISTS ports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        host TEXT NOT NULL,
                        port INTEGER NOT NULL,
                        proto TEXT NOT NULL DEFAULT 'tcp',
                        state TEXT NOT NULL DEFAULT 'open',
                        service TEXT DEFAULT '',
                        version TEXT DEFAULT '',
                        updated_at TEXT NOT NULL,
                        UNIQUE(host, port, proto)
                    );

                    CREATE TABLE IF NOT EXISTS endpoints (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        host TEXT NOT NULL,
                        url TEXT UNIQUE NOT NULL,
                        status_code INTEGER DEFAULT 200,
                        source_tool TEXT DEFAULT '',
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS credentials (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        host TEXT NOT NULL,
                        username TEXT DEFAULT '',
                        secret TEXT NOT NULL,
                        secret_type TEXT NOT NULL DEFAULT 'password',
                        service TEXT DEFAULT '',
                        updated_at TEXT NOT NULL,
                        UNIQUE(host, username, secret, secret_type)
                    );

                    CREATE TABLE IF NOT EXISTS findings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        host TEXT NOT NULL,
                        severity TEXT NOT NULL DEFAULT 'MEDIUM',
                        title TEXT NOT NULL,
                        evidence TEXT DEFAULT '',
                        source_tool TEXT DEFAULT '',
                        session_id TEXT DEFAULT '',
                        updated_at TEXT NOT NULL,
                        UNIQUE(host, title)
                    );
                    """
                )
                conn.commit()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _normalize_host(raw_target: str) -> str:
        if not raw_target:
            return "unknown"
        clean = raw_target.strip().lower()
        clean = re.sub(r"^https?://", "", clean)
        clean = clean.split("/")[0]
        clean = clean.split(":")[0]
        clean = clean.split(",")[0].strip()
        return clean or "unknown"

    # ------------------------------------------------------------------
    # Upsert primitives
    # ------------------------------------------------------------------

    def upsert_host(
        self,
        host: str,
        hostname: str = "",
        os_guess: str = "",
        session_id: str = "",
    ) -> None:
        h = self._normalize_host(host)
        if not h or h == "unknown":
            return
        now = self._now_iso()
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO hosts (host, hostname, os_guess, first_seen, last_seen, session_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(host) DO UPDATE SET
                        hostname = CASE WHEN excluded.hostname != '' THEN excluded.hostname ELSE hosts.hostname END,
                        os_guess = CASE WHEN excluded.os_guess != '' THEN excluded.os_guess ELSE hosts.os_guess END,
                        last_seen = excluded.last_seen,
                        session_id = CASE WHEN excluded.session_id != '' THEN excluded.session_id ELSE hosts.session_id END
                    """,
                    (h, hostname, os_guess, now, now, session_id),
                )
                conn.commit()

    def upsert_port(
        self,
        host: str,
        port: int,
        proto: str = "tcp",
        service: str = "",
        version: str = "",
        state: str = "open",
    ) -> None:
        h = self._normalize_host(host)
        now = self._now_iso()
        self.upsert_host(h)
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO ports (host, port, proto, state, service, version, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(host, port, proto) DO UPDATE SET
                        state = excluded.state,
                        service = CASE WHEN excluded.service != '' THEN excluded.service ELSE ports.service END,
                        version = CASE WHEN excluded.version != '' THEN excluded.version ELSE ports.version END,
                        updated_at = excluded.updated_at
                    """,
                    (h, int(port), proto.lower(), state.lower(), service.strip(), version.strip(), now),
                )
                conn.commit()

    def upsert_endpoint(
        self,
        host: str,
        url: str,
        status_code: int = 200,
        source_tool: str = "",
    ) -> None:
        h = self._normalize_host(host)
        now = self._now_iso()
        self.upsert_host(h)
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO endpoints (host, url, status_code, source_tool, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(url) DO UPDATE SET
                        status_code = excluded.status_code,
                        updated_at = excluded.updated_at
                    """,
                    (h, url.strip()[:250], int(status_code), source_tool, now),
                )
                conn.commit()

    def upsert_credential(
        self,
        host: str,
        secret: str,
        username: str = "",
        secret_type: str = "password",
        service: str = "",
    ) -> None:
        h = self._normalize_host(host)
        now = self._now_iso()
        self.upsert_host(h)
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO credentials (host, username, secret, secret_type, service, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(host, username, secret, secret_type) DO UPDATE SET
                        service = CASE WHEN excluded.service != '' THEN excluded.service ELSE credentials.service END,
                        updated_at = excluded.updated_at
                    """,
                    (h, username.strip(), secret.strip(), secret_type.strip(), service.strip(), now),
                )
                conn.commit()

    def upsert_finding(
        self,
        host: str,
        title: str,
        severity: str = "HIGH",
        evidence: str = "",
        source_tool: str = "",
        session_id: str = "",
    ) -> None:
        h = self._normalize_host(host)
        now = self._now_iso()
        self.upsert_host(h, session_id=session_id)
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO findings (host, severity, title, evidence, source_tool, session_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(host, title) DO UPDATE SET
                        severity = excluded.severity,
                        evidence = CASE WHEN excluded.evidence != '' THEN excluded.evidence ELSE findings.evidence END,
                        updated_at = excluded.updated_at
                    """,
                    (h, severity.upper(), title.strip()[:200], evidence.strip()[:500], source_tool, session_id, now),
                )
                conn.commit()

    # ------------------------------------------------------------------
    # Real-time Tool Output Ingestion
    # ------------------------------------------------------------------

    def ingest_tool_output(
        self,
        target: str,
        tool_name: str,
        command: str,
        output: str,
        session_id: str = "",
    ) -> None:
        """Parse tool execution output and persist structured entities to SQLite."""
        raw = str(output or "")
        if not raw or "[SCOPE_GUARD_BLOCKED]" in raw or "[SAFETY_GATE_BLOCKED]" in raw:
            return

        # Determine host from target or command
        host = self._normalize_host(target)
        if host == "unknown" and command:
            ip_m = self._IPV4_RE.search(command)
            if ip_m:
                host = ip_m.group(1)
            else:
                url_m = self._URL_RE.search(command)
                if url_m:
                    host = self._normalize_host(url_m.group(1))

        if host != "unknown":
            self.upsert_host(host, session_id=session_id)

        # 1. Open ports (Nmap / Masscan / Rustscan)
        for m in self._PORT_RE.finditer(raw):
            port_str, proto, service, version = m.groups()
            self.upsert_port(
                host=host,
                port=int(port_str),
                proto=proto,
                service=service or "",
                version=(version or "").strip()[:100],
            )

        # 2. OS Guess from Nmap
        os_m = re.search(r"OS details:\s*([^\n\r]+)", raw, re.IGNORECASE)
        if os_m and host != "unknown":
            self.upsert_host(host, os_guess=os_m.group(1).strip()[:100], session_id=session_id)

        # 3. Web URLs & Gobuster/FFUF paths
        for m in self._URL_RE.finditer(raw):
            url_val = m.group(1)
            u_host = self._normalize_host(url_val)
            self.upsert_endpoint(host=u_host if u_host != "unknown" else host, url=url_val, source_tool=tool_name)

        for m in self._GOBUSTER_RE.finditer(raw):
            path_val, code_str = m.groups()
            full_url = f"http://{host}{path_val}" if host != "unknown" else path_val
            self.upsert_endpoint(host=host, url=full_url, status_code=int(code_str), source_tool=tool_name)

        # 4. CTF Flags
        for m in self._FLAG_RE.finditer(raw):
            flag_val = m.group(1)
            self.upsert_credential(
                host=host,
                username="ctf_flag",
                secret=flag_val,
                secret_type="flag",
                service=tool_name,
            )

        # 5. Hydra credentials
        for m in self._HYDRA_RE.finditer(raw):
            port_s, svc, h_host, login, pwd = m.groups()
            self.upsert_credential(
                host=h_host or host,
                username=login,
                secret=pwd,
                secret_type="password",
                service=f"{svc}:{port_s}",
            )

        # 6. CVEs & High-severity vulnerabilities
        for m in self._CVE_RE.finditer(raw):
            cve = m.group(1).upper()
            self.upsert_finding(
                host=host,
                title=f"Vulnerability Reference {cve}",
                severity="HIGH",
                evidence=f"Detected in {tool_name} output",
                source_tool=tool_name,
                session_id=session_id,
            )

        if re.search(r"\b(sql injection|is vulnerable|remote code execution|root:x:0:0:)\b", raw, re.I):
            self.upsert_finding(
                host=host,
                title=f"Critical Security Finding ({tool_name})",
                severity="CRITICAL",
                evidence=raw[:300],
                source_tool=tool_name,
                session_id=session_id,
            )

    # ------------------------------------------------------------------
    # Query & Context Injection for LLM
    # ------------------------------------------------------------------

    def get_summary(self, target: str = "") -> Dict[str, Any]:
        """Return structured dictionary of stored campaign intelligence."""
        h_filter = self._normalize_host(target) if target and target.strip() else ""
        with self._lock:
            with self._connect() as conn:
                if h_filter and h_filter != "unknown":
                    hosts = [dict(r) for r in conn.execute("SELECT * FROM hosts WHERE host LIKE ? ORDER BY last_seen DESC", (f"%{h_filter}%",))]
                    ports = [dict(r) for r in conn.execute("SELECT * FROM ports WHERE host LIKE ? ORDER BY port ASC", (f"%{h_filter}%",))]
                    endpoints = [dict(r) for r in conn.execute("SELECT * FROM endpoints WHERE host LIKE ? ORDER BY updated_at DESC LIMIT 30", (f"%{h_filter}%",))]
                    creds = [dict(r) for r in conn.execute("SELECT * FROM credentials WHERE host LIKE ? ORDER BY updated_at DESC", (f"%{h_filter}%",))]
                    findings = [dict(r) for r in conn.execute("SELECT * FROM findings WHERE host LIKE ? ORDER BY updated_at DESC", (f"%{h_filter}%",))]
                else:
                    hosts = [dict(r) for r in conn.execute("SELECT * FROM hosts ORDER BY last_seen DESC LIMIT 20")]
                    ports = [dict(r) for r in conn.execute("SELECT * FROM ports ORDER BY host, port ASC LIMIT 100")]
                    endpoints = [dict(r) for r in conn.execute("SELECT * FROM endpoints ORDER BY updated_at DESC LIMIT 30")]
                    creds = [dict(r) for r in conn.execute("SELECT * FROM credentials ORDER BY updated_at DESC LIMIT 50")]
                    findings = [dict(r) for r in conn.execute("SELECT * FROM findings ORDER BY updated_at DESC LIMIT 50")]

        return {
            "stats": {
                "hosts": len(hosts),
                "ports": len(ports),
                "endpoints": len(endpoints),
                "credentials": len(creds),
                "findings": len(findings),
            },
            "hosts": hosts,
            "ports": ports,
            "endpoints": endpoints,
            "credentials": creds,
            "findings": findings,
        }

    def build_context_for_target(self, target: str = "") -> str:
        """Synthesize a compact Markdown memory block to inject into Agent prompts."""
        data = self.get_summary(target)
        stats = data["stats"]
        if sum(stats.values()) == 0:
            return ""

        lines = ["🧠 [TRÍ NHỚ CHIẾN DỊCH DÀI HẠN — SQLITE CAMPAIGN MEMORY]"]
        if data["hosts"]:
            host_strs = [
                f"{h['host']}" + (f" ({h['os_guess']})" if h.get("os_guess") else "")
                for h in data["hosts"][:5]
            ]
            lines.append(f"- Host đã biết: {', '.join(host_strs)}")

        if data["ports"]:
            port_strs = [
                f"{p['host']}:{p['port']}/{p['proto']} ({p['service']} {p['version']})".strip()
                for p in data["ports"][:15]
            ]
            lines.append(f"- Cổng & Dịch vụ mở: {', '.join(port_strs)}")

        if data["endpoints"]:
            ep_strs = [f"{e['url']} [{e['status_code']}]" for e in data["endpoints"][:8]]
            lines.append(f"- Endpoint Web đã phát hiện: {', '.join(ep_strs)}")

        if data["credentials"]:
            cred_strs = [
                f"[{c['secret_type']}] {c['username']}:{c['secret']} ({c['service']})"
                if c.get("username")
                else f"[{c['secret_type']}] {c['secret']}"
                for c in data["credentials"][:10]
            ]
            lines.append(f"- Tài khoản / Cờ đã thu thập: {', '.join(cred_strs)}")

        if data["findings"]:
            f_strs = [f"[{f['severity']}] {f['title']}" for f in data["findings"][:8]]
            lines.append(f"- Lỗ hổng đã ghi nhận: {'; '.join(f_strs)}")

        lines.append(
            "👉 Kế thừa trực tiếp các dữ kiện trong Trí nhớ chiến dịch ở trên để nối chuỗi kiểm thử, không quét lặp lại các bước đã có kết quả."
        )
        return "\n".join(lines)

    def build_attack_graph(self, target: str = "") -> Dict[str, Any]:
        """Build a hierarchical node-link Attack Graph (Mindmap) from SQLite intelligence."""
        summary = self.get_summary(target)
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        node_ids = set()

        def _add_node(nid: str, label: str, ntype: str, layer: int, meta: Optional[Dict[str, Any]] = None) -> None:
            if nid not in node_ids:
                node_ids.add(nid)
                nodes.append({
                    "id": nid,
                    "label": label,
                    "type": ntype,
                    "layer": layer,
                    "meta": meta or {},
                })

        def _add_edge(src: str, dst: str, label: str = "") -> None:
            edges.append({"source": src, "target": dst, "label": label})

        root_id = "attacker:kali"
        _add_node(root_id, "Kali Attacker / Swarm", "attacker", 0, {"role": "Red Team Controller"})

        hosts_map: Dict[str, str] = {}
        for h in summary["hosts"]:
            h_name = h["host"]
            hid = f"host:{h_name}"
            hosts_map[h_name] = hid
            os_lbl = f" ({h['os_guess']})" if h.get("os_guess") else ""
            _add_node(hid, f"{h_name}{os_lbl}", "host", 1, h)
            _add_edge(root_id, hid, "scan")

        def _ensure_host(h_name: str) -> str:
            h_clean = h_name or "unknown"
            if h_clean not in hosts_map:
                hid = f"host:{h_clean}"
                hosts_map[h_clean] = hid
                _add_node(hid, h_clean, "host", 1, {"host": h_clean})
                _add_edge(root_id, hid, "scan")
            return hosts_map[h_clean]

        for p in summary["ports"]:
            hid = _ensure_host(p["host"])
            pid = f"port:{p['host']}:{p['port']}/{p['proto']}"
            svc = f"{p['service']} {p.get('version', '')}".strip()
            lbl = f":{p['port']}/{p['proto']}" + (f" ({svc})" if svc else "")
            _add_node(pid, lbl, "port", 2, p)
            _add_edge(hid, pid, "open")

        for ep in summary["endpoints"][:20]:
            hid = _ensure_host(ep["host"])
            url_str = ep["url"]
            path_part = re.sub(r"^https?://[^/]+", "", url_str) or "/"
            eid = f"ep:{url_str}"
            code_str = f" [{ep['status_code']}]" if ep.get("status_code") else ""
            _add_node(eid, f"{path_part[:32]}{code_str}", "endpoint", 2, ep)
            _add_edge(hid, eid, "http")

        for f in summary["findings"][:25]:
            hid = _ensure_host(f["host"])
            fid = f"finding:{f['host']}:{f['title'][:40]}"
            sev = (f.get("severity") or "HIGH").upper()
            _add_node(fid, f"[{sev}] {f['title'][:36]}", "finding", 3, f)
            _add_edge(hid, fid, "vuln")

        for c in summary["credentials"][:25]:
            hid = _ensure_host(c["host"])
            cid = f"cred:{c['host']}:{c['secret'][:30]}"
            stype = (c.get("secret_type") or "secret").lower()
            ntype = "flag" if stype == "flag" or "FLAG{" in c.get("secret", "") else "credential"
            user_prefix = f"{c['username']}:" if c.get("username") and c["username"] != "ctf_flag" else ""
            _add_node(cid, f"{user_prefix}{c['secret'][:32]}", ntype, 3, c)
            _add_edge(hid, cid, "loot")

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": summary["stats"],
        }

    def clear_all(self) -> None:
        """Wipe all stored campaign memory."""
        with self._lock:
            with self._connect() as conn:
                conn.executescript(
                    """
                    DELETE FROM hosts;
                    DELETE FROM ports;
                    DELETE FROM endpoints;
                    DELETE FROM credentials;
                    DELETE FROM findings;
                    """
                )
                conn.commit()


# Global singleton instance
campaign_memory = CampaignMemoryStore()

