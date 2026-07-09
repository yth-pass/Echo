# 存储 Schema

| 字段 | 值 |
|------|-----|
| **相关** | [schemas/](./schemas/)、[memory-lifecycle.md](./memory-lifecycle.md) |

磁盘/blob 布局与字段说明。校验以 [schemas/](./schemas/) 为准。

---

## 1. 目录树

```
platform/
├── shared-agent/
├── users/{user_id}/style.md
└── memory/
    ├── users/{observer_id}/
    │   ├── profile.core.json
    │   ├── semantic/facts.jsonl
    │   ├── episodic/events.jsonl
    │   ├── social/by_agent/{other_id}/
    │   │   ├── objective_facts.jsonl    # ①
    │   │   ├── preferences.jsonl        # ②
    │   │   ├── affection.json
    │   │   └── affection_events.jsonl
    │   └── sessions/{session_id}/
    └── joint_sessions/{joint_id}/
        ├── current_topic.json
        ├── topic_history.jsonl
        ├── summary.md
        └── turns.jsonl
```

---

## 2. 关键约束

| 文件 | 约束 |
|------|------|
| `main_topic.summary` | ≤ 150 字 |
| `active_subtopic.summary` | ≤ 150 字 |
| ① objective_facts | 追加，不覆盖 |
| ② preferences | 追加；promote 后标记 |
| ③ current_topic | 仅 `new_main` 整包归档重置 |

---

## 3. Echo 存储映射

| 逻辑路径 | Echo 目标存储 |
|----------|---------------|
| `style.md` | `persona_prompts` + blob |
| `memory/*` | PostgreSQL JSONB 或对象存储 |
| `joint_sessions/*` | `agent_sessions.metadata_json` |

见 [echo-mapping.md](./echo-mapping.md)。

字段详情与英文版 [storage-schema.md](../agent-platform/storage-schema.md) 一致（字段名保持英文）。
