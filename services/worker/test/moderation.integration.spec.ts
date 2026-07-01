/**
 * Moderation integration tests (REQ-09).
 *
 * Verifies:
 * - Sensitive word blacklist blocks unsafe content
 * - LLM classification flow
 * - Safe content passes through
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

// Import the sensitive words checker directly (no NestJS needed)
import { checkSensitiveWords } from '../../api/src/moderation/sensitive-words';

describe('Moderation Integration', () => {
  beforeAll(() => {
    process.env.DEEPSEEK_API_KEY = '';
  });

  // -------------------------------------------------------------------
  // Sensitive word blacklist
  // -------------------------------------------------------------------

  it('should flag explicit sexual content', () => {
    const result = checkSensitiveWords('加我微信号约炮一夜情');
    expect(result.hit).toBe(true);
    expect(result.words.length).toBeGreaterThan(0);
    expect(result.category).toBe('sexual');
  });

  it('should flag gambling content', () => {
    const result = checkSensitiveWords('加群玩百家乐，日赚千元不是梦');
    expect(result.hit).toBe(true);
    expect(result.category).toBe('gambling');
  });

  it('should flag harassment and abusive language', () => {
    const result = checkSensitiveWords('你这个傻逼，滚远点');
    expect(result.hit).toBe(true);
    expect(result.category).toBe('harassment');
  });

  it('should pass clean dating content', () => {
    const result = checkSensitiveWords('我喜欢在咖啡馆聊天，分享生活趣事');
    expect(result.hit).toBe(false);
    expect(result.words).toHaveLength(0);
  });

  it('should pass normal conversation about hobbies', () => {
    const result = checkSensitiveWords('最近在读一本关于心理学的书，很有意思');
    expect(result.hit).toBe(false);
  });

  // -------------------------------------------------------------------
  // ModerationService two-stage pipeline
  // -------------------------------------------------------------------

  it('should classify unsafe content through the pipeline', async () => {
    const { ModerationService } = await import(
      '../../api/src/moderation/moderation.service'
    );

    const mockLlm = {
      chat: jest.fn().mockResolvedValue(
        JSON.stringify({ verdict: 'unsafe', reason: 'contains sexual solicitation' }),
      ),
    };

    const svc = new ModerationService(mockLlm);

    // Stage 1: should be caught by blacklist before LLM
    const result = await svc.moderate('约炮加微');
    expect(result.verdict).toBe('unsafe');
    // Blacklist should catch it, so LLM shouldn't be called
    expect(mockLlm.chat).not.toHaveBeenCalled();
  });

  it('should pass safe content through both stages', async () => {
    const { ModerationService } = await import(
      '../../api/src/moderation/moderation.service'
    );

    const mockLlm = {
      chat: jest.fn().mockResolvedValue(
        JSON.stringify({ verdict: 'safe' }),
      ),
    };

    const svc = new ModerationService(mockLlm);
    const result = await svc.moderate('今天天气真好，适合出去散步');

    expect(result.verdict).toBe('safe');
    expect(mockLlm.chat).toHaveBeenCalled();
  });

  it('should flag borderline content for review', async () => {
    const { ModerationService } = await import(
      '../../api/src/moderation/moderation.service'
    );

    const mockLlm = {
      chat: jest.fn().mockResolvedValue(
        JSON.stringify({
          verdict: 'needs_review',
          reason: 'ambiguous romantic solicitation',
        }),
      ),
    };

    const svc = new ModerationService(mockLlm);
    const result = await svc.moderate('想找个有钱的男朋友一起旅游');

    expect(result.verdict).toBe('needs_review');
    expect(result.reason).toBeDefined();
  });
});
