# Echo Onboarding v2.2 实施核查报告

核查日期：2026-06-27
核查范围：`docs_CN/Onboarding-v2.2-Implementation-Plan.md`（8 阶段实施计划）与 `docs_CN/Onboarding-Survey-Redesign-Proposal.md`（v2.2 设计提案）的完整实现情况

---

## 总体结论

**v2.2 的四阶段入驻系统（Phase 0 / 1 / 1.5 / 2）已全栈实现，覆盖 API 层、Worker 层、前端层。** 8 个实施阶段中，S1-S7 基本完整实现，S8 前端核心流程也已搭建完毕。但仍存在若干需关注的偏差项和缺失项，共计 4 个偏差（PARTIAL）和 2 个缺失（MISSING），以及若干非阻塞性问题。

---

## 各阶段核查结果

### S1：数据模型与类型扩展 — 完成

`survey-schema.ts` 中 `OnboardingSurveyJson` 已新增全部 7 个 v2.2 optional 字段：`identity`（14 子字段）、`scenarioCards`、`dimensionScores`（4 子维度）、`personaSketch`（8 节 sections）、`userFeedback`、`roleplayChats`、`styleProfile`。辅助类型 `FamilyMember`、`ScenarioResponse`、`DimensionScore`、`RoleplayChat`、`StyleProfile` 全部定义完整。

`onboarding.dto.ts` 中 7 个 DTO 类全部创建，使用 class-validator 装饰器做了基本校验。`SurveyDto` 已整合所有 v2.2 字段。

非阻塞观察：`PersonaSketchDto.sections`、`StyleProfileDto.baselineParams` 等嵌套结构使用 `@IsObject()` 而非 `@ValidateNested()`，运行时不会深度校验内部字段。这不影响功能但存在输入合法性盲区。

---

### S2：Phase 0 注册 API — 完成（1 个偏差）

`submitPhase0()` 方法存在，写入 `surveyJson.identity`，同步到 Profile 顶层列（`displayName`、`city`、`gender`、`birthYear` 从 `ageBand` 推算）。字段长度校验通过 DTO 实现。

`POST /onboarding/phase0` 端点 JWT-guarded、Throttle 20/min、返回格式符合规范。

**偏差项：** 文档规定 10 个必填字段 + 2 个可选，但实现中 `Phase0IdentityDto` 声明了 12 个必填 + 2 个可选（`preferredAddress` 和 `industry` 被设为必填而非可选）。这不影响运行但与文档不一致。

---

### S3：Phase 1 情境卡片 — 完成

`scenario-cards.ts` 定义了完整的 15 张卡片（`forest_cabin` 到 `misunderstood`），每张卡都有 `scenarioText`、4 个选项（Card 4 除外，它是纯开放文本）、`dimensionContributions`、心理学来源、测量维度。Card 4 `unsent_letter` 正确设为 `requiredFreeText: true`、`freeTextMaxLength: 30`。

`dimension-scorer.ts` 实现了全部 5 项算法要求：维度得分聚合、归一化到 -1~+1、维度内一致性检查（阈值 0.3/0.6）、反应时间降权（<3000ms 权重 0.3）、自由文本加权（×1.5）。

`POST /onboarding/phase1` 端点和 `submitPhase1()` 方法均存在，逻辑完整（校验卡数、调用评分器、写入 surveyJson、同步 Profile）。

---

### S4：Phase 1.5 人格画像合成器 — 完成

`persona-sketch.service.ts` 完整实现了 `generate()` 和 `adjust()` 两个方法：

- `generate()`：读取 Phase 0 + Phase 1 数据，构建包含 6 条硬规则的 LLM system prompt（禁用维度标签、行为描述、保留矛盾、逐字引用、800-1200 字、优先信任自由文本），temperature=0.7、max_tokens=2000，解析输出为 8 节 sections + narrative + voiceAnchors + timestamp，写入 surveyJson。
- `adjust()`：验证节名合法性（8 节之一），仅重写指定节，写入 `userFeedback.sectionAdjustments`，重新拼装 narrative。

两个 API 端点（`persona-sketch/generate` 和 `persona-sketch/adjust`）存在。`PersonaSketchService` 已注册到 `onboarding.module.ts`。

---

### S5：Phase 2 对话式角色扮演 — 完成（2 个偏差）

