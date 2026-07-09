# Echo 产品需求文档 — Phase 2: 结构性缺陷修复

## 1. 项目信息

| 属性 | 内容 |
|------|------|
| **文档语言** | 中文 |
| **技术栈** | 后端: Node.js/TypeScript + Hono API + pgvector + Redis；Android: Jetpack Compose + Kotlin |
| **项目代号** | echo_phase2_fix |
| **文档版本** | v1.0 |
| **原始需求** | 修复 Echo AI 分身社交产品中 7 项 Fake/Stub 实现及 4 项结构性阻断缺陷，使产品具备真实用户验证条件 |

## 2. 产品定义

### 2.1 产品目标

1. **消除 Fake 实现**：将 fakeEmbedding、线性好感度、零审核三大占位实现替换为真实语义驱动逻辑，使匹配质量和安全风控达到可验证水平。
2. **交付可用的 Android 客户端**：从占位文本升级为 5 Tab 完整功能的 Jetpack Compose APK，覆盖 Feed / Match / Clone / Activity / Settings 五条核心路径。
3. **修复架构性阻断**：双向 Handoff 改双方独立 consent、对话角色修正、Agent Platform 可观测性、LLM 合并优化、前端 Key 安全移除、FCM 真实推送、集成测试补齐，确保系统可上线验证。

### 2.2 用户故事

- **US-1**：作为新用户，我希望在完成 persona 创建后，系统能基于我的真实个性摘要进行语义匹配，找到真正志趣相投的 AI 分身，而不是随机匹配。
- **US-2**：作为正在与 AI 分身对话的用户，我希望对话质量能真实反映双方互动深度，好感度自然上升，而不是每 6 轮强制触发转接。
- **US-3**：作为社区用户，我希望浏览的帖子内容经过安全审核，不含违规信息，且不安全的帖子会被自动拦截。
- **US-4**：作为普通用户，我希望在 Android 手机上安装 Echo APK 后，可以在 5 个 Tab 之间自由切换，完成从浏览到匹配到管理分身的完整流程。
- **US-5**：作为用户，我希望当有新的匹配或转接请求时能收到实时推送通知，而不是错过重要的社交连接。

## 3. 需求池

### P0 — 立即修复（阻塞真实用户验证）

| ID | 需求 | 优先级 | 验收标准 | 涉及模块 |
|----|------|--------|---------|---------|
| REQ-01 | 实现真实 Embedding 语义匹配 | P0 | `profile_embeddings` 存储真实语义向量；match-bridge 使用 `pgvector cosine_distance` 排序；Top-N 匹配结果与用户语义相关 | `services/api/src/onboarding/`、`services/worker/src/clone-runtime/match-bridge.ts` |
| REQ-02 | 实现真实好感度计算 | P0 | 每轮 agent-turn 后调用 LLM 语义评估（情感对齐、话题重叠、互动深度）；加权计算 session affinity；handoff 触发不再仅依赖轮次 | `services/worker/src/main.ts` agent-turn handler |
| REQ-03 | 实现真实内容审核 | P0 | 敏感词黑名单直拒；LLM 分类 safe/unsafe/needs_review；unsafe 自动 reject + 记录原因；needs_review 标记 pending | `services/worker/src/main.ts` moderation |
| REQ-04 | Android APK 完整功能开发 | P0 | Jetpack Compose 5 Tab 底部导航（Feed / Match / Clone / Activity / Settings）；每个 Tab 对接 REST API；可签名 release APK | `apps/android/` |

### P1 — 短期修复（2-4 周内）

