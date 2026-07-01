import type { AffectionState, AffectionEvent, AffectionEventType, RelationshipLabel, AffectionDimensions, EventStrength } from './types';
import { DEFAULT_AFFECTION_DIMENSIONS } from './types';

export const LABEL_THRESHOLDS: Partial<Record<RelationshipLabel, {
  required: AffectionDimensions;
  mustHaveEvent?: AffectionEventType[];
  minPositiveEvents?: number;
  minDistinctTopics?: number;
}>> = {
  close: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 60, warmth: 70, trust: 70, tension: 20 },
    mustHaveEvent: ['explicit_bond', 'value_alignment'],
    minPositiveEvents: 6,
    minDistinctTopics: 2,
  },
  good_terms: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 40, warmth: 55, trust: 50, tension: 30 },
    mustHaveEvent: ['explicit_bond'],
    minPositiveEvents: 4,
  },
  friendly_acquaintance: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 20, warmth: 40, trust: 35, tension: 35 },
    minPositiveEvents: 1,
  },
  acquaintance: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 15, warmth: 25, trust: 20, tension: 50 },
  },
};

const POSITIVE_EVENTS: AffectionEventType[] = [
  'positive_engagement', 'compliment', 'helpful_share', 'agreement', 'explicit_bond', 'session_contact', 'value_alignment', 'preference_match',
];

function countPositiveEvents(events: AffectionEvent[]): number {
  return events.filter((e) => POSITIVE_EVENTS.includes(e.event_type)).length;
}

function dimensionsMeetRequired(current: AffectionDimensions, required: AffectionDimensions): boolean {
  return (
    current.familiarity >= required.familiarity &&
    current.warmth >= required.warmth &&
    current.trust >= required.trust &&
    current.tension <= required.tension
  );
}

/**
 * Stage-specific relaxation rules (分阶段) + event strength awareness (事件强度).
 * Each target label has its own base relaxation and strength-based bonuses.
 * Strength defaults to 'moderate' if not provided by LLM.
 */
const RELAXATION_RULES: Partial<Record<RelationshipLabel, {
  baseRelax: AffectionDimensions;
  strengthBonus: Record<EventStrength, Partial<AffectionDimensions>>;
  perEventBonus?: Partial<AffectionDimensions>;
}>> = {
  good_terms: {
    baseRelax: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 10, warmth: 15, trust: 10, tension: -5 },
    strengthBonus: {
      weak: { familiarity: 5, warmth: 5, trust: 5, tension: 0 },
      moderate: { familiarity: 10, warmth: 10, trust: 10, tension: -5 },
      strong: { familiarity: 15, warmth: 15, trust: 15, tension: -10 },
    },
    perEventBonus: { warmth: 3, trust: 2 },
  },
  close: {
    baseRelax: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 15, warmth: 20, trust: 15, tension: -10 },
    strengthBonus: {
      weak: { familiarity: 10, warmth: 10, trust: 10, tension: -5 },
      moderate: { familiarity: 15, warmth: 15, trust: 15, tension: -10 },
      strong: { familiarity: 20, warmth: 20, trust: 20, tension: -15 },
    },
    perEventBonus: { warmth: 4, trust: 3, familiarity: 2 },
  },
  friendly_acquaintance: {
    baseRelax: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 5, warmth: 8, trust: 5, tension: 0 },
    strengthBonus: {
      weak: { familiarity: 3, warmth: 3, trust: 3, tension: 0 },
      moderate: { familiarity: 5, warmth: 5, trust: 5, tension: 0 },
      strong: { familiarity: 8, warmth: 8, trust: 8, tension: -5 },
    },
  },
};

