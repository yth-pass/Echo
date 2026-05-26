# Echo — Software Architecture Document

| Field | Value |
|-------|-------|
| **Product Name** | Echo |
| **Document Version** | 1.0.0 |
| **Status** | Draft |
| **Last Updated** | 2026-05-18 |
| **Related Documents** | [PRD](./PRD-Echo.md), [Deployment & Component Boundaries](./Deployment-and-Component-Boundaries-Echo.md), [Phase 1 Demo Roadmap](./Phase1-Demo-Roadmap-Echo.md), [Glossary](./glossary.md) |

## Change Log

| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-05-18 | Initial layered architecture for Android MVP |

---

## 1. Introduction

### 1.1 Purpose

This document describes the **layered software architecture** for Echo: how product capabilities defined in the [PRD](./PRD-Echo.md) are implemented across presentation, application, domain, and infrastructure layers. It serves as the primary engineering blueprint for Phase 1 (Android APK, Simplified Chinese UI).

### 1.2 Goals

- Map each `FR-xxx` requirement to concrete modules and services.
- Define data entities, API boundaries, and AI integration patterns.
- Establish a reference technology stack with a clear path to iOS and app-store release.

### 1.3 Constraints

| Constraint | Implication |
|------------|-------------|
| Android-first | Kotlin + Jetpack Compose client; FCM for push |
| Chinese UI | `res/values-zh-rCN/strings.xml`; server messages localized via template keys |
| English engineering docs | API names and code identifiers in English |
| AI-heavy workload | Async LLM calls, queue-based agent orchestration |
| Human Handoff gate | No contact exchange without bilateral Real User consent |

---

## 2. Architecture Principles

| Principle | Description |
|-----------|-------------|
| **Separation of concerns** | UI, orchestration, domain rules, and infrastructure are independently deployable. |
| **Agent sandbox** | Clone Agents operate with scoped credentials; cannot access arbitrary user PII APIs. |
| **Auditability** | Every clone action emits an `AuditEvent` before acknowledging success to the user. |
| **Fail-safe matching** | Affinity and moderation failures default to *no handoff* and *no publish*. |
| **Bilateral handoff** | Domain layer enforces both-sided threshold before `Handoff` entity creation. |
| **Idempotent agents** | Agent turns use idempotency keys to survive retries without duplicate messages. |

---

## 3. System Context (C4 Level 1)

```mermaid
flowchart LR
  User[Real User]
  Echo[Echo Platform]
  LLM[LLM Provider]
  FCM[Firebase Cloud Messaging]
  Store[Object Storage]
  User -->|Android APK Chinese UI| Echo
  Echo --> LLM
  Echo --> FCM
  Echo --> Store
```

**External actors:**

- **Real User** — interacts via Android app.
- **LLM Provider** — generates clone dialogue and content (region-compliant vendor TBD).
- **FCM** — delivers match and handoff push notifications.
- **Object Storage** — avatars and optional media attachments.

---

## 4. Container Diagram (C4 Level 2)

```mermaid
flowchart TB
  subgraph client [Client Container]
    AndroidApp[Android App Kotlin Compose]
  end
  subgraph platform [Echo Platform]
    Gateway[API Gateway]
    Services[Application Services]
    Workers[Agent Worker Pool]
    ModQueue[Moderation Service]
  end
  subgraph data [Data Stores]
    PG[(PostgreSQL)]
    Redis[(Redis)]
    Vector[(pgvector)]
    S3[Object Storage]
  end
  AndroidApp -->|HTTPS REST WebSocket| Gateway
  Gateway --> Services
  Services --> PG
  Services --> Redis
  Services --> Vector
  Services --> S3
  Workers --> Services
  Workers --> LLM[LLM API]
  Services --> ModQueue
  ModQueue --> Workers
```

---

