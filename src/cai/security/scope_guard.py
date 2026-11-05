"""Scope Guard for CAI Penetration Testing Framework.

Enforces authorized Rules of Engagement (RoE) scope.
Extracts network destinations from agent commands and verifies that targets
fall strictly within the user-defined allowlist (IP, CIDR subnets, domains).
Blocks accidental or unauthorized scans against out-of-scope targets.
"""

from __future__ import annotations

import ipaddress
import logging
import os
import re
from typing import List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


class ScopeGuard:
    """Manages target allowlists and verifies tool commands before execution."""

    def __init__(self, default_scope: Optional[str | List[str]] = None) -> None:
        self._enabled = os.getenv("CAI_SCOPE_GUARD", "true").lower() not in ("0", "false", "no", "off")
        self._allow_localhost = os.getenv("CAI_SCOPE_ALLOW_LOCALHOST", "false").lower() in ("1", "true", "yes")
        self._strict_mode = os.getenv("CAI_SCOPE_STRICT", "false").lower() in ("1", "true", "yes")
        self._scope_entries: List[str] = []
        self._networks: List[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
        self._domains: List[str] = []

        initial = default_scope or os.getenv("CAI_TARGET_SCOPE", "")
        if initial:
            self.set_scope(initial)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def set_enabled(self, enabled: bool) -> None:
        self._enabled = enabled

    def get_scope(self) -> List[str]:
        return list(self._scope_entries)

    def set_scope(self, scope: str | List[str]) -> None:
        """Parse and set authorized target scope (CIDR, IP, domains)."""
        if isinstance(scope, str):
            raw_entries = re.split(r"[,\s;]+", scope.strip())
        else:
            raw_entries = list(scope)

        self._scope_entries = []
        self._networks = []
        self._domains = []

        for item in raw_entries:
            clean = item.strip().lower()
            if not clean:
                continue

            # Strip protocol and port if user pasted URL
            clean = re.sub(r"^https?://", "", clean)
            clean = re.sub(r":\d+.*$", "", clean)
            clean = clean.split("/")[0] if "/" in clean and not re.search(r"/\d{1,2}$", clean) else clean

            self._scope_entries.append(clean)

            # Try parsing as IP or CIDR network
            try:
                if "/" in clean:
                    net = ipaddress.ip_network(clean, strict=False)
                else:
                    net = ipaddress.ip_network(f"{clean}/32" if ":" not in clean else f"{clean}/128", strict=False)
                self._networks.append(net)
                continue
            except ValueError:
                pass

            # Domain or wildcard
            self._domains.append(clean)

        logger.info(
            f"[ScopeGuard] Scope configured with {len(self._networks)} subnets/IPs and {len(self._domains)} domains: {self._scope_entries}"
        )

    def clear_scope(self) -> None:
        self._scope_entries.clear()
        self._networks.clear()
        self._domains.clear()

    def extract_targets(self, command: str) -> Set[str]:
        """Extract IPs, domains, and hostnames targeted by the command."""
        targets: Set[str] = set()
        if not command:
            return targets

        # 1. Full URLs: http://example.com:8080/path
        urls = re.findall(r"https?://([a-zA-Z0-9.-]+)", command)
        for u in urls:
            u_clean = u.strip().lower()
            if u_clean:
                targets.add(u_clean)

        # 2. IPv4 addresses
        ipv4_matches = re.findall(
            r"\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b",
            command,
        )
        for ip_str in ipv4_matches:
            try:
                ip = ipaddress.IPv4Address(ip_str)
                # Ignore loopback / multicast / broadcast unless relevant
                targets.add(str(ip))
            except ValueError:
                pass

        # 3. Target flags: -h <host>, --host <host>, -u <url>, -t <target>
        flag_matches = re.findall(r"(?:-h|--host|-u|--url|-t|--target)\s+([^\s]+)", command)
        for fm in flag_matches:
            cleaned = fm.strip().lower()
            cleaned = re.sub(r"^https?://", "", cleaned)
            cleaned = re.sub(r":\d+.*$", "", cleaned)
            cleaned = cleaned.split("/")[0]
            if cleaned and not cleaned.startswith("-") and not cleaned.startswith("$"):
                targets.add(cleaned)

        return targets

    def is_target_allowed(self, target: str) -> bool:
        """Check if a specific IP or domain is within authorized scope."""
        if not self._scope_entries:
            # If no scope defined: allowed unless strict mode is enabled
            return not self._strict_mode

        clean = target.strip().lower()
        if not clean:
            return True

        # Check loopback
        if clean in ("127.0.0.1", "localhost", "::1"):
            if self._allow_localhost:
                return True
            # Allowed only if specifically in scope
            return any(clean in entry for entry in self._scope_entries)

        # 1. Check IP against networks
        try:
            ip = ipaddress.ip_address(clean)
            for net in self._networks:
                if ip in net:
                    return True
            return False
        except ValueError:
            pass

        # 2. Check domain against allowed domains / wildcards
        for d in self._domains:
            if d.startswith("*."):
                suffix = d[2:]
                if clean == suffix or clean.endswith("." + suffix):
                    return True
            elif clean == d:
                return True

        return False

    def check_command(
        self,
        command: str,
        custom_scope: Optional[str | List[str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Verify command targets against scope.

        Returns:
            (is_allowed: bool, violation_reason: Optional[str])
        """
        if not self._enabled:
            return True, None

        # Temporarily use custom scope if provided
        if custom_scope:
            active_guard = ScopeGuard(default_scope=custom_scope)
            return active_guard.check_command(command)

        # If no scope is defined at all
        if not self._scope_entries:
            if self._strict_mode:
                # Offensive tools must have an explicit target defined
                targets = self.extract_targets(command)
                if targets:
                    return False, f"Strict Scope Mode enabled, but no target scope is configured. Extracted targets: {targets}"
            return True, None

        targets = self.extract_targets(command)
        if not targets:
            # Local file manipulation, shell builtins (ls, cat, whoami, etc.)
            return True, None

        # Check all extracted network destinations
        violations = []
        for t in targets:
            if not self.is_target_allowed(t):
                violations.append(t)

        if violations:
            allowed_desc = ", ".join(self._scope_entries)
            violation_str = ", ".join(violations)
            reason = (
                f"[SCOPE_GUARD_BLOCKED] Target(s) '{violation_str}' are OUTSIDE the authorized scope ({allowed_desc}). "
                f"Execution was aborted to prevent unauthorized scanning/attacks."
            )
            logger.warning(reason)
            return False, reason

        return True, None


# Global singleton instance
scope_guard = ScopeGuard()