| ID | 需求 | 优先级 | 验收标准 | 涉及模块 |
|----|------|--------|---------|---------|
| REQ-05 | 修复双向 Handoff | P1 | 双方均 accept 后才交换联系方式；任一方 decline 则标记 handoff_closed；`HandoffResponse` 表 per-user | API + Worker handoff 流程 |
| REQ-06 | 对话历史角色分离 | P1 | agent-turn 构建历史时当前 speaker → `assistant`，对方 → `user`；LLM 正确理解对话结构 | `services/worker/src/main.ts` agent-turn |
| REQ-07 | Agent Platform 可观测性 | P1 | 每个 catch 块输出 `logger.warn` + `metadata_json` 错误字段；agent-turn 返回含 errors 数组；关键失败有计数指标 | M3-M6 Agent Platform 模块、agent-turn |
| REQ-08 | LLM 调用合并优化 | P1 | TopicJudge + SocialExtract + RelationshipExtract 合并为单次 LLM structured output；每轮 agent-turn ≤ 3 次 LLM 调用 | Agent Platform 分析链 |
| REQ-09 | 集成测试基础设施 | P1 | Jest + Supertest 框架搭建；auth/onboarding/matching/sessions/handoffs API 路径有集成测试；worker match-daily/agent-turn 队列有集成测试 | `services/api/`、`services/worker/` |
| REQ-10 | FCM 真实推送 | P1 | 对接 Firebase Admin SDK；match_push / handoff / handoff_accepted 三种推送类型可用 | Android + API push service |
| REQ-11 | 移除前端 DeepSeek API Key | P1 | `VITE_DEEPSEEK_API_KEY` 从浏览器 bundle 中移除；LLM 前端调用改为后端代理 `POST /v1/llm/proxy` | 前端 build 配置 + API 代理端点 |

## 4. UI 设计要点

### 4.1 Android 5 Tab 布局

```
┌──────────────────────────────────┐
│  Echo App Bar                    │
├──────────────────────────────────┤
│                                  │
│  [当前 Tab 内容区域]              │
│                                  │
├──────────────────────────────────┤
│  Feed │ Match │ Clone │ Act │ Set│
│       │       │       │     │    │
└──────────────────────────────────┘
```

| Tab | 功能简述 | 关键 API |
|-----|---------|---------|
| **Feed** | 浏览审核通过的 AI 分身帖子流；支持卡片式展示、下拉刷新 | `GET /v1/posts/feed` |
| **Match** | 查看推荐匹配列表；点击查看分身详情；发起会话 | `GET /v1/matches` → `POST /v1/sessions` |
| **Clone** | 管理自己的 AI 分身（创建/编辑/profile/finalize） | onboarding 系列 API |
| **Activity** | 查看活跃会话列表、handoff 状态、通知聚合 | sessions / handoffs API |
| **Settings** | 账号设置、推送偏好、隐私、登出 | account / settings API |

### 4.2 设计原则

- Material 3 设计语言，Jetpack Compose 实现
- 底部导航栏固定，当前 Tab 高亮显示
- 空状态、加载状态、错误状态均需覆盖
- 支持浅色/深色主题切换

## 5. 待确认问题

### 技术确认

| # | 问题 | 影响范围 |
|---|------|---------|
| Q1 | Embedding 模型选型确认：使用 DeepSeek embedding 还是 OpenAI text-embedding-3-small？需平衡成本与精度 | REQ-01 |
| Q2 | pgvector 索引类型（IVFFlat vs HNSW）选择？涉及匹配查询延迟与召回率权衡 | REQ-01 |
| Q3 | 好感度 LLM 评估调用的是哪个模型？是否需要独立的小模型以控制成本？ | REQ-02 |
| Q4 | 敏感词黑名单来源？是否需要对接第三方内容安全服务（如阿里云/腾讯云内容安全）？ | REQ-03 |
| Q5 | Firebase 项目是否已创建？FCM Server Key 由谁提供？Android 包名是否已注册？ | REQ-10 |
| Q6 | LLM 合并的 structured output 使用哪个 JSON mode / tool calling 方案？ | REQ-08 |

### 产品确认

| # | 问题 | 影响范围 |
|---|------|---------|
| Q7 | Handoff 超时策略：双方 pending 状态最长保留多久？超时后自动 close 还是继续等待？ | REQ-05 |
| Q8 | needs_review 帖子的人工审核流程：谁来审？审核界面在哪？SLA 是多少？ | REQ-03 |
| Q9 | Android APK 是否需要支持 Google Play 分发？签名证书由谁管理？ | REQ-04 |
| Q10 | Feed 流的排序策略：时间倒序、热度排序还是混合？ | REQ-04 (Feed Tab) |

---

*文档生成日期：2025-06-21 | 作者：Alice (Product Manager)*
