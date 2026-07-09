# Echo 匹配算法重构 — 分阶段 AI 提示词 (v1.1)

> 基于 [Matching-Algorithm-Redesign-Echo.md](../docs/Matching-Algorithm-Redesign-Echo.md) v1.1 设计。
> 共 8 个阶段，每阶段一条独立提示词，可直接喂给 Cursor / Claude Code 执行。
> 相比 v1.0 新增：阶段 5（IdealPartnerSketch 后端 LLM 合成）和阶段 7（Phase 1.6 前端页面）。

---

## 执行顺序总览

```
阶段 1-3 可并行（改不同文件）
     ↓
阶段 4 依赖 1-3（服务层集成 + DB 迁移）
阶段 5 依赖 3（IdealPartnerSketch LLM 合成，需要类型定义）
     ↓
阶段 6 依赖 4（Worker 匹配重构）
阶段 7 依赖 5（前端 Phase 1.6 页面，需要后端 API）
     ↓
阶段 8（前端卡片插入，依赖阶段 1）
```

---

## 阶段 1：新增 3 张理想伴侣探测卡（scenario-cards.ts）

**涉及文件**: `services/api/src/onboarding/scenario-cards.ts`
**预估**: 无变更，与 v1.0 相同

```
在 services/api/src/onboarding/scenario-cards.ts 中新增 3 张"理想伴侣探测卡"。
这 3 张卡的 UX 格式与现有 15 张场景卡完全一致（ScenarioCardDefinition 接口），但测量目标不同：不是"你是谁"，而是"你需要什么样的伴侣"。

### 新增卡片定义

#### Card 16: CARD_UNEXPECTED_BREAKFAST
```ts
export const CARD_UNEXPECTED_BREAKFAST: ScenarioCardDefinition = {
  cardId: 'unexpected_breakfast',
  scenarioText: '你的另一半没有任何预告，早起做了你最爱的早餐，摆盘精致。你的第一反应是——',
  options: [
    { key: 'A', text: '好感动！下次我也要这样对 ta。', dimensionContributions: { needEmotionalSafety: -0.3, needSpaceRespect: -0.3 } },
    { key: 'B', text: '有点不好意思……ta 是有什么期待吗？', dimensionContributions: { needEmotionalSafety: 0.7, needSpaceRespect: -0.4 } },
    { key: 'C', text: '挺甜的，但我更习惯各管各的早餐。', dimensionContributions: { needEmotionalSafety: -0.3, needSpaceRespect: 0.7 } },
    { key: 'D', text: '拍照发朋友圈，炫耀一下这种待遇。', dimensionContributions: { needEmotionalSafety: 0.4, needSpaceRespect: -0.2 } },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['ECR-R (Fraley et al., 2011)', 'Bowlby Attachment Theory'],
  measuredDimensions: ['needEmotionalSafety', 'needSpaceRespect'],
};
```

#### Card 17: CARD_SILENT_NIGHT
```ts
export const CARD_SILENT_NIGHT: ScenarioCardDefinition = {
  cardId: 'silent_night',
  scenarioText: '你和另一半坐在沙发上，已经 20 分钟没人说话了。你的感觉是——',
  options: [
    { key: 'A', text: '很舒服。不需要说话也知道 ta 在。', dimensionContributions: { needEmotionalSafety: -0.5, needSpaceRespect: -0.2, needDirectCommunication: -0.3 } },
    { key: 'B', text: 'ta 是不是在生我的气？', dimensionContributions: { needEmotionalSafety: 0.8, needDirectCommunication: 0.5, needSpaceRespect: 0.0 } },
    { key: 'C', text: '终于安静了，刷刷手机挺好。', dimensionContributions: { needEmotionalSafety: -0.3, needDirectCommunication: -0.5, needSpaceRespect: 0.8 } },
    { key: 'D', text: '找个话题打破沉默吧。', dimensionContributions: { needEmotionalSafety: 0.3, needDirectCommunication: 0.4, needSpaceRespect: -0.3 } },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['ECR-R (Fraley et al., 2011)', 'Gottman Repair Attempts Theory'],
  measuredDimensions: ['needEmotionalSafety', 'needDirectCommunication', 'needSpaceRespect'],
};
```

#### Card 18: CARD_SONG_CHOICE
```ts
export const CARD_SONG_CHOICE: ScenarioCardDefinition = {
  cardId: 'song_choice',
  scenarioText: '你们一起自驾 3 小时，轮流选歌。ta 第四次放的歌你完全受不了。你会——',
  options: [
    { key: 'A', text: '切歌，直接说"这首我真的不行"。', dimensionContributions: { needDirectCommunication: 0.7, needConflictResolution: 0.8 } },
    { key: 'B', text: '忍着听完，但一路上都在生闷气。', dimensionContributions: { needDirectCommunication: -0.5, needConflictResolution: -0.8 } },
    { key: 'C', text: '笑着说"这首歌我要举报"，半开玩笑地换掉。', dimensionContributions: { needDirectCommunication: 0.4, needConflictResolution: -0.2 } },
    { key: 'D', text: '默默戴上耳机。', dimensionContributions: { needDirectCommunication: -0.7, needConflictResolution: -0.6 } },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['Gottman Four Horsemen', 'Thomas-Kilmann Conflict Mode Instrument'],
  measuredDimensions: ['needDirectCommunication', 'needConflictResolution'],
};
```

### 需要修改的导出

1. 将以上 3 张卡追加到 `ALL_SCENARIO_CARDS` 数组末尾（第 16、17、18 项）。
2. 在 `DIMENSION_COVERAGE` 中追加 4 个新维度的映射：
   - `needEmotionalSafety: ['unexpected_breakfast', 'silent_night']`
   - `needSpaceRespect: ['unexpected_breakfast', 'silent_night']`
   - `needDirectCommunication: ['silent_night', 'song_choice']`
   - `needConflictResolution: ['song_choice']`
3. P0_CARD_IDS **不修改**（这 3 张卡不进入 P0 最小集，保持 P0 = 8 张不变）。

注意：新维度 key（needEmotionalSafety 等）与现有维度 key（如 extraversion、attachAvoidance）命名空间不同，不会冲突。
```

---

## 阶段 2：理想伴侣维度计分器（dimension-scorer.ts）

**涉及文件**: `services/api/src/onboarding/dimension-scorer.ts`
**预估**: 无变更，与 v1.0 相同

```
在 services/api/src/onboarding/dimension-scorer.ts 中新增理想伴侣维度计分函数。

### 1. 新增类型 IdealPartnerDimensions

在文件中（DimensionScores 接口附近）新增：

```ts
export interface IdealPartnerDimensions {
  needEmotionalSafety: DimensionScoreResult;
  needSpaceRespect: DimensionScoreResult;
  needDirectCommunication: DimensionScoreResult;
  needConflictResolution: DimensionScoreResult;
}
```

### 2. 新增函数 calculateIdealPartnerDimensions

仿照现有 calculateDimensionScores() 的逻辑（加权均值 + clamp + 一致性检查），但只处理 3 张新卡。

```ts
const IDEAL_PARTNER_CARD_IDS = new Set(['unexpected_breakfast', 'silent_night', 'song_choice']);

export function calculateIdealPartnerDimensions(responses: ScenarioResponse[]): IdealPartnerDimensions {
  // 1. 过滤出只属于 IDEAL_PARTNER_CARD_IDS 的 responses
  const idealResponses = responses.filter(r => IDEAL_PARTNER_CARD_IDS.has(r.cardId));

  // 2. 复用和 calculateDimensionScores 完全相同的聚合逻辑：
  //    - 权重计算：responseTimeMs < 3000 → weight *= 0.3; choice==='custom' || freeText → weight *= 1.5
  //    - 加权均值 → clamp [-1, +1]
  //    - 多卡维度做一致性检查（stddev < 0.3 = high, <= 0.6 = medium, > 0.6 = low + contradictions）
  //    - 单卡维度默认 confidence: 'medium'
  //
  //    建议：将 calculateDimensionScores 中的聚合逻辑抽取为共享函数 aggregateDimensionFromCards()，
  //    让两个函数共用，避免代码重复。

  // 3. 组装为 IdealPartnerDimensions 返回
  //    四个维度 key: needEmotionalSafety, needSpaceRespect, needDirectCommunication, needConflictResolution
}
```

### 3. 新增序列化函数

仿照 toSurveyDimensionScores()，新增：

```ts
export function toSurveyIdealPartnerDimensions(dims: IdealPartnerDimensions): Record<string, { value: number; confidence: string }> {
  return {
    needEmotionalSafety: { value: dims.needEmotionalSafety.value, confidence: dims.needEmotionalSafety.confidence },
    needSpaceRespect: { value: dims.needSpaceRespect.value, confidence: dims.needSpaceRespect.confidence },
    needDirectCommunication: { value: dims.needDirectCommunication.value, confidence: dims.needDirectCommunication.confidence },
    needConflictResolution: { value: dims.needConflictResolution.value, confidence: dims.needConflictResolution.confidence },
  };
}
```

保持现有 calculateDimensionScores 和 toSurveyDimensionScores 不变，确保向后兼容。
```

---

## 阶段 3：理想伴侣 Embedding 构建 + Schema 扩展 + IdealPartnerSketch 类型（survey-schema.ts）

**涉及文件**: `services/api/src/onboarding/survey-schema.ts`
**v1.1 变更**: 新增 IdealPartnerSketch 接口和 idealPartnerSketch 字段

```
在 services/api/src/onboarding/survey-schema.ts 中：

### 1. 扩展 OnboardingSurveyJson 类型

在现有 OnboardingSurveyJson 接口中新增两个字段（与 scenarioCards / dimensionScores / personaSketch 同级）：

```ts
idealPartnerDimensions?: Record<string, { value: number; confidence: string }>;
idealPartnerSketch?: IdealPartnerSketch;  // ← v1.1 新增
```

### 2. 新增 IdealPartnerSketch 接口

这是 Phase 1.6 的核心数据结构，与现有 PersonaSketch 对称：

```ts
export interface IdealPartnerSketch {
  /** LLM 合成的自然语言描述（200-400 字），描述"你需要什么样的伴侣" */
  narrative: string;

  /** 四维雷达图数据（前端可视化用） */
  dimensions: {
    emotionalSafety: number;       // -1 ~ +1
    spaceRespect: number;          // -1 ~ +1
    directCommunication: number;   // -1 ~ +1
    conflictResolution: number;    // -1 ~ +1
  };

  /** 用户反馈（可选纠正文本，最多 100 字） */
  userFeedback?: string;

  /** 生成时间戳 */
  generatedAt: string;
}
```

### 3. 新增 buildTextForIdealEmbedding 函数

仿照现有 buildTextForEmbedding() 的 key:value 拼接风格（用 ' | ' 连接），新增：

```ts
export function buildTextForIdealEmbedding(
  profile: { bioJson?: unknown } | null,
  survey: OnboardingSurveyJson,
  userId: string,
): string {
  const parts: string[] = [];

  // ★ 0. 用户反馈前缀（v1.1 新增：如果用户在 Phase 1.6 页面提交了纠正文本，作为最高优先级信号前置）
  if (survey.idealPartnerSketch?.userFeedback && survey.idealPartnerSketch.userFeedback !== 'deferred') {
    parts.push(`userCorrection:${survey.idealPartnerSketch.userFeedback.slice(0, 100)}`);
  }

  // 1. 依恋衍生需求（从现有 15 张卡的 attachAvoidance / attachAnxiety 推算出的 attachmentStyle）
  if (survey.dimensionScores?.attachmentStyle) {
    const style = survey.dimensionScores.attachmentStyle;
    const styleMap: Record<string, string> = {
      secure:      'needs partner who naturally balances intimacy and independence, neither clingy nor cold',
      preoccupied: 'needs partner who provides stable emotional affirmation, consistent and reliable, no hot-and-cold',
      dismissing:  'needs partner who respects personal boundaries, no emotional hostage-taking, gives ample space',
      fearful:     'needs extremely patient partner who tolerates push-pull rhythms, won\'t give up when pushed away',
    };
    parts.push(`attachmentNeed:${styleMap[style] ?? style}`);
  }

  // 2. 理想伴侣维度（来自新卡 16/17/18 的 idealPartnerDimensions）
  const idealDims = survey.idealPartnerDimensions;
  if (idealDims) {
    const descs: string[] = [];

    const val = (key: string) => idealDims[key]?.value;

    if (val('needEmotionalSafety') !== undefined) {
      if (val('needEmotionalSafety') > 0.3) descs.push('high emotional safety need: requires partner to be stable, reliable, an emotional anchor');
      else if (val('needEmotionalSafety') < -0.3) descs.push('low emotional dependence: does not need frequent relationship status confirmation');
    }
    if (val('needSpaceRespect') !== undefined) {
      if (val('needSpaceRespect') > 0.3) descs.push('high independence need: requires partner to respect alone time, no intrusion');
      else if (val('needSpaceRespect') < -0.3) descs.push('prefers close connection: wants partner to share most of their time');
    }
    if (val('needDirectCommunication') !== undefined) {
      if (val('needDirectCommunication') > 0.3) descs.push('prefers direct expression: dislikes guessing, needs partner to speak plainly');
      else if (val('needDirectCommunication') < -0.3) descs.push('prefers gentle expression: wants partner to deliver opinions tactfully');
    }
    if (val('needConflictResolution') !== undefined) {
      if (val('needConflictResolution') > 0.3) descs.push('resolve conflicts directly: dislikes silent treatment, needs partner who can handle straight talk');
      else if (val('needConflictResolution') < -0.3) descs.push('digest conflicts individually: prefers partner to give buffer space during conflicts');
    }

    if (descs.length) parts.push(`partnerExpectation:${descs.join('; ')}`);
  }

  // 3. 价值观对齐信号
  if (survey.trustView?.trim()) {
    parts.push(`trustExpectation:${survey.trustView.trim().slice(0, 60)}`);
  }
  if (survey.happinessView?.trim()) {
    parts.push(`happinessView:${survey.happinessView.trim().slice(0, 60)}`);
  }

  // 4. 关系意图
  const relationshipIntent =
    survey.goal?.trim() ||
    (typeof profile?.bioJson === 'object' && profile?.bioJson !== null
      ? (profile.bioJson as Record<string, unknown>)?.datingGoal as string
      : undefined);
  if (relationshipIntent) {
    parts.push(`relationshipGoal:${relationshipIntent}`);
  }

  return parts.length > 0 ? parts.join(' | ') : `idealPartnerDefault_${userId}`;
}
```

保持现有 buildTextForEmbedding 和 buildPersonaSeedFromSurvey 不变。
```

---

## 阶段 4：服务层集成 + 数据库迁移（onboarding.service.ts + Prisma + DTO）

**涉及文件**:
- `services/api/src/onboarding/onboarding.service.ts`
- `services/api/src/onboarding/onboarding.dto.ts`
- `services/api/prisma/migrations/` (新建迁移)
- `services/api/prisma/schema.prisma`

```
在 onboarding.service.ts 中集成理想伴侣 embedding 的生成与写入，新增 DTO，并创建数据库迁移。

### 1. 新增 DTO（onboarding.dto.ts）

仿照现有 PersonaSketchDto / PersonaSketchAdjustDto / BatchAdjustDto 的风格：

```ts
import { IsString, IsOptional, MaxLength, IsObject, ValidateNested, IsArray, IsNumber } from 'class-validator';

// IdealPartnerSketch 的 dimensions 子对象
export class IdealPartnerDimensionsDto {
  @IsNumber() emotionalSafety: number;
  @IsNumber() spaceRespect: number;
  @IsNumber() directCommunication: number;
  @IsNumber() conflictResolution: number;
}

export class IdealPartnerSketchDto {
  @IsString() narrative: string;
  @IsObject() @ValidateNested() dimensions: IdealPartnerDimensionsDto;
  @IsString() @IsOptional() userFeedback?: string;
  @IsString() generatedAt: string;
}

// 用户纠正确认反馈（Phase 1.6 页面的 "Is this accurate?" 区域）
export class IdealPartnerAdjustDto {
  @IsString() @IsOptional() @MaxLength(100)
  userFeedback?: string;  // 自由文本纠正，或 'deferred' 表示"不确定，以后再调"
}
```

### 2. 修改 submitPhase1()（onboarding.service.ts）

在现有 calculateDimensionScores(responses) 调用之后，新增：

```ts
import { calculateIdealPartnerDimensions, toSurveyIdealPartnerDimensions } from './dimension-scorer';

// 在 submitPhase1() 中，calculateDimensionScores 之后：
const idealScores = calculateIdealPartnerDimensions(responses);
const idealDimsJson = toSurveyIdealPartnerDimensions(idealScores);
```

然后将 idealDimsJson 一并写入 surveyJson：

```ts
// 现有逻辑是合并 scenarioCards + dimensionScores 到 surveyJson
// 在这里额外合并 idealPartnerDimensions:
const updatedSurvey = {
  ...existingSurveyJson,
  scenarioCards: cardResponses,
  dimensionScores: scoresJson,
  idealPartnerDimensions: idealDimsJson,  // ← 新增
};
```

同样更新 Profile.bioJson 的 dual-write。

### 3. 修改 finalize() / finalizeCore()

在现有 buildTextForEmbedding + llm.embed 生成 self embedding 之后，新增 ideal embedding 的生成和写入：

```ts
import { buildTextForIdealEmbedding } from './survey-schema';

// 在现有 embedding 生成之后（大约写入 profile_embeddings 的 raw SQL 附近）：
const idealText = buildTextForIdealEmbedding(profile, survey, userId);
const idealEmbedResult = await llm.embed(idealText);
// 复用与 self embedding 相同的校验逻辑：非全零、stddev >= 0.001

// 修改 raw SQL，在 INSERT ... ON CONFLICT DO UPDATE 中同时写入 ideal_embedding 列：
// INSERT INTO profile_embeddings (user_id, embedding, ideal_embedding)
// VALUES ($1, $2::vector, $3::vector)
// ON CONFLICT (user_id) DO UPDATE SET embedding = $2::vector, ideal_embedding = $3::vector, updated_at = NOW()
```

注意：ideal embedding 也需要和 self embedding 一样用 Promise.race + clearTimeout 防泄漏（在 120s 顶层超时内）。

### 4. 数据库迁移

新建 Prisma 迁移（或手动 SQL 文件）：

```sql
ALTER TABLE profile_embeddings ADD COLUMN ideal_embedding vector(1536);
```

不需要在 ideal_embedding 上创建 HNSW 索引——匹配流程是：用 A 的 self_embedding（已有 HNSW 索引）做 top-K 检索，然后加载候选人的 ideal_embedding 做反向校验，永远不需要对 ideal_embedding 做全表扫描。

同时更新 Prisma schema.prisma 中 ProfileEmbedding model，新增字段（保持 Json 类型，与 embedding 一致）：

```prisma
model ProfileEmbedding {
  userId          String @id @map("user_id")
  embedding       Json
  idealEmbedding  Json?  @map("ideal_embedding")
  // ...
}
```

### 5. 更新 validateV22Completion()

在现有完成校验中新增对 idealPartnerSketch 的检查：

```ts
// 现有检查：Phase 1.5: personaSketch.narrative 非空
// 新增检查（Phase 1.6）：
if (!survey.idealPartnerSketch?.narrative) {
  // idealPartnerSketch 未生成 → 标记需要补充
  // 但注意：这里不要直接 throw，因为用户可能跳过了新卡（降级策略）
  // 仅在有 idealPartnerDimensions 数据但没有 sketch 时警告
}
```

### 6. 新增控制器端点（onboarding.controller.ts）

仿照现有 persona-sketch 端点的模式（@Post + @UseGuards(JwtAuthGuard) + @Throttle），新增：

```ts
@Post('ideal-partner-sketch/generate')
async generateIdealSketch(@Req() req) {
  const userId = req.user.userId;
  return this.onboardingService.generateIdealPartnerSketch(userId);
}

@Post('ideal-partner-sketch/adjust')
async adjustIdealSketch(@Req() req, @Body() dto: IdealPartnerAdjustDto) {
  const userId = req.user.userId;
  return this.onboardingService.adjustIdealPartnerSketch(userId, dto);
}
```

### 7. 历史数据回填脚本

创建 services/api/src/scripts/backfill-ideal-embeddings.ts：
- 遍历所有已有 profile_embeddings 记录的用户
- 对每个用户：读取其 OnboardingSession 的 surveyJson
- 如果有 scenarioCards 数据（包含新卡 16/17/18 的回答），正常计算 idealPartnerDimensions
- 如果没有新卡回答，使用降级策略：仅用 attachmentStyle + trustView + happinessView + goal 构建 idealText
- 调用 buildTextForIdealEmbedding → llm.embed → 写入 ideal_embedding 列
- 打印进度日志，支持断点续传（跳过已有 ideal_embedding 的记录）
```

---

## 阶段 5：IdealPartnerSketch LLM 合成服务（v1.1 新增）

**涉及文件**: `services/api/src/onboarding/ideal-partner-sketch.service.ts`（新建）
**参考模式**: 现有 `persona-sketch.service.ts` 的完整对称实现

```
新建 services/api/src/onboarding/ideal-partner-sketch.service.ts，实现 IdealPartnerSketch 的 LLM 合成。
这是 Phase 1.6 的后端核心：将理想伴侣维度分数翻译为可读的自然语言描述。

### 设计目标

与现有 persona-sketch.service.ts 对称：
- PersonaSketch：维度分数 → "你是谁"的自然语言
- IdealPartnerSketch：理想伴侣维度分数 → "你需要什么样的伴侣"的自然语言

### 1. Service 类定义

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import type { OnboardingSurveyJson, IdealPartnerSketch } from './survey-schema';

@Injectable()
export class IdealPartnerSketchService {
  private readonly logger = new Logger(IdealPartnerSketchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /**
   * 生成理想伴侣画像（Phase 1.6）
   * 从 idealPartnerDimensions + attachmentStyle + trustView/happinessView + goal
   * 合成一段 200-400 字的自然语言描述
   */
  async generate(userId: string): Promise<{ success: true; idealPartnerSketch: IdealPartnerSketch }> {
    // 1. 查找活跃的 OnboardingSession
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw new Error('No active onboarding session');

    const survey = session.surveyJson as unknown as OnboardingSurveyJson;

    // 2. 校验前置条件：Phase 1 完成（至少有 scenarioCards）
    if (!survey?.scenarioCards || survey.scenarioCards.length < 8) {
      throw new Error('Phase 1 not completed: need at least 8 scenario cards');
    }

    // 3. 构建 LLM 输入内容
    const inputContent = this.buildInputContent(survey);

    // 4. 调用 LLM
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: inputContent },
    ];

    const raw = await this.llm.chat(messages, { temperature: 0.7, maxTokens: 800 });
    if (!raw) throw new Error('LLM returned empty response');

    // 5. 解析响应
    const sketch = this.parseIdealPartnerSketch(raw, survey);

    // 6. 写入 surveyJson
    const updatedSurvey = { ...survey, idealPartnerSketch: sketch };
    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as any },
    });
    // 同步写入 Profile.bioJson (dual-write)
    await this.prisma.profile.update({
      where: { userId },
      data: { bioJson: updatedSurvey as any },
    });

    return { success: true, idealPartnerSketch: sketch };
  }

  /**
   * 处理用户纠正确认反馈
   */
  async adjust(userId: string, dto: { userFeedback?: string }): Promise<{ success: true; idealPartnerSketch: IdealPartnerSketch }> {
    // 1. 查找 session 和现有 sketch
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw new Error('No active onboarding session');

    const survey = session.surveyJson as unknown as OnboardingSurveyJson;
    if (!survey?.idealPartnerSketch) throw new Error('No ideal partner sketch to adjust');

    // 2. 更新 userFeedback
    const updatedSketch = {
      ...survey.idealPartnerSketch,
      userFeedback: dto.userFeedback || undefined,
    };

    const updatedSurvey = { ...survey, idealPartnerSketch: updatedSketch };
    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as any },
    });
    await this.prisma.profile.update({
      where: { userId },
      data: { bioJson: updatedSurvey as any },
    });

    return { success: true, idealPartnerSketch: updatedSketch };
  }

  private buildInputContent(survey: OnboardingSurveyJson): string {
    const lines: string[] = [];

    // 理想伴侣维度分数
    const dims = survey.idealPartnerDimensions;
    if (dims) {
      lines.push('## Ideal Partner Dimension Scores');
      for (const [key, val] of Object.entries(dims)) {
        lines.push(`- ${key}: ${val.value.toFixed(2)} (confidence: ${val.confidence})`);
      }
    }

    // 依恋类型
    if (survey.dimensionScores?.attachmentStyle) {
      lines.push(`\n## Attachment Style: ${survey.dimensionScores.attachmentStyle}`);
    }

    // 价值观
    if (survey.trustView?.trim()) lines.push(`\n## Trust View: ${survey.trustView.trim()}`);
    if (survey.happinessView?.trim()) lines.push(`\n## Happiness View: ${survey.happinessView.trim()}`);

    // 关系意图
    if (survey.goal?.trim()) lines.push(`\n## Relationship Intent: ${survey.goal.trim()}`);

    return lines.join('\n') || 'No ideal partner data available';
  }

  private parseIdealPartnerSketch(raw: string, survey: OnboardingSurveyJson): IdealPartnerSketch {
    // LLM 应该返回纯文本 narrative（200-400 字）
    // 从中提取 narrative 文本

    // dimensions 从 idealPartnerDimensions 直接映射
    const dims = survey.idealPartnerDimensions;
    const dimensions = {
      emotionalSafety: dims?.needEmotionalSafety?.value ?? 0,
      spaceRespect: dims?.needSpaceRespect?.value ?? 0,
      directCommunication: dims?.needDirectCommunication?.value ?? 0,
      conflictResolution: dims?.needConflictResolution?.value ?? 0,
    };

    return {
      narrative: raw.trim(),
      dimensions,
      generatedAt: new Date().toISOString(),
    };
  }
}
```

### 2. SYSTEM_PROMPT

```ts
const SYSTEM_PROMPT = `You are a relationship psychology writer for Echo, a dating app that matches people based on compatibility rather than similarity.

Your task: Given a user's "Ideal Partner Profile" dimension scores and background data, write a warm, concrete, second-person description (200-400 words) telling them "what kind of partner they likely need."

Rules:
1. Write in Chinese (Simplified), second person (你).
2. Be SPECIFIC and BEHAVIORAL. Say "you need someone who keeps their word, no hot-and-cold" not "you need someone reliable."
3. Reference their actual scores. If needEmotionalSafety is high, say they need emotional anchoring. If needDirectCommunication is high, say they need straight talk.
4. Connect to their attachment style if available. E.g., "As someone with an anxious attachment pattern, being cared for can feel like a debt — so your partner needs to make you believe 'I'm good to you simply because I want to.'"
5. Weave in their trust/happiness views if provided, connecting them to partner expectations.
6. NEVER invent traits not supported by the data. Only describe what the scores and text actually indicate.
7. Do NOT use bullet points or headers. Write flowing paragraphs.
8. Tone: warm, insightful, slightly playful. Like a close friend who happens to be a relationship therapist.
9. End with an empowering note — this isn't about "flaws" but about knowing what you need.

Output ONLY the narrative text. No preamble, no "Here's your profile:" intro.`;
```

### 3. 注册为 NestJS 模块

在 onboarding.module.ts 的 providers 数组中注册 IdealPartnerSketchService。
同时在 OnboardingService 中注入它（用于 finalize 时可选地调用），或在 Controller 中直接注入。

### 4. 注意事项

- LLM 调用复用现有 LlmService 的 chat() 方法（走 DeepSeek）
- 温度 0.7，maxTokens 800（比 PersonaSketch 的 2000 少，因为输出更短）
- 如果 LLM 返回空，throw Error 让前端显示重试
- adjust() 不调用 LLM —— 用户纠正是纯文本叠加，不重新生成 narrative（这与 PersonaSketch 的 batchAdjust 不同，因为 IdealPartnerSketch 的结构更简单，用户反馈直接前置到 embedding 输入即可）
```

