/**
 * 维度评分器（v2.2 Phase 1）
 *
 * 把 15 张情境卡片的回答聚合成结构化维度分数：
 *   Big Five / 时间观 / 延迟满足 / 道德基础 / 依恋 / 归因 / 谦逊 / 社交面具
 *
 * 算法：
 *   1. 遍历回答，查表取选项的 dimensionContributions
 *   2. 反应时间 < 3000ms → 权重 0.3（随机作答降权）
 *   3. 选择 'custom' 或写了自由文本 → 权重 ×1.5
 *   4. 每维度 = 各卡贡献的加权均值，钳位到 [-1, +1]
 *   5. 维度内一致性：多卡维度的标准差 → high / medium / low
 *
 * 见 docs_CN/Onboarding-Survey-Redesign-Proposal.md §五 和 §九
 */

import type { ScenarioResponse } from './survey-schema';
import {
  ALL_SCENARIO_CARDS,
  DIMENSION_COVERAGE,
  getCardDefinition,
} from './scenario-cards';

// ─── 常量 ───────────────────────────────────────────────────────────────────────

/** 反应时间阈值（毫秒）：低于此值判定为"随机作答" */
const QUICK_RESPONSE_THRESHOLD_MS = 3000;
const QUICK_RESPONSE_WEIGHT = 0.3;
const FREE_TEXT_WEIGHT_BOOST = 1.5;

/** 一致性阈值（标准差） */
const CONSISTENCY_HIGH_MAX = 0.3;
const CONSISTENCY_MEDIUM_MAX = 0.6;

/** 理想伴侣探测卡 ID（Card 16-18） */
export const IDEAL_PARTNER_CARD_IDS = new Set([
  'unexpected_breakfast',
  'silent_night',
  'song_choice',
]);

// ─── Big Five 维度 key ──────────────────────────────────────────────────────────

const BIG_FIVE_DIMS = [
  'extraversion',
  'agreeableness',
  'conscientiousness',
  'neuroticism',
  'openness',
] as const;

// ─── 中间类型 ───────────────────────────────────────────────────────────────────

/** 单卡对某维度的贡献记录 */
interface CardContribution {
  cardId: string;
  /** 加权后的贡献值 */
  weightedScore: number;
  /** 原始贡献值（用于一致性对比） */
  rawScore: number;
}

/** 单维度的聚合结果 */
interface DimensionAggregation {
  rawMean: number;
  normalizedValue: number; // -1 ~ +1
  confidence: 'high' | 'medium' | 'low';
  contradictions: string[];
  cardCount: number;
}

// ─── 公开类型 ────────────────────────────────────────────────────────────────────

export interface DimensionScoreResult {
  value: number;
  confidence: 'high' | 'medium' | 'low';
  contradictions?: string[];
}

export interface DimensionScores {
  bigFive: Record<string, DimensionScoreResult>;
  timePerspective: string;
  timePerspectiveScores: Record<string, DimensionScoreResult>;
  moralFoundations: Record<string, number>;
  attachmentStyle: string;
  attachmentScores: {
    avoidance: DimensionScoreResult;
    anxiety: DimensionScoreResult;
  };
  attributionStyle: string;
  attributionScores: {
    internal: DimensionScoreResult;
    external: DimensionScoreResult;
  };
  delayedGratification: DimensionScoreResult;
  /** 原始维度聚合数据（供 Phase 1.5 LLM 合成器使用） */
  rawDimensions: Record<string, number>;
}

export interface IdealPartnerDimensions {
  needEmotionalSafety: DimensionScoreResult;
  needSpaceRespect: DimensionScoreResult;
  needDirectCommunication: DimensionScoreResult;
  needConflictResolution: DimensionScoreResult;
}

// ─── 核心函数 ───────────────────────────────────────────────────────────────────

/**
 * 计算维度分数。
 *
 * @param responses 用户对情境卡片的回答（最多 15 条）
 * @returns 结构化维度分数
 */
