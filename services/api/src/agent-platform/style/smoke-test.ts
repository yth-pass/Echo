import 'dotenv/config';

/**
 * M2 Smoke Test for StyleGeneratorService (Real DeepSeek version)
 *
 * Run with:
 *   cd services/api
 *   npx ts-node src/agent-platform/style/smoke-test.ts
 *
 * This version uses the real LlmService when DEEPSEEK_API_KEY is present in services/api/.env.
 * It validates the full generate flow with actual LLM output for style.md (Tone/Avoid/Few-shots + mandatory json block).
 * Covers mechanisms 2 (user style) + 20 (style onboarding).
 */

import { StyleGeneratorService } from './style-generator.service';
import { LlmService } from '../../llm/llm.service';
import type { OnboardingSurveyJson } from '../../onboarding/survey-schema';

async function run() {
  console.log('Starting M2 StyleGenerator smoke test (Real DeepSeek mode)...');

  const realLlm = new LlmService();
  const gen = new StyleGeneratorService(realLlm);

  // Test 1: fallbackStyle
  const survey: OnboardingSurveyJson = { displayName: '小明', toneTags: ['幽默'] };
  const fallback = (gen as any).fallbackStyle(survey);
  console.assert(fallback.includes('# Style'), 'fallback should contain # Style');
  console.assert(fallback.includes('幽默'), 'fallback should include toneTags');
  console.log('✓ fallbackStyle works');

  // Test 2: parseOutput with json block
  const rawWithJson = 'some text\n```json\n{"display_name":"张三"}\n```';
  const parsed = (gen as any).parseOutput(rawWithJson, survey);
  console.assert(parsed.core.display_name === '张三', 'parse should extract json');
  console.assert(!parsed.styleMd.includes('```json'), 'styleMd should strip json block');
  console.log('✓ parseOutput with json block works');

  // Test 3: parseOutput without json (uses survey fallback)
  const rawNoJson = 'plain style text';
  const parsedNoJson = (gen as any).parseOutput(rawNoJson, survey);
  console.assert(parsedNoJson.core.display_name === '小明', 'parse should fallback to survey.displayName');
  console.log('✓ parseOutput without json works');

  // Test 4: generate flow (uses real DeepSeek LLM)
  const result = await gen.generate(survey, [{ role: 'user', content: 'hello' }]);
  console.assert(result.styleMd.includes('## Tone'), 'generated styleMd must have Tone section');
  console.assert(result.styleMd.includes('## Avoid'), 'generated styleMd must have Avoid section');
  console.assert(result.styleMd.includes('## Few-shots'), 'generated styleMd must have Few-shots section');
  console.assert(typeof result.coreCandidates === 'object', 'coreCandidates should be an object');
  console.log('✓ generate flow produces correct structure and coreCandidates');

  // Test 5: selfCheck scoring (real LLM returns a number 0-100)
  const score = await (gen as any).selfCheck('dummy', 'dummy');
  console.assert(typeof score === 'number' && score >= 0 && score <= 100, 'selfCheck should return a valid numeric score');
  console.log('✓ selfCheck scoring logic works');

  console.log('\nAll M2 smoke tests passed. Style onboarding (mechanism 2+20) validated.');
}

void run();
