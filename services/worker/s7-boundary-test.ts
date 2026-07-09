import { formatBoundariesClause } from './src/clone-runtime/boundaries';

// v2.2 rich format: socialBoundaries + contradictions as prose strings
// (matches what personaSketch.sections provides)
const v22 = {
  socialBoundaries: '不要在我面前提她的前任；不要翻看我的手机；吵架的时候不要冷暴力',
  contradictions: '嘴上说不在乎，但其实很在意别人的评价；说自己内向，但在朋友面前很疯',
  handoff: true,
};

console.log('=== v2.2 boundaryClause ===');
const clause = formatBoundariesClause(v22);
console.log(clause);

const checks: [string, boolean][] = [
  ['包含社交边界标题', clause.includes('社交边界')],
  ['包含边界内容:前任', clause.includes('不要在我面前提她的前任')],
  ['包含边界内容:手机', clause.includes('不要翻看我的手机')],
  ['包含边界内容:冷暴力', clause.includes('吵架的时候不要冷暴力')],
  ['包含内在矛盾标题', clause.includes('内在矛盾')],
  ['包含矛盾内容:在乎', clause.includes('嘴上说不在乎')],
  ['包含矛盾内容:内向', clause.includes('说自己内向')],
  ['包含handoff', clause.includes('handoff')],
  ['包含【标记', clause.includes('【')],
];

let allPass = true;
console.log('\n=== v2.2 rich format 验证 ===');
for (const [name, pass] of checks) {
  console.log(pass ? '✅' : '❌', name);
  if (!pass) allPass = false;
}

// Empty boundaries
const empty = formatBoundariesClause({});
console.log('\n空边界:', JSON.stringify(empty));
const emptyOk = empty === '';
console.log(emptyOk ? '✅ 空边界返回空字符串' : '❌ 空边界应返回空字符串');
if (!emptyOk) allPass = false;

// Legacy format: forbiddenWords + topicsToAvoid as array (pre-fix finalize format)
const legacy = formatBoundariesClause({
  forbiddenWords: ['政治', '宗教'],
  topicsToAvoid: ['前任', '薪资'],
  handoff: true,
});
console.log('\n=== Legacy array format ===');
console.log(legacy);
const legacyChecks: [string, boolean][] = [
  ['Legacy forbiddenWords: 政治', legacy.includes('政治')],
  ['Legacy forbiddenWords: 宗教', legacy.includes('宗教')],
  ['Legacy topicsToAvoid array: 前任', legacy.includes('前任')],
  ['Legacy topicsToAvoid array: 薪资', legacy.includes('薪资')],
  ['Legacy handoff', legacy.includes('handoff')],
];
for (const [name, pass] of legacyChecks) {
  console.log(pass ? '✅' : '❌', name);
  if (!pass) allPass = false;
}

// Legacy format: topicsToAvoid as string
const legacyStr = formatBoundariesClause({ topicsToAvoid: '不要讨论政治', handoff: false });
console.log('\n=== Legacy string format ===');
console.log(legacyStr);
const strOk = legacyStr.includes('不要讨论政治');
console.log(strOk ? '✅ Legacy topicsToAvoid string' : '❌ Legacy topicsToAvoid string');
if (!strOk) allPass = false;

console.log(`\n=== S7: ${allPass ? 'PASS ✅' : 'FAIL ❌'} ===`);
process.exit(allPass ? 0 : 1);
