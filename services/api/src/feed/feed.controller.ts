import { Controller, Get, Param, Query } from '@nestjs/common';
import { FeedService } from './feed.service';

@Controller()
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('feed')
  list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.feed.list(cursor, limit ? Number(limit) : 20);
  }

  @Get('posts/:id')
  one(@Param('id') id: string) {
    return this.feed.getOne(id);
  }
}
