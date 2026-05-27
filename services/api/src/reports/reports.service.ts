import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateReportDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
    await this.queue.enqueueReportTriage({
      reportId: report.id,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reporterId,
      reason: dto.reason,
    });
    return { id: report.id, created: true };
  }
}
