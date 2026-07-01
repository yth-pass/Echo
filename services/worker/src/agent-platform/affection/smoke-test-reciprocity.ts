import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AffectionApplyService } from './affection-apply.service';
import { AffectionStateStore } from './affection-state.store';
import {
  computeReciprocityMultiplier,
  DEFAULT_RECIPROCITY_CONFIG,
  type ReciprocityConfig,
} from './reciprocity.service';
import type { AffectionEvent, AffectionState } from './types';
import { DEFAULT_AFFECTION_DIMENSIONS } from './types';

/**
 * Reciprocity weak-coupling smoke test.
 * Run from services/worker: npx ts-node src/agent-platform/affection/smoke-test-reciprocity.ts
 */

const observer = 'clone_recip_a';
const other = 'clone_recip_b';
const sessionId = 'sess_reciprocity';
const baseDir = path.join(process.cwd(), 'tmp', 'memory_affection_reciprocity');

const ENABLED_CONFIG: ReciprocityConfig = { ...DEFAULT_RECIPROCITY_CONFIG, enabled: true };

let eventCounter = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
}

async function clean(): Promise<void> {
  await fs.rm(baseDir, { recursive: true, force: true });
}

function makeEvent(
  observerId: string,
  otherId: string,
  type: AffectionEvent['event_type'],
  extra: Partial<AffectionEvent> = {},
): AffectionEvent {
  eventCounter += 1;
  return {
    id: `evt_recip_${eventCounter}`,
    observer_id: observerId,
    other_id: otherId,
    event_type: type,
    deltas: {},
    evidence: { joint_session_id: sessionId, turn_ids: [1], strength: 'moderate' as const },
    at: new Date().toISOString(),
    correlation_id: `${sessionId}:${observerId}:${type}:${eventCounter}`,
    ...extra,
  };
}

async function seedState(
  store: AffectionStateStore,
  observerId: string,
  otherId: string,
  partial: Omit<Partial<AffectionState>, 'dimensions'> & { dimensions?: Partial<AffectionState['dimensions']> },
): Promise<AffectionState> {
  const current = await store.read(observerId, otherId);
  const merged: AffectionState = {
    ...current,
    ...partial,
    other_agent_id: otherId,
    dimensions: { ...current.dimensions, ...partial.dimensions },
    last_interaction_at: partial.last_interaction_at ?? new Date().toISOString(),
  };
  const res = await store.write(observerId, otherId, current.version, merged);
  assert(res.success, `seedState write failed for ${observerId}→${otherId}`);
  return { ...merged, version: current.version + 1 };
}

function testUnitMultiplier(): void {
  console.log('\n=== R1: computeReciprocityMultiplier (unit) ===');

  assert(
    computeReciprocityMultiplier(5, 10, DEFAULT_RECIPROCITY_CONFIG) === 1.0,
    'disabled config should return 1.0',
  );

  assert(
    computeReciprocityMultiplier(5, null, ENABLED_CONFIG) === 1.0,
    'null other delta should return 1.0',
  );

  const boost = computeReciprocityMultiplier(8, 20, ENABLED_CONFIG);
  assert(boost > 1.0 && boost <= 1.2, `positive reciprocity boost should be in (1, 1.2], got ${boost}`);

  const dampenPos = computeReciprocityMultiplier(10, -20, ENABLED_CONFIG);
  assert(dampenPos === 0.8, `cold counterparty should dampen positive warmth, got ${dampenPos}`);

  const amplifyNeg = computeReciprocityMultiplier(-5, -20, ENABLED_CONFIG);
  assert(amplifyNeg === 1.2, `cold counterparty should amplify negative warmth, got ${amplifyNeg}`);

  const noEffect = computeReciprocityMultiplier(5, -10, ENABLED_CONFIG);
  assert(noEffect === 1.0, 'small counterparty drop should not trigger reciprocity');

  console.log('[结果] PASS');
}

