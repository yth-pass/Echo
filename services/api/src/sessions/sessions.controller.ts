import { Controller, Get, Post, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.sessions.listForUser(userId);
  }

  @Get(':id/affinity')
  affinity(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.sessions.affinityForUser(userId, id);
  }

  @Get(':id/relationship')
  relationship(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.sessions.relationshipForUser(userId, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.sessions.messages(id, userId);
  }

  @Post(':id/end-request')
  @HttpCode(200)
  endRequest(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.sessions.requestEndChat(userId, id, reason);
  }
}