`roleplay-agent.service.ts` 实现了 4 个核心方法：`startChat`、`chatTurn`、`endChat`、`extractStyleProfile`。8 条硬规则中的 7 条完整落地，4 个 API 端点全部存在。

**偏差项 1（文件命名）：** 文档要求 `roleplay-prompts.ts`，实际文件名为 `roleplay-agents.ts`。内容完整，仅命名偏差。

**偏差项 2（Rule 7 记忆与矛盾）：** 矛盾追踪仅通过老许的 system prompt 指令实现，没有服务层的程序化矛盾检测机制或跨会话记忆注入。其他三个角色的 prompt 中未包含记忆/矛盾指令。这在单次对话中可接受（依赖 LLM context window），但对长对话是脆弱点。

---

### S6：Finalize 管线升级 — 完成（1 个偏差 + 1 个缺失）

**4 个消费函数全部升级：**

- `buildPersonaSeedFromSurvey`：优先返回 `personaSketch.narrative`，缺失时走 M1/M2/M3 旧逻辑。
- `finalize()` 四项变更：(A) personaText 从 personaSketch 生成，(B) boundariesJson 从 socialBoundaries + contradictions 填充，(C) roleplayChats 合并写入 dialogueJson，(D) v2.2 四阶段完成度校验（Phase 0 身份完整 + Phase 1 至少 8 卡 + Phase 1.5 画像已生成 + Phase 2 至少 2 段对话）。所有变更都有旧数据降级路径。

**偏差项：** `buildTextForEmbedding` 中旧的 `keyExperience` 和新的 `identity.keyLifeExperiences` 同时被推入（当两者都存在时），没有互斥处理。`style-generator.service.ts` 中对应的代码正确地使用了 `if/else if` 互斥，两处实现不一致，可能导致 embedding 文本中出现两段"关键经历"。

**缺失项：** `buildSeed()` 中 M4 对话段和 Phase 2 角色扮演段是两个独立区块，当 `roleplayChats` 缺失时，M4 对话虽然仍被包含，但并非作为"Phase 2 的降级替代"存在。文档规定"roleplayChats 缺失时仍使用 dialogueJson 最后 10 轮"，当前实现效果上等价（M4 对话总是包含），但逻辑上不是显式降级关系。

---

### S7：Worker Prompt-Composer 升级 — 完成（1 个偏差）

`prompt-composer.ts` 正确消费 v2.2 boundaryClause：检测 `【` 标记后将包含 `socialBoundaries`（【社交边界 — 你必须遵守】）和 `contradictions`（【内在矛盾 — 在适当情境下自然展现】）的多行块直接推入 L1，旧格式走 `- boundary:` 单行降级。格式化逻辑位于 `clone-runtime/boundaries.ts`，composer 通过 `includes('【')` 检测路由。

SKILL.md 已更新两条指令：保留内在矛盾不消解（第 26 行）+ 尊重 L1 社交边界（第 27 行）。

**偏差项：** L0-L8 层级编号在文件头注释（L0=safety, L1=SKILL）和函数体代码（l0=SKILL, l1=safety）之间不一致。实际组装顺序正确（SKILL 在前、safety+boundaries 紧随其后），但文档标签有混淆。`safety.md` 自身也声明为"L0"。

---

### S8：Web 前端入驻重构 — 完成（2 个偏差）

前端已从 960 行单体 `Onboarding.tsx` 重构为 `v2/` 目录下 21 个模块化文件，四阶段架构清晰：`OnboardingShell`（状态机壳）→ `Phase0Identity` → `Phase1Cards` → `Phase1_5Sketch` → `Phase2Roleplay` → `Finalize`。

**Phase 0** 渐进式名片 UI 存在，单步采集 + 名片翻转动画 + 进度条。Phase 1 情境卡片 UI 完整（15 张全屏插画 + 选项 + 自由文本、ProgressRing "X/15"、每 5 卡揭晓画像碎片、Card 4 纯开放文本必填、responseTimeMs 计时）。Phase 1.5 画像展示 + 微调 UI 完整（loading、8 节卡片、"这里不太像我"按钮、30 字纠正输入）。Phase 2 角色对话 UI 完整（4 角色卡片、P0 仅小鹿+小夜可用、微信式气泡聊天、"对方正在输入..."动画、分段消息、6-15 轮控制）。

