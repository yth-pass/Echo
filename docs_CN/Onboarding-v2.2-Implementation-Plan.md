# Echo 入驻问卷 v2.2 — 分阶段实施任务与 Agent 提示词

> 本文档基于 `docs_CN/Onboarding-Survey-Redesign-Proposal.md`（v2.2）设计，将提案拆解为 **8 个实施阶段**，每阶段附带可直接交给 AI Agent / 工程师的**结构化提示词**。
> 阶段顺序遵循依赖链：数据层 → 后端服务 → 合成器 → 前端 UI → 集成联调。

---

## 阶段总览

| 阶段 | 名称 | 改动层 | 优先级 | 预估工作量 | 依赖 |
|------|------|--------|--------|-----------|------|
| S1 | 数据模型与类型扩展 | API / Shared | P0 | 小 | 无 |
| S2 | Phase 0 注册阶段（身份采集） | API + Web | P0 | 中 | S1 |
| S3 | Phase 1 情境卡片（15 张） | API + Web | P0 | 大 | S1 |
| S4 | Phase 1.5 人格画像合成器 | API（LLM） | P0 | 中 | S1, S3 |
| S5 | Phase 2 对话式角色扮演 | API（LLM） + Web | P0 | 大 | S1, S4 |
| S6 | Finalize 管线升级 | API | P0 | 中 | S1–S5 |
| S7 | Worker Prompt-Composer 升级 | Worker | P1 | 小 | S6 |
| S8 | Web 前端入驻流程重构 | Echo/ | P0 | 大 | S2–S6 |

---

## S1：数据模型与类型扩展

### 目标

在不触发 Prisma schema migration 的前提下，扩展 `OnboardingSurveyJson` 类型定义，为 Phase 0/1/1.5/2 的新字段预留空间。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/survey-schema.ts` | 扩展 `OnboardingSurveyJson` 类型，新增 `identity`、`scenarioCards`、`dimensionScores`、`personaSketch`、`userFeedback`、`roleplayChats`、`styleProfile` 等 optional 字段 |
| `services/api/src/onboarding/onboarding.dto.ts` | 新增 `Phase0IdentityDto`、`ScenarioCardDto`、`PersonaSketchDto`、`UserFeedbackDto`、`RoleplayChatDto` 等 DTO 类 |

### 提示词

```
你是一名 NestJS + Prisma 后端工程师，正在为 Echo 项目的入驻问卷做数据模型升级。

## 背景
当前项目的入驻问卷使用 OnboardingSurveyJson 类型（定义在 services/api/src/onboarding/survey-schema.ts），
组织为 M1（身份基座）/ M2（语言指纹）/ M3（信念系统）三层。
现在要升级到 v2.2 的四阶段模型（Phase 0 / Phase 1 / Phase 1.5 / Phase 2），需要添加新字段。

## 关键约束
1. Prisma schema 不需要 migration —— OnboardingSession.surveyJson、Profile.bioJson、
   PersonaPrompt.boundariesJson 均为 Json? 类型列，新字段作为 JSON 内部 key 写入
2. 所有新字段必须是 optional，保持向后兼容
3. 旧数据中缺失的字段在消费侧按 undefined 降级处理

## 任务 1：扩展 survey-schema.ts 的类型定义

在 OnboardingSurveyJson 类型中新增以下 optional 字段（保留所有现有字段不动）：

### Phase 0 身份基座
identity?: {
  displayName: string;
  preferredAddress: string;
  genderIdentity: 'male' | 'female' | 'nonbinary' | 'unspecified';
  ageBand: '18-22' | '23-27' | '28-32' | '33-38' | '39-45' | '46+';
  hometownCity: string;
  currentCity: string;
  education: 'highschool' | 'college' | 'bachelor' | 'master' | 'phd' | 'overseas';
  occupation: string;
  industry: string;
  workDescription: string;           // 限 20 字
  keyLifeExperiences: string[];      // 1-3 条，每条限 15 字
  selfIntroOneLiner: string;         // 限 30 字
  goalOnEcho?: string;
  familyMembers?: FamilyMember[];    // 可选
};

新增辅助类型：
type FamilyMember = {
  relation: 'father' | 'mother' | 'sibling' | 'partner' | 'other';
  brief: string;
};

### Phase 1 情境卡片
scenarioCards?: ScenarioResponse[];
dimensionScores?: {
  bigFive?: Record<string, DimensionScore>;
  timePerspective?: string;
  moralFoundations?: Record<string, number>;
  attachmentStyle?: string;
};

新增辅助类型：
type ScenarioResponse = {
  cardId: string;    // 'forest_cabin' | 'time_machine' | 'cotton_candy' | ... 15 个
  choice: 'A' | 'B' | 'C' | 'D' | 'custom';
  freeText?: string;
  responseTimeMs?: number;
};

type DimensionScore = {
  value: number;     // -1 ~ +1
  confidence: 'high' | 'medium' | 'low';
  contradictions?: string[];
};

### Phase 1.5 人格画像合成
personaSketch?: {
  narrative: string;                 // 完整 800-1200 字人物小传（markdown）
  sections: {
    identityNarrative: string;
    personalityTexture: string;
    coreBeliefs: string;
    valuesInAction: string;
    caringStyle: string;
    socialBoundaries: string;
    contradictions: string;
    voiceAnchors: string[];
  };
  generationTimestamp: number;
};
userFeedback?: {
  accepted: boolean;
  sectionAdjustments?: Array<{
    section: string;
    originalText: string;
    userCorrection: string;
  }>;
};

