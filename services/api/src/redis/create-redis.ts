import Redis from 'ioredis';

/** BullMQ-compatible Redis client; enables TLS for Upstash `rediss://` URLs. */
export function createRedisClient(url: string): Redis {
  const useTls = url.startsWith('rediss://');
  return new Redis(url, {
    maxRetriesPerRequest: null,
    ...(useTls ? { tls: {} } : {}),
  });
}
