/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';

export type DeepSeekChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

const DEFAULT_BASE = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

/** Returns null if no API key (caller should use mock or skip AI). */
export function createDeepSeekClient(): OpenAI | null {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey || !String(apiKey).trim()) return null;

  return new OpenAI({
    apiKey: String(apiKey).trim(),
    baseURL: (import.meta.env.VITE_DEEPSEEK_BASE_URL || DEFAULT_BASE).replace(/\/$/, ''),
    dangerouslyAllowBrowser: true,
  });
}

export type DeepSeekChatOptions = {
  model?: string;
  /** Maps to Python sample: reasoning_effort + extra_body thinking (DeepSeek extension). */
  enableThinking?: boolean;
};

/**
 * Non-streaming chat completion against DeepSeek.
 * Optional thinking mode matches DeepSeek/OpenAI-compatible extensions when enabled.
 */
export async function deepseekChat(
  messages: DeepSeekChatMessage[],
  options?: DeepSeekChatOptions,
): Promise<string | null> {
  const client = createDeepSeekClient();
  if (!client) return null;

  const model =
    options?.model ||
    (import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined)?.trim() ||
    DEFAULT_MODEL;

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };

  if (options?.enableThinking) {
    payload.reasoning_effort = 'high';
    payload.extra_body = { thinking: { type: 'enabled' } };
  }

  const completion = await client.chat.completions.create(
    payload as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  );

  const text = completion.choices[0]?.message?.content;
  return typeof text === 'string' && text.length > 0 ? text : null;
}
