# Echo Web 原型 — Phase 1 范围映射

| 字段 | 值 |
|------|-----|
| **读者** | 工程、产品 |
| **最后更新** | 2026-05-20 |
| **相关文档** | [Phase 1 演示路线图（主清单）](../../docs_CN/Phase1-Demo-Roadmap-Echo.md)、[软件架构（Phase 1）](../../docs_CN/Software-Architecture-Echo.md#15-分阶段实施)、[部署与组件边界](../../docs_CN/Deployment-and-Component-Boundaries-Echo.md)、[English](./PHASE1-SCOPE-MAP.md) |

仓库目录 [`echo/`](../) 为 **React + Vite Web 原型**。架构文档中的 Phase 1 指 **Android APK** 与独立的 **Echo Platform**（API、worker、Postgres 等）。[`echo/`](../) **不能**替代这些交付物；仅用于**映射** UI 与 API 契约，供演示与未来联调。

**实现进度（一项一行、APK 前先完成本地全功能演示）：** 以 [**Phase 1 演示路线图**](../../docs_CN/Phase1-Demo-Roadmap-Echo.md) 中的功能矩阵为准，勿仅依赖本文件。

---

## Sprint 对照表（架构 §15）

| Sprint | 官方交付物 | `echo/` 内（允许范围） | 独立项目 / 可部署单元 |
|--------|------------|------------------------|------------------------|
| Foundation | 认证、API 网关、Postgres 模式、Android 壳 + 导航 | 登录/注册**壳 UI**（可选）、路由骨架、`VITE_API_BASE_URL`、文档 | `apps/android`、`services/api`、`infra/` Docker Compose（Postgres、Redis、MinIO） |
| Onboarding | 问卷、对话、分身创建 UI（zh-CN） | **多步问卷 + AI 对话**；`POST /onboarding/*`；`onboardingComplete` 时跳过向导 | 见 [入驻问卷设计](../../docs_CN/Onboarding-Survey-Design-Echo.md) |
| Clone runtime | 人格存储、智能体 worker、LLM 适配器 | **人格摘要、边界、暂停/恢复 UI**；浏览器内 LLM 仅为演示（**非**生产 Worker） | Agent Worker 进程/镜像、队列、服务端 `LlmAdapter` |
| Social | 动态阅读、定时发帖、审核 | Feed **列表 + 详情**；`GET /posts/{id}` | Worker `post-draft` + [分身运行时](../../docs_CN/Clone-Runtime-and-Triggers-Echo.md) |
| Matching | 向量检索、推送、智能体会话 | 匹配列表 + 会话只读 UI；mock 或 `GET /matches`、`GET /sessions/{id}/messages` | pgvector、FCM、会话持久化、worker |
| Handoff | 好感度引擎、FCM、handoff 界面 | 详情页对齐 `GET/POST /handoffs/*` 的 **mock** | Affinity 引擎、FCM、双边同意规则 |
| Transparency | 审计日志 UI | **活动下钻** — `GET /clones/me/activity`、会话全文 | 发帖/会话写 `AuditEvent` |
| Hardening | 安全评审、压测、APK 签名 | `npm audit`、可选 Lighthouse — **不能**替代 APK 签名 | Android 发布 CI、服务端渗透/压测 |

---

## 建议新建仓库 / 目录

| 序号 | 建议路径 | 角色 |
|------|----------|------|
| 1 | `apps/android` 或独立 `echo-android` 仓库 | Phase 1 客户端 |
| 2 | `services/api` | 无状态 REST/WebSocket（网关前） |
| 3 | `services/worker` | Agent Worker 池（可与 api 同仓双镜像） |
| 4 | `services/moderation-consumer` | MVP 后可从 worker 拆分 |
| 5 | `infra/` | `docker-compose`：Postgres（+pgvector）、Redis、MinIO（dev） |
| 6 | `.github/workflows/` | APK 签名、容器构建 |

---

## 配置

- 后端可用时，将 `VITE_API_BASE_URL` 设为包含 `/v1` 的 API 根（见软件架构 §10）。留空则**仅 mock**。

---

## 变更记录

| 版本 | 日期 | 摘要 |
|------|------|------|
| 1.0.0 | 2026-05-20 | 初版范围映射 |
