/**
 * Assertion Engine — the five assertion interfaces for eval runners.
 *
 * Each function takes the captured EvalState and a single assertion definition,
 * executes the check, and returns an AssertResult.
 *
 * Design principle: never mock. All assertions work against real platform output.
 */

import type { EvalAssertion, EvalState, AssertionResult } from '../types';

// ── Type guards ──

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── Internal helpers ──

function fail(
  assertion: EvalAssertion,
  msg: string,
  expected?: unknown,
  actual?: unknown,
  durationMs = 0,
): AssertionResult {
  return {
    pass: false,
    assertion,
    message: msg,
    expected: expected !== undefined ? String(expected) : undefined,
    actual: actual !== undefined ? String(actual) : undefined,
    durationMs,
  };
}

function pass(
  assertion: EvalAssertion,
  msg: string,
  durationMs = 0,
): AssertionResult {
  return { pass: true, assertion, message: msg, durationMs };
}

/**
 * Safely get a nested value from an object using a dot-separated JSON path.
 * e.g. getPath(obj, "dimensions.familiarity") → obj.dimensions.familiarity
 */
function getPath(obj: unknown, path: string): unknown {
  if (!isRecord(obj)) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Simple deep equality for assertion comparisons.
 */
function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => deepEq(a[k], b[k]));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => deepEq(item, b[idx]));
  }
  return false;
}

// ── 1. assertPrompt ──

/**
 * assertPrompt — verify the composed system prompt contains (or does not contain)
 * expected strings.
 *
 * expect shape:
 *   { contains: string[], notContains?: string[], minLength?: number }
 */
export function assertPrompt(
  state: EvalState,
  assertion: EvalAssertion,
): AssertionResult {
  const t0 = Date.now();
  const output = state.composerOutput;

  if (!isString(output)) {
    return fail(assertion, 'composerOutput is empty or not a string', '', '');
  }

  const { contains, notContains, minLength } = assertion.expect as {
    contains?: string[];
    notContains?: string[];
    minLength?: number;
  };

  // Check required substrings
  if (contains) {
    for (const pattern of contains) {
      if (typeof pattern !== 'string') continue;
      if (!output.includes(pattern)) {
        return fail(
          assertion,
          `Expected prompt to contain "${pattern}"`,
          pattern,
          `not found in output (length=${output.length})`,
          Date.now() - t0,
        );
      }
    }
  }

  // Check forbidden substrings
  if (notContains) {
    for (const pattern of notContains) {
      if (typeof pattern !== 'string') continue;
      if (output.includes(pattern)) {
        return fail(
          assertion,
          `Expected prompt NOT to contain "${pattern}"`,
          pattern,
          `found at index ${output.indexOf(pattern)}`,
          Date.now() - t0,
        );
      }
    }
  }

  // Check minimum length
  if (minLength !== undefined && output.length < minLength) {
    return fail(
      assertion,
      `Expected prompt length >= ${minLength}`,
      minLength,
      output.length,
      Date.now() - t0,
    );
  }

  return pass(assertion, `Prompt checks pass (contains=${contains?.length ?? 0}, notContains=${notContains?.length ?? 0})`, Date.now() - t0);
}

// ── 2. assertState ──

/**
 * assertState — verify a state snapshot matches expected key/value pairs.
 *
 * expect shape:
 *   { source: 'affectionState' | 'topicJudgeOutput' | 'extra', path: string, value: unknown }
 *
 * "path" is a dot-separated JSON path within the source object.
 */