function getEffectiveThreshold(
  targetLabel: RelationshipLabel,
  events: AffectionEvent[]
): AffectionDimensions {
  const base = LABEL_THRESHOLDS[targetLabel]?.required;
  if (!base) {
    return { ...DEFAULT_AFFECTION_DIMENSIONS, tension: 100 };
  }

  const rule = RELAXATION_RULES[targetLabel];
  if (!rule) {
    return base;
  }

  // 泛化：所有事件均参与 strength 影响（不再仅限 critical events）
  const relevantEvents = events.length > 0 ? events : [];

  if (relevantEvents.length === 0) {
    return base;
  }

  let totalRelax: AffectionDimensions = { ...rule.baseRelax };

  for (const evt of relevantEvents) {
    const strength: EventStrength = (evt.evidence?.strength as EventStrength) || 'moderate';
    const bonus = rule.strengthBonus[strength] || {};
    totalRelax.familiarity += bonus.familiarity ?? 0;
    totalRelax.warmth += bonus.warmth ?? 0;
    totalRelax.trust += bonus.trust ?? 0;
    totalRelax.tension += bonus.tension ?? 0;
  }

  if (rule.perEventBonus && relevantEvents.length > 1) {
    const extra = relevantEvents.length - 1;
    totalRelax.warmth += (rule.perEventBonus.warmth ?? 0) * extra;
    totalRelax.trust += (rule.perEventBonus.trust ?? 0) * extra;
    totalRelax.familiarity += (rule.perEventBonus.familiarity ?? 0) * extra;
  }

  return {
    ...DEFAULT_AFFECTION_DIMENSIONS,
    familiarity: Math.max(0, base.familiarity - totalRelax.familiarity),
    warmth: Math.max(0, base.warmth - totalRelax.warmth),
    trust: Math.max(0, base.trust - totalRelax.trust),
    tension: Math.min(100, base.tension + totalRelax.tension),
  };
}

export function checkLabelUpgrade(
  before: AffectionState,
  candidate: AffectionState,
  events: AffectionEvent[]
): { allowed: boolean; reason: string } {
  const beforeLabel = before.relationship_label;
  const candidateLabel = candidate.relationship_label;

  if (beforeLabel === candidateLabel) {
    return { allowed: true, reason: 'no label change' };
  }

  const threshold = LABEL_THRESHOLDS[candidateLabel];
  if (!threshold) {
    return { allowed: true, reason: 'no threshold defined for target label' };
  }

  const effectiveRequired = getEffectiveThreshold(candidateLabel, events);
  if (!dimensionsMeetRequired(candidate.dimensions, effectiveRequired)) {
    return { allowed: false, reason: `dimensions do not meet required for ${candidateLabel}` };
  }

  if (threshold.mustHaveEvent) {
    const hasRequired = events.some((e) => threshold.mustHaveEvent!.includes(e.event_type));
    if (!hasRequired) {
      return { allowed: false, reason: `missing required event ${threshold.mustHaveEvent.join(' or ')}` };
    }
  }

  if (threshold.minPositiveEvents !== undefined) {
    const posCount = countPositiveEvents(events);
    if (posCount < threshold.minPositiveEvents) {
      return { allowed: false, reason: `insufficient positive events (${posCount} < ${threshold.minPositiveEvents})` };
    }
  }

  if (threshold.minDistinctTopics !== undefined) {
    const topicSet = new Set<string>();
    for (const e of events) {
      const t = e.evidence?.topic_id ?? e.evidence?.joint_session_id;
      if (t) topicSet.add(t);
    }
    if (topicSet.size < threshold.minDistinctTopics) {
      return { allowed: false, reason: `insufficient distinct topics (${topicSet.size} < ${threshold.minDistinctTopics})` };
    }
  }

  return { allowed: true, reason: 'thresholds satisfied' };
}

const NEGATIVE_EVENTS: AffectionEventType[] = [
  'conflict', 'insult_or_rude', 'trust_break'
];

function countNegativeEvents(events: AffectionEvent[]): number {
  return events.filter((e) => NEGATIVE_EVENTS.includes(e.event_type)).length;
}

function dimensionsMeetDowngradeRequired(current: AffectionDimensions, required: AffectionDimensions): boolean {
  // For downgrade "required" defines upper bounds for positive dims and lower bound for tension
  return (
    current.tension >= required.tension &&
    current.trust <= required.trust &&
    (required.warmth === 0 || current.warmth <= required.warmth) &&
    (required.familiarity === 0 || current.familiarity <= required.familiarity)
  );
}

/**
 * Downgrade rules for negative relationship labels.
 * Symmetric to LABEL_THRESHOLDS but focused on negative events and tension.
 */
