# Echo 映射 — 目标 vs Phase 1

| 字段 | 值 |
|------|-----|
| **相关** | [Agent 行为与机制（实装）](../Agent-Behavior-and-Mechanics-Echo.md) |

目标设计与 Phase 1 代码差距分析。

---

## 1. 总表

| 目标设计 | Phase 1 实装 | 差距 | 演进建议 |
|----------|--------------|------|----------|
| `style.md` | `persona_prompts.prompt_text` | 无文件形态 | 双写 + blob/缓存 |
| `shared-agent/SKILL.md` | worker 硬编码 system | 无共享目录 | `worker/.../agent-platform/shared/` |
| L0–L8 Composer | 单层 persona 注入 | 无分层 | 重构 compilePrompt |
| profile.core | `bio_json` 部分 | 无专用 core | JSONB 列 |
| semantic/episodic | 未实现 | 全缺口 | 新表 + 检索 |
| social ①② | 未实现 | 全缺口 | 新表或 jsonl |
| ②→① promote | 未实现 | 全缺口 | PromoteCheck job |
| main/sub topic | 未实现 | 全缺口 | `agent_sessions.metadata_json` |
| joint 单 topic | agent_sessions | 无主题状态 | 扩展 metadata |
| 四维好感 + events | `affinity_scores.score` | 简化 | M6: 文件 affection.json + events + LLM 提取 + API + Web 提示（demo）；后续 DB 表 |
| TopicJudge 等 | 仅 agent-turn | 无后处理管线 | 新队列 |

---

## 2. Phase 1 关键文件

| 关注点 | 路径 |
|--------|------|
| Persona | `services/api/src/onboarding/onboarding.service.ts` |
| Agent turn | `services/worker/src/main.ts` |
| Boundaries | `services/worker/src/clone-runtime/boundaries.ts` |
| Match | `services/worker/src/clone-runtime/match-bridge.ts` |

---

## 3. 概念映射

| 目标 | Phase 1 |
|------|---------|
| Clone / Agent | `digital_clones` + `persona_prompts` |
| style.md | `prompt_text` |
| joint_session | `agent_sessions` |
| turns | `agent_messages` |

---

## 4. M1 首选改动点

1. `services/worker/src/agent-platform/composer/prompt-composer.ts`  
2. `shared/SKILL.md` — 从 worker 提取硬编码规则  
3. `agent_sessions.metadata_json` — 最小 current_topic  

见 [implementation-milestones.md](./implementation-milestones.md)。
