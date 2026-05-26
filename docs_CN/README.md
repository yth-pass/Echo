# Echo 中文文档

本目录为 [`docs/`](../docs/) 的**简体中文镜像**，结构与英文版一一对应，仅自然语言不同；技术标识（`FR-xxx`、API 路径、表名等）保持一致。

## 文档索引

| 文件 | 说明 |
|------|------|
| [PRD-Echo.md](./PRD-Echo.md) | 产品需求文档 |
| [Software-Architecture-Echo.md](./Software-Architecture-Echo.md) | 软件架构文档 |
| [Deployment-and-Component-Boundaries-Echo.md](./Deployment-and-Component-Boundaries-Echo.md) | 部署拓扑与组件边界 |
| [Phase1-Demo-Roadmap-Echo.md](./Phase1-Demo-Roadmap-Echo.md) | Phase 1 全功能演示路线图（功能矩阵，APK 前主清单） |
| [glossary.md](./glossary.md) | 术语表 |

## 维护说明

- **英文主文档：** `docs/`（对外工程协作用）
- **同步规则：** 修改 `docs/` 后，请同步更新本目录对应文件；项目已配置 Cursor Skill `docs-cn-mirror` 与 `postToolUse` 钩子辅助提醒
- **应用 UI 语言：** 简体中文（见 PRD §12）