---

## 阶段 6：Worker 匹配算法重构（match-bridge.ts）

**涉及文件**: `services/worker/src/clone-runtime/match-bridge.ts`

```
重构 services/worker/src/clone-runtime/match-bridge.ts 的匹配逻辑，从单向自画像相似度改为双向理想伴侣互配。

### 1. 新增类型

```ts
export type BidirectionalCandidate = {
  user_id: string;
  scoreAtoB: number;   // cosine(self_A, ideal_B) — A 符合 B 的理想型程度
  scoreBtoA: number;   // cosine(self_B, ideal_A) — B 符合 A 的理想型程度
  compatibility: number; // sqrt(scoreAtoB * scoreBtoA) — 几何均值
};
```

### 2. 新增常量

```ts
const IDEAL_MATCH_THRESHOLD = 0.3;  // 双向最低阈值
```

### 3. 新增函数：批量加载理想伴侣 embedding

```ts
async function batchLoadIdealEmbeddings(prisma, userIds: string[]): Promise<Map<string, number[]>> {
  // 从 profile_embeddings 表批量读取 ideal_embedding 列
  // 返回 Map<userId, embeddingVector>
  // 注意用 raw SQL 查询，因为 pgvector 列在 Prisma 中是 Json 类型
  // SQL: SELECT user_id, ideal_embedding FROM profile_embeddings WHERE user_id = ANY($1)
  // 过滤掉 ideal_embedding 为 null 的用户
}
```

### 4. 重构 runDailyMatchJob()

在现有逻辑基础上修改（保持时间窗口、autoMatchEnabled 检查、active session 计数等不变）：

核心修改点在拿到 queryVectorCandidates 结果之后：

```ts
// 现有：queryVectorCandidates 返回 VectorCandidate[]（用 self embedding 做 cosine）
// 这些作为初步候选人，接下来做双向匹配：

