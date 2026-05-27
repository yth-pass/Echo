import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { LivePublisherService } from './live-publisher.service';
import { LiveRedisSubscriber } from './live-redis.subscriber';
import { LiveWsHub } from './live-ws.hub';

@Module({
  imports: [RedisModule],
  providers: [LiveWsHub, LivePublisherService, LiveRedisSubscriber],
  exports: [LiveWsHub, LivePublisherService],
})
export class LiveModule {}
