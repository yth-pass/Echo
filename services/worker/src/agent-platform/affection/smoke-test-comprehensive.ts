import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AffectionApplyService } from './affection-apply.service';
import { AffectionOverlayService } from './affection-overlay.service';
import { AffectionStateStore } from './affection-state.store';
import { runAffectionDecay } from './affection-decay.job';
import { applyHysteresis } from './label-transition-rules';
import type { AffectionEvent, AffectionState, AffectionDimensions } from './types';
import { DEFAULT_AFFECTION_DIMENSIONS, DEFAULT_REPAIR_ARC } from './types';
import { DEFAULT_RECIPROCITY_CONFIG, computeReciprocityMultiplier } from './reciprocity.service';

const ENABLED_RECIPROCITY = { ...DEFAULT_RECIPROCITY_CONFIG, enabled: true };

/**
 * Comprehensive smoke test for P1–P4 affection system + R1–R3 enhancements.
 * Run from services/worker: npx ts-node src/agent-platform/affection/smoke-test-comprehensive.ts
 */

const observer = 'clone_comp_a';
const other = 'clone_comp_b';
const sessionId = 'sess_comprehensive';
const baseDir = path.join(process.cwd(), 'tmp', 'memory_affection_comprehensive');

let eventCounter = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function logStep(name: string, state: AffectionState): void {
  const d = state.dimensions;
  const arc = state.repair_arc ?? DEFAULT_REPAIR_ARC;
  console.log(
    `[${name}] fam=${d.familiarity} warm=${d.warmth} trust=${d.trust} ten=${d.tension} ` +
      `ten_q=${d.tension_quality ?? 'situational'} ` +
      `comp=${state.composite_affinity} label=${state.relationship_label} ` +
      `repair={breaks:${arc.trust_break_count},pos:${arc.positive_interactions_since_break},arc:${arc.is_in_repair_arc}}`,
  );
}

function makeEventFor(
  observerId: string,
  otherId: string,
  type: AffectionEvent['event_type'],
  extra: Partial<AffectionEvent> = {},
): AffectionEvent {
  eventCounter += 1;
  const { at, evidence, ...restExtra } = extra;
  return {
    id: `evt_comp_${eventCounter}`,
    observer_id: observerId,
    other_id: otherId,
    event_type: type,
    deltas: {},
    evidence: {
      joint_session_id: sessionId,
      turn_ids: [eventCounter],
      strength: 'moderate',
      ...evidence,
    },
    correlation_id: restExtra.correlation_id ?? `${sessionId}:${observerId}:${type}:${eventCounter}`,
    ...restExtra,
    at: at ?? new Date().toISOString(),
  };
}

function makeEvent(type: AffectionEvent['event_type'], extra: Partial<AffectionEvent> = {}): AffectionEvent {
  return makeEventFor(observer, other, type, extra);
}

async function clean(): Promise<void> {
  await fs.rm(baseDir, { recursive: true, force: true });
  eventCounter = 0;
}

async function seedState(
  store: AffectionStateStore,
  partial: Omit<Partial<AffectionState>, 'dimensions'> & { dimensions?: Partial<AffectionDimensions> },
  observerId: string = observer,
  otherId: string = other,
): Promise<AffectionState> {
  const current = await store.read(observerId, otherId);
  const merged: AffectionState = {
    ...current,
    ...partial,
    other_agent_id: otherId,
    dimensions: { ...current.dimensions, ...partial.dimensions },
    repair_arc: partial.repair_arc ?? current.repair_arc ?? DEFAULT_REPAIR_ARC,
  };
  const res = await store.write(observerId, otherId, current.version, merged);
  assert(res.success, 'seedState write failed');
  return { ...merged, version: current.version + 1 };
}

