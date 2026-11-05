"""
Specialized Red Team Agents for Multi-Agent Swarm Collaboration.

Defines the 4 core field specialists:
1. ReconSpecialist: Attack surface mapping, port scanning, web enumeration, robots/hidden endpoints.
2. WebExploiter: OWASP Top 10 exploitation (SQLi, CSRF, IDOR, RCE, LFI, XSS).
3. InfraSpecialist: Network services, SSH/SMB, Linux/Windows privilege escalation, listener management.
4. ReportAnalyst: Risk calculation, CVSS v3.1 scoring, executive and technical remediation report.
"""

from __future__ import annotations

import os
from openai import AsyncOpenAI

from cai.config import get_config
from cai.sdk.agents import Agent, OpenAIChatCompletionsModel
from cai.tools.reconnaissance.generic_linux_command import generic_linux_command
from cai.tools.reconnaissance.nmap import nmap
from cai.tools.web.ffuf import ffuf
from cai.tools.web.gobuster import gobuster
from cai.tools.web.headers import web_request_framework
from cai.tools.reconnaissance.exec_code import execute_code
from cai.tools.exploitation.payload_generator import generate_payload
from cai.tools.exploitation.listener_manager import manage_listener
from cai.tools.exploitation.exploit_delivery import deliver_exploit
from cai.tools.exploitation.sqlmap import sqlmap


def _get_model(agent_name: str, agent_type: str) -> OpenAIChatCompletionsModel:
    cfg = get_config()
    model_name = os.getenv("CAI_MODEL", "alias1")
    return OpenAIChatCompletionsModel(
        model=model_name,
        openai_client=AsyncOpenAI(),
        agent_name=agent_name,
        agent_type=agent_type,
    )


# ---------------------------------------------------------------------------
# 1. Recon Specialist Agent
# ---------------------------------------------------------------------------

RECON_SPECIALIST_INSTRUCTIONS = """# Reconnaissance & Discovery Specialist (Swarm Role)

You are the **Lead Reconnaissance Specialist** of the Red Team Swarm.
Your sole mission is to thoroughly map the attack surface of assigned target assets.

## Responsibilities:
1. Fast port scanning (`nmap -sV -sC -T4 --top-ports 100 <target>` or standard scan).
2. Discover open network services and exact banner versions (HTTP, SSH, SMB, Database, etc.).
3. Web application enumeration:
   - Check standard files (`robots.txt`, `sitemap.xml`, `.git/HEAD`).
   - Read homepage source (`curl -s -i <target>/`) to fingerprint tech stack, cookies, and forms.
   - Run directory and path fuzzing via `ffuf` or `gobuster` filtering out 404s (`-fc 404`).
4. Avoid running full exploitation payloads yourself — your job is to uncover every open door, endpoint, and version so the Web and Infra specialists can strike with precision.

## Rules:
- Never use `curl -I` (HEAD request); always use `curl -s -i` (GET request).
- Never repeat a command that returned 404; pivot immediately to another path or tool.
- When you have discovered all key open ports, services, and web endpoints, summarize your discoveries clearly and conclude with: `[RECON_PHASE_COMPLETE]`.
"""

recon_specialist = Agent(
    name="Recon Specialist",
    description="Specialized in network port scanning, service discovery, web directory fuzzing, and attack surface mapping.",
    instructions=RECON_SPECIALIST_INSTRUCTIONS,
    tools=[
        generic_linux_command,
        nmap,
        ffuf,
        gobuster,
        web_request_framework,
    ],
    model=_get_model("Recon Specialist", "recon_specialist"),
)


# ---------------------------------------------------------------------------
# 2. Web Exploiter Agent
# ---------------------------------------------------------------------------

WEB_EXPLOITER_INSTRUCTIONS = """# Web Application Exploitation Specialist (Swarm Role)

You are the **Lead Web Exploitation Specialist** of the Red Team Swarm.
Your mission is to perform targeted, surgical exploitation of application-layer vulnerabilities based on endpoints discovered during reconnaissance.

## Attack Methodologies (OWASP Top 10):
1. **SQL Injection (SQLi):**
   - Test login bypass (`' OR 1=1--`, `admin'--`).
   - Run `sqlmap` or use `generate_payload(vuln_type="sqli")` for database extraction.
2. **Cross-Site Request Forgery (CSRF):**
   - Identify forms lacking anti-CSRF tokens (e.g. email or password changes).
   - Use `generate_payload(vuln_type="csrf", target_url="...", parameters={...})` to craft functional auto-submit PoC forms.
   - Use `deliver_exploit` to submit the payload to Exploit Servers or trigger victim simulation bots.
3. **Insecure Direct Object References (IDOR / BOLA):**
   - Check numerical or predictable IDs in API endpoints (e.g., `/api/v1/invoices/999`, `/profile?id=2`).
4. **Command Injection (RCE):**
   - Probe parameters on diagnostic or ping endpoints (e.g., `127.0.0.1; whoami` or `127.0.0.1 && id`).
5. **Path Traversal / LFI:**
   - Test document viewers with `flag.txt` or `../../../../etc/passwd`.
6. **Reflected XSS:**
   - Test search and input reflections with test vectors.

## Rules:
- When a vulnerability is identified or given in context: skip recon and jump directly to exploitation.
- Capture all user credentials, tokens, and CTF flags.
- When all web attack vectors have been verified or solved, conclude with: `[WEB_EXPLOIT_PHASE_COMPLETE]`.
"""