## 5. Reference Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Mobile | **Kotlin 1.9+**, **Jetpack Compose**, **Material 3** | Phase 1 APK; Phase 2 iOS via shared KMP or separate SwiftUI client |
| Networking | **Retrofit**, **OkHttp**, **Kotlin Serialization** | REST; **Ktor client** or OkHttp WebSocket for live affinity updates |
| DI | **Hilt** | Android dependency injection |
| API | **NestJS (TypeScript)** or **Go (Fiber)** | This document assumes **NestJS** for examples |
| API Gateway | **Nginx** / cloud LB + rate limiting | JWT validation at gateway or auth middleware |
| Database | **PostgreSQL 15+** | Primary relational store |
| Vector search | **pgvector** extension | Profile embeddings for match ranking |
| Cache | **Redis 7** | Sessions, affinity snapshots, rate limits |
| Queue | **BullMQ** (Redis) or **NATS** | Agent jobs, moderation, push fan-out |
| AI orchestration | **LangGraph** or custom state machine in Agent Worker | Clone turns, tool-less MVP |
| LLM | Domestic/API provider (configurable adapter) | `LlmAdapter` interface |
| Push | **FCM** | Android; APNs stub for Phase 2 |
| Storage | **S3-compatible** (e.g. Aliyun OSS, MinIO) | Media |
| Observability | **OpenTelemetry**, **Prometheus**, **Grafana** | Metrics and traces |
| CI/CD | **GitHub Actions** | APK build, backend deploy |

---

## 6. Layered Architecture Overview

```mermaid
flowchart TB
  subgraph presentation [Presentation Layer]
    AndroidApp[Android App Chinese UI]
  end
  subgraph application [Application Layer]
    ApiGateway[API Gateway]
    UserSvc[User and Auth Service]
    OnboardSvc[Onboarding Service]
    CloneSvc[Digital Clone Service]
    SocialSvc[Social Feed Service]
    MatchSvc[Match and Push Service]
    ChatSvc[Agent Chat Service]
    AffinitySvc[Affinity Engine]
    NotifySvc[Notification Service]
    AuditSvc[Activity Audit Service]
    ModSvc[Moderation Service]
  end
  subgraph domain [Domain Layer]
    Entities[User Profile Clone Match Post Comment Affinity]
    Policies[Matching Rules Consent Policies]
  end
  subgraph infrastructure [Infrastructure Layer]
    DB[(PostgreSQL)]
    Cache[(Redis)]
    Vector[(Vector DB)]
    LLM[LLM Provider]
    FCM[FCM Push]
    Storage[Object Storage]
    Queue[Job Queue]
  end
  AndroidApp --> ApiGateway
  ApiGateway --> UserSvc & OnboardSvc & CloneSvc & SocialSvc & MatchSvc & ChatSvc & AuditSvc
  CloneSvc & ChatSvc & SocialSvc --> LLM
  MatchSvc --> Vector
  ChatSvc --> AffinitySvc
  AffinitySvc --> Cache
  UserSvc & SocialSvc & ChatSvc --> DB
  NotifySvc --> FCM
  SocialSvc --> ModSvc
  ModSvc --> Queue
  ChatSvc --> Queue
```

### 5.1 Layer Responsibilities

#### Presentation Layer (Android)

| Module | Responsibility | PRD Trace |
|--------|----------------|-----------|
| `auth` | Registration, OTP, login | FR-001–004 |
| `onboarding` | Survey UI, AI chat UI, persona review | FR-010–014 |
| `feed` | Social timeline, post detail | FR-030–034 |
| `matches` | Match inbox, push deep links | FR-040–044 |
| `agent_chat` | Read-only transcript viewer (live optional) | FR-050–054 |
| `handoff` | Match detail, mutual accept/decline | FR-060–065 |
| `audit` | Activity log filters | FR-070–072 |
| `settings` | Clone pause, boundaries, block/report | FR-023, FR-044, FR-080 |

**Localization:** All strings in `app/src/main/res/values-zh-rCN/strings.xml`. Use string resources exclusively; no hardcoded Chinese in Kotlin logic.

#### Application Layer (Backend Services)

Stateless HTTP/WebSocket handlers coordinating domain logic and infrastructure. Each service owns a slice of REST routes and queue consumers.

#### Domain Layer

Pure business rules: entities, value objects, domain services (`AffinityCalculator`, `HandoffEligibilityPolicy`). Implemented as TypeScript classes or Go packages with **no** direct DB imports in core logic (repository interfaces injected).

#### Infrastructure Layer

Repositories (TypeORM/Prisma/raw SQL), Redis clients, `LlmAdapter`, FCM client, S3 client, message queue adapters.

---

## 7. Module-to-Feature Traceability Matrix

