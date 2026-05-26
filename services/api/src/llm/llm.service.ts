import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client: OpenAI | null = null;

  private getClient(): OpenAI | null {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key?.trim()) return null;
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: key.trim(),
        baseURL: (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
      });
    }
    return this.client;
  }

  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): Promise<string | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.warn('DEEPSEEK_API_KEY not set; skipping LLM call');
      return null;
    }
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
    const completion = await client.chat.completions.create({
      model,
      messages,
      stream: false,
    });
    return completion.choices[0]?.message?.content ?? null;
  }
}