// 4a. 加载所有候选人的 ideal embedding
const idealEmbeddings = await batchLoadIdealEmbeddings(prisma, candidates.map(c => c.user_id));

// 4b. 加载 A 自己的 ideal embedding
const selfIdealMap = await batchLoadIdealEmbeddings(prisma, [userA.userId]);
const idealEmbeddingA = selfIdealMap.get(userA.userId);
if (!idealEmbeddingA) continue; // A 没有 ideal embedding，跳过

// 4c. 双向评分
const bidirectionalCandidates: BidirectionalCandidate[] = [];
for (const candidate of candidates) {
  const idealEmbeddingB = idealEmbeddings.get(candidate.user_id);
  if (!idealEmbeddingB) continue;

  // scoreAtoB: A 的自画像与 B 的理想型的匹配度
  const scoreAtoB = cosineSimilarity(embeddingA, idealEmbeddingB);
  // scoreBtoA: B 的自画像与 A 的理想型的匹配度
  const scoreBtoA = cosineSimilarity(candidateEmbeddingB, idealEmbeddingA);

  // 阈值过滤
  if (Math.min(scoreAtoB, scoreBtoA) < IDEAL_MATCH_THRESHOLD) continue;

  // 几何均值
  const compatibility = Math.sqrt(scoreAtoB * scoreBtoA);
  bidirectionalCandidates.push({ user_id: candidate.user_id, scoreAtoB, scoreBtoA, compatibility });
}
```

注意：需要在 queryVectorCandidates 阶段额外加载候选人的 self embedding 向量（用于计算 scoreBtoA）。
如果现有 queryVectorCandidates 没有返回候选人的 embedding 向量，需要修改 SQL 添加 `pe.embedding AS candidate_embedding` 到 SELECT 中。

### 5. 重构 rankCandidatesByRules()

将函数签名从接受 VectorCandidate[] 改为接受 BidirectionalCandidate[]：

```ts
export function rankCandidatesByRules(
  seeker: SeekerProfile,
  candidates: BidirectionalCandidate[],  // ← 改这里
  candidateProfiles: CandidateProfile[],
  prefs: MatchPrefs,
  topN: number = FINAL_TOP_N,
): RankedCandidate[] {
  // 基础分改为 compatibility（不再是 similarity）
  // 规则加分保持不变：同城 +0.05、共同兴趣 +0.05、关系意图匹配 +0.10
  // 排序和 top-N 截取保持不变
}
```

同时更新 RankedCandidate 类型，保留兼容性分数而非 similarity。

### 6. 注意事项

- 保持所有现有过滤逻辑：双向 block 排除、autoMatchEnabled 检查、active session 计数、已存在 session 过滤
- 保持 MatchPush 创建逻辑和去重不变
- 保持 bridgeMatchPushes 函数不变
- cosineSimilarity 工具函数如果不存在，需要新增（或用 pgvector 的 <=> 运算符）
```