### Phase 2 对话式角色扮演
roleplayChats?: RoleplayChat[];
styleProfile?: StyleProfile;

新增辅助类型：
type RoleplayChat = {
  roleName: 'stranger' | 'bestfriend' | 'crush' | 'oldfriend';
  agentName: string;          // 阿远 / 小鹿 / 小夜 / 老许
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  startedAt: number;
  endedAt: number;
  qualityFlag?: 'good' | 'low_effort' | 'incomplete';
};

type StyleProfile = {
  baselineParams: {
    avgReplyLength: number;
    sentenceLengthDist: Record<string, number>;
    emojiDensity: number;
    punctuationHabits: Record<string, number>;
    topCatchphrases: string[];
    commonParticles: string[];
  };
  relationSwitchRules: Record<string, string>;
  emotionalReactionPatterns: Record<string, string>;
  boundaries: string[];
};

## 任务 2：新增 DTO 类（onboarding.dto.ts）

为上述每个新增的数据结构创建对应的 DTO 类，使用 class-validator 装饰器做基本校验：
- IsOptional / IsString / IsArray / IsEnum / MaxLength 等
- 命名规则：Phase0IdentityDto、ScenarioCardDto、DimensionScoreDto、PersonaSketchDto、
  UserFeedbackDto、RoleplayChatDto、StyleProfileDto
- 在现有 SurveyDto 中新增对应字段（全部 @IsOptional()）

## 不要做的事
- 不要修改 Prisma schema.prisma
- 不要修改任何现有字段（只新增）
- 不要修改 buildPersonaSeedFromSurvey 或 buildTextForEmbedding 的逻辑（后续阶段处理）
```

---

## S2：Phase 0 注册阶段（身份采集 API）

### 目标

实现 Phase 0 的 12 字段身份采集后端逻辑，包括写入 `OnboardingSession.surveyJson.identity` 和同步到 `Profile` 顶层列。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/onboarding.service.ts` | 扩展 `submitSurvey()` 处理 identity 字段；新增 `submitPhase0()` 方法 |
| `services/api/src/onboarding/onboarding.controller.ts` | 新增 `POST /onboarding/phase0` 端点 |
| `services/api/src/onboarding/onboarding.dto.ts` | 完善 `Phase0IdentityDto` 的校验规则 |

### 提示词

```
你是一名 NestJS 后端工程师，正在为 Echo 项目实现入驻问卷 v2.2 的 Phase 0（注册身份采集）。

## 背景
Phase 0 是四阶段入驻的第一步，采集 12 个硬性事实字段（身份 + 经历）。
当前 submitSurvey() 函数（onboarding.service.ts:95-128）已能创建/更新 OnboardingSession 和 Profile。

## 需求

### 新增 API 端点
POST /onboarding/phase0
- JWT-guarded，throttle 20/min
- Body: Phase0IdentityDto
- 返回: { success: true, phase: 'phase0', fieldsReceived: string[] }

### submitPhase0(userId, dto) 业务逻辑

1. 校验必填字段（12 个必填 + 2 个可选）：
   必填：displayName, preferredAddress, genderIdentity, ageBand, hometownCity,
         currentCity, education, occupation, industry, workDescription,
         keyLifeExperiences (至少 1 条), selfIntroOneLiner
   可选：goalOnEcho, familyMembers

2. 写入 OnboardingSession.surveyJson：
   - 读取现有 surveyJson（如果有），在其上设置 identity 子对象
   - 保留其他已有字段不动（M1/M2/M3 等旧数据不删）

3. 同步到 Profile 顶层列：
   - Profile.displayName = dto.displayName
   - Profile.city = dto.currentCity
   - Profile.gender = 映射 genderIdentity → Profile.gender 枚举
   - Profile.birthYear = 从 ageBand 推算中间年份（如 '23-27' → 1999）
   - Profile.bioJson 中也冗余写入 identity 子对象（兼容旧读取逻辑）

4. 字段长度校验：
   - workDescription: 最多 20 字
   - selfIntroOneLiner: 最多 30 字
   - keyLifeExperiences: 1-3 条，每条最多 15 字

## 降级兼容
- 如果客户端提交的是旧版 SurveyDto（没有 identity 字段），走原有 submitSurvey 逻辑不受影响
- 新增的 submitPhase0 是独立端点，不覆盖 submitSurvey

## 不要做的事
- 不要修改 Prisma schema
- 不要删除任何现有端点或函数
```

---

## S3：Phase 1 情境卡片（15 张，API + 评分逻辑）

### 目标

实现 Phase 1 的情境卡片提交 API 和维度分数计算逻辑。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/onboarding.service.ts` | 新增 `submitPhase1()` 方法 |
| `services/api/src/onboarding/onboarding.controller.ts` | 新增 `POST /onboarding/phase1` 端点 |
| `services/api/src/onboarding/scenario-cards.ts`（新建） | 15 张卡片的定义（cardId、选项、维度映射、评分规则） |
| `services/api/src/onboarding/dimension-scorer.ts`（新建） | 维度分数计算器（维度内一致性检查、矛盾标记） |

### 提示词

```
你是一名 NestJS 后端工程师 + 心理学领域知识应用者，正在为 Echo 项目实现 Phase 1 情境卡片系统。

