import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { HandoffStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LivePublisherService } from '../live/live-publisher.service';

@Injectable()
export class HandoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly live: LivePublisherService,
  ) {}

  async getOne(userId: string, id: string) {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id },
      include: { session: { include: { affinityScore: true } } },
    });
    if (!handoff) throw new NotFoundException('Handoff not found');
    if (handoff.userAId !== userId && handoff.userBId !== userId) {
      throw new ForbiddenException();
    }
    return {
      id: handoff.id,
      status: handoff.status,
      session_id: handoff.sessionId,
      affinity_score: handoff.session.affinityScore?.score ?? null,
      user_a_id: handoff.userAId,
      user_b_id: handoff.userBId,
    };
  }

  async respond(userId: string, id: string, accept: boolean) {
    const handoff = await this.prisma.handoff.findUnique({ where: { id } });
    if (!handoff) throw new NotFoundException('Handoff not found');
    if (handoff.userAId !== userId && handoff.userBId !== userId) {
      throw new ForbiddenException();
    }
    const status = accept ? HandoffStatus.accepted : HandoffStatus.declined;
    const updated = await this.prisma.handoff.update({
      where: { id },
      data: {
        status,
        acceptedAt: accept ? new Date() : undefined,
      },
    });
    await this.audit.log({
      userId,
      eventType: 'handoff.respond',
      referenceId: id,
      summaryZh: accept ? '接受真人接力' : '拒绝真人接力',
    });
    const payload = { handoffId: id, sessionId: handoff.sessionId, status };
    await this.live.publish({
      type: 'handoff',
      userId: handoff.userAId,
      payload,
    });
    await this.live.publish({
      type: 'handoff',
      userId: handoff.userBId,
      payload,
    });
    console.log(`[FCM stub] handoff ${id} -> ${status} for user ${userId}`);
    return { id: updated.id, status: updated.status };
  }
}