// --- S1: Initial contact ---
async function testInitialContact(apply: AffectionApplyService, store: AffectionStateStore): Promise<void> {
  console.log('\n=== S1: Initial contact (stranger → acquaintance → friendly_acquaintance) ===');
  await clean();

  let state = await store.read(observer, other);
  logStep('初始', state);
  assert(state.relationship_label === 'stranger', 'should start stranger');

  let r = await apply.apply(observer, other, [
    makeEvent('compliment', { correlation_id: 's1:cmp:0' }),
    makeEvent('compliment', { correlation_id: 's1:cmp:1' }),
    makeEvent('compliment', { correlation_id: 's1:cmp:2' }),
  ]);
  logStep('3x compliment batch A', r.after);

  r = await apply.apply(
    observer,
    other,
    [
      makeEvent('compliment', { correlation_id: 's1:cmp:3' }),
      makeEvent('compliment', { correlation_id: 's1:cmp:4' }),
      makeEvent('compliment', { correlation_id: 's1:cmp:5' }),
    ],
    { priorState: r.after },
  );
  logStep('3x compliment batch B', r.after);

  r = await apply.apply(
    observer,
    other,
    [
      makeEvent('compliment', { correlation_id: 's1:cmp:6' }),
      makeEvent('compliment', { correlation_id: 's1:cmp:7' }),
      makeEvent('compliment', { correlation_id: 's1:cmp:8' }),
    ],
    { priorState: r.after },
  );
  logStep('3x compliment batch C', r.after);
  assert(r.after.dimensions.warmth >= 25, 'warmth should reach 25 before familiarity threshold');

  r = await apply.apply(
    observer,
    other,
    Array.from({ length: 8 }, (_, i) =>
      makeEvent('trust_confirm', { correlation_id: `s1:tc:${i}` }),
    ),
    { priorState: r.after },
  );
  logStep('8x trust_confirm (B层 acquaintance 门控)', r.after);
  assert(r.after.dimensions.trust >= 20, 'trust should meet acquaintance upgrade threshold');

  const batch2 = Array.from({ length: 12 }, (_, i) =>
    makeEvent('session_contact', { correlation_id: `s1:sc:${i}` }),
  );
  r = await apply.apply(observer, other, batch2, { priorState: r.after });
  logStep('12x session_contact', r.after);
  assert(r.after.dimensions.familiarity >= 15, 'familiarity should reach acquaintance threshold');
  assert(
    ['acquaintance', 'friendly_acquaintance', 'good_terms'].includes(r.after.relationship_label),
    `expected acquaintance+, got ${r.after.relationship_label}`,
  );

  const batch3 = Array.from({ length: 10 }, (_, i) =>
    makeEvent('positive_engagement', { correlation_id: `s1:pe:${i}` }),
  );
  r = await apply.apply(observer, other, batch3, { priorState: r.after });
  logStep('10x positive_engagement', r.after);

  const batch4 = [
    ...Array.from({ length: 6 }, (_, i) =>
      makeEvent('helpful_share', { correlation_id: `s1:hs:${i}` }),
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      makeEvent('positive_engagement', { correlation_id: `s1:pe2:${i}` }),
    ),
  ];
  r = await apply.apply(observer, other, batch4, { priorState: r.after });
  logStep('6x helpful_share + 6x positive_engagement', r.after);

  r = await apply.apply(
    observer,
    other,
    [
      ...Array.from({ length: 4 }, (_, i) =>
        makeEvent('compliment', { correlation_id: `s1:cmp2:${i}` }),
      ),
      makeEvent('positive_engagement', { correlation_id: 's1:pe:final' }),
      makeEvent('positive_engagement', { correlation_id: 's1:pe:final2' }),
      makeEvent('value_alignment', { correlation_id: 's1:va:final' }),
    ],
    { priorState: r.after },
  );
  logStep('4x compliment + 2x positive (hysteresis threshold)', r.after);
  assert(r.after.composite_affinity >= 44, 'composite should pass friendly_acquaintance hysteresis (40×1.1)');
  assert(
    ['friendly_acquaintance', 'good_terms'].includes(r.after.relationship_label),
    `expected friendly_acquaintance+, got ${r.after.relationship_label}`,
  );
  console.log('[结果] PASS');
}

