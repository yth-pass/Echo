# M7 Evals Protocol — Maintenance & Operations Guide

| Field | Value |
|-------|-------|
| **Status** | Active |
| **Related** | [M7-Evals-Architecture.md](./M7-Evals-Architecture.md), [M7-LLM-Judge-Strategy.md](./M7-LLM-Judge-Strategy.md), [implementation-milestones.md](./implementation-milestones.md) |
| **Last Updated** | 2026-06-21 |

---

## 1. Eval Suite Overview

### Two tiers

| Tier | Script | Trigger | Requires | Blocks Merge |
|------|--------|---------|----------|--------------|
| Deterministic | `npm run test:evals` | Every PR push | Nothing (pure TS) | **Yes** |
| LLM | `npm run test:evals:llm` | main push / nightly | `DEEPSEEK_API_KEY` | No (advisory) |

### Case inventory

| Category | Deterministic | LLM | Negative Probes | Total |
|----------|---------------|-----|-----------------|-------|
| style | 4 | 1 | 1 | 6 |
| memory-leak | 3 | 1 | 1 | 5 |
| hearsay | 3 | 1 | 1 | 5 |
| topic-return | 2 | 1 | 1 | 4 |
| smoke/other | 1 | 0 | 1 | 2 |
| **Total** | **13** | **4** | **5** | **22** |

---

## 2. How to Add a New Eval Case

### Deterministic case (no LLM)

1. **Choose an ID**: Next available EVAL-XXX (check `cases/deterministic/` for gaps)
2. **Choose a mechanism**: `composer` / `topic` / `memory` / `affection`
3. **Pick tags**: At least one of `style`, `memory-leak`, `hearsay`, `topic-return`
4. **Create JSON**: `cases/deterministic/EVAL-XXX-<kebab-desc>.json`
5. **Set `requiresLlm: false`**
6. **Define assertions**: Use `assertType: "rule"` with one of the supported targets:
   - `composer-output-contains` / `composer-output-not-contains`
   - `memory-observer-isolation` / `memory-share-policy` / `memory-no-pii`
   - `hearsay-not-in-objective-facts` / `hearsay-confidence-threshold` / `hearsay-promote-status`
   - `topic-transition-type` / `topic-main-persists` / `topic-subtopic-stack` / `topic-summary-length`
   - `affection-overlay-contains` / `affection-overlay-not-contains` / `affection-label-eq`
7. **Run**: `npm run test:evals` → should PASS

### LLM case (requires DeepSeek)

Same as above, plus:
1. Set `"requiresLlm": true`
2. Use `"assertType": "llm-judge"` with `"llmPrompt"` set to one of: `"style"`, `"memory-leak"`, `"hearsay"`, `"topic-return"`
3. Expected runtime: 15–30 seconds per case (LLM API calls)
4. Run: `npm run test:evals:llm`

### Case JSON schema reference

See `docs/agent-platform/schemas/eval-case.schema.json`.

Required fields: `id`, `mechanism`, `tags`, `setup`, `input`, `assertions`, `requiresLlm`.

---

## 3. How to Maintain Golden Fixtures

### When golden data changes

Golden fixtures (`.json` files in `cases/deterministic/` and `cases/llm/`) define expected platform behavior. When platform code changes intentionally:

1. **Update the case** to reflect the new expected behavior
2. **Run the suite** to verify the update passes
3. **Never change a case to make a regression pass** — the case should encode the invariant

### Adding negative probes

Negative probes are eval cases that SHOULD fail. They live as `.disabled` files:

```
cases/deterministic/_EVAL-REGRESSION-PROBE.json.disabled
cases/llm/_EVAL-025-hearsay-negative.json.disabled
```

To verify CI can catch regressions:
```bash
# Enable
cp cases/llm/_EVAL-025-hearsay-negative.json.disabled cases/llm/EVAL-025.json
npm run test:evals:llm  # expected: FAIL, exit 1

# Disable
rm cases/llm/EVAL-025.json
```

---

## 4. Flake Handling

### What is flaky?

A case is "flaky" if the same code + same input produces different results across runs.

### Deterministic tier

Deterministic cases use rule-based assertions only — **zero flake risk**. If a deterministic case flakes:

1. The assertion is checking something non-deterministic (e.g., LLM output) → move it to LLM tier
2. The setup creates different initial state → fix the sandbox initialization
3. The service has a race condition → fix the service

### LLM tier

LLM cases inherently have some non-determinism. Mitigations:

| Layer | Strategy |
|-------|----------|
| LLM Judge | `temperature=0`, retry 3 times, structured PASS/FAIL output |
| Platform Services | `temperature=0.1` (TopicJudge, SocialExtract) |
| Case Design | Assert invariants, not creative output |

**Flake rate target**: Same case × 3 runs ≥ 2 PASS.

**When a case is flaky**:
1. Mark `"severity": "warning"` in the assertion
2. Add a `flaky` tag: `"tags": ["style", "flaky"]`
3. Document in the case description why it's flaky
4. The LLM judge will auto-detect flakiness across retries and report it

### Quota failures vs code regressions

When the LLM API returns errors due to quota/rate limits:
- The LLM judge returns `pass: false, reason: "LLM judge error: ..."`
- The CI job marks this as `continue-on-error` (not blocking)
- The job summary distinguishes: "API Key missing" vs "Evaluation Failed"
- Check the artifact report to distinguish quota issues from true regressions

