import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisClient } from './create-redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = createRedisClient(url);
    // 【必修】ioredis 的 error 事件若无监听器，会作为 unhandled error 让 Node 进程崩溃。
    // BYPASS_REDIS=true 时 retryStrategy:null 会让连接快速失败并触发 error 事件；
    // 正常模式下 Upstash 抖动同样会触发。这里吞掉错误记日志，命令仍由调用方 try/catch 降级。
    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis 连接错误（已降级，不阻断请求）: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
