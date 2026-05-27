import type Redis from 'ioredis';

export const LIVE_EVENTS_CHANNEL = 'echo:live';

export type LiveEventType = 'match' | 'handoff' | 'affinity' | 'feed';

export type LiveEvent = {
  type: LiveEventType;
  userId: string;
  payload?: Record<string, unknown>;
};

export async function publishLiveEvent(redis: Redis, event: LiveEvent): Promise<void> {
  await redis.publish(LIVE_EVENTS_CHANNEL, JSON.stringify(event));
}
