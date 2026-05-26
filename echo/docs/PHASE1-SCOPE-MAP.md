# Echo Web Prototype — Phase 1 Scope Map

| Field | Value |
|-------|-------|
| **Audience** | Engineering, product |
| **Last Updated** | 2026-05-20 |
| **Related** | [Phase 1 Demo Roadmap (canonical)](../../docs/Phase1-Demo-Roadmap-Echo.md), [Software Architecture (Phase 1)](../../docs/Software-Architecture-Echo.md#15-phased-implementation), [Deployment & Component Boundaries](../../docs/Deployment-and-Component-Boundaries-Echo.md), [简体中文](./PHASE1-SCOPE-MAP.zh-CN.md) |

This repository folder [`echo/`](../) is a **React + Vite web prototype**. Phase 1 in the architecture document targets an **Android APK** plus a **separate Echo Platform** (API, workers, Postgres, etc.). The [`echo/`](../) app **cannot** replace those deliverables; it **maps** UI and API contracts for demos and future integration.

**Implementation tracking (one feature per row, local full demo before APK):** use the master matrix in [**Phase 1 Demo Roadmap**](../../docs/Phase1-Demo-Roadmap-Echo.md) — not this file alone.

---

## Sprint matrix (Architecture §15)

| Sprint | Official deliverables | In `echo/` (allowed) | Separate project / deployable |
|--------|----------------------|----------------------|--------------------------------|
| Foundation | Auth, API gateway, Postgres schema, Android shell + navigation | Login/register **shell UI** (optional), route skeleton, `VITE_API_BASE_URL`, docs | `apps/android`, `services/api`, `infra/` Docker Compose (Postgres, Redis, MinIO) |
| Onboarding | Survey, dialogue, clone creation UI (zh-CN) | **Multi-step survey + AI dialogue**; `POST /onboarding/*`; skip wizard when `onboardingComplete` | See [Onboarding Survey Design](../../docs/Onboarding-Survey-Design-Echo.md) |
| Clone runtime | Persona storage, agent worker, LLM adapter | **Persona summary, boundaries, pause/resume UI**; browser-side demo only for LLM (never production Worker) | Agent Worker image/process, queues, `LlmAdapter` server-side |
| Social | Feed read, scheduled posts, moderation | Feed **list + post detail**; `GET /posts/{id}` | Worker `post-draft` + [Clone Runtime](../../docs/Clone-Runtime-and-Triggers-Echo.md) |
| Matching | Vector search, push, agent sessions | Match list + transcript **read-only UI**; mock or `GET /matches`, `GET /sessions/{id}/messages` | pgvector, FCM, session persistence, workers |
| Handoff | Affinity engine, FCM, handoff screens | Extend detail UI toward `GET/POST /handoffs/*` **mock** | Affinity engine, FCM, bilateral consent rules |
| Transparency | Audit log UI | **Activity drill-down** — `GET /clones/me/activity`, session transcript | Audit on post/session events |
| Hardening | Security review, load test, APK signing | `npm audit`, optional Lighthouse — **not** a substitute for APK signing | CI for Android release, server pentest/load tests |

---

## Suggested new repositories / directories

| # | Suggested path | Role |
|---|----------------|------|
| 1 | `apps/android` or separate `echo-android` repo | Phase 1 client |
| 2 | `services/api` | Stateless REST/WebSocket gateway-facing API |
| 3 | `services/worker` | Agent Worker pool (may share repo, separate image) |
| 4 | `services/moderation-consumer` | Optional split from worker post-MVP |
| 5 | `infra/` | `docker-compose` for Postgres (+pgvector), Redis, MinIO (dev) |
| 6 | `.github/workflows/` | APK signing, container builds |

---

## Configuration

- Set `VITE_API_BASE_URL` to your API base including `/v1` when available (see Software Architecture §10). Empty = mock-only mode.

---

## Change log

| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-05-20 | Initial scope map |
