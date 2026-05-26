import OpenAI from 'openai';

export function llmClient(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
  });
}

export async function chat(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  const client = llmClient();
  if (!client) return '（离线占位回复）';
  const res = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    messages,
  });
  return res.choices[0]?.message?.content ?? '';
}