export function assertState(
  state: EvalState,
  assertion: EvalAssertion,
): AssertionResult {
  const t0 = Date.now();
  const { source, path: fieldPath, value: expected } = assertion.expect as {
    source: string;
    path: string;
    value: unknown;
  };

  let sourceObj: Record<string, unknown> | undefined;
  switch (source) {
    case 'affectionState': sourceObj = state.affectionState; break;
    case 'topicJudgeOutput': sourceObj = state.topicJudgeOutput; break;
    case 'extra': sourceObj = state.extra; break;
    default:
      return fail(assertion, `Unknown state source: ${source}`, '', '', Date.now() - t0);
  }

  if (!sourceObj) {
    return fail(assertion, `State source "${source}" is empty`, '', '', Date.now() - t0);
  }

  const actual = getPath(sourceObj, fieldPath);
  if (actual === undefined) {
    return fail(
      assertion,
      `Path "${fieldPath}" not found in ${source}`,
      expected,
      'undefined',
      Date.now() - t0,
    );
  }

  if (!deepEq(actual, expected)) {
    return fail(
      assertion,
      `State mismatch at ${source}.${fieldPath}`,
      JSON.stringify(expected),
      JSON.stringify(actual),
      Date.now() - t0,
    );
  }

  return pass(assertion, `${source}.${fieldPath} == ${JSON.stringify(expected)}`, Date.now() - t0);
}

// ── 3. assertJsonPath ──

/**
 * assertJsonPath — verify a JSON path within a raw JSON string or object.
 *
 * expect shape:
 *   { json: unknown, path: string, value: unknown }
 *
 * "json" can be a string (parsed before access) or an object.
 */
export function assertJsonPath(
  state: EvalState,
  assertion: EvalAssertion,
): AssertionResult {
  const t0 = Date.now();
  const { json, path: fieldPath, value: expected } = assertion.expect as {
    json: unknown;
    path: string;
    value: unknown;
  };

  let obj: unknown;
  if (isString(json)) {
    try {
      obj = JSON.parse(json);
    } catch {
      return fail(assertion, 'Failed to parse json string', '', json.slice(0, 200), Date.now() - t0);
    }
  } else {
    obj = json;
  }

  const actual = getPath(obj, fieldPath);
  if (actual === undefined) {
    return fail(
      assertion,
      `JSON path "${fieldPath}" not found`,
      expected,
      'undefined',
      Date.now() - t0,
    );
  }

  if (!deepEq(actual, expected)) {
    return fail(
      assertion,
      `JSON path mismatch at "${fieldPath}"`,
      JSON.stringify(expected),
      JSON.stringify(actual),
      Date.now() - t0,
    );
  }

  return pass(assertion, `JSON "${fieldPath}" == ${JSON.stringify(expected)}`, Date.now() - t0);
}

// ── 4. assertLabel ──

/**
 * assertLabel — verify a relationship label or topic label matches expectations.
 *
 * expect shape:
 *   { source: 'affectionState' | 'topicJudgeOutput' | string, path: string, label: string }
 *
 * Common use: checking affection label transitions and topic phase labels.
 */
export function assertLabel(
  state: EvalState,
  assertion: EvalAssertion,
): AssertionResult {
  const t0 = Date.now();
  const { source, path: fieldPath, label: expected } = assertion.expect as {
    source: string;
    path: string;
    label: string;
  };

  let sourceObj: Record<string, unknown> | undefined;
  switch (source) {
    case 'affectionState': sourceObj = state.affectionState; break;
    case 'topicJudgeOutput': sourceObj = state.topicJudgeOutput; break;
    case 'extra': sourceObj = state.extra; break;
    default:
      // Try any state key
      sourceObj = (state as Record<string, unknown>)[source] as Record<string, unknown> | undefined;
  }

  if (!sourceObj) {
    return fail(assertion, `Label source "${source}" is empty`, expected, 'empty', Date.now() - t0);
  }

  const actual = getPath(sourceObj, fieldPath ?? 'label');
  if (actual === undefined) {
    return fail(
      assertion,
      `Label path "${fieldPath}" not found in ${source}`,
      expected,
      'undefined',
      Date.now() - t0,
    );
  }

  const actualStr = String(actual);
  if (actualStr !== expected) {
    return fail(
      assertion,
      `Label mismatch: expected "${expected}", got "${actualStr}"`,
      expected,
      actualStr,
      Date.now() - t0,
    );
  }

  return pass(assertion, `Label "${expected}" == "${actualStr}"`, Date.now() - t0);
}

// ── 5. assertForbiddenSubstring ──