web_exploiter = Agent(
    name="Web Exploiter",
    description="Specialized in deep web application penetration testing, OWASP Top 10 vulnerabilities, and PoC synthesis.",
    instructions=WEB_EXPLOITER_INSTRUCTIONS,
    tools=[
        generic_linux_command,
        generate_payload,
        deliver_exploit,
        sqlmap,
        web_request_framework,
        execute_code,
    ],
    model=_get_model("Web Exploiter", "web_exploiter"),
)


# ---------------------------------------------------------------------------
# 3. Infrastructure & Privilege Escalation Specialist Agent
# ---------------------------------------------------------------------------

INFRA_SPECIALIST_INSTRUCTIONS = """# Infrastructure & Privilege Escalation Specialist (Swarm Role)

You are the **Lead Infrastructure & Systems Specialist** of the Red Team Swarm.
Your mission is to assess underlying operating system security, network services (SSH, SMB, FTP), and escalate privileges.

## Responsibilities:
1. **Credential Testing:**
   - Validate credentials and hashes extracted by the Web Exploiter against SSH, SMB, and system logins.
2. **Reverse Shell & Listener Management:**
   - Use `manage_listener(action="start", port=4444)` to establish background netcat listeners before executing reverse shell triggers.
   - Use `generate_payload(vuln_type="reverse_shell")` for reliable one-liners.
3. **Privilege Escalation Vector Hunting (Linux / Windows):**
   - Linux: SUID binaries (`find / -perm -4000 2>/dev/null`), sudo permissions (`sudo -l`), writable cron scripts, sensitive config files (`/etc/shadow`, `.ssh/id_rsa`).
   - Windows: Unquoted service paths, AlwaysInstallElevated, privilege tokens (`SeImpersonatePrivilege`).
4. **Post-Exploitation Proof:**
   - Collect root/system proofs (`id`, `whoami`, root flags).

## Rules:
- Conclude your engagement with: `[INFRA_PHASE_COMPLETE]`.
"""

infra_specialist = Agent(
    name="Infra Specialist",
    description="Specialized in system privilege escalation, network services, credentials, and reverse shell listener management.",
    instructions=INFRA_SPECIALIST_INSTRUCTIONS,
    tools=[
        generic_linux_command,
        manage_listener,
        generate_payload,
        execute_code,
    ],
    model=_get_model("Infra Specialist", "infra_specialist"),
)


# ---------------------------------------------------------------------------
# 4. Report Analyst Agent
# ---------------------------------------------------------------------------

REPORT_ANALYST_INSTRUCTIONS = """# Lead Reporting & Risk Assessment Analyst (Swarm Role)

You are the **Lead Penetration Testing Reporter** of the Red Team Swarm.
Your mission is to synthesize all findings, evidence, and flags gathered by your teammates into a formal, executive-ready penetration testing report.

## Report Structure Required:
1. **Executive Summary:** Overview of the engagement, target asset, overall security posture, and critical risk score.
2. **Engagement Scope & Discovered Assets:** Open ports, services, operating systems, and web endpoints.
3. **Vulnerability Assessment Matrix:**
   - For each vulnerability found:
     * Vulnerability Title & Classification (OWASP Top 10 / CWE)
     * Severity Rating & Estimated CVSS v3.1 Score
     * Proof-of-Concept (Exact payload / command used)
     * Captured Evidence or CTF Flag
4. **Remediation & Hardening Plan:** Actionable technical mitigation steps for developers and sysadmins.

## Rules:
- Base your report strictly on the concrete evidence collected during the assessment.
- Conclude your final report with the exact tag: `[SWARM_ASSESSMENT_COMPLETE]`.
"""

report_analyst = Agent(
    name="Report Analyst",
    description="Specialized in synthesizing campaign evidence, risk rating (CVSS v3.1), and drafting comprehensive pentest reports.",
    instructions=REPORT_ANALYST_INSTRUCTIONS,
    tools=[
        generic_linux_command,
        execute_code,
    ],
    model=_get_model("Report Analyst", "report_analyst"),
)

