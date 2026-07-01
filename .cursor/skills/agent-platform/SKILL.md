---
name: agent-platform
description: >-
  Implement Echo Agent Platform target design: shared skill base, per-user
  style.md, layered memory, main/sub topics, social memory ①②, promote pipeline,
  affection, Prompt Composer. Use when editing services/api or services/worker
  agent-platform code, memory storage, topic state, onboarding style generation,
  or docs/agent-platform/.
---

# Echo Agent Platform

## Before coding

1. Read [docs/agent-platform/README.md](../../docs/agent-platform/README.md) index.
2. Check [echo-mapping.md](../../docs/agent-platform/echo-mapping.md) for Phase 1 vs target gaps.
3. Follow [implementation-milestones.md](../../docs/agent-platform/implementation-milestones.md) — do not skip ahead without user request.
4. Validate JSON against [docs/agent-platform/schemas/](../../docs/agent-platform/schemas/).

## Architecture invariants

| Rule | Detail |
|------|--------|
| Style vs memory | Facts only in memory jsonl / profile; voice only in `style.md` / persona |
| Shared + overlay | One `shared-agent/`; per-user only `style.md` + `memory/users/{id}/` |
| Observer-relative | Social ①② under observer path; dual extract after joint chat |
| Promote | ②→① atomic; no duplicate active fact in both |
| Topics | Only `new_main` archives full bundle; subtopics use return_to_main |
| Joint topic | One `current_topic.json` per joint_session |
| Safety | L0 safety beats style, affection, and memory injection |

## Key paths (target code)

| Area | Path |
|------|------|
| Composer | `services/worker/src/agent-platform/composer/` |
| Shared skill | `services/worker/src/agent-platform/shared/` |
| Memory API | `services/api/src/agent-platform/memory/` |
| Jobs | `services/worker/src/agent-platform/jobs/` |

## LLM modules

| Module | Doc |
|--------|-----|
| TopicJudge | [topic-state-machine.md](../../docs/agent-platform/topic-state-machine.md) |
| SocialExtract / PromoteCheck | [memory-lifecycle.md](../../docs/agent-platform/memory-lifecycle.md) |
| RelationshipExtract / AffectionApply | [affection-protocol.md](../../docs/agent-platform/affection-protocol.md) |
| Prompt layers | [prompt-layers.md](../../docs/agent-platform/prompt-layers.md) |

## Phase 1 coexistence

Do not break existing `agent-turn` loop or `persona_prompts` without migration plan in [echo-mapping.md](../../docs/agent-platform/echo-mapping.md).

## ADRs

- [adr/001-shared-skill-plus-style-overlay.md](../../docs/agent-platform/adr/001-shared-skill-plus-style-overlay.md)
- [adr/002-observer-relative-social-memory.md](../../docs/agent-platform/adr/002-observer-relative-social-memory.md)
- [adr/003-promote-pipeline-2-to-1.md](../../docs/agent-platform/adr/003-promote-pipeline-2-to-1.md)
- [adr/004-main-subtopic-not-overwrite.md](../../docs/agent-platform/adr/004-main-subtopic-not-overwrite.md)
- [adr/005-joint-session-single-topic-file.md](../../docs/agent-platform/adr/005-joint-session-single-topic-file.md)

## Docs mirror

When editing `docs/agent-platform/`, apply skill **docs-cn-mirror** for `docs_CN/agent-platform/`.
