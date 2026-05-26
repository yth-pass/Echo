import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MatchesService } from './matches.service';

class BlockDto {
  @IsString()
  blockedUserId!: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get('matches')
  list(@CurrentUser() userId: string) {
    return this.matches.list(userId);
  }

  @Post('matches/:id/dismiss')
  dismiss(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.matches.dismiss(userId, id);
  }

  @Post('blocks')
  block(@CurrentUser() userId: string, @Body() dto: BlockDto) {
    return this.matches.block(userId, dto.blockedUserId);
  }
}
