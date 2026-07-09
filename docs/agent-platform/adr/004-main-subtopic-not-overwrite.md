# ADR 004: Main-Subtopic Not Overwrite

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-10 |

## Context

Human conversations have a main thread and temporary digressions (e.g. homework progress → complain about teacher → return to homework). Replacing the entire topic file on any subject change loses the main thread.

## Decision

- `current_topic.json` contains persistent **main_topic** plus optional **active_subtopic**.
- TopicJudge transitions:
  - `new_sub` / `continue_sub` / `return_to_main` / `continue_main` — main topic retained.
  - **`new_main` only** — archive full bundle to `topic_history.jsonl` and reset file.
- `return_to_main` moves closed sub to `subtopic_history`; does not archive main.
- Summary fields ≤ 150 characters.

## Consequences

- Composer injects main + active sub + closed sub list.
- SocialExtract runs on sub close and on new_main archive.
- MVP: one active sub at a time; nested stack optional in V2.

## Related

- [topic-state-machine.md](../topic-state-machine.md)
- [schemas/current_topic.schema.json](../schemas/current_topic.schema.json)
