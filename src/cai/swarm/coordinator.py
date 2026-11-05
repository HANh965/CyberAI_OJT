"""
Swarm Execution Coordinator.

Provides end-to-end automated orchestration across the 4 specialized agents:
1. ReconSpecialist -> 2. WebExploiter -> 3. InfraSpecialist -> 4. ReportAnalyst
Synchronizing intelligence across all phases through the shared SQLite Campaign Memory.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from cai.memory import campaign_memory
from cai.sdk.agents import Runner
from cai.sdk.agents.items import RunItem

from .orchestrator import swarm_orchestrator
from .specialists import (
    infra_specialist,
    recon_specialist,
    report_analyst,
    web_exploiter,
)

logger = logging.getLogger("cai.swarm.coordinator")


class SwarmCoordinator:
    """Manages multi-phase sequential or adaptive swarm engagements."""

    def __init__(self, target: str, session_id: Optional[str] = None):
        self.target = target
        self.session_id = session_id or f"swarm_{int(time.time())}"
        self.phase = "init"
        self.findings_count = 0
        self.logs: List[Dict[str, Any]] = []

    async def execute_phase(
        self,
        agent: Any,
        phase_name: str,
        prompt: str,
        max_turns: int = 10,
        stream_callback: Optional[Callable[[str], None]] = None,
    ) -> str:
        """Run a single specialist agent for a specific phase."""
        self.phase = phase_name
        logger.info(f"[SwarmCoordinator] Starting Phase: {phase_name.upper()} with {agent.name}")

        prefix = f"\n=== [SWARM PHASE: {phase_name.upper()} · {agent.name.upper()}] ===\n"
        if stream_callback:
            stream_callback(prefix)

        try:
            # Inject memory context into prompt
            mem_ctx = campaign_memory.build_context_for_target(self.target)
            full_prompt = (
                f"{prompt}\n\n"
                f"🎯 Target Asset: {self.target}\n"
                f"📊 Current Shared Knowledge:\n{mem_ctx or 'No prior assets recorded.'}\n"
            )

            result = await Runner.run(
                agent,
                input=full_prompt,
                max_turns=max_turns,
            )

            final_text = getattr(result, "final_output", "") or str(result)
            return final_text
        except Exception as e:
            logger.error(f"Error in swarm phase {phase_name}: {e}")
            return f"[ERROR in {phase_name}]: {str(e)}"

    async def run_full_swarm_assessment(
        self,
        max_total_turns: int = 35,
        stream_callback: Optional[Callable[[str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an end-to-end coordinated assessment through all 4 specialists.
        """
        start_time = time.time()
        results: Dict[str, Any] = {
            "session_id": self.session_id,
            "target": self.target,
            "phases_executed": [],
            "reports": {},
        }

        # ------------------------------------------------------------------
        # Phase 1: Reconnaissance
        # ------------------------------------------------------------------
        recon_prompt = (
            f"Thực hiện trinh sát toàn diện trên mục tiêu `{self.target}`. "
            f"Quét các cổng dịch vụ chính, kiểm tra tiêu đề HTTP, file robots.txt, và dò tìm các thư mục/endpoint web ẩn. "
            f"Không chạy exploit phức tạp. Tổng hợp bề mặt tấn công khi hoàn tất."
        )
        recon_output = await self.execute_phase(
            agent=recon_specialist,
            phase_name="recon",
            prompt=recon_prompt,
            max_turns=min(8, max_total_turns // 4),
            stream_callback=stream_callback,
        )
        results["phases_executed"].append("recon")
        results["reports"]["recon"] = recon_output

        # Check what was discovered
        summary = campaign_memory.get_summary(target=self.target)
        stats = summary.get("stats", {})

        # ------------------------------------------------------------------
        # Phase 2: Web Application Exploitation
        # ------------------------------------------------------------------
        has_web = (
            any("80" in p or "443" in p or "8080" in p or "8888" in p or "http" in p for p in summary.get("ports", []))
            or self.target.startswith("http")
            or stats.get("endpoints", 0) > 0
        )

        if has_web:
            web_prompt = (
                f"Tiến hành kiểm thử và khai thác sâu các lỗ hổng ứng dụng web trên `{self.target}`. "
                f"Tập trung kiểm tra các lỗ hổng OWASP Top 10: SQL Injection (form login, search), "
                f"CSRF (kiểm tra token form đổi email, sinh PoC và nộp qua exploit server), "
                f"IDOR (thay đổi ID trên API hóa đơn), Command Injection trên các công cụ chẩn đoán ping, "
                f"Path Traversal (file viewer), và Reflected XSS. Chiếm lấy toàn bộ CTF Flags và tài khoản."
            )
            web_output = await self.execute_phase(
                agent=web_exploiter,
                phase_name="web_exploit",
                prompt=web_prompt,
                max_turns=min(15, max_total_turns // 2),
                stream_callback=stream_callback,
            )
            results["phases_executed"].append("web_exploit")
            results["reports"]["web_exploit"] = web_output

        # ------------------------------------------------------------------
        # Phase 3: Infrastructure & PrivEsc
        # ------------------------------------------------------------------
        has_creds_or_shell = stats.get("credentials", 0) > 0 or "FLAG{" in str(results["reports"])

        infra_prompt = (
            f"Đánh giá an ninh hạ tầng và leo thang đặc quyền trên `{self.target}`. "
            f"Nếu có reverse shell hoặc công cụ ping/RCE: mở listener `nc -lvnp 4444` và bắt shell. "
            f"Kiểm tra quyền hạn hệ thống, các file SUID, sudoers, và các thông tin bí mật của máy chủ."
        )
        infra_output = await self.execute_phase(
            agent=infra_specialist,
            phase_name="infra",
            prompt=infra_prompt,
            max_turns=min(6, max_total_turns // 4),
            stream_callback=stream_callback,
        )
        results["phases_executed"].append("infra")
        results["reports"]["infra"] = infra_output

        # ------------------------------------------------------------------
        # Phase 4: Formal Reporting
        # ------------------------------------------------------------------
        report_prompt = (
            f"Tổng hợp toàn bộ các phát hiện, cổng mở, lỗ hổng, tài khoản chiếm được và CTF Flags từ bộ nhớ chiến dịch. "
            f"Viết báo cáo đánh giá an ninh mạng toàn diện cho `{self.target}` theo cấu trúc chuyên nghiệp: "
            f"Executive Summary, Ma trận lỗ hổng (kèm điểm CVSS v3.1 và PoC cụ thể), và Kế hoạch khắc phục lỗ hổng."
        )
        report_output = await self.execute_phase(
            agent=report_analyst,
            phase_name="report",
            prompt=report_prompt,
            max_turns=4,
            stream_callback=stream_callback,
        )
        results["phases_executed"].append("report")
        results["reports"]["final_report"] = report_output

        duration = time.time() - start_time
        results["duration_seconds"] = duration
        logger.info(f"[SwarmCoordinator] Full Swarm Assessment completed in {duration:.1f}s")
        return results

