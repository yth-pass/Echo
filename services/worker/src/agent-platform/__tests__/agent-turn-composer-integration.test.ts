import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { composeSystemPrompt } from '../composer/prompt-composer';

describe('agent-turn composer integration', () => {
  const baseOpts = {
    persona: '测试人格：幽默风趣，喜欢开玩笑',
    boundaryClause: '不要讨论政治和宗教',
  };

  it('should include L3 profileCore when provided', () => {
    const prompt = composeSystemPrompt({
      ...baseOpts,
      profileCore: '沟通风格：主动搭讪型，喜欢用表情包',
    });
    expect(prompt).toContain('沟通风格：主动搭讪型');
    expect(prompt).toContain('profile.core');
  });

  it('should include L6 socialMemory when provided', () => {
    const prompt = composeSystemPrompt({
      ...baseOpts,
      socialMemory: '已知对方姓名：小明\n已知对方职业：程序员\n已知对方爱好：打篮球',
    });
    expect(prompt).toContain('小明');
    expect(prompt).toContain('程序员');
    expect(prompt).toContain('打篮球');
    expect(prompt).toContain('social-memory');
  });

  it('should include M6 affection overlay when provided', () => {
    const prompt = composeSystemPrompt({
      ...baseOpts,
      affectionOverlay: '当前亲密度: 60/100，关系: 刚认识',
    });
    expect(prompt).toContain('亲密度');
    expect(prompt).toContain('刚认识');
  });

  it('should include ALL layers when all provided', () => {
    const prompt = composeSystemPrompt({
      persona: '测试人格',
      boundaryClause: '不要讨论政治',
      profileCore: '风格：活泼',
      socialMemory: '已知：姓名-小红',
      affectionOverlay: '亲密度：50',
    });
    const indexOf = (substr: string) => prompt.indexOf(substr);

    expect(prompt).toContain('L0 always overrides');
    expect(indexOf('测试人格')).toBeLessThan(indexOf('风格：活泼'));
    expect(indexOf('风格：活泼')).toBeLessThan(indexOf('小红'));
    expect(indexOf('测试人格')).toBeLessThan(indexOf('亲密度'));
  });

  it('should NOT include L3 when profileCore is undefined', () => {
    const prompt = composeSystemPrompt({ ...baseOpts });
    expect(prompt).not.toContain('profile.core:\n');
  });

  it('should NOT include L6 when socialMemory is undefined', () => {
    const prompt = composeSystemPrompt({ ...baseOpts });
    expect(prompt).not.toContain('social-memory');
  });
});

describe('G3 Phase 3.1 L2 style wiring', () => {
  it('should include L2 style guidance when persona carries augmentedPersona', () => {
    const prompt = composeSystemPrompt({
      persona: '测试人格\n\n沟通风格指导:\n## Tone\n简短口语',
      boundaryClause: '',
    });
    expect(prompt).toContain('沟通风格指导:');
    expect(prompt).toContain('## Tone');
    expect(prompt).toContain('测试人格');
  });
});

describe('G3 Phase 3.2 L6 block format', () => {
  const sampleSocialMemory = [
    '## About the other participant — observer view',
    '### Confirmed facts ①',
    '- [explicit] 我叫小明，是程序员',
    '### Preferences / inferences ②',
    '- [opinion] 喜欢打篮球',
  ].join('\n');

  it('should inject buildSocialMemoryBlock-style output into composer', () => {
    const prompt = composeSystemPrompt({
      persona: '测试人格',
      boundaryClause: '',
      socialMemory: sampleSocialMemory,
    });
    expect(prompt).toContain('social-memory');
    expect(prompt).toContain('小明');
    expect(prompt).toContain('程序员');
    expect(prompt).toContain('Confirmed facts');
    expect(prompt).toContain('喜欢打篮球');
  });
});

describe('G3 Phase 3.3 M3 opening rules', () => {
  it('unified analysis prompt includes opening phase anti-repeat rules', () => {
    const src = readFileSync(
      join(__dirname, '../merged/unified-analysis.service.ts'),
      'utf8',
    );
    expect(src).toContain('开场阶段 (opening)');
    expect(src).toContain('我叫小明，是程序员');
    expect(src).toContain('禁止在 reason/summary 中建议 agent 重复询问');
  });
});
