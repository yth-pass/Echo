import { AffectionStateStore } from './affection-state.store';
import { AffectionEventStore } from './affection-event.store';
import { applyHysteresis } from './label-transition-rules';
import { getStateDependentDelta, getTensionQuality, updateRepairArc } from './delta-calculator';
import {
  DEFAULT_AFFECTION_DIMENSIONS,
  DEFAULT_REPAIR_ARC,
  type AffectionDimensions,
  type AffectionEvent,
  type AffectionState,
  type RelationshipLabel,
  type TensionQuality,
  type EventStrength,
} from './types';

export interface DecayResult {
  applied: boolean;
  daysSinceContact: number;
  before: AffectionDimensions;
  after: AffectionDimensions;
  skippedReason?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeComposite(d: AffectionDimensions): number {
  const raw = 0.25 * d.familiarity + 0.35 * d.warmth + 0.3 * d.trust - 0.40 * d.tension;
  return clamp(Math.round(raw), 0, 100);
}

function computeLabel(d: AffectionDimensions & { composite_affinity: number }): RelationshipLabel {
  if (d.tension >= 50 || (d.warmth < 25 && d.familiarity >= 15)) return 'strained';
  if (d.trust <= 40 && d.tension >= 40 && d.familiarity < 20) return 'distant';
  if (d.trust >= 25 && d.warmth >= 40 && d.tension >= 25) return 'friendly_but_cautious';
  if (d.composite_affinity >= 75 && d.trust >= 70 && d.tension < 20) return 'close';
  if (d.composite_affinity >= 60 && d.tension < 30) return 'good_terms';
  if (d.composite_affinity >= 40) return 'friendly_acquaintance';
  if (d.familiarity < 15) return 'stranger';
  return 'acquaintance';
}

function daysSince(isoDate: string, nowMs: number): number {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((nowMs - then) / (24 * 60 * 60 * 1000)));
}

function daysSinceLastContact(state: AffectionState, events: AffectionEvent[], nowMs: number): number {
  if (state.last_interaction_at) {
    return daysSince(state.last_interaction_at, nowMs);
  }
  if (events.length > 0) {
    const latest = events.reduce((max, e) => (e.at > max ? e.at : max), events[0].at);
    return daysSince(latest, nowMs);
  }
  return 0;
}

function weeksEligible(days: number, minDays: number): number {
  if (days < minDays) return 0;
  return Math.floor((days - minDays) / 7) + 1;
}

function everMet(state: AffectionState, events: AffectionEvent[]): boolean {
  return (
    events.length > 0 ||
    state.dimensions.familiarity > 0 ||
    !!state.last_interaction_at
  );
}

/**
 * 【步骤3修复】从不可变事件历史重建"基线维度"——即最后一次交互时刻的峰值维度。
 * 衰减总是基于此基线重算（baseline - 总衰减），而非基于当前已衰减值递减，
 * 从而保证多次运行 decay 不会叠加（幂等）。
 */
function reconstructBaselineDims(events: AffectionEvent[]): {
  familiarity: number;
  warmth: number;
  trust: number;
  tension: number;
  tensionQuality: TensionQuality;
  repairArcTrustBreakCount: number;
} {
  if (events.length === 0) {
    return {
      familiarity: 0,
      warmth: 0,
      trust: 0,
      tension: 0,
      tensionQuality: 'situational',
      repairArcTrustBreakCount: 0,
    };
  }
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let dim = { ...DEFAULT_AFFECTION_DIMENSIONS };
  let repairArc = DEFAULT_REPAIR_ARC;
  let tensionQuality: TensionQuality = 'situational';
  for (const evt of sorted) {
    const strength = (evt.evidence?.strength as EventStrength) || 'moderate';
    const delta = getStateDependentDelta(evt.event_type, dim, strength, repairArc);
    dim.familiarity = clamp(dim.familiarity + (delta.familiarity ?? 0), 0, 100);
    dim.warmth = clamp(dim.warmth + (delta.warmth ?? 0), 0, 100);
    dim.trust = clamp(dim.trust + (delta.trust ?? 0), 0, 100);
    dim.tension = clamp(dim.tension + (delta.tension ?? 0), 0, 100);
    if ((delta.tension ?? 0) > 0) {
      const q = getTensionQuality(evt.event_type);
      if (q === 'structural' || tensionQuality === 'structural') tensionQuality = 'structural';
      else tensionQuality = 'situational';
    }
    repairArc = updateRepairArc(repairArc, evt.event_type);
  }
  return {
    familiarity: dim.familiarity,
    warmth: dim.warmth,
    trust: dim.trust,
    tension: dim.tension,
    tensionQuality,
    repairArcTrustBreakCount: repairArc.trust_break_count,
  };
}

/**
 * 【步骤3修复】基于基线 + lastInteractionAt 计算目标维度（幂等）。
 * 目标值 = 基线 - 总衰减量，clamp 到 [0, 基线]。
 * 因基线来自不可变事件历史、总衰减量是 lastInteractionAt 的纯函数，
 * 同一时刻多次运行结果一致，不会叠加。
 */
