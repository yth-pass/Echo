# ADR 003: Promote Pipeline 2 to 1

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-10 |

## Context

Inferences and opinions about other Agents must not be treated as objective facts. Implicit statements should live in ② until the other Agent explicitly confirms.

## Decision

- **② preferences** hold opinions and `implicit_inferred` items (status `candidate` or `active`).
- **① objective_facts** hold explicit verifiable statements only.
- PromoteCheck: when other Agent makes an explicit accurate statement matching a ② candidate:
  1. Append to ①.
  2. Mark ② as `promoted_to_objective` (keep audit link via `promoted_to` / `source.promoted_from`).
- Do **not** copy ② to ① without removing/ marking ② — no duplicate active representations.
- On contradiction, mark ② `contradicted`; do not write ①.

## Consequences

- Prompt injection tags ① as confirmed, ② inferred with confidence.
- trust_confirm / trust_break affection events tie to promote/contradict.
- Promote runs on topic close and after relevant turns (async).

## Related

- [memory-lifecycle.md](../memory-lifecycle.md)
- [schemas/preference.schema.json](../schemas/preference.schema.json)