export function calculateDimensionScores(
  responses: ScenarioResponse[],
): DimensionScores {
  // ①② 收集卡片贡献并聚合每个维度
  const aggregations = aggregateDimensionFromResponses(responses);

  // 无数据 fallback（所有维度共用）
  const noData: DimensionScoreResult = {
    value: 0,
    confidence: 'low' as const,
    contradictions: ['no_data'],
  };

  // ③ 组装 Big Five
  const bigFive: Record<string, DimensionScoreResult> = {};
  for (const dim of BIG_FIVE_DIMS) {
    const agg = aggregations.get(dim);
    bigFive[dim] = agg ? toScoreResult(agg) : { ...noData };
  }

  // ④ 时间观
  const timePerspectiveScores: Record<string, DimensionScoreResult> = {};
  for (const dim of ['timeFuture', 'timePast', 'timePresent']) {
    const agg = aggregations.get(dim);
    timePerspectiveScores[dim] = agg ? toScoreResult(agg) : { ...noData };
  }
  const timePerspective = determineTimePerspective(timePerspectiveScores);

  // ⑤ 道德基础 (MFT)
  const mftDims = ['care', 'fairness', 'authority', 'loyalty'] as const;
  const moralFoundations: Record<string, number> = {};
  for (const dim of mftDims) {
    const agg = aggregations.get(dim);
    moralFoundations[dim] = agg ? agg.normalizedValue : 0;
  }

  // ⑥ 依恋
  const avoidanceAgg = aggregations.get('attachAvoidance');
  const anxietyAgg = aggregations.get('attachAnxiety');
  const attachmentScores = {
    avoidance: avoidanceAgg ? toScoreResult(avoidanceAgg) : { ...noData },
    anxiety: anxietyAgg ? toScoreResult(anxietyAgg) : { ...noData },
  };
  const attachmentStyle = determineAttachmentStyle(
    attachmentScores.avoidance.value,
    attachmentScores.anxiety.value,
  );

  // ⑦ 归因
  const internalAgg = aggregations.get('attributionInternal');
  const externalAgg = aggregations.get('attributionExternal');
  const attributionScores = {
    internal: internalAgg ? toScoreResult(internalAgg) : { ...noData },
    external: externalAgg ? toScoreResult(externalAgg) : { ...noData },
  };
  const attributionStyle = determineAttributionStyle(
    attributionScores.internal.value,
    attributionScores.external.value,
  );

  // ⑧ 延迟满足
  const delayAgg = aggregations.get('delayedGratification');
  const delayedGratification: DimensionScoreResult = delayAgg
    ? toScoreResult(delayAgg)
    : { ...noData };

  // ⑨ 原始维度数据（供 Phase 1.5 LLM 消费）
  const rawDimensions: Record<string, number> = {};
  for (const [dim, agg] of aggregations.entries()) {
    rawDimensions[dim] = agg.normalizedValue;
  }

  return {
    bigFive,
    timePerspective,
    timePerspectiveScores,
    moralFoundations,
    attachmentStyle,
    attachmentScores,
    attributionStyle,
    attributionScores,
    delayedGratification,
    rawDimensions,
  };
}

/**
 * 计算理想伴侣维度分数（Card 16-18）。
 *
 * 只处理 3 张理想伴侣探测卡的回答，聚合为 4 个维度：
 *   needEmotionalSafety / needSpaceRespect / needDirectCommunication / needConflictResolution
 *
 * 算法与 calculateDimensionScores 完全一致（加权均值 + clamp + 一致性检查），
 * 通过 aggregateDimensionFromResponses 共享核心聚合逻辑。
 *
 * @param responses 用户对所有情境卡片的回答（自动过滤出 Card 16-18）
 */
