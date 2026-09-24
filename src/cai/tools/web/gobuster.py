"""
gobuster tool for directory/file, DNS, and vhost brute-forcing.
"""

import os
import re
from cai.tools.common import run_command
from cai.sdk.agents import function_tool

DEFAULT_WORDLIST = os.path.expanduser(r"~\wordlists\common.txt")

@function_tool
def gobuster(mode: str, args: str, ctf=None) -> str:
    """
    Gobuster tool to brute-force URIs (dir), DNS subdomains (dns), or virtual hosts (vhost).

    Args:
        mode: Gobuster mode: "dir", "dns", "fuzz", or "vhost"
        args: Additional arguments (e.g., "-u http://example.com -w wordlist.txt")

    Returns:
        str: The output from gobuster execution
    """
    # Fix placeholder wordlists like /path/to/wordlist or non-existent linux paths on Windows
    if os.path.isfile(DEFAULT_WORDLIST):
        m = re.search(r'-w\s+([^\s]+)', args)
        if m:
            wl = m.group(1).strip('"\'')
            if not os.path.exists(wl) or wl.startswith(("/", "/usr", "/path", "/opt")):
                args = args.replace(m.group(0), f'-w "{DEFAULT_WORDLIST}"')
        elif "-w" not in args:
            args = f'{args} -w "{DEFAULT_WORDLIST}"'

    command = f'gobuster {mode} {args}'
    return run_command(command, ctf=ctf)
