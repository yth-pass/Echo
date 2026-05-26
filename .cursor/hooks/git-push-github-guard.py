#!/usr/bin/env python3
"""beforeShellExecution: block direct git push; use SSH workflow or git-push-echo.cmd."""

from __future__ import annotations

import json
import re
import sys


def _extract_command(payload: dict) -> str:
    for key in ("command", "shell_command", "cmd"):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except (json.JSONDecodeError, OSError):
        sys.stdout.write(json.dumps({"permission": "allow"}))
        return 0

    command = _extract_command(payload)
    if not command:
        sys.stdout.write(json.dumps({"permission": "allow"}))
        return 0

    if "git-push-echo.cmd" in command.lower():
        sys.stdout.write(json.dumps({"permission": "allow"}))
        return 0

    if not re.search(r"\bgit\s+push\b", command, re.IGNORECASE):
        sys.stdout.write(json.dumps({"permission": "allow"}))
        return 0

    msg = (
        "Blocked direct `git push`. Apply skill **git-push-github-ssh**. "
        "CMD: `cd /d C:\\Users\\天昊\\Desktop\\Echo` → `ssh -T git@github.com` "
        "(Hi ... authenticated) → "
        "`git remote set-url origin git@github.com:yth-pass/Echo.git` → "
        "`git push origin main`, or run `.cursor\\scripts\\git-push-echo.cmd`."
    )
    sys.stdout.write(
        json.dumps(
            {
                "permission": "deny",
                "user_message": "请用 SSH 推送：运行 .cursor/scripts/git-push-echo.cmd 或按 skill git-push-github-ssh 步骤操作",
                "agent_message": msg,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
