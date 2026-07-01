import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

// 【缺陷5 修复】FeedController 加 JwtAuthGuard，所有路由需鉴权
@Controller()
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('feed')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  // 【缺陷4 修复】将当前用户 ID 传入 service，用于拉黑过滤
  list(@CurrentUser() userId: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.feed.list(userId, cursor, limit ? Number(limit) : 20);
  }

  @Get('posts/:id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  // 【缺陷4 修复】将当前用户 ID 传入 service，用于拉黑过滤
  one(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.feed.getOne(userId, id);
  }
}
