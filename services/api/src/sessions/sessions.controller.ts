import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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

  @Get(':id/messages')
  messages(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.sessions.messages(id, userId);
  }
}
