# Storage Schema

| Field | Value |
|-------|-------|
| **Related** | [schemas/](./schemas/), [memory-lifecycle.md](./memory-lifecycle.md), [topic-state-machine.md](./topic-state-machine.md) |

On-disk / blob layout and field specifications. JSON Schemas in [schemas/](./schemas/) are authoritative for validation.

---

## Local Demo Storage (M1 Prototype)

本地开发统一采用 **Neon (Postgres) + Upstash (Redis)** 托管免费层，无 Docker。

- M1 阶段（Prompt Composer 骨架）优先使用 **Postgres JSONB** 存储小对象（`profile.core`、`current_topic` 等），避免立即引入文件系统依赖。
- 引用 [echo-mapping.md](./echo-mapping.md) §4 建议：“JSONB blob per user under object storage for M1 prototype”。
- 后续 M4（Social Memory）及以后，可按需扩展为 S3-compatible 对象存储（MinIO / OSS / R2）存放 `*.jsonl` 和 `style.md` 等文件。
- Redis 仅用于 BullMQ 队列和发布订阅，不承担持久化存储职责。

生产部署同样推荐托管 Postgres + 托管 Redis + S3-compatible 对象存储，与本地 demo 存储模型保持一致，便于迁移。

---

## 1. Directory tree

```
platform/
├── shared-agent/
│   ├── SKILL.md
│   ├── references/
│   │   ├── safety.md
│   │   ├── chat-protocol.md
│   │   ├── memory-protocol.md
│   │   └── affection-protocol.md
│   ├── scripts/
│   └── evals/
│
├── users/{user_id}/
│   └── style.md
│
└── memory/
    ├── users/{observer_id}/
    │   ├── profile.core.json
    │   ├── profile.full.json          # optional; UI / archive
    │   ├── semantic/
    │   │   ├── facts.jsonl
    │   │   └── index/
    │   ├── episodic/
    │   │   ├── events.jsonl
    │   │   └── index/
    │   ├── social/by_agent/{other_agent_id}/
    │   │   ├── objective_facts.jsonl    # ①
    │   │   ├── preferences.jsonl        # ②
    │   │   ├── affection.json
    │   │   └── affection_events.jsonl
    │   ├── sessions/{session_id}/       # 1:1 private chat
    │   │   ├── current_topic.json
    │   │   ├── topic_history.jsonl
    │   │   ├── summary.md
    │   │   └── turns.jsonl
    │   └── meta.json
    │
    └── joint_sessions/{joint_session_id}/
        ├── participants.json
        ├── current_topic.json           # shared ③
        ├── topic_history.jsonl
        ├── summary.md
        └── turns.jsonl
```

---

## 2. profile.core.json

Minimal always-injected profile (L3). See [schemas/profile.core.schema.json](./schemas/profile.core.schema.json).

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | User display name |
| `gender` | string | optional |
| `core_relationships` | array | `{ relation, name, person_id }` |
| `hard_preferences` | string[] | e.g. "no emoji", "no honorifics" |

---

## 3. semantic/facts.jsonl (self)

One JSON object per line.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique fact id |
| `subject` | string | `"self"` or `person_id` |
| `predicate` | string | e.g. `occupation` |
| `object` | string | Fact value |
| `confidence` | number | 0–1 |
| `status` | enum | `candidate`, `confirmed`, `deprecated` |
| `visibility` | enum | `private`, `shared_with:{id}`, etc. |
| `source` | object | `{ type, session_id, at }` |

---

## 4. episodic/events.jsonl (self)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Event id |
| `when` | string | ISO date or range |
| `who` | string[] | `self`, person_ids |
| `what` | string | Event description |
| `confidence` | number | 0–1 |
| `status` | enum | `candidate`, `confirmed`, `deprecated` |
| `source` | object | session reference |

---

## 5. objective_facts.jsonl ①

Per (observer, other_agent). See [schemas/objective_fact.schema.json](./schemas/objective_fact.schema.json).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Fact id |
| `subject_agent_id` | string | Speaker Agent (other) |
| `fact` | string | Verifiable statement |
| `fact_scope` | enum | `about_self`, `about_third_party` |
| `third_party` | object | optional `{ relation_to_subject, person_ref }` |
| `fact_type` | enum | `explicit_statement` |
| `confidence` | number | Typically ≥ 0.85 |
| `status` | enum | `active`, `deprecated` |
| `source` | object | `{ session_id, speaker_id, turn_ids, quoted_span }` |
| `visibility` | enum | `observer_private`, etc. |
| `share_policy` | enum | See [memory-lifecycle.md](./memory-lifecycle.md) |

---

## 6. preferences.jsonl ②

See [schemas/preference.schema.json](./schemas/preference.schema.json).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Preference id |
| `subject_agent_id` | string | Other Agent id |
| `content` | string | Opinion or inference |
| `pref_type` | enum | `explicit_opinion`, `implicit_inferred`, `stylistic` |
| `confidence` | number | inferred typically 0.4–0.7 |
| `status` | enum | `candidate`, `active`, `promoted_to_objective`, `contradicted` |
| `promoted_to` | string | optional objective fact id |
| `source` | object | session / turn reference |

---

## 7. current_topic.json ③

See [schemas/current_topic.schema.json](./schemas/current_topic.schema.json).

| Field | Type | Description |
|-------|------|-------------|
| `main_topic` | object | `{ topic_id, label, summary, phase, started_at, last_turn_id }` |
| `active_subtopic` | object \| null | Current digression |
| `subtopic_history` | array | Completed subtopics this session |
| `subtopic_stack` | array | optional; nested digressions (V2+) |
| `focus` | enum | `"main"` \| `"sub"` |
| `meta` | object | `{ session_id, updated_at }` |

**Constraints:** `main_topic.summary` and `active_subtopic.summary` each ≤ 150 characters.

---

## 8. topic_history.jsonl

One line per archived main-topic bundle (on `new_main`):

```json
{
  "main_topic": { "label": "...", "summary": "..." },
  "subtopics": [{ "label": "...", "summary": "...", "valence": "neutral" }],
  "ended_at": "ISO8601",
  "turn_range": [4, 28]
}
```

---

## 9. affection.json

See [schemas/affection.schema.json](./schemas/affection.schema.json).

| Field | Type | Description |
|-------|------|-------------|
| `other_agent_id` | string | Counterparty |
| `dimensions` | object | `familiarity`, `warmth`, `trust`, `tension` (0–100) |
| `composite_affinity` | number | Weighted score |
| `relationship_label` | enum | e.g. `friendly_acquaintance`, `strained` |
| `last_updated_at` | string | ISO8601 |
| `version` | number | Increment on update |

---

## 10. affection_events.jsonl

See [schemas/affection_event.schema.json](./schemas/affection_event.schema.json).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Event id |
| `event_type` | enum | See [affection-protocol.md](./affection-protocol.md) |
| `deltas` | object | Dimension changes applied |
| `evidence` | object | `{ joint_session_id, turn_ids, span }` |
| `confidence` | number | Extraction confidence |
| `at` | string | ISO8601 |

---

## 11. Echo storage mapping (target)

| Logical path | Echo target store |
|--------------|-------------------|
| `users/{id}/style.md` | `persona_prompts` + optional blob/S3 |
| `memory/*` | PostgreSQL JSONB tables + optional object storage |
| `joint_sessions/*` | `agent_sessions.metadata_json` + `agent_messages` |
| `shared-agent/` | Repo path or config bucket |

See [echo-mapping.md](./echo-mapping.md).