## 背景
Phase 1 是入驻第二步：15 张情境卡片，每张卡有 3-4 个行为选项 + 一行可选自由文本（限 20 字）。
用户完成 15 张卡后，系统计算维度分数（Big Five + 时间观 + 道德基础 + 依恋 + 归因 + 延迟满足）。

## 任务 1：创建 scenario-cards.ts（卡片定义）

为 15 张卡片各创建一个 ScenarioCardDefinition 对象，结构如下：

interface ScenarioCardDefinition {
  cardId: string;                    // 英文 snake_case
  scenarioText: string;              // 场景描述文本
  options: Array<{
    key: 'A' | 'B' | 'C' | 'D';
    text: string;
    /** 每个选项在各维度上的得分贡献 */
    dimensionContributions: Record<string, number>;  // 维度 → -1~+1
  }>;
  allowCustomText: boolean;          // 是否允许"你的版本"
  customTextMaxLength: number;
  requiredFreeText: boolean;         // Card 4 必填，其他选填
  freeTextMaxLength: number;
  sources: string[];                 // 心理学来源
  measuredDimensions: string[];      // 测量维度
}

15 张卡的具体内容严格按照文档 docs_CN/Onboarding-Survey-Redesign-Proposal.md §五 的定义：
- Card 1: forest_cabin（森林小木屋）→ E维度/信任/风险
- Card 2: time_machine（时间机器）→ 时间观
- Card 3: cotton_candy（棉花糖2.0）→ 延迟满足/冲动控制
- Card 4: unsent_letter（未寄出的信）→ 核心关切/投射（纯开放文本，必填 30 字）
- Card 5: saturday_energy（周六电量）→ E维度/社交恢复
- Card 6: trolley（失控电车）→ 功利vs道义/道德直觉
- Card 7: spotlight（聚光灯）→ E维度/社交主动度
- Card 8: deadline_eve（死线前夜）→ C维度/拖延
- Card 9: criticism（突如其来的批评）→ N维度/情绪调节
- Card 10: weekend_detour（周末的岔路）→ O维度/新奇追求
- Card 11: found_wallet（捡到钱包）→ MFT Care/Fairness/Authority
- Card 12: cafe_window（窗边的人）→ 社交主动性/关系维持
- Card 13: promotion（升职/拿奖）→ 归因风格/谦逊度
- Card 14: midnight_call（深夜电话）→ 依恋回避/焦虑/边界
- Card 15: misunderstood（被误解）→ 自我认知vs社交面具

## 任务 2：创建 dimension-scorer.ts（维度评分器）

实现 calculateDimensionScores(responses: ScenarioResponse[]): DimensionScores 函数：

1. **维度得分聚合**：遍历 15 张卡的回答，累加每张卡选项的 dimensionContributions
2. **归一化**：每个维度的原始分映射到 -1 ~ +1 区间（基于该维度的理论最大/最小值）
3. **维度内一致性检查**：
   - 对有多张卡测量的维度（如 E 有 4 张卡），计算卡间得分的标准差
   - 标准差 < 0.3 → confidence: 'high'
   - 标准差 0.3-0.6 → confidence: 'medium'
   - 标准差 > 0.6 → confidence: 'low'，并在 contradictions 数组中记录矛盾的卡对
4. **反应时间标记**：如果 responseTimeMs < 3000，标记该卡为"随机作答"，在聚合时降权（权重 0.3）
5. **自由文本优先级**：如果用户选了 'custom' 或写了自由文本，该卡的维度贡献权重 ×1.5

## 任务 3：新增 API 端点

POST /onboarding/phase1
- Body: { cards: ScenarioCardDto[], completionTimestamp: number }
- 逻辑：
  1. 校验 15 张卡全部回答（允许部分，但记录 completionRate）
  2. 调用 calculateDimensionScores()
  3. 写入 surveyJson.scenarioCards + surveyJson.dimensionScores
- 返回: { success: true, phase: 'phase1', dimensionScores: DimensionScores, completionRate: number }

## P0 最小可行集
如果一次性实现 15 张卡工作量大，P0 阶段先实现前 8 张卡（覆盖 Big Five 全部 5 个维度）：
Card 1, 5, 7 (E) + Card 8 (C) + Card 9 (N) + Card 10 (O) + Card 6 (A) + Card 4 (投射锚点)
```

---

## S4：Phase 1.5 人格画像合成器（LLM 服务）

### 目标

实现 Persona Sketch Generator —— 用 LLM 把 Phase 0 身份 + Phase 1 维度分数 + 自由文本合成为 800-1200 字的人物小传。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/persona-sketch.service.ts`（新建） | Persona Sketch 合成服务（LLM 调用 + 模板 + 用户反馈微调） |
| `services/api/src/onboarding/onboarding.controller.ts` | 新增 `POST /onboarding/persona-sketch/generate` 和 `POST /onboarding/persona-sketch/adjust` |
| `services/api/src/onboarding/onboarding.module.ts` | 注册 PersonaSketchService |

### 提示词

