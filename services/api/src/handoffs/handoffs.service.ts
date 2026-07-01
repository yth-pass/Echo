import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { HandoffStatus, HandoffDecision } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LivePublisherService } from '../live/live-publisher.service';
import { PushService } from '../push/push.service';
import { createLogger } from '../../../shared/observability';

const logger = createLogger('handoffs');

@Injectable()
export class HandoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly live: LivePublisherService,
    private readonly push: PushService,
  ) {}

  /**
   * Get a single handoff with per-user decision status.
   * 【步骤8修复】返回体移除 user_a_id / user_b_id（不暴露对端真实 user id），
   * 改为返回 isUserA（当前调用者是否为 user_a）；
   * contact_info 仅含对方的 displayName + city（contact_exchanged 为 true 时）。
   */
  async getOne(userId: string, id: string) {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id },
      include: {
        session: { include: { affinityScore: true } },
        responses: true,
      },
    });
    if (!handoff) throw new NotFoundException('Handoff not found');
    if (handoff.userAId !== userId && handoff.userBId !== userId) {
      throw new ForbiddenException();
    }

    // 【步骤8修复】判定调用者是否为 user_a（不暴露对端 user id）
    const isUserA = handoff.userAId === userId;
    const contactExchanged =
      handoff.status === HandoffStatus.accepted ? !!handoff.contactInfoJson : false;

    // 【步骤8修复】仅当已交换联系方式时，返回对方（而非双方）的 displayName + city
    let contactInfo: { display_name: string | null; city: string | null } | null = null;
    if (contactExchanged && handoff.contactInfoJson) {
      const raw = handoff.contactInfoJson as {
        user_a?: { display_name?: string | null; city?: string | null };
        user_b?: { display_name?: string | null; city?: string | null };
      };
      // 对方视角：调用者是 user_a 时，对方是 user_b；反之对方是 user_a
      const partner = isUserA ? raw.user_b : raw.user_a;
      contactInfo = {
        display_name: partner?.display_name ?? null,
        city: partner?.city ?? null,
      };
    }

    return {
      id: handoff.id,
      status: handoff.status,
      session_id: handoff.sessionId,
      affinity_score: handoff.session.affinityScore?.score ?? null,
      // 【步骤8修复】用 isUserA 替代 user_a_id / user_b_id，避免暴露对端 user id
      is_user_a: isUserA,
      contact_exchanged: contactExchanged,
      // 【步骤8修复】仅含对方信息（displayName + city）
      contact_info: contactInfo,
      responses: handoff.responses.map((r) => ({
        user_id: r.userId,
        decision: r.decision,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Record one user's accept/decline decision.
   *
   * REQ-05: Bidirectional handoff state machine.
   * - Both users accept → status = accepted, exchange contact info.
   * - Either user declines → status = declined.
   */
  async respond(userId: string, id: string, accept: boolean) {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id },
      include: { responses: true },
    });
    if (!handoff) throw new NotFoundException('Handoff not found');
    if (handoff.userAId !== userId && handoff.userBId !== userId) {
      throw new ForbiddenException();
    }
    if (handoff.status !== HandoffStatus.pending) {
      throw new ForbiddenException(
        `Handoff is already ${handoff.status}; no further responses allowed`,
      );
    }

    // Record this user's decision (upsert idempotent on [handoffId, userId]).
    const decision: HandoffDecision = accept
      ? HandoffDecision.accept
      : HandoffDecision.decline;
    await this.prisma.handoffResponse.upsert({
      where: { handoffId_userId: { handoffId: id, userId } },
      create: { handoffId: id, userId, decision },
      update: { decision },
    });

    // Re-fetch to get the latest state.
    const updated = await this.prisma.handoff.findUnique({
      where: { id },
      include: { responses: true },
    });
    if (!updated) throw new NotFoundException('Handoff not found');

    const partnerId =
      userId === updated.userAId ? updated.userBId : updated.userAId;

    let newStatus: HandoffStatus = HandoffStatus.pending;
    let contactExchanged = false;

    if (decision === HandoffDecision.decline) {
      // Either-side decline → terminal declined.
      newStatus = HandoffStatus.declined;
    } else {
      // Accept — check if both have accepted.
      const bothAccepted =
        updated.responses.length === 2 &&
        updated.responses.every((r) => r.decision === HandoffDecision.accept);
      if (bothAccepted) {
        newStatus = HandoffStatus.accepted;

        // REQ-05: Exchange contact info (display names + location hints).
        const [profileA, profileB] = await Promise.all([
          this.prisma.profile.findUnique({ where: { userId: updated.userAId } }),
          this.prisma.profile.findUnique({ where: { userId: updated.userBId } }),
        ]);
        const contactInfo = {
          user_a: {
            display_name: profileA?.displayName ?? null,
            city: profileA?.city ?? null,
          },
          user_b: {
            display_name: profileB?.displayName ?? null,
            city: profileB?.city ?? null,
          },
          exchanged_at: new Date().toISOString(),
        };

        await this.prisma.handoff.update({
          where: { id },
          data: {
            status: newStatus,
            acceptedAt: new Date(),
            contactInfoJson: contactInfo,
          },
        });

        contactExchanged = true;

        // REQ-10: Push both users on mutual accept.
        await Promise.allSettled([
          this.push.sendPush(updated.userAId, 'handoff_accepted', {
            handoffId: id,
            sessionId: updated.sessionId,
            partnerDisplayName: profileB?.displayName ?? '对方',
          }),
          this.push.sendPush(updated.userBId, 'handoff_accepted', {
            handoffId: id,
            sessionId: updated.sessionId,
            partnerDisplayName: profileA?.displayName ?? '对方',
          }),
        ]);
      }
    }

    if (newStatus !== HandoffStatus.pending) {
      await this.prisma.handoff.update({
        where: { id },
        data: {
          status: newStatus,
          acceptedAt: newStatus === HandoffStatus.accepted ? new Date() : undefined,
        },
      });
    }

    await this.audit.log({
      userId,
      eventType: 'handoff.respond',
      referenceId: id,
      summaryZh: accept ? '接受真人接力' : '拒绝真人接力',
    });

    const payload = {
      handoffId: id,
      sessionId: updated.sessionId,
      status: newStatus,
      contact_exchanged: contactExchanged,
    };
    await this.live.publish({
      type: 'handoff',
      userId: updated.userAId,
      payload,
    });
    await this.live.publish({
      type: 'handoff',
      userId: updated.userBId,
      payload,
    });

    logger.info('handoff response recorded', {
      handoffId: id,
      userId,
      decision,
      newStatus,
      contactExchanged,
    });

    return {
      id: updated.id,
      status: newStatus,
      contact_exchanged: contactExchanged,
      responses: updated.responses.map((r) => ({
        user_id: r.userId,
        decision: r.decision,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}
