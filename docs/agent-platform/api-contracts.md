# API Contracts (Target)

| Field | Value |
|-------|-------|
| **Related** | [echo-mapping.md](./echo-mapping.md), [implementation-milestones.md](./implementation-milestones.md) |

Target REST API sketch. Paths are **design targets**; map to NestJS modules under `services/api/src/agent-platform/`.

---

## 1. Onboarding / style

### `POST /v1/agent-platform/onboarding/submit`

Submit survey + writing samples; generate style and memory candidates.

**Request:**

```json
{
  "survey_json": {},
  "dialogue_json": {},
  "writing_samples": ["..."]
}
```

**Response:**

```json
{
  "user_id": "uuid",
  "style_version": 1,
  "profile_candidates": [{ "id": "cand_1", "type": "semantic", "preview": "..." }],
  "preview_replies": ["..."]
}
```

**Echo map:** Extend [`onboarding.service.ts`](../../services/api/src/onboarding/onboarding.service.ts) `finalize` or new method.

---

## 2. Chat

### `POST /v1/agent-platform/chat`

User or system sends a message; returns styled reply.

**Request:**

```json
{
  "user_id": "uuid",
  "session_id": "uuid",
  "message": "string",
  "participants": ["uuid-other"],
  "session_type": "private | joint"
}
```

**Response:**

```json
{
  "reply": "string",
  "session_id": "uuid",
  "turn_id": "uuid"
}
```

**Echo map:** New module; long-term replaces direct worker-only turn for user-initiated chat. Joint sessions align with `agent_sessions`.

---

## 3. Memory management

### `GET /v1/agent-platform/memory/profile`

Returns `profile.core` + confirmed facts summary for UI.

### `POST /v1/agent-platform/memory/confirm`

Confirm or edit a candidate memory item.

**Request:**

```json
{
  "memory_id": "cand_1",
  "action": "confirm | edit | reject",
  "payload": {}
}
```

### `DELETE /v1/agent-platform/memory/{id}`

Forget a fact, preference, or event.

---

## 4. Internal / worker (no public exposure)

| Job | Trigger | Handler |
|-----|---------|---------|
| `topic-judge` | After each turn | Update `current_topic.json` |
| `memory-extract` | Topic close / session end | Write ①② semantic episodic |
| `promote-check` | After extract | ②→① |
| `relationship-extract` | Topic/session end | affection_events |
| `affection-apply` | After relationship extract | Update affection.json |
| `memory-consolidate` | Cron | Dedupe, decay, conflict queue |

Enqueue via existing Bull/Redis queue pattern in `services/worker`.

---

## 5. WebSocket (optional)

Extend live WS hub for streaming chat tokens:

- `wss://.../v1/ws` — event `agent_platform.chat.chunk`

Phase 1 polling acceptable per architecture doc.

---

## 6. Auth

All endpoints require user JWT; `user_id` must match authenticated user unless internal worker service account.

Memory endpoints scoped strictly to owning observer.

---

## 7. Error codes

| Code | Meaning |
|------|---------|
| `MEMORY_CONFLICT` | Confirm rejected due to conflicting fact |
| `SESSION_NOT_FOUND` | Invalid session_id |
| `TOPIC_STATE_INVALID` | current_topic failed schema validation |
| `LLM_UNAVAILABLE` | Provider down; return 503 |

---

## 8. Idempotency

Chat turns: `Idempotency-Key` header → dedupe LLM calls (align with Phase 1 `turn_id` pattern in agent-to-agent chat).