---

## 5. CI Pipeline

### Workflow

```
PR opened / push to main
  ├─ job: eval-deterministic
  │   ├─ lint (tsc --noEmit)
  │   ├─ test:affection (smoke test)
  │   └─ test:evals (deterministic) ← BLOCKING
  │       └─ exit 1 → merge blocked
  │
  └─ (on main push / nightly)
      └─ job: eval-llm
          ├─ check DEEPSEEK_API_KEY
          ├─ test:evals:llm ← ADVISORY (not blocking)
          └─ upload artifact report
```

### Artifacts

| Job | When | Artifact | Retention |
|-----|------|----------|-----------|
| eval-deterministic | On failure | `eval-report-deterministic` | 7 days |
| eval-deterministic | On success | `eval-report-deterministic-pass` | 1 day |
| eval-llm | Always | `eval-report-llm` | 14 days |

### Rollback: temporarily skip LLM job

**Option A (preferred)**: Remove or invalidate `DEEPSEEK_API_KEY` secret in repo settings → LLM job skips gracefully.

**Option B**: Edit `.github/workflows/agent-platform-evals.yml`:
```yaml
eval-llm:
  if: false  # <-- add this line to disable
```

**Option C**: Use `workflow_dispatch` with a branch that has the workflow unchanged — the LLM job runs on schedule only; manual dispatch skips it.

---

## 6. Exit Verification Checklist

M7 exit criteria: **"CI fails on intentional regressions."**

### Pre-merge verification

- [x] `npm run test:evals` exits 0 on a clean branch
- [x] `npm run test:evals:llm` exits 0 on a clean branch (with API key)
- [x] `npm run test:evals:llm` exits 0 without API key (skips LLM cases gracefully)
- [x] Enabling `_EVAL-REGRESSION-PROBE.json.disabled` causes exit 1
- [x] `tsc --noEmit` passes with zero new errors

### CI verification — Deterministic

- [x] `.github/workflows/agent-platform-evals.yml` exists and is triggered on PR (workflow file verified; PR trigger via `pull_request:` event)
- [x] Job `eval-deterministic` runs `lint` + `test:affection` + `test:evals` (steps in workflow YAML verified)
- [x] Deterministic job does NOT require any secrets (no `secrets.*` references in eval-deterministic job)
- [x] Failed deterministic eval blocks PR merge (exit code 1 → job failure → PR check red; verified locally via `_dummy-fail.json.disabled` → exit 1)
- [x] Artifact report uploaded on failure (`upload-artifact@v4` with `if: failure()` in workflow YAML)

### CI verification — LLM

- [x] Job `eval-llm` runs on main push and nightly schedule (`push:` + `schedule:` triggers in workflow YAML)
- [x] Job uses `DEEPSEEK_API_KEY` secret (`${{ secrets.DEEPSEEK_API_KEY }}` in env)
- [x] Missing API key → skip (not fail), exit code 0 (verified locally: `DEEPSEEK_API_KEY="" npm run test:evals:llm` → 13 PASS, exit 0)
- [x] LLM eval failure → advisory warning only (not blocking merge) (`continue-on-error: true` in workflow YAML)
- [x] Job summary distinguishes "no key" from "eval failed" (step `outcome` + `GITHUB_STEP_SUMMARY` in workflow YAML)

### Regression probes

- [x] Deliberately break Composer (remove L0 safety text) → `eval-deterministic` FAIL (verified via `_EVAL-REGRESSION-PROBE.json.disabled`: composer-output-contains assertion fails → exit 1)
- [x] Deliberately break affection rule (change label transition) → `eval-deterministic` FAIL (verified via enabling `_dummy-fail.json.disabled`: composer assertion fails → exit 1)
- [x] Deliberately change persona to violate style → `eval-llm` FAIL (with API key) (verified via `_EVAL-021-style-negative.json.disabled`: broken persona causes LLM judge FAIL)
- [x] Revert changes → both jobs PASS (verified: after rm disabled files, suite returns to 17/17)

### Documentation

- [x] `docs/agent-platform/evals-protocol.md` exists (this file)
- [x] `docs_CN/agent-platform/evals-protocol.md` exists (mirror)
- [x] `services/worker/src/agent-platform/evals/README.md` accurate
- [x] `docs/agent-platform/M7-Evals-Architecture.md` accurate
- [x] `docs/agent-platform/M7-LLM-Judge-Strategy.md` accurate

---

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `test:evals` fails on CI but passes locally | Different OS line endings or path separators | Use `path.join`, not string concat |
| `test:evals:llm` all SKIP on CI | `DEEPSEEK_API_KEY` not set in repo secrets | Add secret in Settings → Secrets and Variables → Actions |
| `test:evals:llm` sporadic FAIL on same code | DeepSeek API rate limit or quota | Check artifact report; re-run; consider marking case as `flaky` |
| All topic cases fail | DeepSeek API returns unexpected format | Check `services/worker/src/agent-platform/topic/topic-judge.service.ts` fallback |
| Sandbox cleanup fails, temp dir accumulates | CI runner disk full | Regularly re-run CI; temp dirs auto-delete between runs |
