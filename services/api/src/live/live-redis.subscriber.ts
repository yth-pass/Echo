import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';
import { LIVE_EVENTS_CHANNEL, parseLiveEvent } from './live-event';
import { LiveWsHub } from './live-ws.hub';

@Injectable()
export class LiveRedisSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveRedisSubscriber.name);
  private sub: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly hub: LiveWsHub,
  ) {}

  onModuleInit() {
    this.sub = this.redis.client.duplicate();
    // 【必修】duplicate() 不继承 error 监听器。BYPASS_REDIS 模式下连接失败会触发 error 事件，
    // 无监听器会让 Node 进程崩溃（Upstash 额度耗尽时必现）。
    // subscribe 的 reject 已被下方 void 吞掉，这里仅防 error 事件导致进程退出。
    this.sub.on('error', (err: Error) => {
      this.logger.warn(`Live Redis 订阅连接错误（已降级，不影响核心请求）: ${err.message}`);
    });
    this.sub.subscribe(LIVE_EVENTS_CHANNEL).catch(() => {
      // BYPASS_REDIS 或 Upstash 不可达时 subscribe 会 reject（maxRetriesPerRequest:1），
      // 静默降级：live 实时推送不可用，不影响核心请求
    });
    this.sub.on('message', (channel, message) => {
      if (channel !== LIVE_EVENTS_CHANNEL) return;
      const event = parseLiveEvent(message);
      if (!event) return;
      this.hub.broadcastToUser(event.userId, {
        type: event.type,
        payload: event.payload ?? {},
      });
    });
  }

  onModuleDestroy() {
    this.sub?.disconnect();
    this.sub = null;
  }
}
