import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisClient } from './create-redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = createRedisClient(url);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
