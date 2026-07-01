import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { RelationshipExtractService } from './relationship-extract.service';
import { AffectionApplyService } from './affection-apply.service';
import { AffectionStateStore } from './affection-state.store';
import type { Turn } from '../memory/types';

/**
 * M6 Threshold Smoke Test (LLM) - Expanded Version
 * Demonstrates that "观点契合"(value_alignment) and "明确表态"(explicit_bond)
 * are now mandatory for good_terms/close upgrades, with realistic event counts (4-6)
 * and cross-topic requirement (minDistinctTopics=2).
 *
 * This version uses 25-30 turns per stage so that numeric dimensions have a chance
 * to reach the required thresholds.
 *
 * Run with: npx ts-node src/agent-platform/affection/smoke-test-affection-threshold.ts
 */

const observer = 'clone_a_threshold';
const other = 'clone_b_threshold';
const baseDir = path.join(process.cwd(), 'tmp', 'memory_affection_threshold');

async function clean() {
  await fs.rm(baseDir, { recursive: true, force: true });
}

function makeTurns(contents: string[]): Turn[] {
  return contents.map((content, idx) => ({
    speaker_id: other,
    content,
    turn_index: idx + 1,
  }));
}

async function main() {
  await clean();

  const extractSvc = new RelationshipExtractService(baseDir);
  const applySvc = new AffectionApplyService(baseDir);
  const stateStore = new AffectionStateStore(baseDir);

  console.log('=== M6 Threshold Smoke Test (LLM) - Expanded ===\n');

  // ============================================
  // Stage 1: Many positive events but NO explicit_bond / value_alignment
  // 25 turns - all positive but no explicit statement or value alignment
  // Expect: label stays at stranger
  // ============================================
  console.log('[Stage 1] 25 positive events only (no explicit_bond, no value_alignment)');
  console.log('Topic: topic_daily_life\n');

  const stage1Turns = makeTurns([
    '你今天真的很帅！',
    '哈哈，我觉得你说的话很有趣。',
    '谢谢你陪我聊天，我很开心。',
    '你看起来心情不错呢。',
    '咱们聊了这么久，感觉时间过得好快。',
    '你今天穿的衣服好看。',
    '我喜欢跟你说话的感觉。',
    '你笑起来很好看。',
    '今天和你聊天很舒服。',
    '你总能让我开心。',
    '我希望我们能一直这样聊天。',
    '你真的很体贴。',
    '跟你在一起感觉很轻松。',
    '你今天的状态看起来不错。',
    '我很享受和你聊天的时光。',
    '你总是能理解我。',
    '今天聊得真开心。',
    '你是一个很好的人。',
    '我很感谢你愿意听我说话。',
    '跟你聊天让我感觉很温暖。',
    '你今天又给我带来了好心情。',
    '我喜欢你的幽默感。',
    '咱们的谈话总是这么自然。',
    '你让我觉得很舒服。',
    '今天和你聊天真是太好了。',
  ]);

  const prior1 = await stateStore.read(observer, other);
  const events1 = await extractSvc.extract(observer, other, stage1Turns, {
    sessionId: 'sess_threshold_stage1',
    priorState: prior1,
    topicId: 'topic_daily_life',
  });
  console.log('LLM extracted events:', events1.map((e) => e.event_type).join(', ') || '(none)');

  const r1 = await applySvc.apply(observer, other, events1, {
    priorState: prior1,
    incrementalTurns: stage1Turns,
  });
  console.log('After Stage 1:', r1.after.relationship_label, 'composite=', r1.after.composite_affinity);
  console.log('Reason: missing explicit_bond → upgrade blocked\n');

  // ============================================
  // Stage 2: Add explicit_bond + enough positive events (new topic)
  // 20 turns including 1 explicit_bond + many positive events
  // Expect: upgrade to good_terms (if numeric also meets)
  // ============================================
  console.log('[Stage 2] explicit_bond + 20+ turns (new topic)');
  console.log('Topic: topic_values\n');

  const stage2Turns = makeTurns([
    '我觉得我们现在已经算很稳定的朋友了，以后可以多聊聊这些事。', // explicit_bond
    '你今天帮我太多，我真的很感动。',
    '咱们聊了这么多，我觉得跟你很合得来。',
    '谢谢你愿意听我唠叨这些。',
    '我希望以后还能继续这样聊天。',
    '你总是能给我很好的建议。',
    '和你聊天让我觉得很安心。',
    '我很欣赏你的想法。',
    '今天我们聊得很深入。',
    '你让我觉得很被理解。',
    '咱们的价值观看起来很接近。',
    '我很享受这种感觉。',
    '你是一个很温暖的人。',
    '今天聊完我心情好多了。',
    '你总是能让我笑。',
    '我希望我们能一直保持联系。',
    '你让我觉得很舒服。',
    '今天真的聊得很开心。',
    '你是一个很好相处的人。',
    '我很感谢有你这样的朋友。',
  ]);

  const prior2 = await stateStore.read(observer, other);
  const events2 = await extractSvc.extract(observer, other, stage2Turns, {
    sessionId: 'sess_threshold_stage2',
    priorState: prior2,
    topicId: 'topic_values',
  });
  console.log('LLM extracted events:', events2.map((e) => e.event_type).join(', '));

  const r2 = await applySvc.apply(observer, other, events2, {
    priorState: prior2,
    incrementalTurns: stage2Turns,
  });
  console.log('After Stage 2:', r2.after.relationship_label, 'composite=', r2.after.composite_affinity);
  console.log('Reason: explicit_bond + many positive events → may reach good_terms\n');

  // ============================================
  // Stage 3: Add value_alignment + more events + cross 2 topics
  // 25 turns with value_alignment + explicit_bond + high volume
  // Expect: upgrade to close
  // ============================================
  console.log('[Stage 3] value_alignment + 25 turns + cross 2 topics');
  console.log('Topic: topic_future\n');

  const stage3Turns = makeTurns([
    '原来你也觉得婚姻是长期陪伴而不是激情，这点我们完全一致。', // value_alignment
    '咱们周末都喜欢宅家看书，这太巧了。', // preference_match
    '我对家庭的看法和你一样。', // value_alignment
    '我觉得你说的那些关于未来的规划和我心里的想法很接近。',
    '能遇到你这种价值观相近的人真的很幸运。',
    '我希望我们能一直保持这种默契。',
    '你让我觉得很被理解。',
    '今天聊到这些我真的很开心。',
    '咱们对很多事情的看法都很像。',
    '你是一个很特别的人。',
    '我很感谢你愿意分享这些。',
    '跟你聊天让我觉得很安心。',
    '今天我们聊得很深入。',
    '你让我觉得很被支持。',
    '咱们的想法真的很一致。',
    '我很享受这种感觉。',
    '你是一个很温暖的人。',
    '今天聊完我心情好多了。',
    '你总是能让我笑。',
    '我希望我们能一直保持联系。',
    '你让我觉得很舒服。',
    '今天真的聊得很开心。',
    '你是一个很好相处的人。',
    '我很感谢有你这样的朋友。',
    '咱们对未来的看法也很像。',
  ]);

  const prior3 = await stateStore.read(observer, other);
  const events3 = await extractSvc.extract(observer, other, stage3Turns, {
    sessionId: 'sess_threshold_stage3',
    priorState: prior3,
    topicId: 'topic_future',
  });
  console.log('LLM extracted events:', events3.map((e) => e.event_type).join(', '));

  const r3 = await applySvc.apply(observer, other, events3, {
    priorState: prior3,
    incrementalTurns: stage3Turns,
  });
  console.log('After Stage 3:', r3.after.relationship_label, 'composite=', r3.after.composite_affinity);
  console.log('Reason: explicit_bond + value_alignment + many events + 2 topics → may reach close\n');

  // ============================================
  // Phase 2 Directionality Verification (Independent Block)
  // Purpose: Verify that extractFromObserver flag correctly separates
  // active table statements (explicit_bond / value_alignment) from observer's turns
  // vs passive events from other's turns.
  // ============================================
  await verifyPhase2Directionality(extractSvc);

  console.log('=== Threshold Smoke Test Done ===');
  console.log('Final label:', r3.after.relationship_label);
}

