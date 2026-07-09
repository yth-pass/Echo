# ADR 002: Observer-Relative Social Memory

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-10 |

## Context

When clone A chats with clone B, A may learn facts about B. Storing these as B's official profile would conflate hearsay with self-reported truth and break privacy.

## Decision

- Social memory paths include **observer_id**: `memory/users/{observer}/social/by_agent/{other}/`.
- After a joint session, run extraction **twice** (A's perspective, B's perspective).
- A's ①② about B does not automatically appear in B's memory unless B confirms (promote into B's own store separately).

## Consequences

- Retrieval for A's reply when talking to B reads A's social store about B.
- share_policy controls whether A's Agent may repeat items to B.
- Third-party facts stated by B (e.g. "cousin in Shanghai") live in observer A's ① with `fact_scope=about_third_party`, `subject_agent_id=B`.

## Related

- [memory-lifecycle.md](../memory-lifecycle.md)
- [adr/003-promote-pipeline-2-to-1.md](./003-promote-pipeline-2-to-1.md)