```
你是一名 NestJS 后端工程师，专精 LLM 应用层开发，正在为 Echo 项目实现 Phase 1.5 人格画像合成器。

## 背景
Phase 1 的 15 张卡片产出的是抽象的心理学维度分数（Big Five / MFT / 依恋 / 归因等），
但 LLM 克隆拿到 "E=0.7, O=0.3" 根本不知道怎么扮演一个人。Phase 1.5 是一个翻译层，
把"维度分数"翻译成"克隆能消费的活人人格小传"（800-1200 字叙事散文）。

## 服务设计

### PersonaSketchService 类

#### 方法 1: generate(userId: string): Promise<PersonaSketch>

1. 从数据库读取 OnboardingSession.surveyJson 中的：
   - identity（Phase 0 的 12 字段）
   - scenarioCards（15 张卡的回答）
   - dimensionScores（维度分数）

2. 构建 LLM system prompt（严格按照以下 prompt 模板）：

---SYSTEM PROMPT---
你是 Echo 的人格画像合成器。你的任务是把用户的心理学维度分数 + 选择题回答 + 自由文本，
翻译成一份 800-1200 字的「人物小传」，供下游的 LLM 克隆直接消费。

硬规则：
1. 全程使用散文叙事，禁用维度标签（不许写"高外向性""MFT Care=0.8"等任何术语）
2. 每个节都要用**具体的行为描述**，不要用形容词
   （"你体贴" ❌ → "你会默默记住朋友随口提过的餐厅，下次直接订好位置" ✅）
3. 「内在矛盾」一节必须保留矛盾的两边，不要试图"解释掉"或"和解"
4. 「语言锚点」一节必须**逐字引用**用户原话，不要改写
5. 字数控制在 800-1200 字之间——超过 1500 字会让克隆 prompt 膨胀，低于 600 字不够用
6. 如果维度分数与自由文本矛盾，**优先信任自由文本**（那是用户自己的话，不是选择题的猜测）

输出结构（严格按此 8 节输出 markdown）：

# [用户昵称] 的人物画像

## 身份脉络（Identity Narrative）
[基于 identity 字段的叙事化描述]

## 性格底色（Personality Texture）
[基于 E/O/C 维度的具体行为描述，包含陌生/朋友/独处三种场景]

## 核心信念（Core Beliefs）
[基于 MFT + Card 4 自由文本]

## 价值观优先级（Values in Action）
[基于 MFT + Card 6/11 的选择]

## 关心方式（Caring Style）
[基于 A 维度 + Card 14 的选择]

## 社交边界（Social Boundaries）
[基于 N 维度 + Card 9/15 的选择与自由文本]

## 内在矛盾（Contradictions to Preserve）
[从维度内矛盾 + Card 选择矛盾中提取，保留两边]

## 语言锚点（Voice Anchors）
[逐字引用用户在各卡片自由文本中的原话片段]
---END SYSTEM PROMPT---

3. 构建 user content：
   - 第一部分：Identity Profile（Phase 0 全部字段，格式化为可读文本）
   - 第二部分：Dimension Scores（格式化为 "维度名: 值 (置信度)" 的列表）
   - 第三部分：Scenario Responses（15 张卡的选择 + 自由文本原文）

4. 调用 LLM（使用项目现有的 LlmService），temperature=0.7，max_tokens=2000

5. 解析输出：
   - 提取完整 narrative（全文）
   - 按 ## 标题拆分 8 个 sections
   - 提取 voiceAnchors（从"语言锚点"节中逐条提取）
   - 记录 generationTimestamp

6. 写入 surveyJson.personaSketch

7. 返回 PersonaSketch 对象

#### 方法 2: adjust(userId, sectionName, userCorrection): Promise<PersonaSketch>

1. 读取现有 personaSketch
2. 构建 LLM prompt：要求只重写指定节，保持其他节不变，融入用户的纠正
3. 调用 LLM，解析结果
4. 写入 surveyJson.userFeedback.sectionAdjustments
5. 更新 surveyJson.personaSketch 中对应节 + narrative

### API 端点

POST /onboarding/persona-sketch/generate
- JWT-guarded
- 无 body（从 session 中读取数据）
- 返回: { success: true, personaSketch: PersonaSketch }

POST /onboarding/persona-sketch/adjust
- Body: { section: string, userCorrection: string }
- section 必须是 8 节之一
- userCorrection 限 30 字
- 返回: { success: true, updatedSection: string, narrative: string }

## 错误处理
- Phase 0 数据不完整 → 返回 400 "Phase 0 尚未完成"
- Phase 1 数据不完整 → 返回 400 "Phase 1 尚未完成，至少需要 8 张卡"
- LLM 超时/失败 → 重试 1 次，仍失败返回 503 + 降级提示
```

---

## S5：Phase 2 对话式角色扮演（4 Agent + 语言指纹提取）

### 目标

实现 4 个角色 Agent 的对话系统（阿远/小鹿/小夜/老许），包括角色 prompt、AI 腔黑名单过滤、不完美行为模拟，以及对话后的 style.md 生成。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/roleplay-agent.service.ts`（新建） | 4 角色对话管理服务 |
| `services/api/src/onboarding/roleplay-agents.ts`（新建） | 4 角色的 system prompt 模板 + AI 腔黑名单 |
| `services/api/src/onboarding/onboarding.controller.ts` | 新增 roleplay 相关端点 |
| `services/api/src/agent-platform/style/style-generator.service.ts` | 扩展 buildSeed() 消费 roleplayChats |

### 提示词

```
你是一名 NestJS 后端工程师 + LLM 对话系统设计专家，正在为 Echo 项目实现 Phase 2 对话式角色扮演。

## 背景
Phase 2 是入驻第四步：用户与 4 个 AI 扮演的角色进行对话，采集真实语言样本。
4 个角色是：阿远（陌生人）、小鹿（死党）、小夜（暧昧对象）、老许（深交老友）。
语言风格只能从真实对话中采集，不能从选择题中采集。