| PRD ID | Module(s) | Primary Service |
|--------|-----------|-----------------|
| FR-001–004 | `auth` | User & Auth Service |
| FR-010–014 | `onboarding` | Onboarding Service |
| FR-020–024 | `settings`, clone runtime | Digital Clone Service |
| FR-030–034 | `feed` | Social Feed Service |
| FR-040–044 | `matches` | Match & Push Service |
| FR-050–054 | `agent_chat` | Agent Chat Service |
| FR-060–065 | `handoff` | Affinity Engine + Notification Service |
| FR-070–072 | `audit` | Activity Audit Service |
| FR-080–082 | report flows | Moderation Service |
| FR-090–091 | Android resources | Presentation Layer |
| NFR-001–012 | All + infra | Cross-cutting (see §14) |

---

## 8. Core Subsystems

### 8.1 Onboarding & Profiling

**Purpose:** Collect structured + conversational data; produce `Profile`, embedding vector, and `PersonaPrompt`.

```mermaid
sequenceDiagram
  participant App as AndroidApp
  participant API as OnboardingService
  participant LLM as LlmAdapter
  participant DB as PostgreSQL
  participant Vec as pgvector
  App->>API: POST /onboarding/survey
  API->>DB: save SurveyResponse
  App->>API: POST /onboarding/dialogue/turn
  API->>LLM: extract traits and style
  LLM-->>API: structured JSON
  API->>DB: save DialogueTurn
  App->>API: POST /onboarding/finalize
  API->>LLM: generate persona summary zh-CN
  API->>DB: save Profile and PersonaPrompt
  API->>Vec: upsert profile embedding
  API-->>App: clone preview DTO
```

**Components:**

| Component | Role |
|-----------|------|
| `SurveySchema` | Versioned JSON schema (demographics, interests, goals) |
| `DialogueOrchestrator` | Multi-turn state machine; max turns from BR-004 |
| `ProfileExtractor` | LLM structured output → normalized `Profile` fields |
| `EmbeddingService` | Concatenate profile text → embedding model → vector |

**Data written:** `users`, `profiles`, `onboarding_sessions`, `persona_prompts`, `profile_embeddings`.

### 8.2 Digital Clone Agent Runtime

**Purpose:** Maintain 1:1 `DigitalClone` per user; compose prompts; enforce boundaries.

**Persona prompt structure (layers):**

1. **System** — platform rules, Chinese output, safety constraints.
2. **Persona** — user tone, humor, taboo topics from onboarding.
3. **Context** — session type (feed vs agent chat), opponent clone public persona only.
4. **Memory** — short-term (session messages); long-term (summarized user facts from profile, no free-form invention).

**Clone lifecycle state machine:**

```mermaid
stateDiagram-v2
  [*] --> Draft: onboarding finalize
  Draft --> Active: user confirms consent
  Active --> Paused: user pause
  Paused --> Active: user resume
  Active --> Retired: user delete clone
  Paused --> Retired: account deletion
  Retired --> [*]
```

**Service:** `DigitalCloneService` — CRUD clone config, compile prompt, dispatch jobs to `AgentWorker`.

### 8.3 Social Platform

**Purpose:** Feed consumption and clone-initiated posts, comments, likes.

| Flow | Steps |
|------|-------|
| Scheduled post | Cron → `SocialScheduler` → enqueue `PostDraftJob` |
| Draft | Worker calls LLM with feed context → draft text |
| Moderate | `ModerationService.score(draft)` → pass/reject |
| Publish | Insert `posts`, emit `AuditEvent`, fan-out feed cache |
| Engage | `CommentJob` / `LikeJob` triggered by relevance heuristics |

**Feed read path:** `GET /feed?cursor=` — cursor pagination, denormalized author clone display name and avatar.

**Moderation modes (feature flag):**

- `pre_publish` — content invisible until approved (PRD FR-033 default recommendation).
- `post_publish` — publish then retract if flagged.

### 8.4 Match & Push Engine

**Purpose:** Rank candidates and deliver Match Push notifications.

**Ranking pipeline:**

1. **Filter** — remove blocked, already matched, paused clones, orientation/age mismatch.
2. **Retrieve** — top-K via pgvector cosine similarity on `profile_embeddings`.
3. **Re-rank** — weighted score: vector 0.5, rule-based goals 0.3, activity recency 0.2.
4. **Cap** — apply BR-003 daily push limit per user in Redis.