function applyDecayFromBaseline(
  baseline: { familiarity: number; warmth: number; trust: number; tension: number; tensionQuality: TensionQuality; repairArcTrustBreakCount: number },
  events: AffectionEvent[],
  state: AffectionState,
  days: number,
): AffectionDimensions {
  const met = everMet(state, events);
  const famFloor = met ? 10 : 0;
  // familiarity：基线 - 总衰减（每周 -1，7 天后起算）
  const famLoss = weeksEligible(days, 7);
  const familiarity = clamp(baseline.familiarity - famLoss, famFloor, baseline.familiarity);

  // warmth：基线 - 总衰减（14 天后起算；trust>=70 时衰减半价）
  const warmWeeks = weeksEligible(days, 14);
  const warmLoss = Math.floor(warmWeeks * (baseline.trust >= 70 ? 0.5 : 1));
  const warmth = clamp(baseline.warmth - warmLoss, 0, baseline.warmth);

  // trust：基线 - 总衰减（30 天后起算，每周 -2；多次 trust_break 加速 1.5x）
  const trustFloor = baseline.trust >= 30 ? 10 : 0;
  const breakMultiplier = baseline.repairArcTrustBreakCount > 3 ? 1.5 : 1;
  const trustLoss = Math.floor(weeksEligible(days, 30) * 2 * breakMultiplier);
  const trust = clamp(baseline.trust - trustLoss, trustFloor, baseline.trust);

  // tension：situational 类型衰减，structural 不衰减
  let tension = baseline.tension;
  let tensionQuality: TensionQuality = baseline.tensionQuality;
  if (tensionQuality === 'situational') {
    const tensionLoss = weeksEligible(days, 14) * 2;
    tension = clamp(baseline.tension - tensionLoss, 0, baseline.tension);
  }
  if (tensionQuality === 'structural' && tension === 0) {
    tensionQuality = 'situational';
  }

  return { familiarity, warmth, trust, tension, tension_quality: tensionQuality };
}

/**
 * affection-decay.job
 * Manual trigger: npx ts-node affection-decay.job.ts <observerId> <otherId>
 *
 * 【步骤3修复】基于 lastInteractionAt 重算目标值（baseline - 总衰减），幂等：
 * 重复运行不会叠加衰减，因为总是从不可变事件重建基线再扣减。
 */
export async function runAffectionDecay(
  observerId: string,
  otherId: string,
  baseDir?: string,
  now: Date = new Date(),
): Promise<DecayResult> {
  const stateStore = new AffectionStateStore(baseDir);
  const eventStore = new AffectionEventStore(baseDir);
  const nowMs = now.getTime();

  const state = await stateStore.read(observerId, otherId);
  const events = await eventStore.readAll(observerId, otherId);
  const before = { ...state.dimensions };

  const daysSinceContact = daysSinceLastContact(state, events, nowMs);
  if (daysSinceContact < 7) {
    const reason = daysSinceContact === 0
      ? 'no prior contact recorded'
      : `only ${daysSinceContact} days since last contact (need >= 7)`;
    console.log(`[M6] Decay skipped: ${reason}`);
    return { applied: false, daysSinceContact, before, after: before, skippedReason: reason };
  }

  // 【步骤3修复】从事件历史重建基线，再计算目标值（幂等）
  const baseline = reconstructBaselineDims(events);
  const newDim = applyDecayFromBaseline(baseline, events, state, daysSinceContact);
  const unchanged =
    newDim.familiarity === before.familiarity &&
    newDim.warmth === before.warmth &&
    newDim.trust === before.trust &&
    newDim.tension === before.tension &&
    newDim.tension_quality === before.tension_quality;

  if (unchanged) {
    const reason = 'dimensions already at decay target';
    console.log(`[M6] Decay skipped: ${reason}`);
    return { applied: false, daysSinceContact, before, after: before, skippedReason: reason };
  }

  const newComposite = computeComposite(newDim);
  const rawLabel = computeLabel({ ...newDim, composite_affinity: newComposite });
  const newLabel = applyHysteresis(state.relationship_label, rawLabel, newDim, newComposite);

  const newState: AffectionState = {
    ...state,
    dimensions: newDim,
    composite_affinity: newComposite,
    relationship_label: newLabel,
    last_updated_at: now.toISOString(),
  };

  const writeRes = await stateStore.write(observerId, otherId, state.version, newState);
  if (!writeRes.success) {
    const reason = 'version conflict on affection write';
    console.warn(`[M6] Decay write failed: ${reason}`);
    return { applied: false, daysSinceContact, before, after: before, skippedReason: reason };
  }

  console.log(
    `[M6] Decay: fam ${before.familiarity}→${newDim.familiarity} ` +
      `warm ${before.warmth}→${newDim.warmth} ` +
      `trust ${before.trust}→${newDim.trust} ` +
      `tension ${before.tension}→${newDim.tension} ` +
      `(days=${daysSinceContact}, label=${state.relationship_label}→${newLabel})`,
  );

  return { applied: true, daysSinceContact, before, after: newDim };
}

async function main() {
  const [, , observerId, otherId] = process.argv;
  if (!observerId || !otherId) {
    console.error('Usage: ts-node affection-decay.job.ts <observerId> <otherId>');
    process.exit(1);
  }

  await runAffectionDecay(observerId, otherId);
}

if (require.main === module) {
  main().catch(console.error);
}