---

## 阶段 7：前端 Phase 1.6 — IdealPartnerSketch 展示页（v1.1 新增）

**涉及文件**:
- `Echo/src/features/onboarding/v2/onboarding-v2.types.ts`（修改）
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx`（修改）
- `Echo/src/features/onboarding/v2/onboarding-v2.api.ts`（修改）
- `Echo/src/features/onboarding/v2/Phase1_6IdealSketch.tsx`（新建）
- `Echo/src/features/onboarding/v2/components/DimensionBars.tsx`（新建）

```
实现 Phase 1.6 "Ideal Partner Sketch" 前端展示页，与现有 Phase 1.5 Persona Sketch 页面完全对称。

### 设计目标

用户在 Phase 1.5 看到"你是谁"（Persona Sketch），在 Phase 1.6 看到"你需要什么样的伴侣"（Ideal Partner Sketch）。
两个页面使用相同的 UX 范式：LLM 合成 → 卡片展示 → 用户微调反馈。

### 1. 类型扩展（onboarding-v2.types.ts）

在 OnboardingPhase 联合类型中新增 'phase1_6'：

```ts
export type OnboardingPhase = 'phase0' | 'phase1' | 'phase1_5' | 'phase1_6' | 'phase2' | 'finalize';
//                                                                  ^^^^^^^^^^ 新增

export const PHASE_ORDER: OnboardingPhase[] = [
  'phase0', 'phase1', 'phase1_5', 'phase1_6', 'phase2', 'finalize',
  //                                   ^^^^^^^^^^ 插入到 phase1_5 和 phase2 之间
];
```

