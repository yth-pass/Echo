# ADR 001: Shared Skill Plus Style Overlay

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-10 |

## Context

Each Echo user needs a personalized speaking style. Copying a full agent skill directory per user (scripts, evals, install.sh) is expensive and hard to upgrade platform-wide.

## Decision

- Maintain **one** shared skill base: `shared-agent/` (SKILL.md, references, scripts, evals).
- Per user store **only** `users/{id}/style.md` for voice (tone, vocabulary, few-shots).
- Style must **not** contain factual memory.

## Consequences

- Platform upgrades change one shared base.
- Per-user storage is O(1) small file per user.
- Composer merges L1 (skill) + L2 (style) every turn.
- Implementation: see [echo-mapping.md](../echo-mapping.md) — dual-write with `persona_prompts` during migration.

## Related

- [adr/002-observer-relative-social-memory.md](./002-observer-relative-social-memory.md)
- [prompt-layers.md](../prompt-layers.md)
