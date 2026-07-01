import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { CreateReportDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    // 【缺陷5 修复】校验举报目标在对应表中存在，不存在则抛 NotFoundException，
    // 避免对不存在的实体发起无效举报/重审流程
    await this.assertTargetExists(dto.targetType, dto.targetId);

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
    // 【缺陷8 修复】审计：举报创建
    await this.audit.log({
      userId: reporterId,
      eventType: 'report_created',
      summaryZh: `举报 ${dto.targetType} ${dto.targetId}：${dto.reason ?? '无'}`,
      referenceId: report.id,
    });
    return { id: report.id, created: true };
  }

  /**
   * 【缺陷5 修复】按 targetType 校验 targetId 是否存在于对应表。
   * 不存在则抛 NotFoundException。
   */
  private async assertTargetExists(
    targetType: string,
    targetId: string,
  ): Promise<void> {
    let exists = false;
    switch (targetType) {
      case 'post':
        exists = !!(await this.prisma.post.findUnique({ where: { id: targetId } }));
        break;
      case 'session':
        exists = !!(await this.prisma.agentSession.findUnique({ where: { id: targetId } }));
        break;
      case 'clone':
        exists = !!(await this.prisma.digitalClone.findUnique({ where: { id: targetId } }));
        break;
      case 'user':
        exists = !!(await this.prisma.user.findUnique({ where: { id: targetId } }));
        break;
      default:
        // 白名单已在 DTO 层拦截，兜底防御
        throw new NotFoundException(`Unsupported report target type: ${targetType}`);
    }
    if (!exists) {
      throw new NotFoundException(`${targetType} ${targetId} not found`);
    }
  }
}