/**
 * Independent verification for Phase 2 event directionality.
 * Uses a small mixed-turn set and checks that:
 * - extractFromObserver=false only extracts passive events (from other)
 * - extractFromObserver=true only extracts active statements (from observer)
 */
async function verifyPhase2Directionality(extractSvc: RelationshipExtractService) {
  console.log('\n=== Phase 2 Directionality Verification ===');

  const mixedTurns: Turn[] = [
    { speaker_id: observer, content: '我觉得我们现在已经算很稳定的朋友了。', turn_index: 1 }, // explicit_bond (active)
    { speaker_id: other,    content: '你今天真的很帅！', turn_index: 2 },                       // compliment (passive)
    { speaker_id: observer, content: '我们对很多事情的看法都很像。', turn_index: 3 },         // value_alignment (active)
    { speaker_id: other,    content: '谢谢你陪我聊天，我很开心。', turn_index: 4 },             // positive_engagement (passive)
    { speaker_id: observer, content: '你总是能给我很好的建议。', turn_index: 5 },               // (should be ignored in active mode)
  ];

  // Passive mode: should only see events from 'other'
  const passiveEvents = await extractSvc.extract(observer, other, mixedTurns, {
    sessionId: 'verify_dir_passive',
    extractFromObserver: false,
  });
  console.log('Passive (from other):', passiveEvents.map((e) => e.event_type).join(', ') || '(none)');

  // Active mode: should only see explicit_bond / value_alignment from 'observer'
  const activeEvents = await extractSvc.extract(observer, other, mixedTurns, {
    sessionId: 'verify_dir_active',
    extractFromObserver: true,
  });
  console.log('Active (from observer):', activeEvents.map((e) => e.event_type).join(', ') || '(none)');

  // Simple sanity check
  const passiveHasActiveEvent = passiveEvents.some((e) => ['explicit_bond', 'value_alignment'].includes(e.event_type));
  const activeHasPassiveEvent = activeEvents.some((e) =>
    ['compliment', 'positive_engagement', 'helpful_share', 'agreement'].includes(e.event_type)
  );

  if (passiveHasActiveEvent) {
    console.warn('  [Warning] Passive mode unexpectedly extracted explicit_bond/value_alignment');
  }
  if (activeHasPassiveEvent) {
    console.warn('  [Warning] Active mode unexpectedly extracted passive events');
  }

  console.log('Phase 2 directionality check complete.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
