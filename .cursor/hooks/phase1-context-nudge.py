#!/usr/bin/env python3
"""postToolUse hook: Phase 1 demo + deployment reminders for echo/, services/, infra/, apps/, roadmap docs."""

from __future__ import annotations

import json
import re
import sys
from pathlib import PurePosixPath

ROADMAP_EN = "docs/Phase1-Demo-Roadmap-Echo.md"
ROADMAP_CN = "docs_CN/Phase1-Demo-Roadmap-Echo.md"

ECHO_SUFFIXES = {".tsx", ".ts", ".css", ".html", ".md", ".json", ".svg", ".png", ".ico"}
SKIP_PARTS = {"node_modules", "dist", ".git"}


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


def _has_skip_segment(parts: tuple[str, ...]) -> bool:
    return any(p in SKIP_PARTS for p in parts)


def _classify_path(path: str) -> str | None:
    p = PurePosixPath(path)
    parts = p.parts
    if not parts or _has_skip_segment(parts):
        return None

    if parts[0] == "echo":
        if len(parts) < 2:
            return None
        name = p.name
        suffix = p.suffix.lower()
        if suffix in ECHO_SUFFIXES:
            return "echo"
        if name == ".env.example" or name.startswith(".env"):
            return "echo"
        return None

    if parts[0] in ("services", "infra", "apps"):
        return "platform"

    if parts[0] == "docs" and p.name == "Phase1-Demo-Roadmap-Echo.md":
        return "roadmap_en"

    if parts[0] == "docs_CN" and p.name == "Phase1-Demo-Roadmap-Echo.md":
        return "roadmap_cn"

    return None


def _message_for(kind: str, path: str) -> str:
    skill = "echo-deployment-boundaries"
    roadmap = f"{ROADMAP_EN} and {ROADMAP_CN}"
    deploy = "docs/Deployment-and-Component-Boundaries-Echo.md"

    if kind == "echo":
        return (
            f"echo/ file written: {path}. "
            f"Apply skill {skill}. "
            f"Read {roadmap} before claiming a feature done. "
            "Demo goal: real API via VITE_API_BASE_URL; mock is fallback only. "
            f"Do not put API/Worker/Postgres/Redis into echo/ as production topology. "
            f"See {deploy}."
        )
    if kind == "platform":
        prefix = PurePosixPath(path).parts[0]
        return (
            f"{prefix}/ file written: {path}. "
            f"Apply skill {skill}. "
            f"Update status for the matching P1-xx row in {roadmap}. "
            f"Follow {deploy} (API vs Worker vs infra). "
            "One feature at a time."
        )
    if kind == "roadmap_en":
        return (
            f"Roadmap written: {path}. "
            "Sync docs_CN/Phase1-Demo-Roadmap-Echo.md (docs-cn-mirror skill). "
            "Keep P1-xx IDs and API paths unchanged; translate prose only."
        )
    if kind == "roadmap_cn":
        return (
            f"Roadmap mirror written: {path}. "
            "Ensure it matches docs/Phase1-Demo-Roadmap-Echo.md structure and P1-xx rows."
        )
    return ""


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return 0
        payload = json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return 0

    written = _extract_written_path(payload)
    if not written:
        return 0

    kind = _classify_path(written)
    if not kind:
        return 0

    message = _message_for(kind, written)
    if not message:
        return 0

    sys.stdout.write(json.dumps({"additional_context": message}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
