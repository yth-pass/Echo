# Echo 中文文档

本目录为 [`docs/`](../docs/) 的**简体中文镜像**，结构与英文版一一对应，仅自然语言不同；技术标识（`FR-xxx`、API 路径、表名等）保持一致。

**实现进度**以 [Phase1-Demo-Roadmap-Echo.md](./Phase1-Demo-Roadmap-Echo.md) 功能矩阵为准（`API` | `Worker` | `Web` | `APK`），PRD/架构文档描述的是产品蓝图，不单独反映当前代码完成度。

## 文档索引

| 文件 | 说明 |
|------|------|
| [PRD-Echo.md](./PRD-Echo.md) | 产品需求文档 |
| [Software-Architecture-Echo.md](./Software-Architecture-Echo.md) | 软件架构文档 |
| [Deployment-and-Component-Boundaries-Echo.md](./Deployment-and-Component-Boundaries-Echo.md) | 部署拓扑与组件边界 |
| [Phase1-Demo-Roadmap-Echo.md](./Phase1-Demo-Roadmap-Echo.md) | Phase 1 全功能演示路线图（功能矩阵，APK 前主清单） |
| [Onboarding-Survey-Design-Echo.md](./Onboarding-Survey-Design-Echo.md) | 入驻问卷与对话设计 |
| [Clone-Runtime-and-Triggers-Echo.md](./Clone-Runtime-and-Triggers-Echo.md) | 分身运行时、队列与 LLM 触发 |
| [Agent-Behavior-and-Mechanics-Echo.md](./Agent-Behavior-and-Mechanics-Echo.md) | **Agent 行为机制** — 语气模仿、匹配、互聊、发帖、好感度（Phase 1 实装说明） |
| [Campus-Pilot-Launch-Plan-Echo.md](./Campus-Pilot-Launch-Plan-Echo.md) | 校园试点发布与 GTM |
| [Strategic-Update-Plan-Echo.md](./Strategic-Update-Plan-Echo.md) | **CEO 战略更新计划** — Part I（CEO §1–§13）+ Part II（CTO §14–§26）+ Part III（CMO §27–§41） |
| [glossary.md](./glossary.md) | 术语表 |

英文索引：[`docs/README.md`](../docs/README.md)。

## 维护说明

- **英文主文档：** `docs/`（对外工程协作用）
- **同步规则：** 修改 `docs/` 后，请同步更新本目录对应文件；项目已配置 Cursor Skill `docs-cn-mirror` 与 `postToolUse` 钩子辅助提醒
- **路线图：** 每完成一项功能，只更新对应行的 `API` / `Worker` / `Web` / `APK` 列，勿使用整行单一 `done`
- **应用 UI 语言：** 简体中文（见 PRD §12）