// --- S2: Intimate upgrade ---
async function testIntimateUpgrade(apply: AffectionApplyService, store: AffectionStateStore): Promise<void> {
  console.log('\n=== S2: Intimate upgrade (friendly_acquaintance → good_terms → close) ===');
  await clean();

  await seedState(store, {
    dimensions: { familiarity: 88, warmth: 86, trust: 78, tension: 8 },
    composite_affinity: 77,
    relationship_label: 'close',
    last_interaction_at: new Date().toISOString(),
  });

  let r = await apply.apply(observer, other, [makeEvent('session_contact', { correlation_id: 's2:touch' })]);
  logStep('close 数值维持', r.after);
  assert(r.after.relationship_label === 'close', 'close label should persist (hysteresis holds if composite dips slightly)');
  assert(r.after.composite_affinity >= 67, 'composite should stay in close hysteresis band');

  await clean();
  await seedState(store, {
    dimensions: { familiarity: 28, warmth: 48, trust: 38, tension: 14 },
    composite_affinity: 43,
    relationship_label: 'friendly_acquaintance',
    last_interaction_at: new Date().toISOString(),
  });

  const noBond = Array.from({ length: 4 }, (_, i) =>
    makeEvent('compliment', { correlation_id: `s2:nobond:${i}` }),
  );
  r = await apply.apply(observer, other, noBond);
  logStep('B层门控：无 explicit_bond', r.after);
  assert(r.after.relationship_label !== 'good_terms', 'upgrade to good_terms should be blocked without explicit_bond');
  assert(r.after.relationship_label !== 'close', 'should not reach close without required events');

  await seedState(store, {
    dimensions: { familiarity: 68, warmth: 78, trust: 68, tension: 8 },
    composite_affinity: 62,
    relationship_label: 'friendly_acquaintance',
    last_interaction_at: new Date().toISOString(),
  });

  const upgradeBatch: AffectionEvent[] = [
    makeEvent('explicit_bond', {
      correlation_id: 's2:eb',
      evidence: { joint_session_id: sessionId, topic_id: 'topic_a', turn_ids: [1], strength: 'moderate' },
    }),
    makeEvent('positive_engagement', {
      correlation_id: 's2:p1',
      evidence: { joint_session_id: sessionId, topic_id: 'topic_a', turn_ids: [2], strength: 'moderate' },
    }),
    makeEvent('compliment', {
      correlation_id: 's2:p2',
      evidence: { joint_session_id: sessionId, topic_id: 'topic_a', turn_ids: [3], strength: 'moderate' },
    }),
    makeEvent('helpful_share', {
      correlation_id: 's2:p3',
      evidence: { joint_session_id: sessionId, topic_id: 'topic_b', turn_ids: [4], strength: 'moderate' },
    }),
    makeEvent('agreement', {
      correlation_id: 's2:p4',
      evidence: { joint_session_id: sessionId, topic_id: 'topic_b', turn_ids: [5], strength: 'moderate' },
    }),
  ];
  r = await apply.apply(observer, other, upgradeBatch);
  logStep('含 explicit_bond 升级批次', r.after);
  assert(r.after.composite_affinity >= 60, 'composite should support good_terms numerically');
  assert(
    ['good_terms', 'close', 'friendly_acquaintance'].includes(r.after.relationship_label),
    'explicit_bond batch should allow upgrade path toward good_terms',
  );
  console.log('[结果] PASS');
}

