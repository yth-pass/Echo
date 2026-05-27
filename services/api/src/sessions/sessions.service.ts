import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) return { items: [] };
    const sessions = await this.prisma.agentSession.findMany({
      where: { OR: [{ cloneAId: clone.id }, { cloneBId: clone.id }] },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return {
      items: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        started_at: s.startedAt.toISOString(),
        ended_at: s.endedAt?.toISOString() ?? null,
      })),
    };
  }

  async messages(sessionId: string, userId: string) {
    const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const myClone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    const messages = await this.prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { turnIndex: 'asc' },
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
      items: messages.map((m) => ({
        id: m.id,
        speaker_clone_id: m.speakerCloneId,
        content: m.content,
        turn_index: m.turnIndex,
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
}
