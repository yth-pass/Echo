#!/usr/bin/env python3
"""postToolUse hook: remind agent to sync docs_CN/ when docs/ markdown is written."""

from __future__ import annotations

import json
import re
import sys
from pathlib import PurePosixPath


def _normalize_path(raw: str) -> str:
    return raw.replace("\\", "/")


def _extract_written_path(payload: dict) -> str | None:
    candidates: list[str] = []

    for key in ("file_path", "path", "filePath"):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            candidates.append(val)

    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        for key in ("path", "file_path", "filePath", "target_file"):
            val = tool_input.get(key)
            if isinstance(val, str) and val.strip():
                candidates.append(val)

    tool_result = payload.get("tool_result")
    if isinstance(tool_result, dict):
        for key in ("path", "file_path", "filePath"):
            val = tool_result.get(key)
            if isinstance(val, str) and val.strip():
                candidates.append(val)

    arguments = payload.get("arguments")
    if isinstance(arguments, dict):
        for key in ("path", "file_path", "filePath"):
            val = arguments.get(key)
            if isinstance(val, str) and val.strip():
                candidates.append(val)
    elif isinstance(arguments, str):
        match = re.search(r'"(?:path|file_path|filePath)"\s*:\s*"([^"]+)"', arguments)
        if match:
            candidates.append(match.group(1))

    for raw in candidates:
        path = _normalize_path(raw.strip())
        if path:
            return path
    return None


def _is_docs_markdown(path: str) -> bool:
    p = PurePosixPath(path)
    parts = p.parts
    if not parts or parts[0] != "docs":
        return False
    if len(parts) < 2:
        return False
    return p.suffix.lower() == ".md"


def _mirror_path(docs_path: str) -> str:
    rel = PurePosixPath(docs_path).relative_to("docs")
    return str(PurePosixPath("docs_CN") / rel)


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0
        payload = json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return 0

    written = _extract_written_path(payload)
    if not written or not _is_docs_markdown(written):
        return 0

    mirror = _mirror_path(written)
    message = (
        f"docs/ file was written: {written}. "
        f"You MUST update the Simplified Chinese mirror at {mirror} "
        f"with identical structure (translate prose only). "
        f"Follow the docs-cn-mirror skill. If the mirror is missing, create it."
    )
    sys.stdout.write(json.dumps({"additional_context": message}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