新增 IdealPartnerSketch 相关类型：

```ts
export interface IdealPartnerSketchDimensions {
  emotionalSafety: number;
  spaceRespect: number;
  directCommunication: number;
  conflictResolution: number;
}

export interface IdealPartnerSketchData {
  narrative: string;
  dimensions: IdealPartnerSketchDimensions;
  userFeedback?: string;
  generatedAt: string;
}

export interface IdealPartnerSketchApiResponse {
  success: boolean;
  idealPartnerSketch: IdealPartnerSketchData;
}
```

### 2. API 函数（onboarding-v2.api.ts）

仿照现有 generatePersonaSketch() / batchAdjustPersonaSketch() 的模式：

```ts
export async function generateIdealPartnerSketch(): Promise<IdealPartnerSketchApiResponse> {
  const res = await request('/onboarding/ideal-partner-sketch/generate', {
    method: 'POST',
  });
  // 使用现有的 resultErrorMessage() 处理错误
  if (!res.ok) throw new Error(resultErrorMessage(res));
  return res.data;
}

export async function adjustIdealPartnerSketch(userFeedback: string): Promise<IdealPartnerSketchApiResponse> {
  const res = await request('/onboarding/ideal-partner-sketch/adjust', {
    method: 'POST',
    body: JSON.stringify({ userFeedback }),
  });
  if (!res.ok) throw new Error(resultErrorMessage(res));
  return res.data;
}
```

