"""Unit tests for Stage 6: Multi-Agent Red Team Swarm."""

import unittest

from cai.memory import campaign_memory
from cai.swarm import (
    infra_specialist,
    recon_specialist,
    red_team_lead,
    report_analyst,
    swarm_orchestrator,
    web_exploiter,
    SwarmCoordinator,
)
from cai.swarm.orchestrator import log_swarm_finding, query_campaign_memory


class TestRedTeamSwarm(unittest.TestCase):
    def setUp(self):
        campaign_memory.clear_all()

    def test_specialists_initialization_and_roles(self):
        # 1. Recon Specialist
        self.assertEqual(recon_specialist.name, "Recon Specialist")
        recon_tool_names = [getattr(t, "name", str(t)) for t in recon_specialist.tools]
        self.assertIn("nmap", recon_tool_names)
        self.assertIn("ffuf", recon_tool_names)
        self.assertIn("generic_linux_command", recon_tool_names)

        # 2. Web Exploiter
        self.assertEqual(web_exploiter.name, "Web Exploiter")
        web_tool_names = [getattr(t, "name", str(t)) for t in web_exploiter.tools]
        self.assertIn("generate_payload", web_tool_names)
        self.assertIn("deliver_exploit", web_tool_names)
        self.assertIn("sqlmap", web_tool_names)

        # 3. Infra Specialist
        self.assertEqual(infra_specialist.name, "Infra Specialist")
        infra_tool_names = [getattr(t, "name", str(t)) for t in infra_specialist.tools]
        self.assertIn("manage_listener", infra_tool_names)
        self.assertIn("generate_payload", infra_tool_names)

        # 4. Report Analyst
        self.assertEqual(report_analyst.name, "Report Analyst")
        self.assertIn("CVSS", report_analyst.instructions)

    def test_swarm_orchestrator_handoffs_and_tools(self):
        self.assertEqual(swarm_orchestrator.name, "Red Team Lead")
        # Check handoffs
        handoff_agents = [h.agent_name for h in swarm_orchestrator.handoffs]
        self.assertIn("Recon Specialist", handoff_agents)
        self.assertIn("Web Exploiter", handoff_agents)
        self.assertIn("Infra Specialist", handoff_agents)
        self.assertIn("Report Analyst", handoff_agents)

    def test_campaign_memory_integration_tools(self):
        # Test logging a swarm finding
        res = log_swarm_finding(
            title="SQL Injection Auth Bypass",
            severity="CRITICAL",
            description="Bypassed admin login on /login",
            target="http://127.0.0.1:8888",
            evidence="FLAG{mock_sqli_auth_bypass_success}",
        )
        self.assertIn("[SUCCESS]", res)
        self.assertIn("CRITICAL", res)

        # Test querying memory
        mem_output = query_campaign_memory(target="http://127.0.0.1:8888")
        self.assertIn("SQL Injection Auth Bypass", mem_output)
        self.assertIn("CRITICAL", mem_output)
        self.assertIn("FLAG{mock_sqli_auth_bypass_success}", mem_output)

    def test_swarm_coordinator_initialization(self):
        coord = SwarmCoordinator(target="http://127.0.0.1:8888", session_id="test_session")
        self.assertEqual(coord.target, "http://127.0.0.1:8888")
        self.assertEqual(coord.session_id, "test_session")
        self.assertEqual(coord.phase, "init")


if __name__ == "__main__":
    unittest.main()