async function testIntegrationBoost(store: AffectionStateStore): Promise<void> {
  console.log('\n=== R2: Integration — counterparty warmth up boosts my warmth gain ===');
  await clean();

  await seedState(store, other, observer, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 40, warmth: 60, trust: 50, tension: 5 },
    composite_affinity: 55,
    relationship_label: 'good_terms',
  });

  const applyOther = new AffectionApplyService(baseDir, ENABLED_CONFIG);
  await applyOther.apply(other, observer, [
    makeEvent(other, observer, 'compliment', { correlation_id: 'r2:other:1' }),
    makeEvent(other, observer, 'compliment', { correlation_id: 'r2:other:2' }),
    makeEvent(other, observer, 'compliment', { correlation_id: 'r2:other:3' }),
  ]);

  await seedState(store, observer, other, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 40, warmth: 50, trust: 50, tension: 5 },
    composite_affinity: 52,
    relationship_label: 'good_terms',
  });

  const applyDisabled = new AffectionApplyService(baseDir, DEFAULT_RECIPROCITY_CONFIG);
  const baseline = await applyDisabled.apply(observer, other, [
    makeEvent(observer, other, 'compliment', { correlation_id: 'r2:base:1' }),
    makeEvent(observer, other, 'compliment', { correlation_id: 'r2:base:2' }),
  ]);

  await clean();
  await seedState(store, other, observer, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 40, warmth: 60, trust: 50, tension: 5 },
    composite_affinity: 55,
    relationship_label: 'good_terms',
  });
  await applyOther.apply(other, observer, [
    makeEvent(other, observer, 'compliment', { correlation_id: 'r2:other:1b' }),
    makeEvent(other, observer, 'compliment', { correlation_id: 'r2:other:2b' }),
    makeEvent(other, observer, 'compliment', { correlation_id: 'r2:other:3b' }),
  ]);
  await seedState(store, observer, other, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 40, warmth: 50, trust: 50, tension: 5 },
    composite_affinity: 52,
    relationship_label: 'good_terms',
  });

  const applyEnabled = new AffectionApplyService(baseDir, ENABLED_CONFIG);
  const boosted = await applyEnabled.apply(observer, other, [
    makeEvent(observer, other, 'compliment', { correlation_id: 'r2:en:1' }),
    makeEvent(observer, other, 'compliment', { correlation_id: 'r2:en:2' }),
  ]);

  const baseGain = baseline.after.dimensions.warmth - 50;
  const boostedGain = boosted.after.dimensions.warmth - 50;
  console.log(`[reciprocity boost] warmth gain disabled=${baseGain} enabled=${boostedGain}`);
  assert(boostedGain >= baseGain, 'enabled reciprocity should not reduce warmth gain when counterparty warmed up');
  console.log('[结果] PASS');
}

async function testIntegrationCold(store: AffectionStateStore): Promise<void> {
  console.log('\n=== R3: Integration — counterparty cold dampens my warmth gain ===');
  await clean();

  await seedState(store, observer, other, {
    dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS, familiarity: 40, warmth: 50, trust: 50, tension: 5 },
    composite_affinity: 52,
    relationship_label: 'good_terms',
  });

  const applyOther = new AffectionApplyService(baseDir, ENABLED_CONFIG);
  await applyOther.apply(other, observer, [
    makeEvent(other, observer, 'conflict', { correlation_id: 'r3:c1' }),
    makeEvent(other, observer, 'conflict', { correlation_id: 'r3:c2' }),
    makeEvent(other, observer, 'conflict', { correlation_id: 'r3:c3' }),
    makeEvent(other, observer, 'conflict', { correlation_id: 'r3:c4' }),
  ]);

  const applyEnabled = new AffectionApplyService(baseDir, ENABLED_CONFIG);
  const dampened = await applyEnabled.apply(observer, other, [
    makeEvent(observer, other, 'compliment', { correlation_id: 'r3:me:1' }),
    makeEvent(observer, other, 'compliment', { correlation_id: 'r3:me:2' }),
    makeEvent(observer, other, 'compliment', { correlation_id: 'r3:me:3' }),
  ]);

  const rawWarmthGain = dampened.after.dimensions.warmth - 50;
  console.log(`[reciprocity cold] warmth gain with cold counterparty=${rawWarmthGain}`);
  assert(rawWarmthGain > 0, 'should still gain some warmth');
  assert(rawWarmthGain < 9, 'cold counterparty should dampen warmth gain below unadjusted ~9');
  console.log('[结果] PASS');
}

async function testDefaultDisabled(): Promise<void> {
  console.log('\n=== R4: Default config disabled (backward compatible) ===');
  await clean();

  const apply = new AffectionApplyService(baseDir);
  const r = await apply.apply(observer, other, [
    makeEvent(observer, other, 'compliment', { correlation_id: 'r4:1' }),
  ]);
  assert(r.after.dimensions.warmth > 0, 'default apply should work unchanged');
  console.log('[结果] PASS');
}

async function main(): Promise<void> {
  console.log('=== Reciprocity Smoke Test ===');
  testUnitMultiplier();

  const store = new AffectionStateStore(baseDir);
  await testDefaultDisabled();
  await testIntegrationBoost(store);
  await testIntegrationCold(store);

  console.log('\n=== All reciprocity scenarios PASSED ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