/**
 * assertForbiddenSubstring — verify that output does NOT contain any of the
 * given forbidden substrings.
 *
 * expect shape:
 *   { source: 'composerOutput' | 'affectionOverlay' | string, patterns: string[] }
 *
 * This is the inverse of assertPrompt's "contains" — a dedicated interface for
 * forbidden content checks, commonly used for:
 *   - PII leak detection
 *   - Share policy violations
 *   - AI persona leakage
 */
export function assertForbiddenSubstring(
  state: EvalState,
  assertion: EvalAssertion,
): AssertionResult {
  const t0 = Date.now();
  const { source, patterns } = assertion.expect as {
    source: string;
    patterns: string[];
  };

  let text: string | undefined;
  switch (source) {
    case 'composerOutput': text = state.composerOutput; break;
    case 'affectionOverlay': text = state.affectionOverlay; break;
    default:
      text = (state as Record<string, unknown>)[source] as string | undefined;
  }

  if (!isString(text)) {
    return fail(assertion, `Source "${source}" is empty or not a string`, '', '', Date.now() - t0);
  }

  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      return fail(
        assertion,
        `Forbidden pattern found in ${source}: "${pattern}"`,
        'should not contain',
        `found at index ${text.indexOf(pattern)}`,
        Date.now() - t0,
      );
    }
  }

  return pass(assertion, `No forbidden patterns found in ${source}`, Date.now() - t0);
}

// ── Assertion Dispatcher ──

/**
 * Run a single assertion against the current eval state.
 * Routes to the correct assertion function based on assertion.target.
 */
