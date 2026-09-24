"""
ffuf (Fast Web Fuzzer) tool for web fuzzing and discovery.
"""

import os
import re
from cai.tools.common import run_command
from cai.sdk.agents import function_tool

DEFAULT_WORDLIST = os.path.expanduser(r"~\wordlists\common.txt")

@function_tool
def ffuf(args: str, target_url: str = "", ctf=None) -> str:
    """
    Fast web fuzzer (ffuf) to discover hidden files, directories, vhosts, or fuzz HTTP parameters.

    Args:
        args: Command-line arguments for ffuf (e.g., "-w wordlist.txt -u http://example.com/FUZZ -mc 200,301")
        target_url: Optional base target URL if not already in args

    Returns:
        str: The output from ffuf execution
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

    if target_url and "-u " not in args and " -u" not in args:
        command = f'ffuf {args} -u {target_url}'
    else:
        command = f'ffuf {args}'
    return run_command(command, ctf=ctf)
