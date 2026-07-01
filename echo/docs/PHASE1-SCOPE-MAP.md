# Echo Web Prototype — Phase 1 Scope Map

| Field | Value |
|-------|-------|
| **Audience** | Engineering, product |
| **Last Updated** | 2026-05-28 |
| **Related** | [Phase 1 Demo Roadmap (canonical)](../../docs/Phase1-Demo-Roadmap-Echo.md), [Software Architecture (Phase 1)](../../docs/Software-Architecture-Echo.md#15-phased-implementation), [Deployment & Component Boundaries](../../docs/Deployment-and-Component-Boundaries-Echo.md), [简体中文](./PHASE1-SCOPE-MAP.zh-CN.md) |

This repository folder [`echo/`](../) is a **React + Vite web prototype**. Phase 1 in the architecture document targets an **Android APK** plus a **separate Echo Platform** (API, workers, Postgres, etc.). The [`echo/`](../) app **cannot** replace those deliverables; it **maps** UI and API contracts for demos and future integration.

**Implementation tracking (one feature per row, local full demo before APK):** use the master matrix in [**Phase 1 Demo Roadmap**](../../docs/Phase1-Demo-Roadmap-Echo.md) — not this file alone.

**Status columns (v1.1.0):** each `P1-xx` row has **`API` | `Worker` | `Web` | `APK`** — not a single `done`. `echo/` work updates **`Web`** only. Campus APK requires §3.3 release gate in the roadmap.

---

## Sprint matrix (Architecture §15)

| Sprint | Official deliverables | In `echo/` (Web layer) | Separate project / deployable |
|--------|----------------------|--------------------------|-------------------------------|
| Foundation | Auth, API gateway, Postgres schema, Android shell | Auth shell + `VITE_API_BASE_URL`; splash token path (`P1-02` Web **done**) | `apps/android`, `services/api`, `infra/` |
| Onboarding | Survey, dialogue, clone creation UI (zh-CN) | 8-step wizard + `POST /onboarding/*` (`P1-03` Web **done**) | [Onboarding Survey Design](../../docs/Onboarding-Survey-Design-Echo.md) |
| Clone runtime | Persona, boundaries, agent worker, LLM | Pause/resume, persona editor, boundaries (`P1-04a–c` Web **done**); post draft UI (`P1-06`) | Worker + [Clone Runtime](../../docs/Clone-Runtime-and-Triggers-Echo.md) |
| Social | Feed read, scheduled posts, moderation | Feed + detail + source indicators (`P1-05`–`06` Web **done**) | `post-draft`, `moderation` queues |
| Matching | Vector search, push, agent sessions | List, dismiss/block, session messages (`P1-07`–`08` Web **done**) | pgvector, FCM, `agent-turn` |
| Handoff | Affinity, FCM, handoff screens | Affinity in detail, accept/decline (`P1-09` Web **done**) | Affinity engine, FCM |
| Transparency | Audit log UI | Activity tab + transcript (`P1-10` Web **done**) | Audit writes on platform |
| Safety | Reports | `ReportSheet` → `POST /reports` (`P1-11` Web **done**) | `report-triage` worker |
| Live (optional) | WebSocket push | `connectLiveEvents` → `/v1/ws` (`P1-12` Web **done**) | Redis `echo:live` |
| Hardening | Security, load test, APK signing | `npm audit` only — **not** APK signing | `apps/android`, CI |

---

## Suggested repositories / directories

| # | Path | Role |
|---|------|------|
| 1 | `apps/android` | Phase 1 APK client (`P1-14`–`15` **todo**) |
| 2 | `services/api` | REST + WebSocket gateway |
| 3 | `services/worker` | BullMQ + clone runtime |
| 4 | `infra/` | Neon + Upstash 托管服务 |
| 5 | `.github/workflows/` | Debug APK CI (release signing **todo**) |

---

## Configuration

- Set `VITE_API_BASE_URL` to API base including `/v1` (see Software Architecture §10). Empty = mock-only mode.
- WebSocket: same host, `ws://localhost:4000/v1/ws?token=<access_token>` after login.

---

## Change log

| Version | Date | Summary |
|---------|------|---------|
| 1.0.2 | 2026-05-28 | Align sprint rows with roadmap P1-04–P1-12 Web done; add Live row |
| 1.0.1 | 2026-05-26 | Point to roadmap API/Web/APK columns; P1-04 split |
| 1.0.0 | 2026-05-20 | Initial scope map |
