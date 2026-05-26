import type Redis from 'ioredis';

export type CloneMeta = {
  lastPostAt: number;
  lastSessionAt: number;
  lastAffinityPeak: number;
};

export async function getCloneMeta(redis: Redis, cloneId: string): Promise<CloneMeta> {
  const raw = await redis.hgetall(`clone:meta:${cloneId}`);
  return {
    lastPostAt: Number(raw.lastPostAt ?? 0),
    lastSessionAt: Number(raw.lastSessionAt ?? 0),
    lastAffinityPeak: Number(raw.lastAffinityPeak ?? 0),
  };
}

export async function setCloneMeta(
  redis: Redis,
  cloneId: string,
  patch: Partial<CloneMeta>,
): Promise<void> {
  const key = `clone:meta:${cloneId}`;
  const entries: Record<string, string> = {};
  if (patch.lastPostAt != null) entries.lastPostAt = String(patch.lastPostAt);
  if (patch.lastSessionAt != null) entries.lastSessionAt = String(patch.lastSessionAt);
  if (patch.lastAffinityPeak != null) entries.lastAffinityPeak = String(patch.lastAffinityPeak);
  if (Object.keys(entries).length) await redis.hset(key, entries);
}
