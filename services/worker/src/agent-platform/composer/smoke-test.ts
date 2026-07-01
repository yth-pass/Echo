/**
 * M1 Smoke Test for Prompt Composer
 *
 * Run with:
 *   cd services/worker
 *   npx ts-node src/agent-platform/composer/smoke-test.ts
 *
 * This test does NOT require Prisma, Redis, or any external services.
 * It validates that composeSystemPrompt correctly assembles L0 (safety), L1 (shared skill),
 * L2 (persona), and L8 (output contract) layers.
 */

import { composeSystemPrompt } from './prompt-composer';

interface TestCase {
  name: string;
  persona: string;
  boundaryClause: string;
  shouldContain: string[];
}

const testCases: TestCase[] = [
  {
    name: 'basic persona + boundary',
    persona: '温柔体贴的女生，喜欢猫，讨厌油腻的玩笑',
    boundaryClause: '，避免油腻话题',
    shouldContain: ['L0 always overrides', '约会分身', '用中文简短回复一句', '温柔', '猫'],
  },
  {
    name: 'minimal persona',
    persona: '直率男生',
    boundaryClause: '',
    shouldContain: ['L0 always overrides', '约会分身', '用中文简短回复一句', '直率'],
  },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const output = composeSystemPrompt({
    persona: tc.persona,
    boundaryClause: tc.boundaryClause,
  });

  let ok = true;
  const errors: string[] = [];

  // Verify L0 (safety) is loaded
  if (!output.includes('L0 always overrides')) {
    ok = false;
    errors.push('L0 safety layer not loaded');
  }

  // Verify L1 (shared skill) is loaded
  if (!output.includes('约会分身') && !output.includes('digital clone')) {
    ok = false;
    errors.push('L1 shared skill layer not loaded');
  }

  // Verify L8 output contract is present
  if (!output.includes('用中文简短回复一句')) {
    ok = false;
    errors.push('L8 output contract not found');
  }

  for (const phrase of tc.shouldContain) {
    if (!output.includes(phrase)) {
      ok = false;
      errors.push(`missing expected phrase: ${phrase}`);
    }
  }

  // Length check: system prompt should be substantial (L0 + L1 loaded)
  if (output.length < 800) {
    ok = false;
    errors.push('output too short, likely missing L0 or L1 layers');
  }

  if (ok) {
    console.log(`[PASS] ${tc.name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${tc.name}`);
    errors.forEach((e) => console.log(`       - ${e}`));
    console.log('       Output preview:', output.slice(0, 200).replace(/\n/g, ' '));
    failed++;
  }
}

console.log(`\nSmoke test finished: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All M1 composer constraints satisfied.');
}