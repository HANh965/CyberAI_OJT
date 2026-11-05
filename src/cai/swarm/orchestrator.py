"""
Lead Orchestrator (Commander) for the Red Team Swarm.

Coordinates the specialized agents, manages strategic phase transitions,
inspects real-time campaign memory from SQLite, and drives end-to-end
autonomous security assessments.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

from openai import AsyncOpenAI

from cai.config import get_config
from cai.memory import campaign_memory
from cai.sdk.agents import Agent, OpenAIChatCompletionsModel, function_tool
from cai.sdk.agents.handoffs import handoff
from cai.tools.reconnaissance.generic_linux_command import generic_linux_command

from .specialists import (
    infra_specialist,
    recon_specialist,
    report_analyst,
    web_exploiter,
)

logger = logging.getLogger("cai.swarm.orchestrator")


# ---------------------------------------------------------------------------
# Swarm Commander Coordination Tools
# ---------------------------------------------------------------------------

@function_tool
def query_campaign_memory(target: str = "") -> str:
    """
    Query the shared SQLite Campaign Memory Store to inspect all assets, open ports,
    web endpoints, credentials, and findings discovered so far by the swarm.

    Args:
        target: Optional target filter (e.g. 'http://127.0.0.1:8888').

    Returns:
        str: Formatted Markdown summary of all discovered knowledge.
    """
    summary = campaign_memory.get_summary(target=target)
    stats = summary.get("stats", {})
    context = campaign_memory.build_context_for_target(target=target)

    lines = [
        "=== [SHARED CAMPAIGN MEMORY (SQLITE)] ===",
        f"Hosts: {stats.get('hosts', 0)} | Open Ports: {stats.get('ports', 0)} | "
        f"Endpoints: {stats.get('endpoints', 0)} | Credentials/Flags: {stats.get('credentials', 0)} | "
        f"Findings: {stats.get('findings', 0)}",
        "----------------------------------------",
        context or "No assets or findings recorded yet.",
        "========================================",
    ]
    return "\n".join(lines)


@function_tool
def log_swarm_finding(
    title: str,
    severity: str = "HIGH",
    description: str = "",
    target: str = "",
    cve: str = "",
    evidence: str = "",
) -> str:
    """
    Record a confirmed vulnerability or key finding into the shared SQLite campaign memory.

    Args:
        title: Title of finding (e.g. 'SQL Injection Auth Bypass').
        severity: Severity rating ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO').
        description: Technical details and reproduction steps.
        target: Target asset URL or IP.
        cve: Associated CVE ID if applicable.
        evidence: Proof-of-concept payload or captured Flag.

    Returns:
        str: Confirmation message.
    """
    campaign_memory.upsert_finding(
        host=target,
        title=title,
        severity=severity.upper(),
        evidence=evidence or description,
        source_tool="swarm",
    )
    # Automatically extract and store flags into credentials table
    import re as _re
    flag_match = _re.search(r"FLAG\{[^\}]+\}", evidence or description)
    if flag_match:
        campaign_memory.upsert_credential(
            host=target,
            secret_type="flag",
            secret=flag_match.group(0),
        )
    return f"[SUCCESS] Finding logged into Campaign Memory: [{severity.upper()}] {title}"


# ---------------------------------------------------------------------------
# Swarm Handoff Definitions
# ---------------------------------------------------------------------------

handoff_to_recon = handoff(
    agent=recon_specialist,
    tool_description_override="Delegate reconnaissance phase to Recon Specialist for port scanning, network services, and web directory mapping.",
)

handoff_to_web = handoff(
    agent=web_exploiter,
    tool_description_override="Delegate web application exploitation phase to Web Exploiter for OWASP Top 10 vulnerabilities (SQLi, CSRF, IDOR, RCE, LFI, XSS).",
)

handoff_to_infra = handoff(
    agent=infra_specialist,
    tool_description_override="Delegate infrastructure & privilege escalation phase to Infra Specialist for SSH/SMB credential spraying, SUID/sudo privesc, and reverse shells.",
)

handoff_to_reporter = handoff(
    agent=report_analyst,
    tool_description_override="Delegate reporting phase to Report Analyst to synthesize all memory findings, calculate CVSS scores, and draft the final executive report.",
)


SWARM_ORCHESTRATOR_INSTRUCTIONS = """# Red Team Swarm Commander (Lead Orchestrator)

You are the **Supreme Commander** of the Red Team Swarm, leading a coordinated squad of elite cybersecurity specialists:
- **Recon Specialist:** Port scanning, service identification, and web directory fuzzing.
- **Web Exploiter:** Application-layer attacks (SQLi, CSRF, IDOR, Command Injection, LFI, XSS).
- **Infra Specialist:** Network services, SSH/SMB, system privilege escalation, and listener handling.
- **Report Analyst:** Evidence consolidation, CVSS v3.1 calculation, and executive reporting.

## Mission Workflow:
1. **Perceive & Strategize:** Inspect the assigned target. Call `query_campaign_memory` to check what data is already known.
2. **Phase 1 (Reconnaissance):** Delegate to `Recon Specialist` to map all open ports, services, and web directories.
3. **Phase 2 (Targeted Exploitation):**
   - If web services are present (e.g. port 80, 443, 8080, 8888): Delegate to `Web Exploiter` to test application flaws and capture web flags.
   - If network logins or shell triggers are present: Delegate to `Infra Specialist` to escalate privileges.
4. **Phase 3 (Reporting):** Once objectives or flags are captured, delegate to `Report Analyst` to generate the final pentest report.

## Rules:
- Guide and command your team using delegations and handoffs.
- Always check `query_campaign_memory` between phases to verify progress.
- Maintain offensive discipline, avoid redundant scans, and drive to full objective completion.
"""


def _get_model(agent_name: str, agent_type: str) -> OpenAIChatCompletionsModel:
    model_name = os.getenv("CAI_MODEL", "alias1")
    return OpenAIChatCompletionsModel(
        model=model_name,
        openai_client=AsyncOpenAI(),
        agent_name=agent_name,
        agent_type=agent_type,
    )


swarm_orchestrator = Agent(
    name="Red Team Lead",
    description="Supreme commander orchestrating the multi-agent Red Team Swarm (Recon, Web, Infra, Reporter).",
    instructions=SWARM_ORCHESTRATOR_INSTRUCTIONS,
    tools=[
        generic_linux_command,
        query_campaign_memory,
        log_swarm_finding,
    ],
    handoffs=[
        handoff_to_recon,
        handoff_to_web,
        handoff_to_infra,
        handoff_to_reporter,
    ],
    model=_get_model("Red Team Lead", "swarm_orchestrator"),
)

# Export standard alias
agent = swarm_orchestrator
