import Redis from 'ioredis';

/** BullMQ-compatible Redis client; enables TLS for Upstash `rediss://` URLs. */
export function createRedisClient(url: string): Redis {
  const bypass = process.env.BYPASS_REDIS === 'true';
  const useTls = url.startsWith('rediss://');
  return new Redis(url, {
    // 非 BYPASS：null（BullMQ 兼容；Upstash 可达时命令正常返回）
    // BYPASS：1（命令 1 次重试后 reject，约 60ms，不永久 hang）
    //   —— 原 null 会让 hget 等命令在 Upstash 不可达时永久 pending，
    //      把 getMe 等 clone:meta 读取请求挂死 → 前端"分身正在苏醒"永不消失。
    maxRetriesPerRequest: bypass ? 1 : null,
    ...(useTls ? { tls: {} } : {}),
    // BYPASS_REDIS 模式：lazyConnect 不主动连接 + connectTimeout 快速超时。
    // 保持默认 retryStrategy（重试）让连接留在 reconnecting 状态，避免 close →
    // flushQueue 同步抛异常导致进程崩溃（retryStrategy:()=>null 会触发此问题）。
    ...(bypass ? { lazyConnect: true, connectTimeout: 1 } : {}),
  });
}