### 3. 维度条形图组件（DimensionBars.tsx）

新建一个轻量的维度可视化组件。设计文档的 ASCII 原型用的是进度条样式（████████░░），不用引入图表库，用纯 CSS/Tailwind 实现：

```tsx
// Echo/src/features/onboarding/v2/components/DimensionBars.tsx

const DIMENSION_LABELS: Record<string, string> = {
  emotionalSafety: '情感安全感',
  spaceRespect: '独立空间',
  directCommunication: '直接沟通',
  conflictResolution: '冲突处理',
};

interface DimensionBarsProps {
  dimensions: IdealPartnerSketchDimensions;
}

export function DimensionBars({ dimensions }: DimensionBarsProps) {
  return (
    <div className="space-y-3">
      {Object.entries(dimensions).map(([key, value]) => {
        // value 范围 -1 ~ +1，映射到 0% ~ 100%
        const percent = Math.round(((value + 1) / 2) * 100);
        return (
          <div key={key}>
            <div className="flex justify-between text-sm text-gray-300 mb-1">
              <span>{DIMENSION_LABELS[key]}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-echo-blue rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 4. Phase 1.6 主页面组件（Phase1_6IdealSketch.tsx）

仿照 Phase1_5Sketch.tsx 的完整结构，但内容更简单（没有 8 个 section 的句子级编辑，只有一个 narrative + 维度图 + 反馈框）：

```tsx
// Echo/src/features/onboarding/v2/Phase1_6IdealSketch.tsx
// 参考 Phase1_5Sketch.tsx 的组件结构和样式

