#!/usr/bin/env python3
"""postToolUse (Shell): after git commit, remind to push via SSH workflow."""

from __future__ import annotations

import json
import re
import sys


def _extract_command(payload: dict) -> str:
    for key in ("command", "shell_command", "cmd"):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        val = tool_input.get("command")
        if isinstance(val, str) and val.strip():
            return val.strip()
    arguments = payload.get("arguments")
    if isinstance(arguments, dict):
        val = arguments.get("command")
        if isinstance(val, str) and val.strip():
            return val.strip()
    elif isinstance(arguments, str):
        match = re.search(r'"command"\s*:\s*"([^"]*)"', arguments)
        if match:
            return match.group(1)
    return ""


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0
        payload = json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return 0

    command = _extract_command(payload)
    if not command or not re.search(r"\bgit\s+commit\b", command, re.IGNORECASE):
        return 0

    message = (
        "git commit completed. To upload to GitHub, apply skill **git-push-github-ssh**: "
        "`ssh -T git@github.com` then "
        "`git remote set-url origin git@github.com:yth-pass/Echo.git` then "
        "`git push origin main`, or run `.cursor\\scripts\\git-push-echo.cmd` from repo root. "
        "Use CMD, not Git Bash."
    )
    sys.stdout.write(json.dumps({"additional_context": message}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
