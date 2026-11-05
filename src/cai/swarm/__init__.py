"""Multi-Agent Red Team Swarm Package for CAI."""

from .specialists import (
    recon_specialist,
    web_exploiter,
    infra_specialist,
    report_analyst,
)
from .orchestrator import swarm_orchestrator, agent as red_team_lead
from .coordinator import SwarmCoordinator

__all__ = [
    "recon_specialist",
    "web_exploiter",
    "infra_specialist",
    "report_analyst",
    "swarm_orchestrator",
    "red_team_lead",
    "SwarmCoordinator",
]

