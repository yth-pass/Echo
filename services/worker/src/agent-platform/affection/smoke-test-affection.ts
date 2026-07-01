import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AffectionApplyService } from './affection-apply.service';
import { AffectionOverlayService } from './affection-overlay.service';
import type { AffectionEvent } from './types';

/**
 * M6 smoke test (A+B+C model)
 * Demonstrates state-dependent deltas, threshold-based label upgrades, and optional LLM judge.
 * Run with: npx ts-node smoke-test-affection.ts
 */

const observer = 'clone_a_001';
const other = 'clone_b_001';
const sessionId = 'sess_affection_demo';
const baseDir = path.join(process.cwd(), 'tmp', 'memory_affection');

async function clean() {
  await fs.rm(baseDir, { recursive: true, force: true });
}

function makeEvent(type: AffectionEvent['event_type'], extra: Partial<AffectionEvent> = {}): AffectionEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    observer_id: observer,
    other_id: other,
    event_type: type,
    deltas: {},
    evidence: { joint_session_id: sessionId, turn_ids: [1, 2], strength: 'moderate' as const },
    at: new Date().toISOString(),
    correlation_id: `${sessionId}:${type}:${Date.now()}`,
    ...extra,
  };
}

async function main() {
  await clean();
  const apply = new AffectionApplyService(baseDir);
  const overlay = new AffectionOverlayService(baseDir);

  console.log('=== M6 Affection Smoke Test ===');

  // Scenario 1: positive promote (trust_confirm x3)
  console.log('\n[1] Positive promote: 3x trust_confirm');
  const trustEvents = [
    makeEvent('trust_confirm', { correlation_id: `${sessionId}:promote:1` }),
    makeEvent('trust_confirm', { correlation_id: `${sessionId}:promote:2` }),
    makeEvent('trust_confirm', { correlation_id: `${sessionId}:promote:3` }),
  ];
  const r1 = await apply.apply(observer, other, trustEvents);
  console.log('Result:', r1.after.relationship_label, 'trust=', r1.after.dimensions.trust);
  // expect stranger -> friendly_acquaintance or better

  // Scenario 2: caps (warmth many positive)
  console.log('\n[2] Caps: 10x compliment (warmth cap 8)');
  const many = Array.from({ length: 10 }, (_, i) =>
    makeEvent('compliment', { correlation_id: `${sessionId}:cap:${i}` }),
  );
  const r2 = await apply.apply(observer, other, many);
  console.log('warmth after cap:', r2.after.dimensions.warmth, '(should be <=8 more than before)');

  // Scenario 3: negative trust_break
  console.log('\n[3] Negative: trust_break');
  const neg = [makeEvent('trust_break', { correlation_id: `${sessionId}:break:1` })];
  const r3 = await apply.apply(observer, other, neg);
  console.log('After break:', r3.after.relationship_label, 'tension=', r3.after.dimensions.tension);

  // Scenario 4: overlay
  console.log('\n[4] Overlay render:');
  const ov = await overlay.render(observer, other);
  console.log(ov);

  // Scenario 5: idempotency (repeat same corr)
  console.log('\n[5] Idempotency: repeat event');
  const dup = [makeEvent('compliment', { correlation_id: 'dup_corr_001' })];
  await apply.apply(observer, other, dup);
  const r5 = await apply.apply(observer, other, dup); // should skip
  console.log('skipped count on dup:', r5.skippedEvents.length);

  // Scenario 6: strength comparison (point 2) - strong vs weak conflict
  console.log('\n[6] Strength impact: strong vs weak conflict');
  const strongConflict = makeEvent('conflict', {
    correlation_id: `${sessionId}:strong_conflict`,
    evidence: { joint_session_id: sessionId, turn_ids: [10], strength: 'strong' as const },
  });
  const weakConflict = makeEvent('conflict', {
    correlation_id: `${sessionId}:weak_conflict`,
    evidence: { joint_session_id: sessionId, turn_ids: [11], strength: 'weak' as const },
  });
  // reset state for clean comparison (reuse current after r5)
  const r6strong = await apply.apply(observer, other, [strongConflict]);
  console.log('Strong conflict tension delta:', r6strong.after.dimensions.tension - r5.after.dimensions.tension, '(should be larger, ~9 vs ~2.5)');
  const r6weak = await apply.apply(observer, other, [weakConflict]);
  console.log('Weak conflict tension delta:', r6weak.after.dimensions.tension - r6strong.after.dimensions.tension, '(should be smaller)');

  console.log('\n=== Smoke done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
