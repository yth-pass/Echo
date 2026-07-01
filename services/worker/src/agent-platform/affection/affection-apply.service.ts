import type { AffectionEvent, AffectionState, ApplyResult, RelationshipLabel, EventStrength } from './types';
import { DEFAULT_AFFECTION_DIMENSIONS, DEFAULT_REPAIR_ARC } from './types';
import { AffectionStateStore } from './affection-state.store';
import { AffectionEventStore } from './affection-event.store';
import { getStateDependentDelta, getTensionQuality, updateRepairArc } from './delta-calculator';
import { checkLabelUpgrade, checkLabelDowngrade, applyHysteresis } from './label-transition-rules';
import { RelationshipChangeJudgeService, type ChangeDirection } from './relationship-upgrade-judge.service';
import {
  computeReciprocityMultiplier,
  DEFAULT_RECIPROCITY_CONFIG,
  type ReciprocityConfig,
} from './reciprocity.service';
import * as path from 'path';
import { promises as fs } from 'fs';
import { getMemoryBaseDir } from './memory-base-dir';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeComposite(d: { familiarity: number; warmth: number; trust: number; tension: number }): number {
  const raw = 0.25 * d.familiarity + 0.35 * d.warmth + 0.3 * d.trust - 0.40 * d.tension;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * 根据四维数值与 composite_affinity 判定 relationship_label。
 * 规则按优先级从高到低匹配，首个满足条件即返回。
 *
 * 1. strained — 高张力或冷面熟人：tension ≥ 50，或 warmth < 25 且 familiarity ≥ 15
 * 2. distant — 低信任、高张力、不熟：trust ≤ 40 且 tension ≥ 40 且 familiarity < 20
 * 3. friendly_but_cautious — 有温度但存戒心：trust ≥ 25 且 warmth ≥ 40 且 tension ≥ 25
 * 4. close — 亲密关系：composite ≥ 75 且 trust ≥ 70 且 tension < 20
 * 5. good_terms — 相处融洽：composite ≥ 60 且 tension < 30
 * 6. friendly_acquaintance — 友好熟识：composite ≥ 40
 * 7. stranger — 几乎不认识：familiarity < 15
 * 8. acquaintance — 默认熟人：以上均不满足
 */
function computeLabel(d: { familiarity: number; warmth: number; trust: number; tension: number; composite_affinity: number }): RelationshipLabel {
  if (d.tension >= 50 || (d.warmth < 25 && d.familiarity >= 15)) return 'strained';
  if (d.trust <= 40 && d.tension >= 40 && d.familiarity < 20) return 'distant';
  if (d.trust >= 25 && d.warmth >= 40 && d.tension >= 25) return 'friendly_but_cautious';
  if (d.composite_affinity >= 75 && d.trust >= 70 && d.tension < 20) return 'close';
  if (d.composite_affinity >= 60 && d.tension < 30) return 'good_terms';
  if (d.composite_affinity >= 40) return 'friendly_acquaintance';
  if (d.familiarity < 15) return 'stranger';
  return 'acquaintance';
}

export class AffectionApplyService {
  private stateStore: AffectionStateStore;
  private eventStore: AffectionEventStore;
  private baseDir: string;
  private reciprocityConfig: ReciprocityConfig;

  constructor(baseDir?: string, reciprocityConfig: ReciprocityConfig = DEFAULT_RECIPROCITY_CONFIG) {
    this.baseDir = baseDir ?? getMemoryBaseDir();
    this.reciprocityConfig = reciprocityConfig;
    this.stateStore = new AffectionStateStore(this.baseDir);
    this.eventStore = new AffectionEventStore(this.baseDir);
  }

  private async loadObserverStyle(observerId: string): Promise<string> {
    const stylePath = path.join(this.baseDir, 'users', observerId, 'style.md');
    try {
      const content = await fs.readFile(stylePath, 'utf-8');
      // 截取关键部分：Tone + Avoid + 第一条 Few-shot
      const toneMatch = content.match(/## Tone\s*([\s\S]*?)(?=\n## |$)/);
      const avoidMatch = content.match(/## Avoid\s*([\s\S]*?)(?=\n## |$)/);
      const fewShotMatch = content.match(/## Few-shots\s*([\s\S]*?)(?=\n## |$)/);
      let excerpt = '';
      if (toneMatch) excerpt += `Tone: ${toneMatch[1].trim()}\n`;
      if (avoidMatch) excerpt += `Avoid: ${avoidMatch[1].trim()}\n`;
      if (fewShotMatch) {
        const first = fewShotMatch[1].trim().split('\n')[0];
        excerpt += `Few-shot example: ${first}\n`;
      }
      return excerpt.trim() || content.slice(0, 400);
    } catch {
      return '';
    }
  }

  /**
   * 【步骤7修复】读取对方（otherId）对观察者（observerId）的 warmth 增量，用于 reciprocity。
   *
   * 修复要点：
   * - 读取 (otherId, observerId) 的 AffectionState（pair 排序由 store 内部处理）。
   *   当前 per-pair 存储下与 (observerId, otherId) 解析到同一行，但保留方向性读取语义。
   * - 若对方 store 不存在（新用户，无 last_interaction_at）→ 返回 null → multiplier=1.0。
   * - warmth 增量来自对方的事件历史（AffectionEventStore 仍为方向性文件存储），
   *   确保 A 算 reciprocity 时读的是 B 视角对 A 的 warmth 历史，而非对称套用 A 自己的事件。
   */
  private async loadOtherWarmthDelta(otherId: string, observerId: string): Promise<number | null> {
    const otherState = await this.stateStore.read(otherId, observerId);
    // 【步骤7修复】对方 store 不存在（新用户）→ 无 last_interaction_at → 返回 null → multiplier=1.0
    if (!otherState.last_interaction_at) return null;

    const nowMs = Date.now();
    const lastMs = new Date(otherState.last_interaction_at).getTime();
    if (Number.isNaN(lastMs) || nowMs - lastMs > 7 * 24 * 60 * 60 * 1000) return null;

    const events = await this.eventStore.readAll(otherId, observerId);
    const cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const recent = events.filter((e) => new Date(e.at).getTime() >= cutoffMs);
    // 【步骤7修复】对方在窗口内无事件 → 视为无 reciprocity 信号 → multiplier=1.0
    if (recent.length === 0) return null;

    const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
    let repairArc = DEFAULT_REPAIR_ARC;
    let sim = { ...DEFAULT_AFFECTION_DIMENSIONS };

    for (const evt of sorted) {
      if (new Date(evt.at).getTime() >= cutoffMs) break;
      const strength = (evt.evidence?.strength as EventStrength) || 'moderate';
      const delta = getStateDependentDelta(evt.event_type, sim, strength, repairArc);
      sim.familiarity = clamp(sim.familiarity + (delta.familiarity ?? 0), 0, 100);
      sim.warmth = clamp(sim.warmth + (delta.warmth ?? 0), 0, 100);
      sim.trust = clamp(sim.trust + (delta.trust ?? 0), 0, 100);
      sim.tension = clamp(sim.tension + (delta.tension ?? 0), 0, 100);
      repairArc = updateRepairArc(repairArc, evt.event_type);
    }

    let inWindowWarmthDelta = 0;
    for (const evt of sorted) {
      if (new Date(evt.at).getTime() < cutoffMs) continue;
      const strength = (evt.evidence?.strength as EventStrength) || 'moderate';
      const delta = getStateDependentDelta(evt.event_type, sim, strength, repairArc);
      inWindowWarmthDelta += delta.warmth ?? 0;
      sim.warmth = clamp(sim.warmth + (delta.warmth ?? 0), 0, 100);
      repairArc = updateRepairArc(repairArc, evt.event_type);
    }

    return inWindowWarmthDelta;
  }

  private async loadReciprocityMultiplier(
    observerId: string,
    otherId: string,
    myWarmthDelta: number,
  ): Promise<number> {
    const otherWarmthDelta = await this.loadOtherWarmthDelta(otherId, observerId);
    return computeReciprocityMultiplier(myWarmthDelta, otherWarmthDelta, this.reciprocityConfig);
  }

  async apply(
    observerId: string,
    otherId: string,
    events: AffectionEvent[],
    options: { priorState?: AffectionState; incrementalTurns?: any[] } = {}
  ): Promise<ApplyResult> {
    if (events.length === 0) {
      const current = await this.stateStore.read(observerId, otherId);
      return { before: current, after: current, appliedEvents: [], skippedEvents: [], labelChanged: false };
    }

    // 1. append events first (idempotent via correlation)
    const appendRes = await this.eventStore.append(events);

    const before = options.priorState ?? await this.stateStore.read(observerId, otherId);
    const expectedVersion = before.version;

    // 2. aggregate deltas using state-dependent non-linear calculator (A)
    let df = 0,
      dw = 0,
      dt = 0,
      dten = 0;
    const applied: AffectionEvent[] = [];
    const skipped: AffectionEvent[] = [...appendRes.skipped];

    let repairArc = before.repair_arc ?? DEFAULT_REPAIR_ARC;
    const runningDim = { ...before.dimensions };
    let tensionQuality = before.dimensions.tension_quality ?? 'situational';

    // strength-aware delta aggregation (point 2); sequential for repair arc tracking
    let maxStrength: EventStrength = 'moderate';
    for (const evt of appendRes.appended) {
      const s = (evt.evidence?.strength as EventStrength) || 'moderate';
      if (s === 'strong') maxStrength = 'strong';
      else if (s === 'weak' && maxStrength !== 'strong') maxStrength = 'weak';

      const delta = getStateDependentDelta(evt.event_type, runningDim, s, repairArc);
      df += delta.familiarity ?? 0;
      dw += delta.warmth ?? 0;
      dt += delta.trust ?? 0;
      dten += delta.tension ?? 0;

      if ((delta.tension ?? 0) > 0) {
        const q = getTensionQuality(evt.event_type);
        if (q === 'structural' || tensionQuality === 'structural') {
          tensionQuality = 'structural';
        } else {
          tensionQuality = 'situational';
        }
      }

      runningDim.familiarity = clamp(runningDim.familiarity + (delta.familiarity ?? 0), 0, 100);
      runningDim.warmth = clamp(runningDim.warmth + (delta.warmth ?? 0), 0, 100);
      runningDim.trust = clamp(runningDim.trust + (delta.trust ?? 0), 0, 100);
      runningDim.tension = clamp(runningDim.tension + (delta.tension ?? 0), 0, 100);

      repairArc = updateRepairArc(repairArc, evt.event_type);
      applied.push(evt);
    }

    const rawDw = dw;

    const reciprocityMultiplier = await this.loadReciprocityMultiplier(observerId, otherId, dw);
    if (reciprocityMultiplier !== 1.0) {
      const adjustedDw = Math.round(dw * reciprocityMultiplier);
      console.log(`[M6] reciprocity: warmth delta ${dw} → ${adjustedDw} (×${reciprocityMultiplier})`);
      dw = adjustedDw;
    }

    // strength-weighted per-topic warmth cap
    const warmthCap = maxStrength === 'strong' ? 12 : maxStrength === 'weak' ? 6 : 8;
    if (Math.abs(dw) > warmthCap) {
      const sign = dw > 0 ? 1 : -1;
      console.warn(`[M6] warmth delta ${dw} exceeds per-topic cap ${warmthCap} (strength=${maxStrength}), clamped`);
      dw = sign * warmthCap;
    }

    // apply to dimensions (reciprocity adjusts warmth incrementally; otherwise preserve runningDim)
    const warmth =
      reciprocityMultiplier !== 1.0
        ? clamp(runningDim.warmth + (dw - rawDw), 0, 100)
        : runningDim.warmth;
    const newDim = { ...runningDim, warmth, tension_quality: tensionQuality };

    const newComposite = computeComposite(newDim);

    // per-session composite |delta| <=15 (strength-weighted: strong 可略微放宽)
    const compCap = maxStrength === 'strong' ? 18 : 15;
    const compDelta = Math.abs(newComposite - before.composite_affinity);
    if (compDelta > compCap) {
      console.warn(`[M6] composite delta ${compDelta} exceeds per-session cap ${compCap} (strength=${maxStrength})`);
    }

    // 3. initial label from numeric (kept for candidate)
    const rawLabel = computeLabel({ ...newDim, composite_affinity: newComposite });
    const numericLabel = applyHysteresis(
      before.relationship_label,
      rawLabel,
      newDim,
      newComposite
    );

    const candidate: AffectionState = {
      other_agent_id: otherId,
      dimensions: newDim,
      composite_affinity: newComposite,
      relationship_label: numericLabel,
      repair_arc: repairArc,
      last_interaction_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      version: expectedVersion,
    };

    // 4. B: threshold check for label change (upgrade or downgrade)
    let finalLabel = numericLabel;
    const isPositiveTarget = ['close', 'good_terms', 'friendly_acquaintance', 'acquaintance'].includes(numericLabel);
    if (isPositiveTarget) {
      const upgradeCheck = checkLabelUpgrade(before, candidate, applied);
      if (!upgradeCheck.allowed) {
        finalLabel = before.relationship_label;
        console.warn(`[M6] Label upgrade blocked by threshold: ${upgradeCheck.reason}`);
      }
    } else {
      // negative or base labels: check downgrade rules if defined, else allow (computeLabel fallback for extreme tension)
      const downgradeCheck = checkLabelDowngrade(before, candidate, applied);
      if (!downgradeCheck.allowed) {
        finalLabel = before.relationship_label;
        console.warn(`[M6] Label downgrade blocked by threshold: ${downgradeCheck.reason}`);
      }
    }

    // 5. C: LLM judge for high-value / controversial changes (now bidirectional + style-aware)
    if (finalLabel !== before.relationship_label) {
      const isNegativeLabel = ['strained', 'distant', 'friendly_but_cautious'].includes(finalLabel);
      const wasNegative = ['strained', 'distant', 'friendly_but_cautious'].includes(before.relationship_label);
      const crossCluster = isNegativeLabel !== wasNegative;
      const tensionSpike = Math.abs(newDim.tension - before.dimensions.tension) > 15;
      const isHighValue = before.composite_affinity > 50 || compDelta > 10 || tensionSpike || crossCluster || isNegativeLabel;
      if (isHighValue) {
        const direction: ChangeDirection = isNegativeLabel || tensionSpike || crossCluster ? 'downgrade' : 'upgrade';
        const styleExcerpt = await this.loadObserverStyle(observerId);
        try {
          const judgeSvc = new RelationshipChangeJudgeService();
          const judgeRes = await judgeSvc.judge(
            before,
            applied,
            { ...candidate, relationship_label: finalLabel },
            direction,
            styleExcerpt || undefined
          );
          if (!judgeRes.changed) {
            finalLabel = before.relationship_label;
            console.warn(`[M6] LLM judge vetoed ${direction}: ${judgeRes.reason}`);
            if (judgeRes.adjustment !== undefined) {
              df = Math.round(df * (judgeRes.adjustment ?? 1));
              dw = Math.round(dw * (judgeRes.adjustment ?? 1));
              dt = Math.round(dt * (judgeRes.adjustment ?? 1));
              dten = Math.round(dten * (judgeRes.adjustment ?? 1));
            }
          }
        } catch {
          // non-blocking, allow by default
        }
      }
    }

    const after: AffectionState = {
      other_agent_id: otherId,
      dimensions: newDim,
      composite_affinity: newComposite,
      relationship_label: finalLabel,
      repair_arc: repairArc,
      last_interaction_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      version: expectedVersion,
    };

    const writeRes = await this.stateStore.write(observerId, otherId, expectedVersion, after);

    if (!writeRes.success) {
      console.warn('[M6] version conflict on affection write, apply skipped');
      return {
        before,
        after: before,
        appliedEvents: [],
        skippedEvents: [...events],
        labelChanged: false,
      };
    }

    const labelChanged = before.relationship_label !== finalLabel;

    console.log('[M6] Affection applied (A+B+C)', {
      observerId,
      otherId,
      eventCount: applied.length,
      beforeLabel: before.relationship_label,
      afterLabel: finalLabel,
      compositeDelta: newComposite - before.composite_affinity,
    });

    return {
      before,
      after: { ...after, version: expectedVersion + 1 },
      appliedEvents: applied,
      skippedEvents: skipped,
      labelChanged,
    };
  }
}
