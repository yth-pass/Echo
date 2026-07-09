import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MatchesService } from './matches.service';
import { QueueService } from '../queue/queue.service';

class BlockDto {
  @IsString()
  blockedUserId!: string;
}

class MatchRequestDto {
  @IsString()
  targetUserId!: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly queueService: QueueService,
  ) {}

  @Get('matches')
  list(@CurrentUser() userId: string) {
    return this.matches.list(userId);
  }

  @Post('matches/:id/dismiss')
  dismiss(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.matches.dismiss(userId, id);
  }

  @Post('matches/:id/accept')
  accept(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.matches.acceptMatch(userId, id);
  }

  @Post('matches/request')
  request(@CurrentUser() userId: string, @Body() dto: MatchRequestDto) {
    return this.matches.requestMatch(userId, dto.targetUserId);
  }

  @Post('blocks')
  block(@CurrentUser() userId: string, @Body() dto: BlockDto) {
    return this.matches.block(userId, dto.blockedUserId);
  }

  /** 手动触发匹配（跳过 8:00-9:00 时间窗口），用于本地测试 */
  @Post('matches/trigger')
  async trigger() {
    await this.queueService.enqueueMatchDaily({ force: true });
    return { triggered: true };
  }
}
