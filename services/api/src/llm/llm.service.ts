import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { createLogger } from '../../../shared/observability';

const obsLogger = createLogger('llm-service');

export type EmbeddingQuality = 'real' | 'fake';

export interface EmbeddingResult {
  vector: number[];
  quality: EmbeddingQuality;
}

export interface EmbeddingBatchResult {
  vectors: number[][];
  quality: EmbeddingQuality;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  /** DeepSeek client — chat completions only. */
  private chatClient: OpenAI | null = null;
  /** DashScope client — embedding only (OpenAI-compatible API). */
  private embedClient: OpenAI | null = null;
  /** Whether we already warned about missing DashScope key (avoid log spam). */
  private embedKeyWarned = false;

  private getChatClient(): OpenAI | null {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key?.trim()) return null;
    if (!this.chatClient) {
      this.chatClient = new OpenAI({
        apiKey: key.trim(),
        baseURL: (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
      });
    }
    return this.chatClient;
  }

  private getEmbedClient(): OpenAI | null {
    const key = process.env.DASHSCOPE_API_KEY;
    if (!key?.trim()) {
      if (!this.embedKeyWarned) {
        obsLogger.warn('DASHSCOPE_API_KEY not set; falling back to fake embedding');
        this.embedKeyWarned = true;
      }
      return null;
    }
    if (!this.embedClient) {
      this.embedClient = new OpenAI({
        apiKey: key.trim(),
        baseURL: (
          process.env.DASHSCOPE_BASE_URL ??
          'https://dashscope.aliyuncs.com/compatible-mode/v1'
        ).replace(/\/$/, ''),
      });
    }
    return this.embedClient;
  }

  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string | null> {
    const client = this.getChatClient();
    if (!client) {
      this.logger.warn('DEEPSEEK_API_KEY not set; skipping LLM call');
      return null;
    }
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 25_000);
    let timer: ReturnType<typeof setTimeout>;
    try {
      const completion = await Promise.race([
        client.chat.completions.create({
          model,
          messages,
          stream: false,
          ...(options?.temperature != null && { temperature: options.temperature }),
          ...(options?.maxTokens != null && { max_tokens: options.maxTokens }),
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('LLM request timed out')), timeoutMs);
        }),
      ]);
      clearTimeout(timer!);
      return completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      clearTimeout(timer!);
      this.logger.warn(
        `LLM chat failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Embedding (REQ-01) — DashScope text-embedding-v4
  // -----------------------------------------------------------------------

  /**
   * Generate an embedding vector for a single text via DashScope.
   *
   * Falls back to a deterministic pseudo-random vector when the API key is
   * missing or the request fails (non-blocking: a warning is logged).
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const client = this.getEmbedClient();
    if (!client) return { vector: this.fakeEmbedding(text), quality: 'fake' };
    const model = process.env.DASHSCOPE_EMBED_MODEL ?? 'text-embedding-v4';
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 25_000);
    let timer: ReturnType<typeof setTimeout>;
    try {
      const res = await Promise.race([
        client.embeddings.create({ model, input: text }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Embedding request timed out')),
            timeoutMs,
          );
        }),
      ]);
      clearTimeout(timer!);
      const vec = res.data?.[0]?.embedding;
      if (vec && vec.length > 0) return { vector: vec, quality: 'real' };
      obsLogger.warn('Embedding API returned empty result, falling back to fake');
      return { vector: this.fakeEmbedding(text), quality: 'fake' };
    } catch (err) {
      clearTimeout(timer!);
      obsLogger.warn('Embedding API call failed, falling back to fake', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { vector: this.fakeEmbedding(text), quality: 'fake' };
    }
  }

  /**
   * Generate embedding vectors for multiple texts in a single DashScope call.
   */
  async embedBatch(texts: string[]): Promise<EmbeddingBatchResult> {
    if (texts.length === 0) return { vectors: [], quality: 'real' };
    const client = this.getEmbedClient();
    if (!client) {
      return { vectors: texts.map((t) => this.fakeEmbedding(t)), quality: 'fake' };
    }
    const model = process.env.DASHSCOPE_EMBED_MODEL ?? 'text-embedding-v4';
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 25_000);
    let timer: ReturnType<typeof setTimeout>;
    try {
      const res = await Promise.race([
        client.embeddings.create({ model, input: texts }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Batch embedding request timed out')),
            timeoutMs,
          );
        }),
      ]);
      clearTimeout(timer!);
      return { vectors: res.data.map((d) => d.embedding), quality: 'real' };
    } catch (err) {
      clearTimeout(timer!);
      obsLogger.warn('Batch embedding failed, falling back to fake', {
        error: err instanceof Error ? err.message : String(err),
        count: texts.length,
      });
      return { vectors: texts.map((t) => this.fakeEmbedding(t)), quality: 'fake' };
    }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Deterministic pseudo-random 1536-dim vector derived from a seed string.
   * Used as a fallback when the embedding API is unavailable.
   */
  private fakeEmbedding(seed: string): number[] {
    const vec = new Array<number>(1536).fill(0);
    for (let i = 0; i < seed.length; i++) {
      vec[i % 1536] = (vec[i % 1536] + seed.charCodeAt(i) / 1000) % 1;
    }
    return vec;
  }
}
