import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditApiService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, type?: string, cursor?: string, limit = 30) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        userId,
        ...(type ? { eventType: { contains: type } } : {}),
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = events.length > limit;
    const slice = hasMore ? events.slice(0, limit) : events;
    return {
      items: slice.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        summary_zh: e.summaryZh,
        reference_id: e.referenceId,
        created_at: e.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? slice[slice.length - 1]?.id : null,
    };
  }
}