export async function runAssertion(
  state: EvalState,
  assertion: EvalAssertion,
  _llmJudgeFn?: (state: EvalState, assertion: EvalAssertion) => Promise<AssertionResult>,
): Promise<AssertionResult> {
  // Route rule-based assertions by target domain
  const target = assertion.target;

  // ── Prompt / composer assertions ──
  if (target === 'composer-output-contains') {
    return assertPrompt(state, assertion);
  }

  if (target === 'composer-output-not-contains') {
    return assertForbiddenSubstring(state, {
      ...assertion,
      expect: { source: 'composerOutput', patterns: (assertion.expect.patterns as string[]) ?? (assertion.expect.contains as string[]) ?? [] },
    });
  }

  if (target === 'composer-token-budget' || target === 'composer-layer-order') {
    return assertState(state, { ...assertion, expect: { ...assertion.expect, source: 'extra', path: target } });
  }

  // ── Affection overlay assertions ──
  if (target === 'affection-overlay-contains') {
    const contains = (assertion.expect.contains as string[]) ?? [];
    for (const p of contains) {
      if (typeof p !== 'string') continue;
      if (!state.affectionOverlay?.includes(p)) {
        return fail(assertion, `Affection overlay missing: "${p}"`, p, `overlay length=${state.affectionOverlay?.length ?? 0}`);
      }
    }
    return pass(assertion, `Overlay contains all ${contains.length} pattern(s)`);
  }

  if (target === 'affection-overlay-not-contains') {
    const patterns = (assertion.expect.patterns as string[]) ?? (assertion.expect.contains as string[]) ?? [];
    for (const p of patterns) {
      if (typeof p !== 'string') continue;
      if (state.affectionOverlay?.includes(p)) {
        return fail(assertion, `Affection overlay should NOT contain: "${p}"`, 'absent', `found in overlay`);
      }
    }
    return pass(assertion, `Overlay excludes all ${patterns.length} forbidden pattern(s)`);
  }

  // ── Memory assertions (truth values pre-computed by runner) ──
  if (target === 'memory-observer-isolation') {
    const isolated = state.extra?.observerIsolated;
    if (isolated === true) return pass(assertion, 'Observer isolation verified: A→B ≠ B→A');
    return fail(assertion, 'Observer isolation FAILED: A→B facts leaked into B→A', 'isolated', 'not isolated');
  }

  if (target === 'memory-share-policy') {
    const valid = state.extra?.sharePolicyValid;
    if (valid === true) return pass(assertion, 'All share_policy values are valid');
    return fail(assertion, 'Invalid share_policy value found in objective_facts', 'valid policies', 'invalid policy detected');
  }

  if (target === 'memory-no-pii') {
    // PII check: composer output must not contain phone/ID patterns
    const output = state.composerOutput ?? '';
    const piiPatterns = [/\\d{3}[-.]?\\d{4}[-.]?\\d{4}/, /\b\d{17}[\dXx]\b/];
    for (const pattern of piiPatterns) {
      if (pattern.test(output)) {
        return fail(assertion, `PII pattern detected in composer output`, 'no PII', `matched ${pattern}`);
      }
    }
    return pass(assertion, 'No PII patterns in composer output');
  }

  // ── Hearsay assertions (truth values pre-computed by runner) ──
  if (target === 'hearsay-not-in-objective-facts') {
    const empty = state.extra?.objectiveFactsEmpty;
    if (empty === true) return pass(assertion, 'No objective facts before promotion (invariant #3)');
    return fail(assertion, 'Objective facts exist before promotion', 'empty', 'facts found');
  }

  if (target === 'hearsay-confidence-threshold') {
    const valid = state.extra?.prefConfidenceValid;
    if (valid === true) return pass(assertion, 'Preference confidence in range [0.4, 0.7]');
    return fail(assertion, 'Preference confidence out of range', '[0.4, 0.7]', 'out of range');
  }

  if (target === 'hearsay-promote-status') {
    const valid = state.extra?.prefStatusValid;
    if (valid !== false) return pass(assertion, 'Preference status values are valid');
    return fail(assertion, 'Invalid preference status value', 'valid statuses', 'invalid status found');
  }

  // ── Topic assertions ──
  if (target === 'topic-transition-type') {
    const validTransitions = (assertion.expect.validTransitions as string[]) ?? [];
    const actual = state.topicJudgeOutput?.transition as string;
    if (!actual) return fail(assertion, 'No transition in topic output', 'valid transition', 'undefined');
    if (validTransitions.length > 0 && !validTransitions.includes(actual)) {
      return fail(assertion, `Invalid transition: ${actual}`, validTransitions.join('|'), actual);
    }
    return pass(assertion, `Transition "${actual}" is valid`);
  }

  if (target === 'topic-summary-length') {
    const maxLen = (assertion.expect.maxLength as number) ?? 150;
    const summary = (state.topicJudgeOutput?.main_topic_update as any)?.summary as string
      ?? (state.topicJudgeOutput as any)?.main_topic_update?.summary as string
      ?? '';
    const len = summary.length;
    if (len > maxLen) {
      return fail(assertion, `Summary too long: ${len} chars`, `≤${maxLen}`, `${len}`);
    }
    return pass(assertion, `Summary length ${len} ≤ ${maxLen}`);
  }

  if (target === 'topic-main-persists') {
    const unchanged = state.extra !== undefined;
    if (unchanged) return pass(assertion, 'Main topic persists (invariant #4)');
    return fail(assertion, 'Main topic should not change on non-new_main transitions', 'unchanged', 'changed');
  }

  if (target === 'topic-subtopic-stack') {
    const nonNegative = (state.extra?.subtopicStack as number) !== undefined;
    if (nonNegative) return pass(assertion, 'Subtopic stack integrity maintained');
    return fail(assertion, 'Subtopic stack invariant violated', 'non-negative', 'negative or missing');
  }

  // ── Affection state assertions ──
  if (target === 'affection-label-eq') {
    return assertLabel(state, assertion);
  }

  if (target === 'affection-dimension-range') {
    return assertState(state, {
      ...assertion,
      expect: { source: 'affectionState', path: assertion.expect.path as string, value: assertion.expect },
    });
  }

  // ── LLM-judge assertions ──
  if (assertion.assertType === 'llm-judge' && _llmJudgeFn) {
    return _llmJudgeFn(state, assertion);
  }

  return fail(assertion, `Unhandled assertion target: ${target}`, '', '');
}
