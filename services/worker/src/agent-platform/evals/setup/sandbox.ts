/**
 * Sandbox — per-case isolated tmp directory lifecycle.
 *
 * Mirrors the smoke-test pattern:
 *   const baseDir = path.join(process.cwd(), 'tmp', 'memory_xxx');
 *   await clean() → run → clean()
 *
 * Each eval case gets: tmp/evals/<caseId>-<timestamp>/
 * which is destroyed after the case completes.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { getMemoryBaseDir } from '../../affection/memory-base-dir';
import type { EvalCase, EvalSandbox } from '../types';
export type { EvalSandbox };

/**
 * Resolve the base tmp directory for eval sandboxes.
 * Supports two modes:
 *   1. ECHO_EVAL_BASE_DIR env var (absolute or relative to cwd)
 *   2. Default: <memoryBaseDir>/../../evals_tmp
 *
 * The default places evals_tmp alongside memory tmp at the repo root.
 */
export function getEvalBaseDir(): string {
  const envDir = process.env.ECHO_EVAL_BASE_DIR?.trim();
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }
  const memoryBase = getMemoryBaseDir();
  return path.resolve(memoryBase, '..', 'evals_tmp');
}

/**
 * Create an isolated sandbox for a single eval case.
 *
 * Directory layout:
 *   tmp/evals/<caseId>-<ts>/
 *     users/<observerId>/social/by_agent/<otherId>/  ← memory files
 *     users/<observerId>/style.md                     ← per-observer style
 *     affection/                                      ← affection state
 */
export async function createSandbox(evalCase: EvalCase): Promise<EvalSandbox> {
  const ts = Date.now();
  const caseDir = path.join(getEvalBaseDir(), `${evalCase.id}-${ts}`);

  // 1. Create base dir
  await fs.mkdir(caseDir, { recursive: true });

  // 2. Create per-observer directories and seed fixtures
  const { observers } = evalCase.setup;
  for (const obsId of observers) {
    const userDir = path.join(caseDir, 'users', obsId);
    await fs.mkdir(path.join(userDir, 'social', 'by_agent'), { recursive: true });

    // 2a. Write style.md if override provided
    if (evalCase.setup.styleOverrides?.[obsId]) {
      const styleContent = evalCase.setup.styleOverrides[obsId];
      await fs.mkdir(userDir, { recursive: true });
      await fs.writeFile(path.join(userDir, 'style.md'), styleContent, 'utf-8');
    }

    // 2b. Write profile.core.json if override provided
    if (evalCase.setup.profileOverrides?.[obsId]) {
      await fs.writeFile(
        path.join(userDir, 'profile.core.json'),
        evalCase.setup.profileOverrides[obsId],
        'utf-8',
      );
    }

    // 2c. Seed affection state if provided
    if (evalCase.setup.affectionSeed) {
      const affectionDir = path.join(caseDir, 'affection');
      await fs.mkdir(affectionDir, { recursive: true });
      for (const [key, seed] of Object.entries(evalCase.setup.affectionSeed)) {
        const [obs, other] = key.split('::');
        if (!obs || !other) continue;
        const statePath = path.join(affectionDir, obs, other, 'affection.json');
        await fs.mkdir(path.dirname(statePath), { recursive: true });
        await fs.writeFile(statePath, JSON.stringify({
          other_agent_id: other,
          dimensions: {
            familiarity: seed.dimensions.familiarity ?? 0,
            warmth: seed.dimensions.warmth ?? 0,
            trust: seed.dimensions.trust ?? 0,
            tension: seed.dimensions.tension ?? 0,
            tension_quality: 'situational',
          },
          composite_affinity: 50,
          relationship_label: seed.label,
          version: 1,
        }, null, 2), 'utf-8');
      }
    }

    // 2d. Load memory snapshot fixture if provided
    if (evalCase.setup.memorySnapshot && evalCase.setup.memorySnapshot !== 'none') {
      await loadMemoryFixture(caseDir, evalCase.setup.memorySnapshot, observers);
    }
  }

  // 3. Set ECHO_MEMORY_BASE_DIR for this case so all services write to the sandbox
  process.env.ECHO_MEMORY_BASE_DIR = caseDir;

  return {
    caseId: evalCase.id,
    baseDir: caseDir,
    observers,
    destroy: () => fs.rm(caseDir, { recursive: true, force: true }),
  };
}

/**
 * Load a memory fixture JSON file and populate observer directories.
 * Fixture format:
 * {
 *   "<observerId>::<otherId>": {
 *     objective_facts: [...],
 *     preferences: [...]
 *   }
 * }
 */
async function loadMemoryFixture(
  caseDir: string,
  fixturePath: string,
  _observers: string[],
): Promise<void> {
  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.resolve(process.cwd(), fixturePath);

  let fixture: Record<string, { objective_facts?: unknown[]; preferences?: unknown[] }>;
  try {
    const raw = await fs.readFile(resolved, 'utf-8');
    fixture = JSON.parse(raw);
  } catch {
    console.warn(`[sandbox] Could not load memory fixture: ${resolved}`);
    return;
  }

  for (const [key, data] of Object.entries(fixture)) {
    const [obs, other] = key.split('::');
    if (!obs || !other) continue;
    const socialDir = path.join(caseDir, 'users', obs, 'social', 'by_agent', other);
    await fs.mkdir(socialDir, { recursive: true });

    if (data.objective_facts?.length) {
      const lines = data.objective_facts.map((f) => JSON.stringify(f)).join('\n') + '\n';
      await fs.writeFile(path.join(socialDir, 'objective_facts.jsonl'), lines, 'utf-8');
    }

    if (data.preferences?.length) {
      const lines = data.preferences.map((p) => JSON.stringify(p)).join('\n') + '\n';
      await fs.writeFile(path.join(socialDir, 'preferences.jsonl'), lines, 'utf-8');
    }
  }
}