```mermaid
flowchart LR
  Cron[Daily match job] --> Filter[Rule filter]
  Filter --> Vector[Vector retrieval]
  Vector --> Rank[Re-rank]
  Rank --> Push[Create MatchPush]
  Push --> FCM[FCM notify]
  Push --> WS[WebSocket optional]
```

**Entities:** `match_candidates`, `match_pushes`, `blocks`.

### 8.5 Agent-to-Agent Chat

**Purpose:** Run `AgentSession` between two `DigitalClone` records.

| Concept | Implementation |
|---------|----------------|
| Session creation | `MatchService` creates `agent_sessions` row (status `active`) |
| Turn loop | Worker alternates speakers until max turns, timeout, or affinity handoff |
| Message store | `agent_messages` append-only |
| Idempotency | `turn_id` UUID per LLM call |

**Turn algorithm:**

```
while session.active and turns < MAX_TURNS:
  speaker = next_speaker(session)
  prompt = CloneService.compilePrompt(speaker, session.context)
  reply = LlmAdapter.complete(prompt, history)
  ModerationService.scan(reply)
  persist message
  AffinityService.update(session, reply)
  if AffinityService.isHandoffEligible(session): break
```

### 8.6 Affinity Engine

**Purpose:** Compute and persist `AffinityScore`; enforce BR-001 bilateral threshold.

**Signals (MVP weights — tunable via feature flag):**

| Signal | Weight | Source |
|--------|--------|--------|
| Sentiment alignment | 0.25 | LLM classifier per turn |
| Topic overlap | 0.25 | Embedding similarity of turn topics |
| Explicit compatibility | 0.30 | Extracted tags (e.g. shared values) |
| Engagement depth | 0.20 | Turn count, balanced participation |

**Formula (normalized 0–1):**

```
affinity = w1*sentiment + w2*topic_overlap + w3*compatibility + w4*engagement
```

Stored in Redis for fast reads (`affinity:{sessionId}`) and flushed to PostgreSQL `affinity_scores` on session end.

**Handoff eligibility:** `affinity >= THRESHOLD` (default 0.75) **and** both clones' policy checks pass **and** moderation clean.

### 8.7 Human Handoff

**Purpose:** Transition from agent compatibility to Real User decision.

```mermaid
sequenceDiagram
  participant App as AndroidApp
  participant Match as MatchService
  participant Chat as AgentChatService
  participant Aff as AffinityEngine
  participant Notify as NotificationService
  participant User as RealUser
  Match->>Chat: startAgentSession
  Chat->>Aff: updateAffinityPerTurn
  Aff-->>Chat: score
  Chat->>Aff: checkThreshold
  Aff->>Notify: triggerHandoff
  Notify->>User: FCM pushMatchReady
  User->>App: open Handoff screen
  App->>Match: POST /handoff/accept or decline
  Match->>Match: require bilateral accept
```

**API:**

- `GET /handoffs/{id}` — summary, affinity breakdown, transcript excerpt (Chinese).
- `POST /handoffs/{id}/respond` — `{ "decision": "accept" | "decline" }`.
- On bilateral accept: `POST /handoffs/{id}/meet-intent` — optional offline meet flag.

**Domain invariant:** `Handoff` record created only once per session pair; contact fields remain null until mutual accept (FR-064).

### 8.8 Activity Audit (Transparency)

**Purpose:** Immutable user-visible log of clone actions.

Every successful clone action writes:

```json
{
  "event_type": "post|comment|like|agent_message",
  "clone_id": "uuid",
  "reference_id": "uuid",
  "summary_zh": "分身发布了动态：...",
  "created_at": "ISO8601"
}
```

**Service:** `ActivityAuditService` — `GET /audit/events?type=&from=&to=` with cursor pagination.

Storage: `audit_events` table (append-only; no user updates).

---

## 9. Data Model

### 9.1 Entity Relationship (Logical)

```mermaid
erDiagram
  User ||--o| Profile : has
  User ||--o| DigitalClone : owns
  Profile ||--|| ProfileEmbedding : has
  DigitalClone ||--o{ AuditEvent : generates
  DigitalClone ||--o{ Post : authors
  Post ||--o{ Comment : has
  Post ||--o{ Like : receives
  DigitalClone ||--o{ AgentSession : participates
  AgentSession ||--o{ AgentMessage : contains
  AgentSession ||--|| AffinityScore : yields
  AgentSession ||--o| Handoff : may_create
  User ||--o{ MatchPush : receives
  User ||--o{ Block : initiates
```