interface Phase1_6Props {
  onComplete: () => void;
  onGoBack?: (targetPhase: string, message?: string) => void;
  initialError?: string;
}

export function Phase1_6IdealSketch({ onComplete, onGoBack, initialError }: Phase1_6Props) {
  const [sketch, setSketch] = useState<IdealPartnerSketchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(initialError || '');
  const [feedback, setFeedback] = useState('');
  const [deferred, setDeferred] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 1. 挂载时调用 API 生成 sketch
  useEffect(() => {
    generateIdealPartnerSketch()
      .then(res => setSketch(res.idealPartnerSketch))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // 2. 用户提交反馈
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (feedback.trim() || deferred) {
        const fb = deferred ? 'deferred' : feedback.trim();
        const res = await adjustIdealPartnerSketch(fb);
        setSketch(res.idealPartnerSketch);
      }
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. 加载状态（复用 LottieLoader）
  if (loading) return <LoadingState />;

  // 4. 错误状态（红色消息 + 重试按钮）
  if (error && !sketch) return <ErrorState error={error} onRetry={...} />;

  // 5. 正常展示
  return (
    <div className="min-h-screen bg-echo-dark text-white max-w-md mx-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold">你需要什么样的人？</h1>
      </div>

      {/* Narrative Card */}
      <div className="mx-6 p-4 bg-white/5 rounded-xl mb-6">
        <p className="text-gray-200 leading-relaxed">
          根据你在早餐、沉默和音乐上的选择……
          你的理想伴侣画像是：
        </p>
        <div className="mt-4 text-white leading-relaxed">
          {sketch.narrative}
        </div>
      </div>

      {/* Dimension Bars */}
      <div className="mx-6 p-4 bg-white/5 rounded-xl mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-3">他们大概是什么样的人</h2>
        <DimensionBars dimensions={sketch.dimensions} />
      </div>

      {/* Feedback Section */}
      <div className="mx-6 p-4 bg-white/5 rounded-xl mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-3">这个描述准确吗？</h2>
        <textarea
          className="w-full bg-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none"
          placeholder="其实我需要的是一个更……的人"
          maxLength={100}
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={3}
        />
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={deferred}
            onChange={e => setDeferred(e.target.checked)}
            className="rounded"
          />
          不确定，以后再调
        </label>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-echo-dark/90 backdrop-blur-sm">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-echo-blue text-white rounded-xl font-medium disabled:opacity-50"
        >
          {submitting ? '提交中…' : '看起来没问题 →'}
        </button>
      </div>
    </div>
  );
}
```

### 5. OnboardingShell.tsx 集成

在 OnboardingShell 的 render 逻辑中新增 phase1_6 的渲染分支：

```tsx
// 在现有的 phase 渲染 switch/if 链中，phase1_5 之后、phase2 之前：
{phase === 'phase1_6' && (
  <motion.div
    key="phase1_6"
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -50 }}
    transition={{ duration: 0.3 }}
  >
    <Phase1_6IdealSketch
      onComplete={() => advancePhase('phase1_6')}
      onGoBack={goBackToPhase}
      initialError={phaseError}
    />
  </motion.div>
)}
```

### 6. 注意事项

- 整体视觉风格与 Phase1_5Sketch.tsx 保持一致（深色背景、max-w-md 居中、圆角卡片）
- LottieLoader 加载动画复用现有组件
- 错误处理：如果 API 返回的错误信息包含 "Phase 1"，调用 onGoBack?.('phase1', msg) 跳回 Phase 1
- localStorage 的 onboarding_v2_session_{userId} 不需要改键名，PHASE_ORDER 更新后 advancePhase 自动处理
- advancePhase('phase1_6') 触发时，phase1_6 会被加入 completedPhases，然后跳到 phase2
- 不需要引入任何图表库——维度可视化用纯 Tailwind 进度条实现
```

