# Echo Web 原型 — Phase 1 范围映射

| 字段 | 值 |
|------|-----|
| **读者** | 工程、产品 |
| **最后更新** | 2026-05-28 |
| **相关文档** | [Phase 1 演示路线图（主清单）](../../docs_CN/Phase1-Demo-Roadmap-Echo.md)、[软件架构（Phase 1）](../../docs_CN/Software-Architecture-Echo.md#15-分阶段实施)、[部署与组件边界](../../docs_CN/Deployment-and-Component-Boundaries-Echo.md)、[English](./PHASE1-SCOPE-MAP.md) |

仓库目录 [`echo/`](../) 为 **React + Vite Web 原型**。架构文档中的 Phase 1 指 **Android APK** 与独立的 **Echo Platform**（API、worker、Postgres 等）。[`echo/`](../) **不能**替代这些交付物；仅用于**映射** UI 与 API 契约，供演示与未来联调。

**实现进度（一项一行、APK 前先完成本地全功能演示）：** 以 [**Phase 1 演示路线图**](../../docs_CN/Phase1-Demo-Roadmap-Echo.md) 中的功能矩阵为准，勿仅依赖本文件。

**状态列（v1.1.0）：** 每行 `P1-xx` 分列 **`API` | `Worker` | `Web` | `APK`**，不再使用单一 `done`。`echo/` 工作只更新 **`Web`**。校园 APK 须满足路线图 §3.3 发布门槛。

---

## Sprint 对照表（架构 §15）

| Sprint | 官方交付物 | `echo/` 内（Web 层） | 独立项目 / 可部署单元 |
|--------|------------|----------------------|------------------------|
| Foundation | 认证、API 网关、Postgres、Android 壳 | 认证壳 + `VITE_API_BASE_URL`；splash token 路径（`P1-02` Web **done**） | `apps/android`、`services/api`、`infra/` |
| Onboarding | 问卷、对话、分身创建 UI（zh-CN） | 8 步向导 + `POST /onboarding/*`（`P1-03` Web **done**） | [入驻问卷设计](../../docs_CN/Onboarding-Survey-Design-Echo.md) |
| Clone runtime | 人格、边界、agent worker、LLM | 暂停/恢复、人格与边界编辑（`P1-04a–c` Web **done**）；发帖 UI（`P1-06`） | Worker + [分身运行时](../../docs_CN/Clone-Runtime-and-Triggers-Echo.md) |
| Social | 动态阅读、定时发帖、审核 | 广场 + 详情 + 数据来源提示（`P1-05`–`06` Web **done**） | `post-draft`、`moderation` 队列 |
| Matching | 向量检索、推送、智能体会话 | 列表、忽略/拉黑、会话消息（`P1-07`–`08` Web **done**） | pgvector、FCM、`agent-turn` |
| Handoff | 好感度、FCM、handoff 界面 | 详情好感度、接受/拒绝（`P1-09` Web **done**） | Affinity 引擎、FCM |
| Transparency | 审计日志 UI | 活动 Tab + 会话全文（`P1-10` Web **done**） | 平台侧审计写入 |
| Safety | 举报 | `ReportSheet` → `POST /reports`（`P1-11` Web **done**） | `report-triage` worker |
| Live（可选） | WebSocket 推送 | `connectLiveEvents` → `/v1/ws`（`P1-12` Web **done**） | Redis `echo:live` |
| Hardening | 安全、压测、APK 签名 | 仅 `npm audit` — **不能**替代 APK 签名 | `apps/android`、CI |

---

## 建议仓库 / 目录

| 序号 | 路径 | 角色 |
|------|------|------|
| 1 | `apps/android` | Phase 1 APK（`P1-14`–`15` **todo**） |
| 2 | `services/api` | REST + WebSocket 网关 |
| 3 | `services/worker` | BullMQ + clone runtime |
| 4 | `infra/` | Docker Compose（Postgres、Redis、MinIO） |
| 5 | `.github/workflows/` | Debug APK CI（release 签名 **todo**） |

---

## 配置

- 将 `VITE_API_BASE_URL` 设为包含 `/v1` 的 API 根（见软件架构 §10）。留空则**仅 mock**。
- WebSocket：登录后 `ws://localhost:4000/v1/ws?token=<access_token>`。

---

## 变更记录

| 版本 | 日期 | 摘要 |
|------|------|------|
| 1.0.2 | 2026-05-28 | Sprint 行与路线图 P1-04–P1-12 Web done 对齐；新增 Live 行 |
| 1.0.1 | 2026-05-26 | 指向路线图 API/Web/APK 分列；P1-04 拆分 |
| 1.0.0 | 2026-05-20 | 初版范围映射 |
