/**
 * S7 验证: boundaries.ts 的 formatBoundariesClause 正确处理 v2.2 格式数据
 * 验证 socialBoundaries + contradictions 是否被注入到 boundaryClause 中
 */
const { formatBoundariesClause } = require('./src/clone-runtime/boundaries');

// 模拟 finalize 后存入数据库的 boundariesJson
const v22Boundaries = {
  socialBoundaries: [
    '不要在我面前提她的前任',
    '不要翻看我的手机',
    '吵架的时候不要冷暴力'
  ],
  contradictions: [
    '嘴上说不在乎，但其实很在意别人的评价',
    '说自己内向，但在朋友面前很疯'
  ],
  handoff: true
};

console.log('=== v2.2 格式 boundaryClause ===');
const clause = formatBoundariesClause(v22Boundaries);
console.log(clause);

// 验证关键内容
const checks = [
  { name: '包含社交边界标题', pass: clause.includes('社交边界') },
  { name: '包含具体边界1', pass: clause.includes('不要在我面前提她的前任') },
  { name: '包含具体边界2', pass: clause.includes('不要翻看我的手机') },
  { name: '包含具体边界3', pass: clause.includes('吵架的时候不要冷暴力') },
  { name: '包含内在矛盾标题', pass: clause.includes('内在矛盾') },
  { name: '包含矛盾1', pass: clause.includes('嘴上说不在乎') },
  { name: '包含矛盾2', pass: clause.includes('说自己内向') },
  { name: '包含handoff标记', pass: clause.includes('handoff') },
  { name: '包含【标记(v2.2 rich format)', pass: clause.includes('【') },
];

let allPass = true;
console.log('\n=== 验证结果 ===');
for (const c of checks) {
  const status = c.pass ? '✅' : '❌';
  console.log(`${status} ${c.name}`);
  if (!c.pass) allPass = false;
}

// 测试空边界
console.log('\n=== 空边界测试 ===');
const emptyClause = formatBoundariesClause({});
console.log(`空边界输出: "${emptyClause}"`);
console.log(`${emptyClause === '' ? '✅' : '❌'} 空边界返回空字符串`);

// 测试 legacy 格式
console.log('\n=== Legacy 格式测试 ===');
const legacyBoundaries = {
  forbiddenWords: ['政治', '宗教'],
  topicsToAvoid: ['前任', '薪资']
};
const legacyClause = formatBoundariesClause(legacyBoundaries);
console.log(`Legacy 输出: "${legacyClause}"`);
const legacyHasForbidden = legacyClause.includes('政治');
const legacyHasTopics = legacyClause.includes('前任');
console.log(`${legacyHasForbidden ? '✅' : '❌'} 包含 forbiddenWords`);
console.log(`${legacyHasTopics ? '✅' : '❌'} 包含 topicsToAvoid`);

console.log(`\n=== S7 总结: ${allPass ? 'PASS ✅' : 'FAIL ❌'} ===`);
process.exit(allPass ? 0 : 1);
