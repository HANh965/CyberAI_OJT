"""
Here are the nmap tools.
"""

from cai.tools.common import run_command  # pylint: disable=E0401
from cai.sdk.agents import function_tool


@function_tool
def nmap(target: str = "localhost", args: str = "", ctf=None) -> str:
    """
    A simple nmap tool to scan a specified target.

    Args:
        target: The target host or IP address to scan (e.g., "localhost")
        args: Additional arguments to pass to the nmap command (e.g., "-p 8080", "-sV")

    Returns:
        str: The output of running the nmap command
    """
    # Clean target if LLM passed URL or host:port
    clean_target = target.strip() if target else "localhost"
    if "://" in clean_target:
        clean_target = clean_target.split("://", 1)[1]
    clean_target = clean_target.split("/", 1)[0].split(":", 1)[0]
    if not clean_target:
        clean_target = "localhost"

    command = f"nmap {args} {clean_target}".strip()
    return run_command(command, ctf=ctf, stream=True)


# --- Auto-register with ToolRegistry ---
from cai.tool_registry import TOOL_REGISTRY  # noqa: E402
TOOL_REGISTRY.register("nmap", nmap, categories=['recon', 'network'])
