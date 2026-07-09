# ADR 005: Joint Session Single Topic File

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-10 |

## Context

Agent A and Agent B participate in one conversation. If each side maintains separate `current_topic.json`, TopicJudge may diverge (A thinks topic is X, B thinks Y).

## Decision

- For clone-to-clone sessions, store **one** `memory/joint_sessions/{joint_id}/current_topic.json`.
- Both workers / Composer instances read and write this file (single writer: agent-turn worker per turn).
- Social memory and affection remain **per observer** (ADR 002); only topic state is shared.

## Consequences

- TopicJudge runs once per turn in joint session.
- Private 1:1 user chat (no joint) uses `memory/users/{id}/sessions/{session_id}/current_topic.json` instead.
- `agent_sessions.metadata_json` in Echo may embed or reference this structure.

## Related

- [topic-state-machine.md](../topic-state-machine.md)
- [architecture.md](../architecture.md) § Joint agent session
