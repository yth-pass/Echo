# Echo — 入驻问卷设计（Phase 1）

| 字段 | 值 |
|------|-----|
| **文档版本** | 1.0.0 |
| **状态** | Active |
| **相关文档** | [PRD §7.2](./PRD-Echo.md)、[软件架构 §8.2](./Software-Architecture-Echo.md)、[Phase 1 路线图](./Phase1-Demo-Roadmap-Echo.md) |

## 设计灵感

- **Hinge / Bumble 提示语** — 一屏一题；用具体场景选项代替长表单。
- **Replika 类语气画像** — 形容词标签 + 用户原话样本。
- **FR-011** — 结构化问卷后用短 AI 对话捕捉非结构化语气。

## 客户端流程（`echo` 入驻向导）

1. 基础 — 城市、目标、兴趣（标签）
2. 语言风格 — 3 个场景回复选择
3. 语气标签 — 预设中选 2–3 个
4. 可选常用句
5. 价值观 — 2 道二选一
6. 授权
7. AI 对话 — 4–6 轮 `POST /onboarding/dialogue/turn`
8. 完成 — `POST /onboarding/finalize`

## 标准 JSON（`surveyJson` / `Profile.bioJson`）

| 字段 | 类型 | 用途 |
|------|------|------|
| `displayName` | string | 广场展示名 |
| `city` | string | 匹配 / persona |
| `goal` | string | 约会目标 |
| `interests` | string[] | 匹配 |
| `styleReplies` | `{ scenarioId, choiceId, text }[]` | 语言模仿种子 |
| `toneTags` | string[] | 语气 |
| `sampleMessage` | string? | 原话样本 |
| `valuesChoices` | `{ questionId, choiceId, label }[]` | 价值观 |

实现：[`services/api/src/onboarding/survey-schema.ts`](../services/api/src/onboarding/survey-schema.ts)。

## 老用户

`POST /auth/login` 与 `GET /auth/me` 返回 `onboardingComplete`。为 `true` 时客户端跳过向导进入主界面。

## 演示 NPC

种子用户 `13800000001` / `13800000002` 使用与真人**相同 JSON 结构**（林溪的分身 / 陈默的分身）。见 [`services/api/prisma/seed.ts`](../services/api/prisma/seed.ts)。
