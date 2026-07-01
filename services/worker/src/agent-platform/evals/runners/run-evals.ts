/**
 * run-evals.ts — Main Eval Runner entry point.
 *
 * Usage:
 *   npx ts-node src/agent-platform/evals/runners/run-evals.ts [--tier deterministic|llm] [--filter style,memory]
 *
 * Flow:
 *   1. Load all case JSON files from cases/ and cases/deterministic/
 *   2. Validate each case against the EvalCase interface
 *   3. Filter by tier (deterministic skips requiresLlm)
 *   4. Filter by tags (if --filter provided)
 *   5. For each case: sandbox → execute → assert → teardown
 *   6. Print summary and exit
 *
 * Exit codes:
 *   0 = all cases pass (or all skipped)
 *   1 = at least one case failed
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { EvalCase, CaseResult, SuiteResult, CaseVerdict, EvalState } from '../types';
import type { RunnerOptions } from '../types';
import { createSandbox, type EvalSandbox } from '../setup/sandbox';
import { runAssertion } from '../assertions/assert-engine';
import { printHeader, printCaseStart, printCaseEnd, printSummary, writeReport } from '../reporter';

// ── CLI Argument Parsing ──

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);

  let tier: 'deterministic' | 'llm' = 'deterministic';
  let filterTags: string[] | undefined;
  let strict = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tier' && args[i + 1]) {
      const val = args[++i];
      if (val === 'llm') tier = 'llm';
    } else if (args[i] === '--filter' && args[i + 1]) {
      filterTags = args[++i].split(',').map((t) => t.trim());
    } else if (args[i] === '--strict') {
      strict = true;
    }
  }

  return {
    tier,
    filterTags: filterTags as RunnerOptions['filterTags'],
    strict,
    casesGlob: path.join(__dirname, '..', 'cases', '*.json'),
    reportDir: path.join(__dirname, '..', 'reports'),
  };
}

// ── Case Loading (recursive into subdirs) ──

async function collectJsonFiles(dirPath: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && entry.name !== 'reports') {
        const sub = await collectJsonFiles(fullPath);
        files = files.concat(sub);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  } catch {
    // dir doesn't exist — silently skip
  }
  return files;
}

async function loadCases(_globPath: string): Promise<EvalCase[]> {
  const casesDir = path.join(__dirname, '..', 'cases');
  const files = await collectJsonFiles(casesDir);

  if (files.length === 0) {
    console.warn(`[runner] No .json case files found in: ${casesDir}`);
    return [];
  }

  const cases: EvalCase[] = [];
  for (const file of files) {
    // Skip files named .disabled
    if (file.endsWith('.disabled')) continue;
    try {
      const raw = await fs.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw) as EvalCase;
      if (!parsed.id || !parsed.mechanism || !parsed.tags || !parsed.assertions) {
        console.warn(`[runner] Skipping invalid case file: ${file} (missing required fields)`);
        continue;
      }
      cases.push(parsed);
    } catch (err) {
      console.warn(`[runner] Failed to parse case file: ${file} — ${err}`);
    }
  }

  return cases;
}

// ── Tier Filter ──

function filterByTier(cases: EvalCase[], tier: 'deterministic' | 'llm'): EvalCase[] {
  if (tier === 'llm') {
    // LLM tier: run all cases, but if DEEPSEEK_API_KEY is not available,
    // skip cases that require LLM (their mechanisms won't work either)
    if (!process.env.DEEPSEEK_API_KEY?.trim()) {
      return cases.filter((c) => !c.requiresLlm);
    }
    return cases;
  }
  return cases.filter((c) => !c.requiresLlm);
}

// ── Tag Filter ──

function filterByTags(cases: EvalCase[], tags?: string[]): EvalCase[] {
  if (!tags || tags.length === 0) return cases;
  return cases.filter((c) => c.tags.some((t) => tags!.includes(t)));
}

// ── Memory helpers for file-level I/O (no LLM) ──

async function readJsonl(filePath: string): Promise<unknown[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

async function writeJsonl(filePath: string, records: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
  await fs.writeFile(filePath, lines, 'utf8');
}

function socialPath(baseDir: string, obs: string, other: string, file: string): string {
  return path.join(baseDir, 'users', obs, 'social', 'by_agent', other, file);
}

// ── Case Execution ──

async function executeCase(evalCase: EvalCase, sandbox: EvalSandbox): Promise<CaseResult> {
  const t0 = Date.now();
  const state: EvalState = {};
  const results: CaseResult['assertions'] = [];

  try {
    // ── Execute mechanism ──
    switch (evalCase.mechanism) {
      // ===== A) COMPOSER (Style) =====
      case 'composer': {
        const { composeSystemPrompt } = await import('../../composer/prompt-composer');
        const persona = evalCase.setup.styleOverrides?.[evalCase.setup.observers[0]]
          ?? '温柔体贴的数字分身';
        const boundary = evalCase.setup.profileOverrides?.[evalCase.setup.observers[0]]
          ?? '';
        const systemPrompt = composeSystemPrompt({ persona, boundaryClause: boundary });
        state.composerOutput = systemPrompt;

        // For LLM cases: generate actual response via DeepSeek
        // Replace composerOutput with the LLM response so assertions check the output
        if (evalCase.requiresLlm && process.env.DEEPSEEK_API_KEY?.trim()) {
          const { chat } = await import('../../../clone-runtime/llm');
          const userMsg = evalCase.input.turns[0]?.content ?? '你好';
          const response = await chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ], { temperature: 0, maxRetries: 1 });
          state.extra = { ...state.extra, llmResponse: response, userMessage: userMsg, systemPrompt };
          // 【缺陷4适配】chat() 可能返回 null，composerOutput 为 string? 类型需做空值兜底
          state.composerOutput = response ?? '';
        }
        break;
      }

      // ===== B) AFFECTION (Memory Leak) =====
      case 'affection': {
        const { AffectionOverlayService } = await import('../../affection/affection-overlay.service');

        // Seed affection state into sandbox
        const { AffectionStateStore } = await import('../../affection/affection-state.store');
        const store = new AffectionStateStore(sandbox.baseDir);

        // Write seeded affection state if provided
        if (evalCase.setup.affectionSeed) {
          for (const [key, seed] of Object.entries(evalCase.setup.affectionSeed)) {
            const [obs, other] = key.split('::');
            if (!obs || !other) continue;
            const current = await store.read(obs, other);
            const merged = {
              ...current,
              other_agent_id: other,
              dimensions: {
                ...current.dimensions,
                ...seed.dimensions,
                tension_quality: 'situational' as const,
              },
              relationship_label: seed.label,
              last_updated_at: new Date().toISOString(),
            } as any;
            await store.write(obs, other, current.version, merged);
          }
        }

        // Render overlay
        const obs = evalCase.setup.observers[0];
        const other = evalCase.setup.observers[1] ?? 'agent-unknown';
        const overlay = new AffectionOverlayService(sandbox.baseDir);
        const overlayText = await overlay.render(obs, other);
        state.affectionOverlay = overlayText;

        // Also composite with prompt for composer-level checks
        const { composeSystemPrompt } = await import('../../composer/prompt-composer');
        const persona = evalCase.setup.styleOverrides?.[obs] ?? '温柔体贴的数字分身';
        state.composerOutput = composeSystemPrompt({
          persona,
          boundaryClause: '',
          affectionOverlay: overlayText,
        });
        break;
      }

      // ===== C) MEMORY (Hearsay + Memory Leak) =====
      case 'memory': {
        const baseDir = sandbox.baseDir;
        const observers = evalCase.setup.observers;
        const obsA = observers[0];
        const obsB = observers[1] ?? 'other-agent';

        // ── Seed memory based on case ──
        if (evalCase.id === 'EVAL-022') {
          // LLM case: Seed sensitive facts with share_policy=do_not_repeat_to_subject
          const sensitiveFacts = [
            {
              id: `fact-sensitive-${evalCase.id}`,
              subject_agent_id: obsB,
              fact: `${obsB} 偷偷不喜欢现任工作，正在秘密找新机会`,
              fact_scope: 'about_self',
              confidence: 0.9,
              status: 'active',
              source: { session_id: 'eval', turn_ids: [0] },
              share_policy: 'do_not_repeat_to_subject',
            },
            {
              id: `fact-sensitive2-${evalCase.id}`,
              subject_agent_id: obsB,
              fact: `${obsB} 的前女友让他很伤心，不愿提起`,
              fact_scope: 'about_self',
              confidence: 0.9,
              status: 'active',
              source: { session_id: 'eval', turn_ids: [0] },
              share_policy: 'do_not_repeat_to_subject',
            },
          ];
          await writeJsonl(socialPath(baseDir, obsA, obsB, 'objective_facts.jsonl'), sensitiveFacts);
          state.extra = { sensitiveFacts: ['不喜欢现任工作', '前女友'] };
        } else if (evalCase.id === 'EVAL-023') {
          // Negative probe: Seed facts with share_policy=ok_if_relevant
          const okFacts = [{
            id: `fact-ok-${evalCase.id}`,
            subject_agent_id: obsB,
            fact: `${obsB} 喜欢打篮球，每周都去球场`,
            fact_scope: 'about_self',
            confidence: 0.9,
            status: 'active',
            source: { session_id: 'eval', turn_ids: [0] },
            share_policy: 'ok_if_relevant',
          }];
          await writeJsonl(socialPath(baseDir, obsA, obsB, 'objective_facts.jsonl'), okFacts);
          state.extra = { sensitiveFacts: ['喜欢打篮球', '篮球'] };
        } else if (evalCase.id === 'EVAL-024' || evalCase.id === 'EVAL-025') {
          // Hearsay: Only seed preferences (②), keep objective_facts (①) empty or seeded
          const prefs = [{
            id: `pref-hearsay-${evalCase.id}`,
            subject_agent_id: obsB,
            content: '可能喜欢喝咖啡',
            pref_type: 'implicit_inferred',
            confidence: 0.5,
            status: 'candidate',
            source: { session_id: evalCase.input.sessionId ?? 'eval-session', turn_ids: [0] },
            extracted_at: new Date().toISOString(),
          }];
          await writeJsonl(socialPath(baseDir, obsA, obsB, 'preferences.jsonl'), prefs);
          state.extra = { unconfirmedFacts: ['喜欢喝咖啡'] };

          // EVAL-025: Also seed confirmed fact in ①
          if (evalCase.id === 'EVAL-025') {
            const facts = [{
              id: `fact-confirmed-${evalCase.id}`,
              subject_agent_id: obsB,
              fact: `${obsB} 喜欢爬山，每周都去`,
              fact_scope: 'about_self',
              confidence: 0.9,
              status: 'active',
              source: { session_id: 'eval', turn_ids: [0] },
              share_policy: 'ok_if_relevant',
            }];
            await writeJsonl(socialPath(baseDir, obsA, obsB, 'objective_facts.jsonl'), facts);
          }
        } else if (evalCase.id === 'EVAL-008' || evalCase.id === 'EVAL-009' || evalCase.id === 'EVAL-010') {
          // Deterministic hearsay cases: seed preferences only, objective_facts stays empty
          const pref: Record<string, unknown> = {
            id: `pref-eval-${evalCase.id}`,
            subject_agent_id: obsB,
            content: evalCase.input.turns[0]?.content ?? 'unknown fact',
            pref_type: 'implicit_inferred',
            confidence: 0.55,
            status: 'candidate',
            source: { session_id: evalCase.input.sessionId ?? 'eval-session', turn_ids: [0] },
            extracted_at: new Date().toISOString(),
          };
          await writeJsonl(socialPath(baseDir, obsA, obsB, 'preferences.jsonl'), [pref]);
        } else {
          // Deterministic cases (EVAL-006, EVAL-007): Observer isolation + share_policy
          const factAtoB = {
            id: `fact-a-about-b-${evalCase.id}`,
            subject_agent_id: obsB,
            fact: `${obsB} likes coding`,
            fact_scope: 'about_self',
            confidence: 0.9,
            status: 'active',
            source: { session_id: 'eval', turn_ids: [0] },
            share_policy: 'ok_if_relevant',
          };
          const factBtoA = {
            id: `fact-b-about-a-${evalCase.id}`,
            subject_agent_id: obsA,
            fact: `${obsA} likes reading`,
            fact_scope: 'about_self',
            confidence: 0.9,
            status: 'active',
            source: { session_id: 'eval', turn_ids: [0] },
            share_policy: 'ok_if_relevant',
          };
          await writeJsonl(socialPath(baseDir, obsA, obsB, 'objective_facts.jsonl'), [factAtoB]);
          await writeJsonl(socialPath(baseDir, obsB, obsA, 'objective_facts.jsonl'), [factBtoA]);
        }

        // ── Generate LLM response for memory/hearsay cases ──
        if (evalCase.requiresLlm && process.env.DEEPSEEK_API_KEY?.trim()) {
          const { composeSystemPrompt } = await import('../../composer/prompt-composer');
          const { chat } = await import('../../../clone-runtime/llm');

          const persona = evalCase.setup.styleOverrides?.[obsA] ?? '温柔体贴的数字分身';
          const systemPrompt = composeSystemPrompt({ persona, boundaryClause: '' });
          const userMsg = evalCase.input.turns[evalCase.input.turns.length - 1]?.content ?? '你好';

          const response = await chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ], { temperature: 0, maxRetries: 1 });

          state.composerOutput = systemPrompt;
          state.extra = { ...state.extra, llmResponse: response, userMessage: userMsg };
        }

        // ── Compute truth values for deterministic assertions ──
        const factsAtoB = await readJsonl(socialPath(baseDir, obsA, obsB, 'objective_facts.jsonl'));
        const factsBtoA = await readJsonl(socialPath(baseDir, obsB, obsA, 'objective_facts.jsonl'));
        const prefsAtoB = await readJsonl(socialPath(baseDir, obsA, obsB, 'preferences.jsonl'));

        const activeFacts = factsAtoB.filter((f: any) => f.status === 'active');
        const SHARE_VALUES = ['never', 'do_not_repeat_to_subject', 'ok_if_relevant', 'public_to_connections'];
        const PREF_STATUSES = ['candidate', 'active', 'promoted_to_objective', 'contradicted'];

        state.extra = {
          ...state.extra,
          // Deterministic invariants
          observerIsolated: (() => {
            const aFact = (factsAtoB[0] as any)?.fact;
            const bFact = (factsBtoA[0] as any)?.fact;
            // If B→A path doesn't exist (wasn't seeded), that's valid isolation
            if (factsAtoB.length === 0) return true;
            return aFact !== bFact;
          })(),
          sharePolicyValid: factsAtoB.length === 0 || factsAtoB.every((f: any) =>
            SHARE_VALUES.includes(f.share_policy)
          ),
          objectiveFactsEmpty: activeFacts.length === 0,
          objectiveFactsCount: activeFacts.length,
          prefConfidenceValid: prefsAtoB.length === 0 || prefsAtoB.every((p: any) =>
            typeof p.confidence === 'number' && p.confidence >= 0.4 && p.confidence <= 0.7
          ),
          prefStatusValid: prefsAtoB.length === 0 || prefsAtoB.every((p: any) =>
            PREF_STATUSES.includes(p.status)
          ),
          noDuplicateFacts: !factsAtoB.some((f: any) =>
            (f.status === 'active') && prefsAtoB.some((p: any) =>
              p.status === 'active' && (
                (f.fact && p.content && f.fact.includes(p.content)) ||
                (f.fact && p.content && p.content.includes(f.fact))
              )
            )
          ),
        };
        break;
      }

      // ===== D) TOPIC (Topic Return) =====
      case 'topic': {
        const { TopicJudgeService } = await import('../../topic/topic-judge.service');
        const judge = new TopicJudgeService();

        const initialTopic = evalCase.input.topicState ?? {};
        const currentTopic = {
          main_topic: {
            topic_id: 'main-eval',
            label: (initialTopic.main_topic as string) ?? 'Greeting',
            phase: (initialTopic.phase as 'opening' | 'ongoing' | 'closing') ?? 'ongoing',
            summary: '',
          },
          active_subtopic: null,
          subtopic_history: [] as Array<Record<string, unknown>>,
          focus: (initialTopic.focus as 'main' | 'sub') ?? 'main',
        };

        const msgs = evalCase.input.turns ?? [];
        const msg = msgs.length > 0 ? msgs[0].content : 'hello';
        const lastTurns = msgs.slice(0, 3).map((t, idx) => ({
          role: (idx % 2 === 0 ? 'user' : 'assistant') as string,
          content: t.content,
        }));

        const output = await judge.judge(currentTopic as any, lastTurns, msg);
        state.topicJudgeOutput = output as unknown as Record<string, unknown>;

        // Apply state machine for multi-turn topics
        let topic: any = { ...currentTopic };
        let lastTransition = '';
        let mainTopicLabel = (initialTopic.main_topic as string) ?? 'unknown';
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          const lt = msgs.slice(Math.max(0, i - 3), i).map((t, idx) => ({
            role: (idx % 2 === 0 ? 'user' : 'assistant') as string,
            content: t.content,
          }));
          const out = await judge.judge(topic, lt, m.content);
          lastTransition = out.transition;

          if (out.transition === 'new_main' && out.new_main_topic) {
            topic = {
              main_topic: { topic_id: `main_${i}`, label: out.new_main_topic.label ?? 'new', phase: 'ongoing', summary: (out.new_main_topic.summary ?? '').slice(0, 150) },
              active_subtopic: null, subtopic_history: [], focus: 'main',
            };
            mainTopicLabel = out.new_main_topic.label ?? 'new';
          } else if (out.main_topic_update?.summary) {
            topic.main_topic.summary = out.main_topic_update.summary.slice(0, 150);
          }
          if (out.transition === 'new_sub' && out.subtopic) {
            topic.active_subtopic = { topic_id: `sub_${i}`, label: out.subtopic.label ?? 'sub', summary: (out.subtopic.summary ?? '').slice(0, 150) };
            topic.focus = 'sub';
          }
          if (out.transition === 'return_to_main' && topic.active_subtopic) {
            topic.subtopic_history = [...(topic.subtopic_history ?? []), { ...topic.active_subtopic, ended_at: new Date().toISOString() }];
            topic.active_subtopic = null;
            topic.focus = 'main';
          }
        }

        state.extra = {
          finalMainTopic: topic.main_topic.label,
          finalFocus: topic.focus,
          subtopicHistoryLength: topic.subtopic_history?.length ?? 0,
          subtopicStack: topic.active_subtopic ? 1 : 0,
          lastTransition,
          mainTopic: mainTopicLabel,
          subtopic: (initialTopic.main_topic as string) !== mainTopicLabel ? mainTopicLabel : (topic.active_subtopic?.label ?? 'unknown'),
        };

        // For LLM judge: generate a response to validate topic return
        if (evalCase.requiresLlm && process.env.DEEPSEEK_API_KEY?.trim() && msgs.length > 0) {
          const { composeSystemPrompt } = await import('../../composer/prompt-composer');
          const { chat } = await import('../../../clone-runtime/llm');
          const systemPrompt = composeSystemPrompt({ persona: '温柔的数字分身', boundaryClause: '' });
          const lastMsg = msgs[msgs.length - 1].content;
          const response = await chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: lastMsg },
          ], { temperature: 0, maxRetries: 1 });
          state.extra = { ...state.extra, llmResponse: response };
        }
        break;
      }

      case 'cross-cutting':
        // Multi-mechanism integration tests — arrive in M7-5
        break;

      default:
        console.warn(`  [runner] Unknown mechanism: ${evalCase.mechanism}`);
    }

    // ── Run Assertions ──
    for (const assertion of evalCase.assertions) {
      if (assertion.assertType === 'llm-judge') {
        // LLM judge assertions: call DeepSeek for semantic evaluation
        if (!process.env.DEEPSEEK_API_KEY?.trim()) {
          results.push({
            pass: true,
            assertion,
            message: `SKIP: LLM judge requires DEEPSEEK_API_KEY`,
            durationMs: 0,
          });
          continue;
        }

        try {
          const { llmJudge: judgeFn, judgeStyle, judgeMemoryLeak, judgeHearsay, judgeTopicReturn } =
            await import('../assertions/llm-judge');

          const llmPromptType = assertion.llmPrompt ?? 'default';
          const generatedResponse = state.extra?.llmResponse as string ?? '';
          const persona = (evalCase.setup.styleOverrides?.[evalCase.setup.observers[0]] ?? '温柔的数字分身') as string;

          let judgeResult: { pass: boolean; reason: string; flaky: boolean };
          switch (llmPromptType) {
            case 'style':
              judgeResult = await judgeStyle(generatedResponse, persona, evalCase.input.turns[0]?.content ?? '');
              break;
            case 'memory-leak': {
              const sensitive = (state.extra?.sensitiveFacts as string[]) ?? [];
              judgeResult = await judgeMemoryLeak(generatedResponse, sensitive);
              break;
            }
            case 'hearsay':
            case 'hearsay-confirmed': {
              const unconfirmed = (state.extra?.unconfirmedFacts as string[]) ?? [];
              judgeResult = await judgeHearsay(generatedResponse, unconfirmed);
              break;
            }
            case 'topic-return': {
              const mainTopic = (state.extra?.mainTopic as string) ?? '';
              const subtopic = (state.extra?.subtopic as string) ?? '';
              judgeResult = await judgeTopicReturn(generatedResponse, mainTopic, subtopic);
              break;
            }
            default:
              judgeResult = await judgeFn(
                `Evaluate this agent response for the test case "${evalCase.id}":\n\nRESPONSE:\n${generatedResponse}\n\nCONTEXT:\n${evalCase.description}\n\nAnswer PASS or FAIL.`,
              );
          }

          const flakyNote = judgeResult.flaky ? ' [FLAKY]' : '';
          results.push({
            pass: judgeResult.pass,
            assertion,
            message: `LLM judge: ${judgeResult.pass ? 'PASS' : 'FAIL'}${flakyNote} — ${judgeResult.reason}`,
            expected: 'semantic check',
            actual: judgeResult.reason,
            durationMs: 0,
          });
        } catch (err) {
          results.push({
            pass: false,
            assertion,
            message: `LLM judge error: ${err instanceof Error ? err.message : String(err)}`,
            durationMs: 0,
          });
        }
        continue;
      }

      const result = await runAssertion(state, assertion);
      results.push(result);
    }

    // ── Determine Verdict ──
    const blockingFails = results.filter((r) => !r.pass && r.assertion.severity !== 'warning');
    const verdict: CaseVerdict = blockingFails.length > 0 ? 'fail' : 'pass';

    return {
      case: evalCase,
      verdict,
      assertions: results,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      case: evalCase,
      verdict: 'fail',
      assertions: results,
      durationMs: Date.now() - t0,
      skipReason: `Execution error: ${errMsg}`,
    };
  }
}

// ── Main ──

async function main(): Promise<void> {
  const opts = parseArgs();
  const allCases = await loadCases(opts.casesGlob!);

  let cases = filterByTier(allCases, opts.tier);
  cases = filterByTags(cases, opts.filterTags);

  if (cases.length === 0) {
    printHeader(opts.tier, 0);
    console.log('  No cases to run (empty suite or all filtered).\n');
    printSummary({
      tier: opts.tier,
      total: 0,
      pass: 0,
      fail: 0,
      skip: allCases.length,
      cases: [],
      durationMs: 0,
    });
    process.exit(0);
  }

  printHeader(opts.tier, cases.length);

  const caseResults: CaseResult[] = [];
  const suiteT0 = Date.now();

  for (const evalCase of cases) {
    printCaseStart(evalCase.id, evalCase.description ?? '(no description)');

    let sandbox: EvalSandbox | null = null;
    try {
      sandbox = await createSandbox(evalCase);
      const result = await executeCase(evalCase, sandbox);
      caseResults.push(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      caseResults.push({
        case: evalCase,
        verdict: 'fail',
        skipReason: `Sandbox setup error: ${errMsg}`,
        assertions: [],
        durationMs: 0,
      });
    } finally {
      if (sandbox) {
        await sandbox.destroy().catch(() => { /* best effort */ });
      }
    }

    printCaseEnd(caseResults[caseResults.length - 1]);
  }

  const pass = caseResults.filter((r) => r.verdict === 'pass').length;
  const fail = caseResults.filter((r) => r.verdict === 'fail').length;
  const skip = caseResults.filter((r) => r.verdict === 'skip').length;

  const suiteResult: SuiteResult = {
    tier: opts.tier,
    total: caseResults.length,
    pass,
    fail,
    skip,
    cases: caseResults,
    durationMs: Date.now() - suiteT0,
  };

  printSummary(suiteResult);

  if (opts.reportDir) {
    await writeReport(suiteResult, opts.reportDir);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[runner] Fatal error:', err);
  process.exit(1);
});