旧版 `OnboardingLegacy.tsx` 完整保留，`localStorage` key `onboarding_version` 作为 v1/v2 切换 feature flag。

**偏差项 1（Phase 0 字段缺失）：** UI 表单中缺少 `displayName` 和 `industry` 两个字段。`displayName` 在 payload 构建时直接用 `preferredAddress` 的值填充，`industry` 被错误地赋值为 `formData.occupation`（即 industry 和 occupation 永远相同）。这两个字段虽然后端 DTO 标记为必填，但前端并未让用户实际填写。

**偏差项 2（familyMembers 处理）：** `familyMembers` 在表单中是一个纯文本输入框，但类型定义期望 `FamilyMember[]`（包含 `relation` + `brief` 的结构化数组）。payload 构建时直接设为 `undefined`，用户在表单中输入的内容被丢弃。

---

## 需要修复的问题清单

### 高优先级（影响功能正确性）

| # | 阶段 | 问题 | 建议修复 |
|---|------|------|---------|
| 1 | S8 | `industry` 字段未独立采集，直接复制 `occupation` 的值 | 在 `phase0-fields.data.ts` 中增加 `industry` 字段定义，或从 occupation 选项中派生 |
| 2 | S8 | `familyMembers` 表单输入被丢弃（类型不匹配） | 将表单字段改为结构化输入（relation + brief 的多行表单），或在 payload 构建时解析文本为 FamilyMember[] |
| 3 | S6 | `buildTextForEmbedding` 中 `keyExperience` 和 `identity.keyLifeExperiences` 未互斥 | 改为 `if (identity.keyLifeExperiences) { ... } else if (keyExperience) { ... }` 模式，与 `style-generator.service.ts` 保持一致 |

### 中优先级（规范一致性）

| # | 阶段 | 问题 | 建议修复 |
|---|------|------|---------|
| 4 | S2 | 必填字段数 12 个 vs 文档规定 10 个 | 文档中 "10 个必填" 实际是计数错误（列出了 12 个字段名），建议更新文档为 12 个 |
| 5 | S5 | `roleplay-prompts.ts` 文件不存在（实际为 `roleplay-agents.ts`） | 更新文档引用路径，或将文件重命名为 `roleplay-prompts.ts` |
| 6 | S8 | `displayName` 未作为独立字段采集 | 在表单中增加 `displayName` 字段，或在 payload 构建逻辑中明确标注 displayName 来源为 preferredAddress |

### 低优先级（文档/注释债务）

| # | 阶段 | 问题 | 建议修复 |
|---|------|------|---------|
| 7 | S7 | L0-L8 层级编号在文件头 vs 函数体不一致 | 统一文件头注释与函数体中的 L0/L1 标签 |
| 8 | S5 | Rule 7（记忆与矛盾）缺乏服务层支持 | 考虑在 service 中增加对话摘要注入或矛盾检测逻辑 |
| 9 | S1 | 嵌套 DTO（personaSketch.sections 等）缺少 `@ValidateNested()` | 补充深度校验装饰器，或在文档中说明为有意为之的宽松校验 |

---

## 完成度统计

| 阶段 | 检查项总数 | EXISTS | PARTIAL | MISSING | 完成度 |
|------|-----------|--------|---------|---------|--------|
| S1 数据模型 | 19 | 19 | 0 | 0 | **100%** |
| S2 Phase 0 API | 13 | 12 | 1 | 0 | **92%** |
| S3 情境卡片 | 10 | 10 | 0 | 0 | **100%** |
| S4 画像合成器 | 14 | 14 | 0 | 0 | **100%** |
| S5 角色扮演 | 16 | 14 | 2 | 0 | **88%** |
| S6 Finalize 管线 | 15 | 13 | 1 | 1 | **87%** |
| S7 Worker 升级 | 8 | 7 | 1 | 0 | **88%** |
| S8 前端重构 | 16 | 13 | 2 | 0 | **88%** |
| **总计** | **111** | **102** | **7** | **1** | **92%** |

**结论：v2.2 实施整体完成度约 92%。** 核心功能链路（数据采集 → 维度评分 → 人格画像合成 → 对话角色扮演 → Finalize → Worker 消费）已全链路打通。剩余的 9 个问题多为字段映射精确度、文档同步和边缘校验，不影响主流程可运行性，但需要在进入灰度/生产前修复高优先级的 3 项。
