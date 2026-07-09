# Echo Agent 平台 — 目标设计

| 字段 | 值 |
|------|-----|
| **文档版本** | 1.0.0 |
| **状态** | Active（目标设计） |
| **相关（实装）** | [Agent 行为与机制](../Agent-Behavior-and-Mechanics-Echo.md) |
| **相关（架构）** | [软件架构 §8.2](../Software-Architecture-Echo.md) |

本目录定义 Echo 多用户 Agent 平台的**目标设计**：共享 skill 底座、每用户风格、分层记忆、主/次主题、社交记忆（①②）、好感度、Prompt Composer 运行时。

**这不是 Phase 1 实装文档。** 当前实现状态见 [Agent-Behavior-and-Mechanics-Echo.md](../Agent-Behavior-and-Mechanics-Echo.md) 与 [echo-mapping.md](./echo-mapping.md)。

---

## 文档索引

| 文件 | 说明 |
|------|------|
| [architecture.md](./architecture.md) | 三大域、Composer 运行时流程 |
| [mechanisms.md](./mechanisms.md) | 22 项机制 — 目标、实现、存储 |
| [storage-schema.md](./storage-schema.md) | 目录树与 JSON/JSONL 字段说明 |
| [prompt-layers.md](./prompt-layers.md) | L0–L8 分层与关系 overlay |
| [topic-state-machine.md](./topic-state-machine.md) | 主/次主题、5 种 transition、TopicJudge |
| [memory-lifecycle.md](./memory-lifecycle.md) | 抽取、②→① promote、隐私 |
| [affection-protocol.md](./affection-protocol.md) | 四维好感、事件、delta |
| [api-contracts.md](./api-contracts.md) | 目标 API 草图，映射到 `services/api` |
| [echo-mapping.md](./echo-mapping.md) | 目标 vs Phase 1 差距分析 |
| [implementation-milestones.md](./implementation-milestones.md) | M0–M8 交付计划 |
| [schemas/](./schemas/) | LLM 输出与存储用 JSON Schema |
| [adr/](./adr/) | 架构决策记录（ADR） |

---

## 阅读顺序

| 目标 | 从这里开始 |
|------|------------|
| 理解整体形态 | [architecture.md](./architecture.md) |
| 一览全部机制 | [mechanisms.md](./mechanisms.md) |
| 实现存储 / DB | [storage-schema.md](./storage-schema.md) + [schemas/](./schemas/) |
| 实现聊天 / Composer | [prompt-layers.md](./prompt-layers.md) + [topic-state-machine.md](./topic-state-machine.md) |
| 映射到现有 Echo 代码 | [echo-mapping.md](./echo-mapping.md) |
| 排期 | [implementation-milestones.md](./implementation-milestones.md) |

---

## 目标 vs Phase 1

| 文档 | 范围 |
|------|------|
| **本目录** | 目标设计（M1–M8） |
| [Agent-Behavior-and-Mechanics-Echo.md](../Agent-Behavior-and-Mechanics-Echo.md) | Phase 1 实装（`persona_prompts`、worker `agent-turn`、好感分数） |
| [Software-Architecture-Echo.md](../Software-Architecture-Echo.md) | 高层架构（§8.2 四层 prompt 目标） |

---

## Cursor 集成

- **Skill：** `.cursor/skills/agent-platform/SKILL.md` — 实现 agent-platform 代码前阅读。
- **Rule：** `.cursor/rules/agent-platform.mdc` — 不变量（风格 vs 记忆、主题归档、promote）。

---

## 里程碑

| 里程碑 | 范围 |
|--------|------|
| **M0** | 本文档包 |
| **M1–M8** | 见 [implementation-milestones.md](./implementation-milestones.md) |