export function calculateIdealPartnerDimensions(
  responses: ScenarioResponse[],
): IdealPartnerDimensions {
  // 过滤出只属于理想伴侣卡片的回答
  const idealResponses = responses.filter((r) =>
    IDEAL_PARTNER_CARD_IDS.has(r.cardId),
  );

  // 复用共享聚合逻辑
  const aggregations = aggregateDimensionFromResponses(idealResponses);

  const noData: DimensionScoreResult = {
    value: 0,
    confidence: 'low' as const,
    contradictions: ['no_data'],
  };

  const dims = [
    'needEmotionalSafety',
    'needSpaceRespect',
    'needDirectCommunication',
    'needConflictResolution',
  ] as const;

  const result = {} as IdealPartnerDimensions;
  for (const dim of dims) {
    const agg = aggregations.get(dim);
    result[dim] = agg ? toScoreResult(agg) : { ...noData };
  }

  return result;
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────────

/**
 * 从回答列表收集各维度的卡片贡献记录并聚合。
 * 供 calculateDimensionScores 和 calculateIdealPartnerDimensions 共用。
 */
function aggregateDimensionFromResponses(
  responses: ScenarioResponse[],
): Map<string, DimensionAggregation> {
  const dimCards = new Map<string, CardContribution[]>();

  for (const resp of responses) {
    const card = getCardDefinition(resp.cardId);
    if (!card) continue;

    // 计算该卡的权重
    let weight = 1.0;
    if (
      resp.responseTimeMs != null &&
      resp.responseTimeMs < QUICK_RESPONSE_THRESHOLD_MS
    ) {
      weight *= QUICK_RESPONSE_WEIGHT;
    }
    if (resp.choice === 'custom' || (resp.freeText && resp.freeText.trim())) {
      weight *= FREE_TEXT_WEIGHT_BOOST;
    }

    // 取选项的贡献值
    let contributions: Record<string, number> = {};
    if (resp.choice !== 'custom') {
      const option = card.options.find((o) => o.key === resp.choice);
      if (option) {
        contributions = option.dimensionContributions;
      }
    }
    // choice === 'custom' 时 contributions 为空对象，维度贡献由自由文本承载
    // （自由文本将在 Phase 1.5 由 LLM 分析，此处不产生数值贡献）

    // 写入每个涉及的维度
    for (const [dim, value] of Object.entries(contributions)) {
      if (!dimCards.has(dim)) dimCards.set(dim, []);
      dimCards.get(dim)!.push({
        cardId: resp.cardId,
        weightedScore: value * weight,
        rawScore: value,
      });
    }
  }

  // 聚合每个维度
  const aggregations = new Map<string, DimensionAggregation>();
  for (const [dim, cards] of dimCards.entries()) {
    aggregations.set(dim, aggregateDimension(dim, cards));
  }
  return aggregations;
}

/**
 * 聚合单维度：取加权均值并钳位，计算一致性。
 */
function aggregateDimension(
  dim: string,
  cards: CardContribution[],
): DimensionAggregation {
  if (cards.length === 0) {
    return {
      rawMean: 0,
      normalizedValue: 0,
      confidence: 'low',
      contradictions: ['no_data'],
      cardCount: 0,
    };
  }

  // 加权均值（权重已在 caller 应用，此处取算术均值）
  // 但 weightedScore 已含权重，所以需要还原：用 rawScore 取均值再乘平均权重？
  // 更简洁的做法：对 rawScore 取均值作为标准化值，权重影响聚合的"有效样本数"。
  // 实际选择：直接对 weightedScore 取均值，这使降权卡的贡献更小。
  const weightedMean =
    cards.reduce((sum, c) => sum + c.weightedScore, 0) / cards.length;

  // 钳位到 [-1, +1]
  const normalizedValue = clamp(weightedMean, -1, 1);

  // 一致性检查（仅对多卡维度有效）
  const contradictions: string[] = [];
  let confidence: 'high' | 'medium' | 'low';

  if (cards.length >= 2) {
    const rawScores = cards.map((c) => c.rawScore);
    const stddev = computeStdDev(rawScores);

    if (stddev < CONSISTENCY_HIGH_MAX) {
      confidence = 'high';
    } else if (stddev <= CONSISTENCY_MEDIUM_MAX) {
      confidence = 'medium';
    } else {
      confidence = 'low';
      // 找出矛盾的卡对
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i];
          const b = cards[j];
          // 方向相反且差值 > 0.8 视为矛盾
          if (a.rawScore * b.rawScore < 0 && Math.abs(a.rawScore - b.rawScore) > 0.8) {
            contradictions.push(`${a.cardId} vs ${b.cardId}`);
          }
        }
      }
      if (contradictions.length === 0) {
        contradictions.push(
          `high_variance(dim=${dim}, stddev=${stddev.toFixed(2)})`,
        );
      }
    }
  } else {
    // 单卡维度：无一致性校验，默认 medium
    confidence = 'medium';
  }

  return {
    rawMean: weightedMean,
    normalizedValue,
    confidence,
    contradictions,
    cardCount: cards.length,
  };
}

