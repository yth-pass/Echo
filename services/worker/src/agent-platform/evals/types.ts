/**
 * M7 Eval Runner — TypeScript types mirroring shared-agent/evals/schemas/eval-case.schema.json
 */

// ── Eval Case Definition ──

export type Mechanism = 'composer' | 'topic' | 'memory' | 'affection' | 'cross-cutting';

export type CaseTag =
  | 'style'
  | 'memory-leak'
  | 'hearsay'
  | 'topic-return'
  | 'smoke'
  | 'regression'
  | 'affection-label'
  | 'affection-delta'
  | 'affection-overlay';

export type AssertType = 'rule' | 'llm-judge';

export type Severity = 'blocking' | 'warning';

export type AssertionTarget =
  | 'composer-output-contains'
  | 'composer-output-not-contains'
  | 'composer-token-budget'
  | 'composer-layer-order'
  | 'memory-share-policy'
  | 'memory-observer-isolation'
  | 'memory-no-pii'
  | 'hearsay-promote-status'
  | 'hearsay-confidence-threshold'
  | 'hearsay-not-in-objective-facts'
  | 'topic-transition-type'
  | 'topic-main-persists'
  | 'topic-subtopic-stack'
  | 'topic-summary-length'
  | 'affection-label-eq'
  | 'affection-dimension-range'
  | 'affection-overlay-contains'
  | 'affection-overlay-not-contains';

export interface EvalAssertion {
  assertType: AssertType;
  target: AssertionTarget;
  expect: Record<string, unknown>;
  llmPrompt?: string;
  llmModel?: string;
  severity: Severity;
}

export interface SetupDef {
  observers: string[];
  memorySnapshot: string;
  styleOverrides?: Record<string, string>;
  profileOverrides?: Record<string, string>;
  affectionSeed?: Record<string, {
    label: string;
    dimensions: {
      familiarity?: number;
      warmth?: number;
      trust?: number;
      tension?: number;
    };
  }>;
}

export interface TurnDef {
  speaker_id: string;
  content: string;
  turn_index?: number;
  goldenRef?: string;
}

export interface InputDef {
  turns: TurnDef[];
  sessionId?: string;
  topicState?: {
    phase?: 'opening' | 'ongoing' | 'closing';
    main_topic?: string;
    active_subtopic?: string;
    focus?: 'main' | 'sub';
  };
}

export interface EvalCase {
  id: string;
  mechanism: Mechanism;
  tags: CaseTag[];
  description?: string;
  setup: SetupDef;
  input: InputDef;
  assertions: EvalAssertion[];
  requiresLlm: boolean;
  expectedDurationMs?: number;
  sourceSmokeTest?: string;
}

// ── Runtime Context ──

export interface EvalSandbox {
  caseId: string;
  baseDir: string;
  observers: string[];
  /** Clean up temp dir after case */
  destroy: () => Promise<void>;
}

/**
 * Snapshot of platform state captured after executing a case.
 * Passed into assertion engines so they can inspect composer output,
 * memory state, topic state, affection state, etc.
 */
export interface EvalState {
  /** Full assembled system prompt from composeSystemPrompt() */
  composerOutput?: string;
  /** Raw TopicJudgeOutput from the last judged turn */
  topicJudgeOutput?: Record<string, unknown>;
  /** Array of extracted objective facts (parsed JSON from objective_facts.jsonl) */
  objectiveFacts?: Record<string, unknown>[];
  /** Array of extracted preferences (parsed JSON from preferences.jsonl) */
  preferences?: Record<string, unknown>[];
  /** Current affection state file (parsed JSON from affection.json) */
  affectionState?: Record<string, unknown>;
  /** Affection overlay string rendered by AffectionOverlayService */
  affectionOverlay?: string;
  /** Free-form bag for future mechanisms */
  extra?: Record<string, unknown>;
}

// ── Assertion Result ──

export interface AssertionResult {
  pass: boolean;
  assertion: EvalAssertion;
  message: string;
  expected?: unknown;
  actual?: unknown;
  durationMs: number;
}

// ── Case Result ──

export type CaseVerdict = 'pass' | 'fail' | 'skip';

export interface CaseResult {
  case: EvalCase;
  verdict: CaseVerdict;
  skipReason?: string;
  assertions: AssertionResult[];
  durationMs: number;
}

// ── Suite Result ──

export interface SuiteResult {
  tier: 'deterministic' | 'llm';
  total: number;
  pass: number;
  fail: number;
  skip: number;
  cases: CaseResult[];
  durationMs: number;
}

// ── Runner Options ──

export interface RunnerOptions {
  /** 'deterministic' = skip requiresLlm cases; 'llm' = run all */
  tier: 'deterministic' | 'llm';
  /** Filter cases by tag(s). Empty = no filter. */
  filterTags?: CaseTag[];
  /** Glob for case JSON files (default: cases/*.json) */
  casesGlob?: string;
  /** Directory to write reports (default: reports/) */
  reportDir?: string;
  /** If true, also run assertions marked 'warning' as blocking */
  strict?: boolean;
}
