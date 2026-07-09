# API 契约（目标）

| 字段 | 值 |
|------|-----|
| **相关** | [echo-mapping.md](./echo-mapping.md)、[implementation-milestones.md](./implementation-milestones.md) |

目标 REST API 草图。路径为**设计目标**，映射到 NestJS `services/api/src/agent-platform/`。

---

## 1. 入驻 / 风格

### `POST /v1/agent-platform/onboarding/submit`

提交问卷 + 写作样本 → 生成 style + memory candidates。

**Echo 映射：** 扩展 [`onboarding.service.ts`](../../services/api/src/onboarding/onboarding.service.ts) `finalize`。

---

## 2. 聊天

### `POST /v1/agent-platform/chat`

```json
{
  "user_id": "uuid",
  "session_id": "uuid",
  "message": "string",
  "participants": ["uuid-other"],
  "session_type": "private | joint"
}
```

---

## 3. 记忆管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/v1/agent-platform/memory/profile` | 查看 core + 已确认事实 |
| POST | `/v1/agent-platform/memory/confirm` | 确认/编辑/拒绝 candidate |
| DELETE | `/v1/agent-platform/memory/{id}` | 遗忘 |

---

## 4. 内部 Worker 任务

| Job | 触发 |
|-----|------|
| topic-judge | 每轮后 |
| memory-extract | 话题/会话结束 |
| promote-check | 抽取后 |
| relationship-extract | 话题/会话结束 |
| affection-apply | relationship 后 |
| memory-consolidate | Cron |

---

## 5. 其他

- 鉴权：JWT；`user_id` 须匹配当前用户  
- 幂等：`Idempotency-Key` 对齐 Phase 1 `turn_id`  
- 错误码：`MEMORY_CONFLICT`、`SESSION_NOT_FOUND`、`TOPIC_STATE_INVALID`、`LLM_UNAVAILABLE`

请求/响应 JSON 示例见英文 [api-contracts.md](../agent-platform/api-contracts.md)。
