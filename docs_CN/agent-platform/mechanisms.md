# Agent 平台机制

| 字段 | 值 |
|------|-----|
| **相关** | [architecture.md](./architecture.md)、[storage-schema.md](./storage-schema.md) |

**22 项机制**完整列表：设计目标、实现方式、存储路径。

---

## 机制总表

| # | 机制 | 设计目标 | 实现方式 | 存储 |
|---|------|----------|----------|------|
| 1 | 共享 Skill 底座 | 能力统一、可升级 | `shared-agent/SKILL.md` + references + scripts | `shared-agent/` |
| 2 | 用户风格 | 回复像本人 | 入驻 → `style.md`；每轮 L2 | `users/{id}/style.md` |
| 3 | 分层 Prompt Composer | 控 token、降幻觉 | L0–L8 + overlay | 运行时 |
| 4 | 本人核心档案 | 始终知道「我是谁」 | 固定 JSON L3 | `profile.core.json` |
| 5 | 本人稳定事实 | 可检索长期事实 | JSONL + 检索 | `semantic/facts.jsonl` |
| 6 | 本人事件记忆 | 记得发生过什么 | JSONL + 时间检索 | `episodic/events.jsonl` |
| 7 | 社交客观事实 ① | 其他 Agent 明确陈述（含第三人） | 追加 JSONL | `objective_facts.jsonl` |
| 8 | 社交偏好 ② | 观点、隐晦推断 | 追加 JSONL | `preferences.jsonl` |
| 9 | ②→① 晋升 | 推断不当事实 | PromoteCheck 原子迁移 | 同上 + status |
| 10 | 主/次主题 ③ | 主线 + 可返回岔题 | main + active_sub | `current_topic.json` |
| 11 | 主题转移判定 | 5 种 transition | TopicJudge | 更新 current_topic |
| 12 | 主题历史归档 | 换主线不丢内容 | `new_main` → history | `topic_history.jsonl` |
| 13 | 联合会话 | A↔B 共用主题 | 单 current_topic | `joint_sessions/` |
| 14 | 会话摘要 + 窗口 | 多轮连贯 | summary + N 轮 | `summary.md`、`turns.jsonl` |
| 15 | 记忆抽取管线 | 对话后沉淀 | 异步 LLM + 规则 | jsonl |
| 16 | 观察者相对记忆 | A 所知 ≠ B 档案 | 按 observer 分库 | 分路径 |
| 17 | 好感/关系 | 对 B 的态度影响语气 | 四维 + events | `affection.json` |
| 18 | 关系 overlay | 对不同人不同语气 | relationship_label | Composer |
| 19 | 安全与隐私 | 不越权 | L0 + share_policy | `safety.md` |
| 20 | 风格建档 | 新用户可用 | 服务端生成 | Onboarding API |
| 21 | Evals | 回归 | CI | `shared-agent/evals/` |
| 22 | 服务端 Skill Loader | 真 skill 文件 | 读文件拼 prompt | Loader |

---

## LLM / 规则模块

| 模块 | 服务机制 |
|------|----------|
| Style Generator | 2, 20 |
| Prompt Composer | 3, 18, 22 |
| MemoryRetrieve | 4–8 |
| TopicJudge | 10–12 |
| SocialExtract | 7, 8, 15 |
| PromoteCheck | 9, 17 |
| RelationshipExtract | 17 |
| AffectionApply | 17, 18 |

---

## MVP  rollout

| 阶段 | 机制 |
|------|------|
| MVP | 1, 2, 3, 4, 10, 11, 14, 19, 22 |
| V2 | 5, 6, 7, 8, 12, 13, 15, 16 |
| V3 | 9, 17, 18 |
| V4 | 21、衰减/repair、可选 Pass2 |

详见 [implementation-milestones.md](./implementation-milestones.md)。
