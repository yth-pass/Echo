import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
// 【缺陷9 修复】reports 限流：每分钟 20 次
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateReportDto) {
    return this.reports.create(userId, dto);
  }
}
