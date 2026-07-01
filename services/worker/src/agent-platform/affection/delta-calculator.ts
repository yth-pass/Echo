import type { AffectionEventType, AffectionDimensions, EventStrength, TrustRepairArc, TensionQuality } from './types';
import { TENSION_QUALITY_RULES } from './types';

const BASE_DELTAS: Record<AffectionEventType, Partial<AffectionDimensions>> = {
  positive_engagement: { familiarity: 2, warmth: 2 },
  compliment: { warmth: 3, familiarity: 1 },
  helpful_share: { warmth: 2, trust: 2 },
  agreement: { warmth: 2 },
  conflict: { tension: 5, warmth: -3 },
  insult_or_rude: { tension: 10, warmth: -8 },
  apology_or_repair: { tension: -6, warmth: 3 },
  trust_confirm: { trust: 4 },
  trust_break: { trust: -8, tension: 3 },
  deep_share: { trust: 3, warmth: 2 },
  collaborative_success: { trust: 3, familiarity: 1 },
  support_received: { trust: 4, warmth: 2 },
  support_given: { trust: 3, warmth: 1 },
  explicit_bond: { warmth: 5 },
  session_contact: { familiarity: 1 },
  value_alignment: { warmth: 4, trust: 3 },
  preference_match: { warmth: 3, trust: 2 },
};

export const POSITIVE_TRUST_EVENTS: AffectionEventType[] = [
  'trust_confirm',
  'deep_share',
  'collaborative_success',
  'support_received',
  'support_given',
];

function scaleForWarmth(base: number, currentWarmth: number): number {
  if (base === 0) return 0;
  const factor = Math.max(0.2, 1 - currentWarmth / 120);
  return Math.round(base * factor);
}

function scaleForTension(base: number, currentTension: number): number {
  if (base === 0) return 0;
  const factor = Math.max(0.5, 1 + currentTension / 80);
  return Math.round(base * factor);
}

function scaleForTrust(base: number, currentTrust: number): number {
  if (base === 0) return 0;
  const factor = Math.max(0.3, 1 - Math.abs(base) * currentTrust / 200);
  return Math.round(base * factor);
}

function scaleForFamiliarity(base: number, currentFamiliarity: number): number {
  if (base === 0) return 0;
  const factor = Math.max(0.4, 1 - currentFamiliarity / 150);
  return Math.round(base * factor);
}

/**
 * Trust gain multiplier during repair arc based on positive interactions since last break.
 * Count is 1-based after increment (1-3: 0.50, 4-6: 0.75, 7+: 1.00).
 */
export function getRepairTrustMultiplier(positiveInteractionsSinceBreak: number): number {
  if (positiveInteractionsSinceBreak <= 3) return 0.50;
  if (positiveInteractionsSinceBreak <= 6) return 0.75;
  return 1.00;
}

/**
 * getStrengthMultiplier
 * 根据事件强度调整基础 delta 幅度。
 * 原则：strong 事件产生更大影响（尤其是负向），weak 事件影响受限。
 * positive 事件：strong=1.5, moderate=1.0, weak=0.6
 * negative 事件：strong=1.8, moderate=1.0, weak=0.5（冲突放大更明显）
 */
export function getStrengthMultiplier(strength: EventStrength, eventType: AffectionEventType): number {
  const isNegative = ['conflict', 'insult_or_rude', 'trust_break'].includes(eventType);
  if (strength === 'moderate') return 1.0;
  if (strength === 'strong') {
    return isNegative ? 1.8 : 1.5;
  }
  // weak
  return isNegative ? 0.5 : 0.6;
}

export function updateRepairArc(arc: TrustRepairArc, eventType: AffectionEventType): TrustRepairArc {
  if (eventType === 'trust_break') {
    return {
      trust_break_count: arc.trust_break_count + 1,
      positive_interactions_since_break: 0,
      is_in_repair_arc: true,
    };
  }

  if (arc.is_in_repair_arc && POSITIVE_TRUST_EVENTS.includes(eventType)) {
    const nextCount = arc.positive_interactions_since_break + 1;
    return {
      ...arc,
      positive_interactions_since_break: nextCount,
      is_in_repair_arc: nextCount < 7,
    };
  }

  return arc;
}

export function getStateDependentDelta(
  eventType: AffectionEventType,
  current: AffectionDimensions,
  strength: EventStrength = 'moderate',
  repairArc?: TrustRepairArc,
): Partial<AffectionDimensions> {
  const base = BASE_DELTAS[eventType] || {};
  const multiplier = getStrengthMultiplier(strength, eventType);

  const result: Partial<AffectionDimensions> = {};

  if (base.familiarity !== undefined) {
    const scaled = scaleForFamiliarity(base.familiarity, current.familiarity);
    result.familiarity = Math.round(scaled * multiplier);
  }
  if (base.warmth !== undefined) {
    const scaled = scaleForWarmth(base.warmth, current.warmth);
    result.warmth = Math.round(scaled * multiplier);
  }
  if (base.trust !== undefined) {
    const scaled = scaleForTrust(base.trust, current.trust);
    result.trust = Math.round(scaled * multiplier);
  }
  if (base.tension !== undefined) {
    const scaled = scaleForTension(base.tension, current.tension);
    result.tension = Math.round(scaled * multiplier);
  }

  // Repair arc: dampen positive trust gains only; trust_break negatives stay full strength
  if (
    repairArc?.is_in_repair_arc &&
    POSITIVE_TRUST_EVENTS.includes(eventType) &&
    result.trust !== undefined &&
    result.trust > 0
  ) {
    const nextCount = repairArc.positive_interactions_since_break + 1;
    result.trust = Math.round(result.trust * getRepairTrustMultiplier(nextCount));
  }

  return result;
}

export function getTensionQuality(eventType: AffectionEventType): TensionQuality {
  return TENSION_QUALITY_RULES[eventType] ?? 'situational';
}

export { BASE_DELTAS };