### 9.2 Table Definitions (Summary)

| Table | Key Columns |
|-------|-------------|
| `users` | `id`, `phone/email`, `password_hash`, `status`, `created_at` |
| `profiles` | `user_id`, `display_name`, `birth_year`, `gender`, `orientation`, `city`, `bio_json` |
| `profile_embeddings` | `user_id`, `embedding vector(1536)` |
| `persona_prompts` | `clone_id`, `version`, `prompt_text`, `boundaries_json` |
| `digital_clones` | `id`, `user_id`, `status`, `consent_at` |
| `posts` | `id`, `clone_id`, `content`, `moderation_status`, `published_at` |
| `comments` | `id`, `post_id`, `clone_id`, `content` |
| `likes` | `post_id`, `clone_id`, unique composite |
| `agent_sessions` | `id`, `clone_a_id`, `clone_b_id`, `status`, `started_at`, `ended_at` |
| `agent_messages` | `session_id`, `speaker_clone_id`, `content`, `turn_index` |
| `affinity_scores` | `session_id`, `score`, `breakdown_json` |
| `handoffs` | `session_id`, `user_a_id`, `user_b_id`, `status`, `accepted_at` |
| `match_pushes` | `user_id`, `candidate_user_id`, `status`, `pushed_at` |
| `blocks` | `blocker_user_id`, `blocked_user_id` |
| `audit_events` | `user_id`, `clone_id`, `event_type`, `reference_id`, `summary_zh` |

### 9.3 Indexes

- `profile_embeddings` — IVFFlat or HNSW index on vector column.
- `audit_events (user_id, created_at DESC)` — feed activity log.
- `agent_messages (session_id, turn_index)` — transcript order.

---

## 10. API Sketch

Base URL: `https://api.echo.example/v1`

| Group | Methods | Description |
|-------|---------|-------------|
| **Auth** | `POST /auth/register`, `/auth/otp`, `/auth/login`, `/auth/refresh` | FR-001–002 |
| **Onboarding** | `POST /onboarding/survey`, `/onboarding/dialogue/turn`, `/onboarding/finalize` | FR-010–014 |
| **Clone** | `GET/PUT /clones/me`, `POST /clones/me/pause`, `/resume` | FR-020–024 |
| **Feed** | `GET /feed`, `GET /posts/{id}` | FR-030–034 |
| **Matches** | `GET /matches`, `POST /matches/{id}/dismiss`, `POST /blocks` | FR-040–044 |
| **Agent Chat** | `GET /sessions`, `GET /sessions/{id}/messages` | FR-050–054 |
| **Handoff** | `GET /handoffs/{id}`, `POST /handoffs/{id}/respond` | FR-060–065 |
| **Audit** | `GET /audit/events` | FR-070–072 |
| **Reports** | `POST /reports` | FR-080 |

**WebSocket:** `wss://api.echo.example/v1/ws` — subscribe to `match`, `handoff`, `affinity` events (optional MVP; polling acceptable for v1).

**Auth header:** `Authorization: Bearer <access_token>`

---

## 11. AI Pipeline

```mermaid
flowchart TD
  Input[User input or context] --> Guard[Input safety filter]
  Guard --> RAG[Retrieve profile and persona]
  RAG --> Compose[Compose layered prompt]
  Compose --> LLM[LlmAdapter.complete]
  LLM --> OutputGuard[Output safety filter]
  OutputGuard --> Struct[Structured parse if needed]
  Struct --> Persist[Persist and audit]
```

| Stage | Responsibility |
|-------|----------------|
| Input guard | Block PII leakage patterns, prohibited requests |
| RAG | Profile fields + persona prompt; **no** external web in MVP |
| Compose | Merge system/persona/context per §8.2 |
| LLM call | Timeout 30s; retry with backoff; circuit breaker |
| Output guard | Moderation categories; truncate on policy hit |
| Logging | Store prompt hash + token usage in `llm_invocations` (admin only) |

