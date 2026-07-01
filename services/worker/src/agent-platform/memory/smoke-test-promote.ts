import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PromoteCheckService } from './promote-check.service';
import type { Preference, ObjectiveFact, Turn } from './types';

const agentA = 'agent_A_li_xiaoyu';
const agentB = 'agent_B_zhang_mingyuan';
const sessionId = 'test_promote_session_001';
const baseDir = path.join(process.cwd(), 'tmp', 'memory_promote');

async function clean(): Promise<void> {
  await fs.rm(baseDir, { recursive: true, force: true });
}

async function writeJsonl(filePath: string, records: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
  await fs.writeFile(filePath, lines, 'utf8');
}

async function readJsonl(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function makePref(id: string, content: string, turnIds: number[] = [0], status: Preference['status'] = 'candidate'): Preference {
  return {
    id,
    subject_agent_id: agentB,
    content,
    pref_type: 'explicit_opinion',
    confidence: 0.6,
    status,
    source: { session_id: sessionId, turn_ids: turnIds },
    extracted_at: new Date().toISOString(),
  };
}

async function scene1(): Promise<void> {
  await clean();
  const service = new PromoteCheckService(baseDir);
  const prefsPath = path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'preferences.jsonl');
  const turns: Turn[] = [
    { speaker_id: agentB, content: '我讨厌加班', turn_index: 0 },
    { speaker_id: agentB, content: '我真的很讨厌加班', turn_index: 1 },
  ];
  const p1 = makePref('pref_001', '我讨厌加班', [0]);
  const p2 = makePref('pref_002', '我讨厌加班', [1]);
  await writeJsonl(prefsPath, [p1, p2]);
  await service.check(agentA, agentB, turns, sessionId);
  const facts = await readJsonl(path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'objective_facts.jsonl')) as ObjectiveFact[];
  const prefs = await readJsonl(prefsPath) as Preference[];
  const activeFacts = facts.filter((f) => f.status === 'active');
  const promoted = prefs.filter((p) => p.status === 'promoted_to_objective');
  if (activeFacts.length !== 1) throw new Error('Scene1: expected 1 active fact');
  if (!activeFacts[0].source.promoted_from) throw new Error('Scene1: missing promoted_from');
  if (promoted.length < 1) throw new Error('Scene1: expected at least 1 promoted pref');
  console.log('[Scene 1] Promote success: 1 new active fact, promoted_to_objective');
}

async function scene2(): Promise<void> {
  await clean();
  const service = new PromoteCheckService(baseDir);
  const prefsPath = path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'preferences.jsonl');
  const turns: Turn[] = [
    { speaker_id: agentB, content: '我讨厌加班', turn_index: 0 },
  ];
  const p = makePref('pref_010', '我讨厌加班', [0]);
  await writeJsonl(prefsPath, [p]);
  await service.check(agentA, agentB, turns, sessionId);
  const facts = await readJsonl(path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'objective_facts.jsonl')) as ObjectiveFact[];
  const prefs = await readJsonl(prefsPath) as Preference[];
  const activeFacts = facts.filter((f) => f.status === 'active');
  const stillCandidate = prefs.filter((p) => p.status === 'candidate');
  if (activeFacts.length !== 0) throw new Error('Scene2: expected 0 facts');
  if (stillCandidate.length !== 1) throw new Error('Scene2: expected candidate kept');
  console.log('[Scene 2] No promote as expected');
}

async function scene3(): Promise<void> {
  await clean();
  const service = new PromoteCheckService(baseDir);
  const prefsPath = path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'preferences.jsonl');
  const turns: Turn[] = [
    { speaker_id: agentB, content: '我讨厌加班', turn_index: 0 },
    { speaker_id: agentB, content: '其实我也不讨厌加班', turn_index: 1 },
  ];
  const p1 = makePref('pref_020', '我讨厌加班', [0]);
  const p2 = makePref('pref_021', '其实我也不讨厌加班', [1]);
  await writeJsonl(prefsPath, [p1, p2]);
  await service.check(agentA, agentB, turns, sessionId);
  const prefs = await readJsonl(prefsPath) as Preference[];
  const contradicted = prefs.filter((p) => p.status === 'contradicted');
  const facts = await readJsonl(path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'objective_facts.jsonl')) as ObjectiveFact[];
  if (contradicted.length === 0) throw new Error('Scene3: expected contradicted');
  if (facts.length !== 0) throw new Error('Scene3: no facts on contradict');
  console.log('[Scene 3] Contradicted correctly');
}

async function scene4(): Promise<void> {
  await clean();
  const service = new PromoteCheckService(baseDir);
  const prefsPath = path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'preferences.jsonl');
  const turns: Turn[] = [
    { speaker_id: agentB, content: '我讨厌加班', turn_index: 0 },
    { speaker_id: agentB, content: '我真的讨厌加班', turn_index: 1 },
  ];
  const p1 = makePref('pref_030', '我讨厌加班', [0]);
  const p2 = makePref('pref_031', '我讨厌加班', [1]);
  await writeJsonl(prefsPath, [p1, p2]);
  await service.check(agentA, agentB, turns, sessionId);
  const facts = await readJsonl(path.join(baseDir, 'users', agentA, 'social', 'by_agent', agentB, 'objective_facts.jsonl')) as ObjectiveFact[];
  const activeFacts = facts.filter((f) => f.status === 'active');
  if (activeFacts.length !== 1) throw new Error('Scene4: expected exactly 1 active fact');
  console.log('[Scene 4] Deduped: only 1 active fact');
}

async function run() {
  console.log('Starting M5 PromoteCheck smoke test (LLM-based)...');
  try {
    await scene1();
    await scene2();
    await scene3();
    await scene4();
    console.log('✓ All M5 scenarios passed.');
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(1);
  } finally {
    await clean();
  }
}

run();