## 核心约束：8 条硬规则
实现时必须严格遵守以下规则（来自设计文档 §六）：

### Rule 1: 角色 Prompt 强隔离
每个 Agent 的 system prompt 必须锁死人设，包含明确的"禁止清单"：
- 禁止说"我是 AI""我是语言模型"等任何自我指涉
- 禁止用"我理解你的感受""那一定很辛苦"等客服式表达
- 禁止提供"建议""解决方案""多角度分析"
- 禁止用 markdown / 列表 / 分点回答
- 禁止说教、讲道理、升华

### Rule 2: 语言风格矩阵差异化
| 维度 | 阿远 | 小鹿 | 小夜 | 老许 |
|------|------|------|------|------|
| 平均句长 | 15-25字 | 5-15字 | 10-20字 | 20-40字 |
| emoji 密度 | 0.3/条 | 1.5/条 | 0.8/条 | 0/条 |
| 标点偏好 | 句号 | 省略号+感叹号 | 省略号 | 逗号长句 |
| 感叹词 | "哈哈" | "啊啊啊""我靠" | "嗯""哦" | 不用 |
| 话题深度 | 浅 | 日常 | 感受/心动 | 人生/意义 |
| 打断频率 | 0 | 高 | 低 | 中 |

### Rule 3: 不完美设计
每个 Agent 必须内置不完美行为（按概率触发）：
- 打字延迟（按消息长度 5-15 秒，前端显示"对方正在输入..."）
- 分段发送（30% 概率，多段消息间隔 0.5-1.5 秒）
- 偶尔打错字（5% 概率，随后发"打错了"纠正）
- 话题跑偏（20% 概率）
- 忘记前文（5% 概率）
- 不同意用户（10% 概率）
- 分享自己的脆弱（每段对话至少 1 次）

### Rule 4: AI 腔黑名单过滤器
Agent 输出前必须过黑名单过滤器，以下表达出现即拦截并重生成（最多 1 次）：
"我理解你的感受" / "这确实是一个值得思考的问题" / "让我来帮你分析一下" /
"从多个角度来看" / "这是一个复杂的话题" / "作为 AI，我…" /
"首先，…其次，…最后，…" / "综上所述" / "总的来说" / "让我们一起…" /
"这是一个很好的问题" / "我想你可能是…"

### Rule 5: 对话节奏控制
- 用户 >30s 无响应时 Agent 主动补话维持节奏
- 用户连发 3 条时 Agent 用缓冲语

### Rule 6: 情绪真实性
Agent 必须有真实情绪反应，不是"共情表演"：
- 用户说"我被炒了" → "卧槽？？什么情况"（不是"我理解你一定很难过"）
- 用户说"我中彩票了" → "啊啊啊真的假的"（不是"恭喜你！"）

### Rule 7: 记忆与矛盾
Agent 要主动引用之前聊过的内容，主动指出矛盾。
老许特别需要引用 Phase 1.5 Persona Sketch 中的画像内容追问用户。

### Rule 8: 自然收尾
禁止"总结发言"式结尾。每个角色有专属收尾方式：
- 阿远："那先这样，下次约咖啡～"
- 小鹿："行我去洗澡了，回聊 🛁"
- 小夜："…困了。晚安。"
- 老许："好啦，今天聊得够深了，改天继续。"

## 服务设计

### RoleplayAgentService 类

#### 方法 1: startChat(userId, roleName): Promise<{ chatId: string, openingMessage: string }>
- roleName: 'stranger' | 'bestfriend' | 'crush' | 'oldfriend'
- 读取 Persona Sketch 摘要注入 Agent 的 context
- 根据 roleName 选择对应角色的 system prompt
- 生成开场白（参考设计文档中每个角色的"典型开场"）
- 返回 chatId + openingMessage

#### 方法 2: chatTurn(userId, chatId, userMessage): Promise<{ replies: ReplyMessage[] }>
- 将用户消息追加到对话历史
- 调用 LLM 生成回复（带上角色 system prompt + 对话历史）
- 过 AI 腔黑名单过滤器
- 应用"不完美行为"（分段发送时返回多条 reply）
- 返回回复（可能 1-3 条消息，模拟分段发送）

ReplyMessage 结构：
{ content: string, delayMs: number, isTypoCorrection: boolean }

#### 方法 3: endChat(userId, chatId): Promise<RoleplayChat>
- 结束对话，生成自然收尾
- 将完整对话记录写入 surveyJson.roleplayChats
- 评估 qualityFlag（用户回复是否过短/敷衍）

#### 方法 4: extractStyleProfile(userId): Promise<StyleProfile>
- 读取全部 4 段对话（至少 2 段完成）
- 调用 LLM 做语言学特征提取：
  - 基线参数：句长分布、emoji 密度、标点习惯、口头禅 top 5
  - 关系切换规则：4 种模式下的句式/语气/话题差异
  - 情绪反应模式：面对好/坏消息、暧昧信号、矛盾追问的反应
  - 避免列表：用户回避的话题/表达方式
- 写入 surveyJson.styleProfile
- 同时生成 style.md 文本写入 Profile.styleMd

### API 端点

POST /onboarding/roleplay/start
- Body: { roleName: string }
- 返回: { chatId, openingMessage, agentName }

POST /onboarding/roleplay/turn
- Body: { chatId, message: string }
- 返回: { replies: ReplyMessage[] }

POST /onboarding/roleplay/end
- Body: { chatId }
- 返回: { success, chatSummary }

