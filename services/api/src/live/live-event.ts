export const LIVE_EVENTS_CHANNEL = 'echo:live';

export type LiveEventType = 'match' | 'handoff' | 'affinity' | 'feed' | 'notification';

export type LiveEvent = {
  type: LiveEventType;
  userId: string;
  payload?: Record<string, unknown>;
};

export function parseLiveEvent(raw: string): LiveEvent | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const type = o.type;
    const userId = o.userId;
    if (
      type !== 'match' &&
      type !== 'handoff' &&
      type !== 'affinity' &&
      type !== 'feed' &&
      type !== 'notification'
    ) {
      return null;
    }
    if (typeof userId !== 'string' || !userId) return null;
    const payload =
      o.payload && typeof o.payload === 'object' && o.payload !== null
        ? (o.payload as Record<string, unknown>)
        : undefined;
    return { type, userId, payload };
  } catch {
    return null;
  }
}
