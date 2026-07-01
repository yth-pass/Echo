/**
 * Reporter — generates JSON summary and prints human-readable results.
 */

import type { SuiteResult, CaseResult, AssertionResult } from './types';

export function printHeader(tier: string, totalCases: number): void {
  console.log('═══════════════════════════════════════════');
  console.log(`  Echo M7 Evals — ${tier} tier`);
  console.log(`  ${totalCases} case(s) loaded`);
  console.log('═══════════════════════════════════════════\n');
}

export function printCaseStart(caseId: string, description: string): void {
  console.log(`── ${caseId} ── ${description}`);
}

export function printCaseEnd(result: CaseResult): void {
  const icon = result.verdict === 'pass' ? '✓' : result.verdict === 'skip' ? '○' : '✗';
  const label = result.verdict.toUpperCase();
  console.log(`  ${icon} ${label}  (${result.durationMs}ms)`);

  for (const a of result.assertions) {
    printAssertion(a);
  }

  if (result.skipReason) {
    console.log(`  → skip reason: ${result.skipReason}`);
  }

  console.log('');
}

function printAssertion(a: AssertionResult): void {
  if (a.pass) {
    console.log(`    ✓ ${a.message}`);
  } else {
    console.log(`    ✗ ${a.message}`);
    if (a.expected !== undefined || a.actual !== undefined) {
      console.log(`      expected: ${a.expected ?? '(none)'}`);
      console.log(`      actual:   ${a.actual ?? '(none)'}`);
    }
  }
}

export function printSummary(result: SuiteResult): void {
  console.log('═══════════════════════════════════════════');
  console.log(`  TOTAL:  ${result.total}`);
  console.log(`  PASS:   ${result.pass}`);
  console.log(`  FAIL:   ${result.fail}`);
  console.log(`  SKIP:   ${result.skip}`);
  console.log(`  TIME:   ${result.durationMs}ms`);
  console.log('═══════════════════════════════════════════');

  if (result.fail > 0) {
    console.log('\n✗ FAILURES:');
    for (const c of result.cases) {
      if (c.verdict === 'fail') {
        console.log(`  ${c.case.id}: ${c.case.description ?? '(no description)'}`);
        for (const a of c.assertions.filter((x: AssertionResult) => !x.pass)) {
          console.log(`    ✗ ${a.message}`);
        }
      }
    }
  }
}

/**
 * Write a JSON report to the report directory.
 */
export async function writeReport(
  result: SuiteResult,
  reportDir: string,
): Promise<string> {
  const { promises: fs } = await import('fs');
  const path = await import('path');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${result.tier}-${result.fail > 0 ? 'FAIL' : 'PASS'}.json`;
  const filePath = path.join(reportDir, filename);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\nReport: ${filePath}`);
  return filePath;
}
