---
name: echo-deployment-boundaries
description: >-
  Phase 1 full-function demo and deployment boundaries. Read before editing echo/,
  services/, infra/, or apps/. Enforces docs/Deployment-and-Component-Boundaries-Echo.md,
  docs/Phase1-Demo-Roadmap-Echo.md, and one-feature-at-a-time delivery.
---

# Echo — Deployment boundaries and Phase 1 demo

## When to Apply

- Any create, edit, or delete under `echo/`, `services/`, `infra/`, or `apps/`
- User asks for Phase 1 MVP, full-function local demo, or APK
- Adding API, Worker, Postgres, Redis, queues, or LLM integration

## Canonical references (read before large changes)

1. [docs/Phase1-Demo-Roadmap-Echo.md](../../../docs/Phase1-Demo-Roadmap-Echo.md) — **feature matrix** (`P1-xx`, columns **`API` | `Worker` | `Web` | `APK`**); single source for one-feature-at-a-time work
2. [docs_CN/Phase1-Demo-Roadmap-Echo.md](../../../docs_CN/Phase1-Demo-Roadmap-Echo.md) — Chinese mirror
3. [docs/Deployment-and-Component-Boundaries-Echo.md](../../../docs/Deployment-and-Component-Boundaries-Echo.md)
4. [docs_CN/Deployment-and-Component-Boundaries-Echo.md](../../../docs_CN/Deployment-and-Component-Boundaries-Echo.md)
5. [docs/Software-Architecture-Echo.md](../../../docs/Software-Architecture-Echo.md) §10 API, §15 phases

## Phase 1 demo phase (current product goal)

**Sequence:** local/staging **full-function demo** (real API + data + workers) → validate on demo → **then** APK ([`apps/android`](../../../apps/android)).

| Rule | Detail |
|------|--------|
| Demo client | [`echo/`](../../../echo/) is the **debug client** via `VITE_API_BASE_URL`; not the long-term production client (Android is). |
| Real stack | Auth, onboarding, feed, match, handoff, audit, etc. live in **`services/api`**, **`services/worker`**, **`infra/`** — not inside `echo` as a monolith. |
| Mock policy | Mock is **fallback only** when API is down. Set **`API` / `Worker` / `Web` / `APK`** = `done` only when that layer’s happy path is verified (see roadmap §4). |
| One feature | Pick one `P1-xx` row; update the relevant column(s) (`doing` → `done`) in the roadmap (sync EN + CN mirrors if prose changed). |
| APK gate | Do **not** prioritize campus/release APK until roadmap **§3.3 release gate** is met (not merely `API` = `done` on all rows). |

## Hard rules (deployment)

1. **Do not** bundle production API, Worker pool, primary Postgres, or Redis into `echo/` as one deployable without a documented **dev-only** exception in `echo/docs/`.
2. **Async work** (queues, agent turns, scheduled posts, moderation, vector jobs) belongs on **workers** and job contracts — not hidden in React components.
3. **Local data plane:** prefer `infra/docker-compose` for Postgres (+pgvector), Redis, MinIO.
4. **Online when needed:** FCM, LLM (e.g. DeepSeek), staging HTTPS API — configure via env templates; never commit secrets.

## Workflow per feature

1. Open roadmap matrix; choose next `todo` row (or user-specified `P1-xx`).
2. Implement only in paths listed in **Implementation** column.
3. Wire `echo` client to new endpoints if the row has a **Client** cell.
4. Update roadmap `API` / `Worker` / `Web` / `APK` columns; if editing `docs/Phase1-Demo-Roadmap-Echo.md`, sync [docs_CN mirror](../../../docs_CN/Phase1-Demo-Roadmap-Echo.md) (docs-cn-mirror skill).

## Related

- [echo/docs/PHASE1-SCOPE-MAP.md](../../../echo/docs/PHASE1-SCOPE-MAP.md) — sprint summary; links to roadmap

## Limits of automation

Cursor hooks only inject reminders. They **cannot** enforce compliance. Optional future: CI checks on roadmap status and forbidden `VITE_*` in production builds.
