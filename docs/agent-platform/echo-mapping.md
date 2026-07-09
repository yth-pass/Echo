# Echo Mapping — Target vs Phase 1

| Field | Value |
|-------|-------|
| **Related** | [Agent Behavior & Mechanics (as-built)](../Agent-Behavior-and-Mechanics-Echo.md), [Software Architecture §8](../Software-Architecture-Echo.md) |

Gap analysis between **agent-platform target design** and **Phase 1 codebase**.

---

## 1. Summary table

| Target design | Phase 1 as-built | Gap | Suggested evolution |
|---------------|------------------|-----|---------------------|
| `users/{id}/style.md` | `persona_prompts.prompt_text` | File-based style doc | Keep DB; add blob or compile cache; optional export to markdown |
| `shared-agent/SKILL.md` | Hardcoded system string in worker | No shared skill dir | Add `services/worker/src/agent-platform/shared/` |
| L0–L8 Prompt Composer | Single system + persona | No layered compose | `DigitalCloneService` / worker refactor |
| `profile.core.json` | `profiles.bio_json` partial | No dedicated core profile | JSONB column or file; extract from onboarding |
| semantic / episodic memory | Not implemented | Full gap | New Prisma models + retrieval |
| social ①② | Not implemented | Full gap | `agent_memory_social` tables or jsonl blob store |
| ②→① promote | Not implemented | Full gap | PromoteCheck job |
| main/sub `current_topic.json` | Not implemented | Full gap | `agent_sessions.metadata_json` |
| joint single topic file | `agent_sessions` + messages | No topic state | Extend session metadata |
| affection 4D + events | `affinity_scores.score` scalar | Simplified affinity | M6: file-based affection.json + events + RelationshipExtract LLM + API + Web hint (demo); future DB table |
| TopicJudge / extract jobs | Only `agent-turn` worker | No post-turn pipeline | New worker queues |
| User-initiated chat API | Clone chat is worker-driven | No `/chat` for user | New API module |
| RAG retrieval | Not implemented | Full gap | pgvector on memory embeddings |
| Evals | Not implemented | Full gap | `shared-agent/evals/` in CI |

---

## 2. Phase 1 files (reference)

| Concern | Path |
|---------|------|
| Persona generation | [`services/api/src/onboarding/onboarding.service.ts`](../../services/api/src/onboarding/onboarding.service.ts) |
| Persona storage | [`services/api/prisma/schema.prisma`](../../services/api/prisma/schema.prisma) `PersonaPrompt` |
| Agent turn worker | [`services/worker/src/main.ts`](../../services/worker/src/main.ts) `agent-turn` |
| Boundaries | [`services/worker/src/clone-runtime/boundaries.ts`](../../services/worker/src/clone-runtime/boundaries.ts) |
| Match / sessions | [`services/worker/src/clone-runtime/match-bridge.ts`](../../services/worker/src/clone-runtime/match-bridge.ts) |
| Affinity | Worker session end → `affinity_scores` |

---

## 3. Concept mapping

| Target term | Echo Phase 1 term |
|-------------|-------------------|
| User Agent / Clone | `digital_clones` + `persona_prompts` |
| style.md | `persona_prompts.prompt_text` |
| joint_session | `agent_sessions` (pair of clones) |
| turns.jsonl | `agent_messages` |
| observer_id | Speaking clone's `user_id` |
| other_agent_id | Counterparty clone's `user_id` |
| Affinity (relationship) | `affinity_scores.score` (session-level, not yet 4D persistent pair) |

---

## 4. Database extensions (target)

Suggested new tables (names illustrative):

| Table | Purpose |
|-------|---------|
| `agent_memory_facts` | semantic ① + self facts |
| `agent_memory_events` | episodic |
| `agent_memory_preferences` | social ② |
| `agent_relationships` | affection snapshot per (observer, other) pair |
| `agent_relationship_events` | affection_events audit |
| `agent_session_topics` | current_topic JSON per session |

Alternatively: JSONB blob per user under object storage for M1 prototype.

---

## 5. What not to break in Phase 1

| Keep working | While adding |
|--------------|--------------|
| Onboarding → persona → match-daily | Style generation can dual-write persona + style.md |
| agent-turn 6-turn loop | Composer can wrap existing LLM call first |
| affinity_scores for handoff | Map composite_affinity to handoff threshold later |
| boundariesJson | Merge into L0/L1 safety |

---

## 6. Recommended first code touchpoints (M1)

1. `services/worker/src/agent-platform/composer/prompt-composer.ts` — wrap existing persona inject.
2. `services/worker/src/agent-platform/shared/SKILL.md` — extract hardcoded rules from worker.

See [implementation-milestones.md](./implementation-milestones.md).

## 7. M1 本地存储说明

M1 实现完全兼容当前无 Docker 开发环境（Neon + Upstash）：

- `SKILL.md` 和 `safety.md` 以文件形式存放于 `services/worker/src/agent-platform/shared/`，运行时由 Composer 读取。
- Persona（L2）仍来自 `persona_prompts.prompt_text`（Prisma JSONB），无需额外存储。
- 如需持久化 `current_topic`（M3 前置），可扩展 `agent_sessions.metadata_json` 字段（已有 Prisma 模型支持 JSONB）。
- 所有存储操作通过 Postgres（JSONB）完成，与 Phase 1 现有数据面一致，便于本地 demo 和未来生产迁移。

详细存储策略见 [storage-schema.md](./storage-schema.md) 的 “Local Demo Storage” 小节。

## 8. M1 验证方法

### 8.1 Smoke Test（推荐，无依赖）

```bash
cd services/worker
npx ts-node src/agent-platform/composer/smoke-test.ts
```

- 不需要 Prisma、Redis 或任何外部服务。
- 验证 `composeSystemPrompt` 输出符合 L8 约束（不包含代码块、JSON、解释性文字等）。
- 通过后输出 “All M1 composer constraints satisfied.”。

### 8.2 手动触发 agent-turn（需本地 Neon/Upstash）

1. 确保 `services/api/.env` 和 `services/worker/.env` 已正确配置 Neon + Upstash 连接串。
2. 启动 API 和 Worker：
   ```bash
   # 终端 1
   cd services/api && npm run start:dev

   # 终端 2
   cd services/worker && npm run start:dev
   ```
3. 通过已有匹配流程触发 `agent-turn` 队列任务（或在数据库中直接插入测试 session）。
4. 检查 Worker 日志中是否出现 Composer 加载成功的提示（无 `[PromptComposer] Failed to load` 警告）。
5. 观察 clone 回复是否仍保持 Phase 1 的简短、自然中文风格。

### 8.3 预期结果

- Smoke test 全部通过。
- 实际 agent-turn 中 clone 回复长度与原 Phase 1 接近（1–2 句自然中文）。
- 无安全层或能力层加载失败的警告日志。