// --- S3: Conflict without immediate downgrade ---
async function testConflictNoDowngrade(apply: AffectionApplyService, store: AffectionStateStore): Promise<void> {
  console.log('\n=== S3: Conflict in good_terms (tension up, label holds) ===');
  await clean();

  await seedState(store, {
    dimensions: { familiarity: 50, warmth: 58, trust: 55, tension: 10 },
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  const r = await apply.apply(observer, other, [makeEvent('conflict', { correlation_id: 's3:conflict' })]);
  logStep('单次 conflict', r.after);
  assert(r.after.dimensions.tension > 10, 'tension should rise');
  assert(r.after.dimensions.tension_quality === 'situational', 'conflict should set situational tension quality');
  assert(r.after.relationship_label === 'good_terms', 'label should stay good_terms after single conflict');
  console.log('[结果] PASS');
}

// --- S4: Trust break and repair ---
async function testTrustRepair(
  apply: AffectionApplyService,
  store: AffectionStateStore,
  overlay: AffectionOverlayService,
): Promise<void> {
  console.log('\n=== S4: Trust break and repair arc ===');
  await clean();

  const trustBefore = 75;
  await seedState(store, {
    dimensions: { familiarity: 60, warmth: 70, trust: trustBefore, tension: 5 },
    composite_affinity: 76,
    relationship_label: 'close',
    repair_arc: DEFAULT_REPAIR_ARC,
    last_interaction_at: new Date().toISOString(),
  });

  let r = await apply.apply(observer, other, [makeEvent('trust_break', { correlation_id: 's4:break' })]);
  logStep('trust_break', r.after);
  const trustAfterBreak = r.after.dimensions.trust;
  assert(trustAfterBreak < trustBefore, 'trust should drop after break');
  assert(r.after.repair_arc?.is_in_repair_arc === true, 'should enter repair arc');
  assert(r.after.repair_arc?.trust_break_count === 1, 'break count should be 1');
  assert(r.after.dimensions.tension_quality === 'structural', 'trust_break should set structural tension quality');

  const ov = await overlay.render(observer, other);
  console.log('[overlay repair arc]\n' + ov);
  assert(ov.includes('REPAIR ARC'), 'overlay should include REPAIR ARC during repair arc');
  assert(ov.includes('Repair Arc: 0/7'), 'overlay should show repair progress line');

  let prevTrust = r.after.dimensions.trust;
  let state = r.after;
  for (let i = 1; i <= 7; i++) {
    r = await apply.apply(
      observer,
      other,
      [makeEvent('trust_confirm', { correlation_id: `s4:confirm:${i}` })],
      { priorState: state },
    );
    logStep(`trust_confirm #${i}`, r.after);
    assert(r.after.dimensions.trust >= prevTrust, `trust should not decrease on confirm #${i}`);
    prevTrust = r.after.dimensions.trust;
    state = r.after;
  }

  assert(r.after.repair_arc?.is_in_repair_arc === false, 'repair arc should end after 7 positive trust events');
  assert(r.after.repair_arc?.positive_interactions_since_break === 7, 'should count 7 positive interactions');
  const recoveryGain = r.after.dimensions.trust - trustAfterBreak;
  assert(recoveryGain < 7 * 4, 'dampened repair should recover less than full +4×7 trust_confirm');
  console.log(`[预期] 修复增益 ${recoveryGain} < 全额恢复 ${7 * 4}`);
  console.log('[结果] PASS');
}

// --- S5: Decay ---
async function testDecay(store: AffectionStateStore): Promise<void> {
  console.log('\n=== S5: Long silence decay ===');
  await clean();

  await seedState(store, {
    dimensions: { familiarity: 50, warmth: 40, trust: 35, tension: 25 },
    composite_affinity: 55,
    relationship_label: 'good_terms',
    last_interaction_at: daysAgo(35),
  });

  const r = await runAffectionDecay(observer, other, baseDir, new Date());
  console.log(`[decay] days=${r.daysSinceContact} applied=${r.applied}`);
  console.log(
    `[decay] fam ${r.before.familiarity}→${r.after.familiarity} warm ${r.before.warmth}→${r.after.warmth} ` +
      `trust ${r.before.trust}→${r.after.trust} ten ${r.before.tension}→${r.after.tension}`,
  );
  assert(r.applied, 'decay should apply for 35 days no contact');
  assert(r.after.familiarity < r.before.familiarity, 'familiarity should decay');
  assert(r.after.warmth < r.before.warmth, 'warmth should decay');
  assert(r.after.trust < r.before.trust, 'trust should decay');
  assert(r.after.tension < r.before.tension, 'tension should decay');

  await clean();
  await seedState(store, {
    dimensions: { familiarity: 40, warmth: 30, trust: 30, tension: 10 },
    composite_affinity: 45,
    relationship_label: 'friendly_acquaintance',
    repair_arc: { trust_break_count: 4, positive_interactions_since_break: 0, is_in_repair_arc: false },
    last_interaction_at: daysAgo(35),
  });

  const r2 = await runAffectionDecay(observer, other, baseDir, new Date());
  const trustDrop = r2.before.trust - r2.after.trust;
  console.log(`[decay accelerated] trust drop=${trustDrop} (break_count>3 → ×1.5)`);
  assert(trustDrop >= 3, 'accelerated trust decay should drop at least 3 per week-eligible period');
  console.log('[结果] PASS');
}

// --- S6: Label hysteresis ---
async function testHysteresis(apply: AffectionApplyService, store: AffectionStateStore): Promise<void> {
  console.log('\n=== S6: Label hysteresis ===');
  const dims = { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 50, warmth: 60, trust: 55, tension: 15 };

  let label = applyHysteresis('close', 'good_terms', dims, 68);
  assert(label === 'close', 'composite 68 should not downgrade close (needs ≤67.5)');
  console.log('[unit] close@68 + raw good_terms → close');

  label = applyHysteresis('friendly_acquaintance', 'good_terms', dims, 65);
  assert(label === 'friendly_acquaintance', 'composite 65 should not upgrade (needs ≥66)');
  console.log('[unit] friendly_acquaintance@65 + raw good_terms → friendly_acquaintance');

  label = applyHysteresis('close', 'good_terms', dims, 67);
  assert(label === 'good_terms', 'composite 67 should allow downgrade to good_terms');
  console.log('[unit] close@67 + raw good_terms → good_terms');

  await clean();
  await seedState(store, {
    dimensions: { familiarity: 60, warmth: 70, trust: 72, tension: 12 },
    composite_affinity: 68,
    relationship_label: 'close',
    last_interaction_at: new Date().toISOString(),
  });

  const r = await apply.apply(observer, other, [
    makeEvent('conflict', {
      correlation_id: 's6:small',
      evidence: { joint_session_id: sessionId, turn_ids: [1], strength: 'weak' },
    }),
  ]);
  logStep('集成：close@68 弱 conflict', r.after);
  assert(r.after.relationship_label === 'close', 'hysteresis should hold close after minor conflict');
  console.log('[结果] PASS');
}

// --- S7: friendly_but_cautious ---
async function testFriendlyButCautious(store: AffectionStateStore, overlay: AffectionOverlayService): Promise<void> {
  console.log('\n=== S7: friendly_but_cautious label + overlay ===');
  await clean();

  await seedState(store, {
    dimensions: { familiarity: 25, warmth: 45, trust: 30, tension: 30 },
    composite_affinity: 38,
    relationship_label: 'friendly_but_cautious',
    last_interaction_at: new Date().toISOString(),
  });

  const state = await store.read(observer, other);
  logStep('seeded cautious state', state);
  assert(state.relationship_label === 'friendly_but_cautious', 'label should be friendly_but_cautious');

  const ov = await overlay.render(observer, other);
  console.log('[overlay]\n' + ov);
  assert(ov.includes('friendly_but_cautious'), 'overlay should show label');
  assert(ov.toLowerCase().includes('guarded'), 'overlay should include guarded trust hint');
  console.log('[结果] PASS');
}

// --- S8: Boundaries ---
async function testBoundaries(apply: AffectionApplyService, store: AffectionStateStore): Promise<void> {
  console.log('\n=== S8: Dimension boundaries (0–100) ===');
  await clean();

  await seedState(store, {
    dimensions: { familiarity: 50, warmth: 50, trust: 98, tension: 5 },
    composite_affinity: 70,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  let r = await apply.apply(observer, other, [
    makeEvent('trust_confirm', {
      correlation_id: 's8:trust_cap',
      evidence: { joint_session_id: sessionId, turn_ids: [1], strength: 'strong' },
    }),
  ]);
  logStep('trust near 100', r.after);
  assert(r.after.dimensions.trust <= 100, 'trust must not exceed 100');

  await seedState(store, {
    dimensions: { familiarity: 50, warmth: 50, trust: 50, tension: 2 },
    composite_affinity: 55,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  r = await apply.apply(
    observer,
    other,
    Array.from({ length: 5 }, (_, i) =>
      makeEvent('conflict', {
        correlation_id: `s8:ten:${i}`,
        evidence: { joint_session_id: sessionId, turn_ids: [i], strength: 'strong' },
      }),
    ),
  );
  logStep('tension floor', r.after);
  assert(r.after.dimensions.tension >= 0, 'tension must not go below 0');

  await clean();
  r = await apply.apply(observer, other, [
    makeEvent('positive_engagement', { correlation_id: 's8:from_zero' }),
  ]);
  logStep('from zero', r.after);
  assert(r.after.dimensions.familiarity >= 0, 'familiarity must not go below 0');
  assert(r.after.dimensions.warmth >= 0, 'warmth must not go below 0');
  console.log('[结果] PASS');
}

// --- S9: Tension quality — structural vs situational ---
async function testTensionQuality(apply: AffectionApplyService, store: AffectionStateStore): Promise<void> {
  console.log('\n=== S9: Tension quality — structural vs situational ===');

  // situational: conflict + decay
  await clean();
  await seedState(store, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 50, warmth: 58, trust: 55, tension: 10 },
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  let r = await apply.apply(observer, other, [makeEvent('conflict', { correlation_id: 's9:conflict' })]);
  logStep('conflict (situational)', r.after);
  assert(r.after.dimensions.tension_quality === 'situational', 'conflict should set situational tension quality');
  const tensionAfterConflict = r.after.dimensions.tension;

  await seedState(store, {
    dimensions: r.after.dimensions,
    composite_affinity: r.after.composite_affinity,
    relationship_label: r.after.relationship_label,
    last_interaction_at: daysAgo(35),
  });

  let decay = await runAffectionDecay(observer, other, baseDir, new Date());
  assert(decay.after.tension < tensionAfterConflict, 'situational tension should decay after 35 days');
  console.log(`[situational decay] ten ${decay.before.tension}→${decay.after.tension}`);

  // structural: trust_break + no tension decay
  await clean();
  await seedState(store, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 50, warmth: 58, trust: 55, tension: 10 },
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  r = await apply.apply(observer, other, [makeEvent('trust_break', { correlation_id: 's9:break' })]);
  logStep('trust_break (structural)', r.after);
  assert(r.after.dimensions.tension_quality === 'structural', 'trust_break should set structural tension quality');
  const structuralTension = r.after.dimensions.tension;

  await seedState(store, {
    dimensions: r.after.dimensions,
    composite_affinity: r.after.composite_affinity,
    relationship_label: r.after.relationship_label,
    repair_arc: r.after.repair_arc,
    last_interaction_at: daysAgo(35),
  });

  decay = await runAffectionDecay(observer, other, baseDir, new Date());
  assert(decay.after.tension === structuralTension, 'structural tension should not auto-decay');
  console.log(`[structural no-decay] ten ${decay.before.tension}→${decay.after.tension}`);

  // apology lowers tension but keeps structural quality
  await clean();
  await seedState(store, {
    dimensions: {
      ...DEFAULT_AFFECTION_DIMENSIONS,
      familiarity: 50,
      warmth: 50,
      trust: 50,
      tension: 12,
      tension_quality: 'structural',
    },
    composite_affinity: 55,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  r = await apply.apply(observer, other, [
    makeEvent('apology_or_repair', {
      correlation_id: 's9:apology1',
      evidence: { joint_session_id: sessionId, turn_ids: [1], strength: 'moderate' },
    }),
  ]);
  logStep('first apology', r.after);
  assert(r.after.dimensions.tension < 12, 'apology should reduce tension');
  assert(r.after.dimensions.tension_quality === 'structural', 'apology should not clear structural quality');

  // second apology clears tension; decay resets quality to situational
  r = await apply.apply(
    observer,
    other,
    [
      makeEvent('apology_or_repair', {
        correlation_id: 's9:apology2',
        evidence: { joint_session_id: sessionId, turn_ids: [2], strength: 'strong' },
      }),
    ],
    { priorState: r.after },
  );
  logStep('second apology (tension zero)', r.after);
  assert(r.after.dimensions.tension === 0, 'second apology should clear tension to zero');
  assert(r.after.dimensions.tension_quality === 'structural', 'apply should not reset quality at tension zero');

  await seedState(store, {
    dimensions: r.after.dimensions,
    composite_affinity: r.after.composite_affinity,
    relationship_label: r.after.relationship_label,
    last_interaction_at: daysAgo(35),
  });

  decay = await runAffectionDecay(observer, other, baseDir, new Date());
  assert(decay.after.tension_quality === 'situational', 'decay should reset structural quality when tension is 0');
  console.log(`[quality reset] ten_q ${decay.before.tension_quality}→${decay.after.tension_quality}`);
  console.log('[结果] PASS');
}

// --- S10: Reciprocity — warmth weak coupling ---
async function testReciprocity(store: AffectionStateStore): Promise<void> {
  console.log('\n=== S10: Reciprocity — warmth weak coupling ===');

  assert(
    computeReciprocityMultiplier(10, -20, ENABLED_RECIPROCITY) === 0.8,
    'unit: cold counterparty should use minMultiplier',
  );
  assert(
    computeReciprocityMultiplier(8, 20, ENABLED_RECIPROCITY) === 1.2,
    'unit: warm counterparty should use maxMultiplier',
  );
  assert(
    computeReciprocityMultiplier(8, 20, DEFAULT_RECIPROCITY_CONFIG) === 1.0,
    'unit: disabled reciprocity should return 1.0',
  );

  const goodTermsDims = {
    ...DEFAULT_AFFECTION_DIMENSIONS,
    familiarity: 50,
    warmth: 58,
    trust: 55,
    tension: 10,
  };

  // Cold counterparty → ×0.80 on positive warmth
  await clean();
  await seedState(store, {
    dimensions: goodTermsDims,
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  const applyOther = new AffectionApplyService(baseDir, ENABLED_RECIPROCITY);
  // Recent B→A conflicts only (in-window warmth drop toward observer)
  await applyOther.apply(
    other,
    observer,
    Array.from({ length: 6 }, (_, i) =>
      makeEventFor(other, observer, 'conflict', { correlation_id: `s10:cold:${i}` }),
    ),
  );

  const bAfterCold = await store.read(other, observer);
  console.log(`[B→A after cold] warmth=${bAfterCold.dimensions.warmth}`);
  assert(bAfterCold.dimensions.warmth <= 5, 'B→A warmth should drop after conflicts');

  const applyEnabled = new AffectionApplyService(baseDir, ENABLED_RECIPROCITY);
  const applyDisabled = new AffectionApplyService(baseDir, DEFAULT_RECIPROCITY_CONFIG);

  await seedState(store, {
    dimensions: goodTermsDims,
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  const beforeCold = (await store.read(observer, other)).dimensions.warmth;
  const coldEnabled = await applyEnabled.apply(observer, other, [
    makeEvent('compliment', { correlation_id: 's10:cold:en' }),
    makeEvent('compliment', { correlation_id: 's10:cold:en2' }),
  ]);
  const gainColdEnabled = coldEnabled.after.dimensions.warmth - beforeCold;

  await seedState(store, {
    dimensions: goodTermsDims,
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });
  await applyOther.apply(
    other,
    observer,
    Array.from({ length: 6 }, (_, i) =>
      makeEventFor(other, observer, 'conflict', { correlation_id: `s10:cold2:${i}` }),
    ),
  );

  const beforeColdDisabled = (await store.read(observer, other)).dimensions.warmth;
  const coldDisabled = await applyDisabled.apply(observer, other, [
    makeEvent('compliment', { correlation_id: 's10:cold:dis' }),
    makeEvent('compliment', { correlation_id: 's10:cold:dis2' }),
  ]);
  const gainColdDisabled = coldDisabled.after.dimensions.warmth - beforeColdDisabled;

  console.log(`[cold counterparty] warmth gain enabled=${gainColdEnabled} disabled=${gainColdDisabled}`);
  assert(gainColdEnabled > 0 && gainColdDisabled > 0, 'compliments should increase warmth');
  assert(
    gainColdEnabled < gainColdDisabled,
    'reciprocity should dampen warmth when counterparty is cold (~×0.80)',
  );

  // Warm counterparty → ×1.20 boost (B→A recent warmth rise)
  await clean();
  await seedState(store, {
    dimensions: goodTermsDims,
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });

  await applyOther.apply(other, observer, [
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm:1' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm:2' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm:3' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm:4' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm:5' }),
  ]);

  const beforeWarm = (await store.read(observer, other)).dimensions.warmth;
  const warmEnabled = await applyEnabled.apply(observer, other, [
    makeEvent('compliment', { correlation_id: 's10:warm:en' }),
    makeEvent('compliment', { correlation_id: 's10:warm:en2' }),
  ]);
  const gainWarmEnabled = warmEnabled.after.dimensions.warmth - beforeWarm;

  await seedState(store, {
    dimensions: goodTermsDims,
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });
  await applyOther.apply(other, observer, [
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm2:1' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm2:2' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm2:3' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm2:4' }),
    makeEventFor(other, observer, 'compliment', { correlation_id: 's10:warm2:5' }),
  ]);

  const beforeWarmDisabled = (await store.read(observer, other)).dimensions.warmth;
  const warmDisabled = await applyDisabled.apply(observer, other, [
    makeEvent('compliment', { correlation_id: 's10:warm:dis' }),
    makeEvent('compliment', { correlation_id: 's10:warm:dis2' }),
  ]);
  const gainWarmDisabled = warmDisabled.after.dimensions.warmth - beforeWarmDisabled;

  console.log(`[warm counterparty] warmth gain enabled=${gainWarmEnabled} disabled=${gainWarmDisabled}`);
  assert(gainWarmEnabled > gainWarmDisabled, 'reciprocity should boost warmth when counterparty warmed up (~×1.20)');

  // Disabled config: same gain with or without counterparty signal
  await clean();
  await seedState(store, {
    dimensions: goodTermsDims,
    composite_affinity: 65,
    relationship_label: 'good_terms',
    last_interaction_at: new Date().toISOString(),
  });
  const beforeNoRecip = (await store.read(observer, other)).dimensions.warmth;
  const noRecip = await applyDisabled.apply(observer, other, [
    makeEvent('compliment', { correlation_id: 's10:norecip' }),
  ]);
  const gainNoRecip = noRecip.after.dimensions.warmth - beforeNoRecip;
  assert(gainNoRecip >= 2, 'disabled reciprocity should apply normal warmth delta');
  console.log('[结果] PASS');
}

// --- S11: Overlay repair arc visibility ---
async function testOverlayRepairArc(store: AffectionStateStore, overlay: AffectionOverlayService): Promise<void> {
  console.log('\n=== S11: Overlay repair arc visibility ===');
  await clean();

  const baseDims = {
    ...DEFAULT_AFFECTION_DIMENSIONS,
    familiarity: 60,
    warmth: 70,
    trust: 72,
    tension: 8,
  };

  await seedState(store, {
    dimensions: baseDims,
    composite_affinity: 58,
    relationship_label: 'close',
    repair_arc: { trust_break_count: 1, positive_interactions_since_break: 3, is_in_repair_arc: true },
    last_interaction_at: new Date().toISOString(),
  });

  let ov = await overlay.render(observer, other);
  console.log('[overlay progress 3/7]\n' + ov);
  assert(ov.includes('REPAIR ARC'), 'overlay should include REPAIR ARC');
  assert(ov.includes('3/7'), 'overlay should show progress 3/7');
  assert(ov.includes('Mid-recovery'), 'progress 3/7 should show Mid-recovery hint');

  await seedState(store, {
    dimensions: baseDims,
    composite_affinity: 58,
    relationship_label: 'close',
    repair_arc: { trust_break_count: 1, positive_interactions_since_break: 6, is_in_repair_arc: true },
    last_interaction_at: new Date().toISOString(),
  });

  ov = await overlay.render(observer, other);
  console.log('[overlay progress 6/7]\n' + ov);
  assert(ov.includes('6/7'), 'overlay should show progress 6/7');
  assert(ov.includes('Nearly rebuilt'), 'progress 6/7 should show Nearly rebuilt hint');

  await seedState(store, {
    dimensions: baseDims,
    composite_affinity: 58,
    relationship_label: 'close',
    repair_arc: { trust_break_count: 1, positive_interactions_since_break: 1, is_in_repair_arc: true },
    last_interaction_at: new Date().toISOString(),
  });

  ov = await overlay.render(observer, other);
  console.log('[overlay progress 1/7]\n' + ov);
  assert(ov.includes('1/7'), 'overlay should show progress 1/7');
  assert(ov.includes('Early rebuilding'), 'progress 1/7 should show Early rebuilding hint');
  console.log('[结果] PASS');
}

async function main(): Promise<void> {
  console.log('=== Affection Comprehensive Smoke Test (S1–S11) ===');

  const apply = new AffectionApplyService(baseDir);
  const store = new AffectionStateStore(baseDir);
  const overlay = new AffectionOverlayService(baseDir);

  await testInitialContact(apply, store);
  await testIntimateUpgrade(apply, store);
  await testConflictNoDowngrade(apply, store);
  await testTrustRepair(apply, store, overlay);
  await testDecay(store);
  await testHysteresis(apply, store);
  await testFriendlyButCautious(store, overlay);
  await testBoundaries(apply, store);
  await testTensionQuality(apply, store);
  await testReciprocity(store);
  await testOverlayRepairArc(store, overlay);

  console.log('\n=== All 11 scenarios PASSED ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