export const LABEL_DOWNGRADE_RULES: Partial<Record<RelationshipLabel, {
  required: AffectionDimensions;
  mustHaveEvent?: AffectionEventType[];
  minNegativeEvents?: number;
}>> = {
  strained: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 0, warmth: 0, trust: 30, tension: 60 },
    mustHaveEvent: ['conflict', 'insult_or_rude', 'trust_break'],
    minNegativeEvents: 2,
  },
  distant: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 0, warmth: 0, trust: 40, tension: 40 },
    mustHaveEvent: ['conflict'],
    minNegativeEvents: 1,
  },
  friendly_but_cautious: {
    required: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 10, warmth: 20, trust: 25, tension: 45 },
    mustHaveEvent: ['trust_break'],
    minNegativeEvents: 1,
  },
};

export function checkLabelDowngrade(
  before: AffectionState,
  candidate: AffectionState,
  events: AffectionEvent[]
): { allowed: boolean; reason: string } {
  const beforeLabel = before.relationship_label;
  const candidateLabel = candidate.relationship_label;

  if (beforeLabel === candidateLabel) {
    return { allowed: true, reason: 'no label change' };
  }

  const rule = LABEL_DOWNGRADE_RULES[candidateLabel];
  if (!rule) {
    return { allowed: true, reason: 'no downgrade rule defined for target label' };
  }

  if (!dimensionsMeetDowngradeRequired(candidate.dimensions, rule.required)) {
    return { allowed: false, reason: `dimensions do not meet downgrade required for ${candidateLabel}` };
  }

  if (rule.mustHaveEvent) {
    const hasRequired = events.some((e) => rule.mustHaveEvent!.includes(e.event_type));
    if (!hasRequired) {
      return { allowed: false, reason: `missing required negative event ${rule.mustHaveEvent.join(' or ')}` };
    }
  }

  if (rule.minNegativeEvents !== undefined) {
    const negCount = countNegativeEvents(events);
    if (negCount < rule.minNegativeEvents) {
      return { allowed: false, reason: `insufficient negative events (${negCount} < ${rule.minNegativeEvents})` };
    }
  }

  return { allowed: true, reason: 'downgrade thresholds satisfied' };
}

const POSITIVE_LABEL_LADDER: RelationshipLabel[] = [
  'stranger',
  'acquaintance',
  'friendly_acquaintance',
  'good_terms',
  'close',
];

const COMPOSITE_THRESHOLD: Partial<Record<RelationshipLabel, number>> = {
  friendly_acquaintance: 40,
  good_terms: 60,
  close: 75,
};

function positiveLabelRank(label: RelationshipLabel): number | null {
  const rank = POSITIVE_LABEL_LADDER.indexOf(label);
  return rank === -1 ? null : rank;
}

/**
 * 对正向关系标签施加 composite 迟滞，减少轻微波动导致的 label 来回跳变。
 *
 * - 升级迟滞：candidate 高于 prior 时，composite 须达到 candidate 阈值的 110% 才允许升级
 *   （例：friendly_acquaintance → good_terms 需 composite ≥ 66，而非 60）
 * - 降级抵抗：candidate 低于 prior 时，composite 须跌破 prior 阈值的 90% 才允许降级
 *   （例：close → good_terms 需 composite ≤ 67.5，而非刚到 74）
 *
 * 豁免（不受迟滞约束）：
 * - strained 判定或 tension ≥ 50（安全相关，不可延迟）
 * - stranger → acquaintance 的初次升级
 */
export function applyHysteresis(
  priorLabel: RelationshipLabel,
  candidateLabel: RelationshipLabel,
  dimensions: AffectionDimensions,
  composite: number
): RelationshipLabel {
  if (priorLabel === candidateLabel) {
    return candidateLabel;
  }

  if (candidateLabel === 'strained' || dimensions.tension >= 50) {
    return candidateLabel;
  }

  if (priorLabel === 'stranger' && candidateLabel === 'acquaintance') {
    return candidateLabel;
  }

  const priorRank = positiveLabelRank(priorLabel);
  const candidateRank = positiveLabelRank(candidateLabel);

  if (priorRank !== null && candidateRank !== null) {
    if (candidateRank > priorRank) {
      const threshold = COMPOSITE_THRESHOLD[candidateLabel];
      if (threshold !== undefined && composite < threshold * 1.1) {
        return priorLabel;
      }
    } else if (candidateRank < priorRank) {
      const threshold = COMPOSITE_THRESHOLD[priorLabel];
      if (threshold !== undefined && composite > threshold * 0.9) {
        return priorLabel;
      }
    }
  }

  return candidateLabel;
}
