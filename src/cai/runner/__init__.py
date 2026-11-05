"""CAI Reverse Runner Module.

Enables secure, zero-inbound command execution on isolated Kali Linux VMs (VMware / VirtualBox)
via outbound reverse connections to the CAI controller.
"""

from .manager import runner_manager, RunnerManager

__all__ = ["runner_manager", "RunnerManager"]

