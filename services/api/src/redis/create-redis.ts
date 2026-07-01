import Redis from 'ioredis';

/** BullMQ-compatible Redis client; enables TLS for Upstash `rediss://` URLs. */
export function createRedisClient(url: string): Redis {
  const bypass = process.env.BYPASS_REDIS === 'true';
  const useTls = url.startsWith('rediss://');
  return new Redis(url, {
    maxRetriesPerRequest: null,
    ...(useTls ? { tls: {} } : {}),
    // BYPASS_REDIS 模式下不实际连接，避免 Upstash 限额耗尽时崩溃
    ...(bypass ? { lazyConnect: true, connectTimeout: 1 } : {}),
  });
}