POST /onboarding/roleplay/extract-style
- 无 body
- 返回: { styleProfile, styleMd }

## P0 最小可行集
先实现 Role 2（小鹿/死党）+ Role 3（小夜/暧昧），这两个区分度最高、语料最丰富。
```

---

## S6：Finalize 管线升级

### 目标

升级 `finalize()` 函数，使其优先消费 v2.2 的新数据（Persona Sketch + roleplayChats），同时保持对旧数据的完全兼容。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/api/src/onboarding/onboarding.service.ts` | 重写 `finalize()` 中的 personaText 生成、boundariesJson 填充、dialogueJson 写入逻辑 |
| `services/api/src/onboarding/survey-schema.ts` | 升级 `buildPersonaSeedFromSurvey()` + `buildTextForEmbedding()` |
| `services/api/src/agent-platform/style/style-generator.service.ts` | 扩展 `buildSeed()` 消费 roleplayChats |

### 提示词

```
你是一名 NestJS 后端工程师，正在升级 Echo 项目的入驻完成管线（finalize），
使其能消费 v2.2 的四阶段采集数据。

## 当前 finalize() 流程（onboarding.service.ts:243-394）
1. 校验最少 6 轮对话
2. 调用 buildPersonaSeedFromSurvey() 生成 seed
3. 用 seed 调 LLM 生成 personaText（≤200 字）
4. 调用 StyleGeneratorService.generate() 生成 styleMd
5. 调用 buildTextForEmbedding() 生成 embedding 文本
6. 创建 DigitalClone + PersonaPrompt
7. 标记 session 完成 + 写 Redis + 触发 welcome post

## 需要升级的 4 个消费函数

### 1. buildPersonaSeedFromSurvey(survey) — survey-schema.ts:273-392

改动：
- 在函数顶部检查 survey.personaSketch 是否存在
- 如果存在：直接返回 personaSketch.narrative（800-1200 字人物小传），跳过 M1/M2/M3 拼接
- 如果不存在：走现有 M1/M2/M3 拼接逻辑（不修改）

理由：Persona Sketch 是 LLM 合成的叙事散文，信息密度和可扮演性远高于字段拼接。

### 2. buildTextForEmbedding(profile, survey, userId) — survey-schema.ts:193-267

改动：
- 如果 survey.personaSketch?.sections 存在，追加两段：
  "人格画像:{personaSketch.sections.identityNarrative.slice(0,100)}"
  "性格底色:{personaSketch.sections.personalityTexture.slice(0,80)}"
- 如果 survey.identity?.keyLifeExperiences 存在（数组），替换旧的单条 keyExperience
- 所有新字段缺失时输出与当前完全一致

### 3. StyleGeneratorService.buildSeed(survey, dialogue) — style-generator.service.ts:100-199

改动：
- 在 M4 深度对话部分之后，新增 "===== Phase 2 角色扮演对话 =====" 段
- 遍历 survey.roleplayChats，将每段对话的 roleName + messages 作为语言样本输入
- 在 M1 身份基座部分，如果 survey.identity 存在，从中读取 occupation/selfIntroOneLiner 等
  （优先级高于旧字段）
- roleplayChats 缺失时仍使用 dialogueJson 最后 10 轮

### 4. finalize(userId) — onboarding.service.ts:243-394

改动 A — personaText 生成升级：
- 当 survey.personaSketch 存在时：
  - LLM system prompt 改为："以 Persona Sketch 为基础，提炼出 ≤300 字的角色设定 prompt，
    保留叙事性和矛盾"
  - user content 使用 personaSketch.narrative（而非 buildPersonaSeedFromSurvey 的摘要）
- 当 personaSketch 缺失时：走现有逻辑

改动 B — boundariesJson 填充：
- 当 personaSketch.sections.socialBoundaries 存在时：
  从 socialBoundaries + contradictions 提取内容写入 PersonaPrompt.boundariesJson
  替换当前的硬编码默认值 {handoff: true, forbiddenWords: [], topicsToAvoid: null}
- 缺失时走现有默认值

改动 C — roleplayChats 写入 dialogueJson：
- Phase 2 的 roleplayChats 如果存在，合并写入 OnboardingSession.dialogueJson
  （与 M4 对话并行，不覆盖）

改动 D — 最低完成度校验升级：
- 旧逻辑：至少 6 轮 M4 对话
- 新逻辑（当 v2.2 数据存在时）：
  - Phase 0 identity 必填字段完整
  - Phase 1 至少 8 张卡完成
  - Phase 1.5 personaSketch 已生成
  - Phase 2 至少 2 段 roleplayChat 完成（建议 Role 2 + Role 3）
- 旧数据仍走旧校验逻辑

## 绝对不要做的事
- 不要删除任何现有逻辑分支（旧数据必须继续工作）
- 不要修改 Prisma schema
- 不要改变函数签名（所有新逻辑通过内部 if/else 分支实现）
```

---

## S7：Worker Prompt-Composer 升级

### 目标

确保 Worker 的 `composeSystemPrompt()` 能正确消费 v2.2 升级后的 persona prompt 和 boundaries，无需修改层级结构（L0-L8），但 L1 和 L2 的内容质量因 v2.2 显著提升。

### 改动文件

| 文件 | 改动 |
|------|------|
| `services/worker/src/agent-platform/composer/prompt-composer.ts` | 微调 boundaryClause 消费逻辑 |
| `services/worker/src/agent-platform/shared/SKILL.md` | 可能需要在角色描述中追加 v2.2 行为指令 |

