# 实现里程碑

| 字段 | 值 |
|------|-----|
| **相关** | [echo-mapping.md](./echo-mapping.md)、[mechanisms.md](./mechanisms.md) |

M0–M8 交付计划。**M0 = 本文档包。**

---

## M0 — 文档（已完成）

- `docs/agent-platform/` + `docs_CN/agent-platform/`  
- schemas + ADR  
- `.cursor/skills/agent-platform/`、`.cursor/rules/agent-platform.mdc`  

无业务代码。

---

## M1 — Prompt Composer 骨架

**机制：** 1, 3, 19, 22  

- `shared/SKILL.md` + `safety.md`  
- Composer：L0, L1, L2（persona）, L8  
- 接入现有 `agent-turn`，不破坏 Phase 1  

---

## M2 — style.md

**机制：** 2, 20  

- finalize 双写 persona + style.md  
- profile.core candidates  

---

## M3 — 主题引擎

**机制：** 10–14  

- TopicJudge（5 transitions）  
- main/sub/return/new_main  
- joint 单 topic 文件  

---

## M4 — 社交记忆 ①②

**机制：** 5–8, 15, 16  

- SocialExtract、L6 检索  
- 观察者相对双写  

---

## M5 — Promote

**机制：** 9  

- PromoteCheck、审计链  

---

## M6 — 好感

**机制：** 17, 18  

- affection.json、RelationshipExtract、overlay  

---

## M7 — Evals

**机制：** 21  

- CI golden 对话  

---

## M8 — 生产加固

- 队列、监控、consolidate cron、记忆 UI  

---

## 层级归属

| 里程碑 | API | Worker | Web |
|--------|-----|--------|-----|
| M1 | — | Composer | — |
| M2 | onboarding | — | 可选 |
| M3 | session metadata | TopicJudge | — |
| M4 | memory CRUD | extract | UI |
| M5–M8 | 见英文版 | 见英文版 | 见英文版 |

落地功能时更新 [Phase1-Demo-Roadmap-Echo.md](../Phase1-Demo-Roadmap-Echo.md) 对应层列。

英文详情：[implementation-milestones.md](../agent-platform/implementation-milestones.md)。
