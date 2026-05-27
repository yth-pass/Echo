import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LIVE_EVENTS_CHANNEL, type LiveEvent } from './live-event';

@Injectable()
export class LivePublisherService {
  constructor(private readonly redis: RedisService) {}

  async publish(event: LiveEvent): Promise<void> {
    await this.redis.client.publish(LIVE_EVENTS_CHANNEL, JSON.stringify(event));
  }
}