### 提示词

```
你是一名 TypeScript 工程师，正在升级 Echo Worker 侧的 prompt-composer，
使其能正确消费 v2.2 升级后更丰富的 persona 和 boundary 数据。

## 背景
composeSystemPrompt()（prompt-composer.ts:57-86）当前有 L0-L8 共 9 个层：
- L0 = SKILL.md（角色基线）
- L1 = safety.md + boundaryClause（安全边界）
- L2 = sanitized persona（人格 prompt）
- L3-L6 = 记忆层（预留）
- L8 = 输出约束（"用中文简短回复一句"）

v2.2 的 finalize 升级后：
- L2 的 promptText 内容质量更高了（从 Persona Sketch 生成，有叙事性和原话锚点）
- L1 的 boundaryClause 不再是空壳，包含了真实的社交边界和矛盾标记

## 任务 1：boundaryClause 消费逻辑

当前 boundaryClause 可能是空对象 {handoff: true, forbiddenWords: [], topicsToAvoid: null}。
v2.2 后它可能包含：
{
  socialBoundaries: "能让你瞬间冷掉的话是...遇到这些情况你会...",
  contradictions: "你身上有一个重要矛盾：你渴望被懂但害怕被看穿...",
  handoff: true,
  forbiddenWords: [],
  topicsToAvoid: "..."
}

修改 composeSystemPrompt 中 boundaryClause 的注入方式：
- 如果 boundaryClause 包含 socialBoundaries 字段，将其格式化为 L1 的一部分：
  "【社交边界 — 你必须遵守】\n{socialBoundaries}\n\n【内在矛盾 — 在适当情境下自然展现】\n{contradictions}"
- 如果 boundaryClause 仍是旧格式，走现有逻辑

## 任务 2：SKILL.md 微调（如果需要）

检查 services/worker/src/agent-platform/shared/SKILL.md，确认其角色描述不需要因 v2.2 做大改。
如果 persona prompt 质量已经足够好（从 Persona Sketch 生成），SKILL.md 只需做最小改动：
- 追加一句关于"保留内在矛盾"的指令
- 追加关于"尊重社交边界"的指令

## 不要做的事
- 不要改变 L0-L8 的层级顺序
- 不要修改 sanitizePersona() 的安全逻辑
- 不要在 L2 层做任何 persona 文本的二次处理
```

---

## S8：Web 前端入驻流程重构

### 目标

将当前 960 行的单体 Onboarding.tsx 重构为模块化的四阶段入驻 UI（Phase 0/1/1.5/2）。

### 改动文件

| 文件 | 改动 |
|------|------|
| `Echo/src/features/onboarding/Onboarding.tsx` | 重构为主状态机（Phase 0 → 1 → 1.5 → 2 → finalize） |
| `Echo/src/features/onboarding/phases/Phase0Identity.tsx`（新建） | 渐进式名片 UI |
| `Echo/src/features/onboarding/phases/Phase1Cards.tsx`（新建） | 15 张情境卡片 UI |
| `Echo/src/features/onboarding/phases/Phase1_5Sketch.tsx`（新建） | 人格画像展示 + 微调 UI |
| `Echo/src/features/onboarding/phases/Phase2Roleplay.tsx`（新建） | 4 角色对话 UI |
| `Echo/src/features/onboarding/surveySteps.ts` | 新增情境卡片选项定义、角色设定等常量 |

### 提示词

```
你是一名 React + TypeScript 前端工程师，正在重构 Echo Web 客户端的入驻流程。

## 当前状态
当前入驻 UI 是一个 960 行的单体组件 Onboarding.tsx，实现 6 模块向导（M1/M2/M3/consent/M4/finalize）。
所有状态用 useState 管理在组件内部。

## 目标架构
重构为模块化的四阶段入驻，每个 Phase 是独立子组件：

```
<Onboarding> (状态机壳)
  ├─ <Phase0Identity />      → "个人名片"式渐进采集
  ├─ <Phase1Cards />         → 15 张情境卡片全屏插画
  ├─ <Phase1_5Sketch />      → 人格画像展示 + 节级微调
  └─ <Phase2Roleplay />      → 4 角色对话聊天界面
