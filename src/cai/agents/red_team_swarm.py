"""Red Team Swarm Agent.

Orchestrates multi-agent swarm collaboration across Recon Specialist,
Web Exploiter, Infra Specialist, and Report Analyst.
"""

from cai.swarm.orchestrator import swarm_orchestrator

# Expose agent instances for CAI agent discovery and factory
red_team_swarm_agent = swarm_orchestrator
agent = swarm_orchestrator