function toScoreResult(agg: DimensionAggregation): DimensionScoreResult {
  const result: DimensionScoreResult = {
    value: agg.normalizedValue,
    confidence: agg.confidence,
  };
  if (agg.contradictions.length > 0) {
    result.contradictions = agg.contradictions;
  }
  return result;
}

// ─── 判定函数 ────────────────────────────────────────────────────────────────────

function determineTimePerspective(
  scores: Record<string, DimensionScoreResult>,
): string {
  const future = scores.timeFuture?.value ?? 0;
  const past = scores.timePast?.value ?? 0;
  const present = scores.timePresent?.value ?? 0;

  const max = Math.max(future, past, present);
  if (max === 0) return 'balanced';
  if (future === max) return 'future_oriented';
  if (past === max) return 'past_reflective';
  return 'present_focused';
}

/**
 * 依恋类型判定（基于 Bartholomew & Horowitz 四象限模型）：
 *   低回避 + 低焦虑 → Secure（安全型）
 *   低回避 + 高焦虑 → Preoccupied（痴迷型）
 *   高回避 + 低焦虑 → Dismissing（疏离型）
 *   高回避 + 高焦虑 → Fearful（恐惧型）
 */
function determineAttachmentStyle(
  avoidance: number,
  anxiety: number,
): string {
  const highAvoidance = avoidance > 0.2;
  const highAnxiety = anxiety > 0.2;

  if (!highAvoidance && !highAnxiety) return 'secure';
  if (!highAvoidance && highAnxiety) return 'preoccupied';
  if (highAvoidance && !highAnxiety) return 'dismissing';
  return 'fearful';
}

function determineAttributionStyle(
  internal: number,
  external: number,
): string {
  const net = internal - external;
  if (net > 0.3) return 'internal';
  if (net < -0.3) return 'external';
  return 'balanced';
}

// ─── 数学工具 ────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── 转换为存储格式 ──────────────────────────────────────────────────────────────

/**
 * 把完整的 DimensionScores 转为 OnboardingSurveyJson.dimensionScores 格式，
 * 直接写入 surveyJson。
 */
export function toSurveyDimensionScores(
  scores: DimensionScores,
): {
  bigFive: Record<
    string,
    { value: number; confidence: string; contradictions?: string[] }
  >;
  timePerspective: string;
  moralFoundations: Record<string, number>;
  attachmentStyle: string;
} {
  const bigFive: Record<
    string,
    { value: number; confidence: string; contradictions?: string[] }
  > = {};
  for (const [dim, result] of Object.entries(scores.bigFive)) {
    bigFive[dim] = {
      value: result.value,
      confidence: result.confidence,
      ...(result.contradictions?.length
        ? { contradictions: result.contradictions }
        : {}),
    };
  }

  return {
    bigFive,
    timePerspective: scores.timePerspective,
    moralFoundations: scores.moralFoundations,
    attachmentStyle: scores.attachmentStyle,
  };
}

/**
 * 把 IdealPartnerDimensions 转为 OnboardingSurveyJson 可存储的扁平格式。
 */
export function toSurveyIdealPartnerDimensions(
  dims: IdealPartnerDimensions,
): Record<string, { value: number; confidence: string }> {
  return {
    needEmotionalSafety: {
      value: dims.needEmotionalSafety.value,
      confidence: dims.needEmotionalSafety.confidence,
    },
    needSpaceRespect: {
      value: dims.needSpaceRespect.value,
      confidence: dims.needSpaceRespect.confidence,
    },
    needDirectCommunication: {
      value: dims.needDirectCommunication.value,
      confidence: dims.needDirectCommunication.confidence,
    },
    needConflictResolution: {
      value: dims.needConflictResolution.value,
      confidence: dims.needConflictResolution.confidence,
    },
  };
}
