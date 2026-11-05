"""CAI Built-in Mock Vulnerable Lab."""

from .app import app, create_mock_lab_app, CHALLENGE_FLAGS, SOLVED_FLAGS
from .server import mock_lab_manager, MockLabManager, run_mock_lab_server

__all__ = [
    "app",
    "create_mock_lab_app",
    "mock_lab_manager",
    "MockLabManager",
    "run_mock_lab_server",
    "CHALLENGE_FLAGS",
    "SOLVED_FLAGS",
]