```

## Phase 0: 渐进式名片 UI（Phase0Identity.tsx）

### UX 规格
- 一屏展示一张可视化的"我的名片"卡片
- 每个字段用**单步渐进式**问答（每次只亮一个字段）
- 必填字段用实心点标识，选填字段灰色 + "跳过"按钮
- 完成时名片"翻转"动画，正面显示用户可视化头像 + 摘要
- 预计用时 5-7 分钟

### 12 个字段（按顺序）
1. 昵称/希望被怎么称呼（文本输入）
2. 性别认同（4 选 1 卡片）
3. 年龄段（6 选 1 卡片）
4. 成长城市（文本 + 自动补全）
5. 现居城市（文本 + 自动补全）
6. 最高教育（6 选 1）
7. 职业类型（10 选 1）
8. 具体工作内容（文本，限 20 字，带计数器）
9. 关键人生经历（1-3 条，每条限 15 字，带"+"按钮添加）
10. 一句话自我介绍（文本，限 30 字）
11. 注册 Echo 的目标（选择 + 可选文本）
12. 家庭信息（可选，标注"后续可在 Profile 中补充"）

### API 调用
完成所有字段后调用 POST /onboarding/phase0

## Phase 1: 情境卡片 UI（Phase1Cards.tsx）

### UX 规格
- 每张卡 = 全屏插画场景 + 3-4 个行为选项 + 一行自由文本（可选，限 20 字）
- 每卡停留 20-40 秒
- 右上角始终显示"你的画像正在成形（X/15）"+ 渐满的进度环
- 每答完 5 张卡，短暂揭晓一个画像碎片（如"你的画像已经出现了第一笔：你对陌生世界的态度"）
- 15 张全走完后调 POST /onboarding/phase1

### 卡片数据
从 surveySteps.ts 中导入 15 张卡的定义（cardId, scenarioText, options, 是否必填自由文本）

### 特殊处理
- Card 4（未寄出的信）是纯开放文本，必填，限 30 字
- 记录每卡的 responseTimeMs（从进入卡片到提交的时间差）
- 支持"保存并退出，下次继续"——进度存本地 + 每 5 卡调一次 API 暂存

## Phase 1.5: 人格画像展示 + 微调 UI（Phase1_5Sketch.tsx）

### UX 规格
- 调用 POST /onboarding/persona-sketch/generate，显示 loading（"正在画你的画像..."）
- 生成完成后展示 8 节人物小传，每节用卡片式布局
- 每个节右下角一个小按钮"这里不太像我"
- 点击弹出文本框："我其实是______"（限 30 字）
- 提交后调 POST /onboarding/persona-sketch/adjust，局部更新
- 底部按钮"全部 OK，继续"进入 Phase 2

### 视觉设计
- 整体色调温暖，类似 16Personalities 的"开盒"感
- 每节配一个小 icon（身份脉络=🧭, 性格底色=🎨, 核心信念=💎, 价值观=⚖️,
  关心方式=❤️, 社交边界=🛡️, 内在矛盾=🔄, 语言锚点=🎤）

## Phase 2: 对话式角色扮演 UI（Phase2Roleplay.tsx）

### UX 规格
- 进入时展示 4 个角色卡片（阿远/小鹿/小夜/老许），每个有人物剪影 + 一句话介绍
- P0 阶段：只展示小鹿 + 小夜（标注"推荐优先"），阿远 + 老许灰显标"即将解锁"
- 点击角色进入聊天界面（类似微信聊天 UI）
- Agent 消息显示"对方正在输入..."动画（基于 replyMessage.delayMs）
- 支持分段消息逐条出现
- 底部输入框 + 发送按钮
- 每段对话最少 6 轮，最多 15 轮
- 达到最低轮数后显示"可以结束了"按钮，触发自然收尾
- 全部角色完成后调 POST /onboarding/roleplay/extract-style

## 状态管理

主状态机：
type OnboardingPhase = 'phase0' | 'phase1' | 'phase1_5' | 'phase2' | 'finalize';

- 每个 Phase 完成后自动推进到下一个
- 支持"保存并退出"——当前进度写入 OnboardingSession
- 重新进入时读取 session 状态恢复到对应 Phase

## API 调用汇总
- POST /onboarding/phase0（Phase 0 完成）
- POST /onboarding/phase1（Phase 1 完成）
- POST /onboarding/persona-sketch/generate（Phase 1.5 生成）
- POST /onboarding/persona-sketch/adjust（Phase 1.5 微调）
- POST /onboarding/roleplay/start（Phase 2 开始对话）
- POST /onboarding/roleplay/turn（Phase 2 每轮对话）
- POST /onboarding/roleplay/end（Phase 2 结束对话）
- POST /onboarding/roleplay/extract-style（Phase 2 提取语言指纹）
- POST /onboarding/finalize（全部完成）

## 不要做的事
- 不要一次性删除旧的 M1-M4 UI（先保留为 fallback，待 v2.2 灰度验证后再清理）
- 不要修改 App.tsx 的状态机逻辑（splash → auth → onboarding → main 不变）
- 不要引入新的状态管理库（继续使用 useState + useCallback）
```

---

## 附：实施依赖关系图

```
S1 (数据模型)
 ├─→ S2 (Phase 0 API)
 ├─→ S3 (Phase 1 API + 评分)
 │    └─→ S4 (Phase 1.5 合成器)
 │         └─→ S5 (Phase 2 对话)
 │              └─→ S6 (Finalize 升级)
 │                   └─→ S7 (Worker 升级)
 └─→ S8 (Web 前端) ← 依赖 S2-S6 的 API
```

## 附：验证检查清单

| 阶段 | 验证方法 |
|------|---------|
| S1 | TypeScript 编译通过（tsc --noEmit），所有新字段为 optional |
| S2 | 用 curl/Postman 提交 12 字段，验证 surveyJson.identity + Profile 顶层列写入 |
| S3 | 提交 15 张卡回答，验证 dimensionScores 计算正确，矛盾标记正常 |
| S4 | 给定 mock 的 Phase 0+1 数据，验证 Persona Sketch 生成 800-1200 字、8 节完整 |
| S5 | 与小鹿聊 6 轮，验证无 AI 腔泄漏、有分段发送、有 emoji |
| S6 | 用完整 v2.2 数据跑 finalize，验证 personaText/boundariesJson/styleMd/embedding 全部产出 |
| S7 | 启动 Worker，发一条消息，验证 composeSystemPrompt 中 L1 boundaries 包含真实社交边界 |
| S8 | 在浏览器中完整走完 Phase 0→1→1.5→2→finalize，无白屏/报错 |
