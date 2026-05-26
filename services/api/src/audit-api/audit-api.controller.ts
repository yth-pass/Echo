import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuditApiService } from './audit-api.service';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditApiController {
  constructor(private readonly auditApi: AuditApiService) {}

  @Get('events')
  events(
    @CurrentUser() userId: string,
    @Query('type') type?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.auditApi.list(userId, type, cursor);
  }
}
