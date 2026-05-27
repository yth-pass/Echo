import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';
import { LIVE_EVENTS_CHANNEL, parseLiveEvent } from './live-event';
import { LiveWsHub } from './live-ws.hub';

@Injectable()
export class LiveRedisSubscriber implements OnModuleInit, OnModuleDestroy {
  private sub: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly hub: LiveWsHub,
  ) {}

  onModuleInit() {
    this.sub = this.redis.client.duplicate();
    void this.sub.subscribe(LIVE_EVENTS_CHANNEL);
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
