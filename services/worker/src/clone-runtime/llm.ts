import OpenAI from 'openai';

export interface ChatOptions {
  temperature?: number;
  maxRetries?: number;
  jsonMode?: boolean;
}

export function llmClient(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
  });
}

// 【缺陷4修复】chat() 返回类型从 string 改为 string | null：
// - 缺 key 时返回 null（不再返回占位文本）
// - 重试耗尽后返回 null（不再返回空字符串）
// 调用方需对 null 做空值校验，避免写入空消息。
export async function chat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatOptions = {},
): Promise<string | null> {
  const client = llmClient();
  // 【缺陷4修复】缺 key 时返回 null，由调用方决定如何处理（启动期由 assertLlmKey 拦截）
  if (!client) return null;
  const temperature = options.temperature ?? 0.1;
  const maxRetries = options.maxRetries ?? 3;
  const jsonMode = options.jsonMode ?? false;
  const requestBase: any = {
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    messages,
    temperature,
  };
  if (jsonMode) {
    requestBase.response_format = { type: 'json_object' };
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await client.chat.completions.create(requestBase);
      const content = res.choices[0]?.message?.content ?? '';
      if (content.trim()) return content;
      lastError = new Error('empty response');
    } catch (err) {
      lastError = err;
    }
  }
  // 【缺陷4修复】重试耗尽返回 null，调用方应据此标记会话错误而非写入空消息
  return null;
}

// 【缺陷4修复】启动期检测 API key，缺失则直接 throw，阻止 worker 启动
export function assertLlmKey(): void {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new Error('DEEPSEEK_API_KEY 未配置，worker 无法启动。请在 .env 中设置 DEEPSEEK_API_KEY。');
  }
}

// ---------------------------------------------------------------------------
// Embedding (REQ-01)
// ---------------------------------------------------------------------------

export type EmbeddingQuality = 'real' | 'fake';

export interface EmbeddingResult {
  vector: number[];
  quality: EmbeddingQuality;
}

/**
 * Generate a 1536-dimensional embedding vector for a single text.
 *
 * Falls back to a deterministic pseudo-random vector when the API key is
 * missing or the request fails.
 */
export async function embed(text: string): Promise<EmbeddingResult> {
  const client = llmClient();
  if (!client) {
    return { vector: fakeEmbedding(text), quality: 'fake' };
  }

  const model = process.env.DEEPSEEK_EMBED_MODEL ?? 'deepseek-embed';
  try {
    const res = await client.embeddings.create({
      model,
      input: text,
    });
    const vec = res.data?.[0]?.embedding;
    if (vec && vec.length > 0) return { vector: vec, quality: 'real' };
    return { vector: fakeEmbedding(text), quality: 'fake' };
  } catch {
    return { vector: fakeEmbedding(text), quality: 'fake' };
  }
}

/**
 * Deterministic pseudo-random 1536-dim vector derived from a seed string.
 */
function fakeEmbedding(seed: string): number[] {
  const vec = new Array<number>(1536).fill(0);
  for (let i = 0; i < seed.length; i++) {
    vec[i % 1536] = (vec[i % 1536] + seed.charCodeAt(i) / 1000) % 1;
  }
  return vec;
}