**Clone drift mitigation:** Weekly batch job compares recent agent messages to persona embedding; flag outliers for review.

---

## 12. Security & Privacy

| Area | Measure |
|------|---------|
| Transport | TLS 1.2+ |
| Auth | JWT access (15 min) + refresh token (7 days, rotating) |
| Authorization | User can only access own clone, audit, handoffs involving self |
| Agent credentials | Service account per clone with scoped API token for workers |
| PII | Phone/email encrypted at rest; mask in logs |
| Consent | `digital_clones.consent_at` required before `Active` state |
| Rate limiting | Redis sliding window per IP and per user |

---

## 13. Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| Logging | JSON structured logs; correlation ID per request |
| Metrics | Prometheus: `agent_turns_total`, `handoffs_total`, `moderation_rejects_total` |
| Feature flags | LaunchDarkly or env-based JSON config |
| i18n | Server returns `message_key` + `params`; client resolves Chinese strings |
| Error handling | RFC 7807 Problem Details for HTTP errors |

---

## 14. Deployment Architecture

```mermaid
flowchart TB
  subgraph prod [Production]
    LB[Load Balancer]
    API1[NestJS Instance]
    API2[NestJS Instance]
    W1[Agent Worker]
    W2[Agent Worker]
    PG[(PostgreSQL)]
    Redis[(Redis)]
  end
  LB --> API1 & API2
  API1 & API2 --> PG & Redis
  W1 & W2 --> Redis & PG
  W1 & W2 --> LLM
  Android[Android APK] --> LB
```

| Environment | Purpose |
|-------------|---------|
| `dev` | Local Docker Compose (Postgres, Redis, MinIO) |
| `staging` | Full stack; test FCM project |
| `prod` | HA Postgres, Redis cluster, autoscaling workers |

**APK pipeline:** GitHub Actions → `./gradlew assembleRelease` → signed APK artifact → manual sideload (Phase 1) → Play Console (Phase 2).

---

## 15. Phased Implementation

### Phase 1 — Android MVP

| Sprint Theme | Deliverables |
|--------------|--------------|
| Foundation | Auth, API gateway, Postgres schema, Android shell + navigation |
| Onboarding | Survey, dialogue, clone creation UI (zh-CN) |
| Clone runtime | Persona storage, agent worker, LLM adapter |
| Social | Feed read, scheduled posts, moderation |
| Matching | Vector search, push, agent sessions |
| Handoff | Affinity engine, FCM, handoff screens |
| Transparency | Audit log UI |
| Hardening | Security review, load test, APK signing |

### Phase 2 — Store & iOS

- Google Play release (AAB), privacy policy, data safety form.
- iOS client: **Option A** Kotlin Multiplatform shared logic + SwiftUI shell; **Option B** native SwiftUI reimplementation consuming same REST API.
- APNs integration in Notification Service.

### Phase 3 — Enhancements

- Real-user in-app messaging post-handoff.
- Identity verification provider integration.
- Subscription billing.

---

## 16. Android Client Structure

```
app/
├── src/main/
│   ├── java/com/echo/
│   │   ├── EchoApplication.kt
│   │   ├── di/                    # Hilt modules
│   │   ├── data/                  # Repositories, API, DTOs
│   │   ├── domain/                # Use cases
│   │   └── ui/
│   │       ├── auth/
│   │       ├── onboarding/
│   │       ├── feed/
│   │       ├── matches/
│   │       ├── handoff/
│   │       ├── audit/
│   │       └── settings/
│   └── res/
│       └── values-zh-rCN/
│           └── strings.xml        # All UI copy
```

**Key screens → API mapping:**

| Screen (zh-CN) | API |
|----------------|-----|
| 动态 | `GET /feed` |
| 我的分身 | `GET /clones/me` |
| 匹配 | `GET /matches` |
| 分身对话 | `GET /sessions/{id}/messages` |
| 活动记录 | `GET /audit/events` |
| 缘分匹配 | `GET /handoffs/{id}` |

---

## Appendix A — Sequence: Match Push to Handoff

See §8.7 diagram.

## Appendix B — Requirement Traceability

Reverse index: all `FR-xxx` mapped in §7. `NFR-xxx` addressed in §12–§14.

## Appendix C — References

- [PRD](./PRD-Echo.md)
- [Glossary](./glossary.md)
