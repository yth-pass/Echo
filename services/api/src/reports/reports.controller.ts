import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './reports.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() userId: string, @Body() dto: CreateReportDto) {
    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
    return { id: report.id, created: true };
  }
}
