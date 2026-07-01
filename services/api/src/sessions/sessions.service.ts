import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockFilterService } from '../common/block-filter.service';
import { AffectionQueryService } from '../agent-platform/affection/affection-query.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    // 【缺陷4 修复】注入 BlockFilterService，排除对方拉黑/被拉黑的 session
    private readonly blockFilter: BlockFilterService,
  ) {}

  async listForUser(userId: string) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) return { items: [] };

    // 【缺陷4 修复】获取与当前用户存在双向拉黑关系的对端 userId 列表，
    // 后续排除对方拉黑/被拉黑的 session
    const blockedIds = await this.blockFilter.getBlockedUserIds(userId);
    const blockedSet = new Set(blockedIds);

    const sessions = await this.prisma.agentSession.findMany({
      where: { OR: [{ cloneAId: clone.id }, { cloneBId: clone.id }] },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const otherCloneIds = sessions.map((s) =>
      s.cloneAId === clone.id ? s.cloneBId : s.cloneAId,
    );
    const otherClones = await this.prisma.digitalClone.findMany({
      where: { id: { in: otherCloneIds } },
      include: { user: { include: { profile: true } } },
    });
    const nameByCloneId = new Map(
      otherClones.map((c) => [c.id, c.user.profile?.displayName ?? '对方']),
    );
    // 【缺陷4 修复】建立 cloneId → userId 映射，用于按对端 userId 过滤拉黑关系
    const userIdByCloneId = new Map(
      otherClones.map((c) => [c.id, c.userId]),
    );

    const sessionIds = sessions.map((s) => s.id);
    const lastMessages = sessionIds.length
      ? await this.prisma.agentMessage.findMany({
          where: { sessionId: { in: sessionIds } },
          orderBy: [{ sessionId: 'asc' }, { turnIndex: 'desc' }],
          distinct: ['sessionId'],
        })
      : [];
    const lastBySession = new Map(lastMessages.map((m) => [m.sessionId, m]));

    return {
      // 【缺陷4 修复】过滤掉对端 userId 处于拉黑关系中的 session（双向）
      items: sessions
        .filter((s) => {
          const otherCloneId = s.cloneAId === clone.id ? s.cloneBId : s.cloneAId;
          const otherUserId = userIdByCloneId.get(otherCloneId);
          // 对端 userId 未知时不拦截；已知且处于拉黑关系则排除
          return !otherUserId || !blockedSet.has(otherUserId);
        })
        .map((s) => {
        const otherCloneId = s.cloneAId === clone.id ? s.cloneBId : s.cloneAId;
        const last = lastBySession.get(s.id);
        const preview = last?.content
          ? last.content.length > 50
            ? `${last.content.slice(0, 50)}…`
            : last.content
          : null;
        return {
          id: s.id,
          clone_a_id: s.cloneAId,
          clone_b_id: s.cloneBId,
          status: s.status,
          started_at: s.startedAt.toISOString(),
          ended_at: s.endedAt?.toISOString() ?? null,
          wind_down_at: s.windDownAt?.toISOString() ?? null,
          wind_down_reason: s.windDownReason ?? null,
          daily_turn_count: s.dailyTurnCount,
          other_user_name: nameByCloneId.get(otherCloneId) ?? '对方',
          last_message_preview: preview,
          last_message_at: last?.createdAt.toISOString() ?? null,
        };
      }),
    };
  }

  async messages(sessionId: string, userId: string) {
    const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const myClone = await this.prisma.digitalClone.findUnique({ where: { userId } });

    // 【缺陷3 修复】校验调用者的 clone 属于该 session，防止消息 IDOR
    if (!myClone || (session.cloneAId !== myClone.id && session.cloneBId !== myClone.id)) {
      throw new NotFoundException('Session not found');
    }

    const messages = await this.prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: [{ turnIndex: 'asc' }, { bubbleIndex: 'asc' }],
    });
    const speakerIds = [...new Set(messages.map((m) => m.speakerCloneId))];
    const clones = await this.prisma.digitalClone.findMany({
      where: { id: { in: speakerIds } },
      include: { user: { include: { profile: true } } },
    });
    const nameByCloneId = new Map(
      clones.map((c) => [c.id, c.user.profile?.displayName ?? '分身']),
    );
    return {
      session_status: session.status,
      wind_down_reason: session.windDownReason ?? null,
      wind_down_by: session.windDownBy ?? null,
      items: messages.map((m) => ({
        id: m.id,
        speaker_clone_id: m.speakerCloneId,
        content: m.content,
        turn_index: m.turnIndex,
        bubble_index: m.bubbleIndex,
        delay_ms: m.delayMs,
        created_at: m.createdAt.toISOString(),
        is_self: myClone ? m.speakerCloneId === myClone.id : false,
        speaker_name: nameByCloneId.get(m.speakerCloneId) ?? '分身',
      })),
    };
  }

  async affinityForUser(userId: string, sessionId: string) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { affinityScore: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    const myClone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!myClone || (session.cloneAId !== myClone.id && session.cloneBId !== myClone.id)) {
      throw new ForbiddenException();
    }
    const handoff = await this.prisma.handoff.findUnique({ where: { sessionId } });
    const score = session.affinityScore?.score ?? 0;
    return {
      session_id: session.id,
      affinity_score: score,
      affinity_percent: Math.round(score * 100),
      breakdown_json: session.affinityScore?.breakdownJson ?? null,
      handoff: handoff ? { id: handoff.id, status: handoff.status } : null,
    };
  }

  async relationshipForUser(userId: string, sessionId: string) {
    const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const myClone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!myClone || (session.cloneAId !== myClone.id && session.cloneBId !== myClone.id)) {
      throw new ForbiddenException();
    }
    const otherCloneId = session.cloneAId === myClone.id ? session.cloneBId : session.cloneAId;
    const query = new AffectionQueryService();
    const state = await query.getAffectionState(myClone.id, otherCloneId);
    const d = state.dimensions;
    let trustHint = 'moderate — confirm before stating inferred items as facts';
    if (d.trust >= 70) trustHint = 'high — statements treated as reliable';
    else if (d.trust <= 30) trustHint = 'low — verify before relying on memory';
    let tensionHint = 'low — tone may be relaxed';
    if (d.tension >= 40) tensionHint = 'elevated — keep responses neutral and concise';
    return {
      session_id: session.id,
      other_clone_id: otherCloneId,
      label: state.relationship_label,
      dimensions: d,
      composite_affinity: state.composite_affinity,
      hints: { trust: trustHint, tension: tensionHint },
      last_updated_at: state.last_updated_at,
    };
  }

  /** 请求结束聊天：将 session 设为 wind_down，24h 后由 worker 自动完成 */
  async requestEndChat(userId: string, sessionId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('请填写结束聊天的理由');
    }

    const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const myClone = await this.prisma.digitalClone.findUnique({
      where: { userId },
      include: { user: { include: { profile: true } } },
    });
    if (!myClone || (session.cloneAId !== myClone.id && session.cloneBId !== myClone.id)) {
      throw new ForbiddenException('你不是该会话的参与方');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('该会话已不在活跃状态');
    }

    const displayName = myClone.user?.profile?.displayName ?? '用户';

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: 'wind_down',
        windDownAt: new Date(),
        windDownReason: reason.trim(),
        windDownBy: displayName,
      },
    });

    return {
      success: true,
      session_id: sessionId,
      status: 'wind_down',
      message: `聊天将在 24 小时后自动结束。在此期间，双方分身会自然地告别。`,
    };
  }
}