---

## 阶段 8：前端卡片插入 + 进度更新

**涉及文件**:
- `Echo/src/features/onboarding/v2/scenario-cards.data.ts`
- `Echo/src/features/onboarding/v2/Phase1Cards.tsx`

```
在 Echo 前端适配新增的 3 张理想伴侣探测卡，并更新进度显示。

### 1. scenario-cards.data.ts

在现有 15 张卡的数据数组末尾，追加 3 张新卡的前端定义。

前端 ScenarioCardDef 类型与后端不同：没有 dimensionContributions（不暴露给前端），但有 illustrationKey。

新增 3 张卡（ScenarioCardDef 格式）：

```ts
{
  cardId: 'unexpected_breakfast',
  scenarioText: '你的另一半没有任何预告，早起做了你最爱的早餐，摆盘精致。你的第一反应是——',
  illustrationKey: 'unexpected_breakfast',
  options: [
    { optionId: 'A', text: '好感动！下次我也要这样对 ta。' },
    { optionId: 'B', text: '有点不好意思……ta 是有什么期待吗？' },
    { optionId: 'C', text: '挺甜的，但我更习惯各管各的早餐。' },
    { optionId: 'D', text: '拍照发朋友圈，炫耀一下这种待遇。' },
  ],
  allowCustomText: true,
  requiredFreeText: false,
  freeTextMaxLength: 20,
},
{
  cardId: 'silent_night',
  scenarioText: '你和另一半坐在沙发上，已经 20 分钟没人说话了。你的感觉是——',
  illustrationKey: 'silent_night',
  options: [
    { optionId: 'A', text: '很舒服。不需要说话也知道 ta 在。' },
    { optionId: 'B', text: 'ta 是不是在生我的气？' },
    { optionId: 'C', text: '终于安静了，刷刷手机挺好。' },
    { optionId: 'D', text: '找个话题打破沉默吧。' },
  ],
  allowCustomText: true,
  requiredFreeText: false,
  freeTextMaxLength: 20,
},
{
  cardId: 'song_choice',
  scenarioText: '你们一起自驾 3 小时，轮流选歌。ta 第四次放的歌你完全受不了。你会——',
  illustrationKey: 'song_choice',
  options: [
    { optionId: 'A', text: '切歌，直接说"这首我真的不行"。' },
    { optionId: 'B', text: '忍着听完，但一路上都在生闷气。' },
    { optionId: 'C', text: '笑着说"这首歌我要举报"，半开玩笑地换掉。' },
    { optionId: 'D', text: '默默戴上耳机。' },
  ],
  allowCustomText: true,
  requiredFreeText: false,
  freeTextMaxLength: 20,
},
```

### 2. Phase1Cards.tsx

将进度显示从 "X/15" 改为 "X/18"。具体找到 ProgressRing 组件传入的总数（硬编码 15 或来自某个常量），改为 18。

如果是从 cards 数组的 .length 自动计算的，则不需要改（因为第 1 步已经追加了 3 张卡）。

### 3. 注意事项

- 这 3 张卡紧跟在第 15 张卡之后展示，仍在 Phase 1 内（Phase 1.5 Persona Sketch 之前）
- 复用现有的卡片渲染组件，无需新建 UI
- localStorage 的 onboarding_phase1_responses_{userId} key 不需要改，它已经是按 cardId 索引的
- submitPhase1() 调用不需要改，它接受 ScenarioResponse[] 数组，新卡的回答格式与现有卡一致
```

---

## 验证清单

每个阶段完成后需要确认：

| 阶段 | 验证方法 |
|------|---------|
| 1 | `nest build` 编译通过；`ALL_SCENARIO_CARDS.length === 18` |
| 2 | `nest build` 编译通过；单元测试通过 |
| 3 | `nest build` 编译通过；`IdealPartnerSketch` 类型可被 import |
| 4 | `npx prisma migrate dev` 成功；`profile_embeddings` 表有 `ideal_embedding` 列；新 DTO 校验通过 |
| 5 | `nest build` 编译通过；`POST /onboarding/ideal-partner-sketch/generate` 返回有效 narrative |
| 6 | Worker 编译通过；`POST /matches/trigger { force: true }` 走双向匹配逻辑 |
| 7 | 前端 dev server 启动；Phase 1.6 页面渲染正常；生成 sketch + 提交反馈流程通 |
| 8 | 新用户完整走一遍 onboarding（18 卡 → Phase 1.5 → Phase 1.6 → Phase 2 → Finalize）；self_embedding 和 ideal_embedding 均写入 DB |
