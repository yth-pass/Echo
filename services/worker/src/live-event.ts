import type Redis from 'ioredis';

export const LIVE_EVENTS_CHANNEL = 'echo:live';

// 【缺陷4修复】新增 'session_error' 类型，用于 LLM 失败时通知前端会话异常
export type LiveEventType = 'match' | 'handoff' | 'affinity' | 'feed' | 'session_error';

export type LiveEvent = {
  type: LiveEventType;
  userId: string;
  payload?: Record<string, unknown>;
};

export async function publishLiveEvent(redis: Redis, event: LiveEvent): Promise<void> {
  await redis.publish(LIVE_EVENTS_CHANNEL, JSON.stringify(event));
}
