import { Injectable, NotFoundException } from '@nestjs/common';
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

  async messages(sessionId: string) {
    const session = await this.prisma.agentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const messages = await this.prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { turnIndex: 'asc' },
    });
    return {
      items: messages.map((m) => ({
        id: m.id,
        speaker_clone_id: m.speakerCloneId,
        content: m.content,
        turn_index: m.turnIndex,
        created_at: m.createdAt.toISOString(),
      })),
    };
  }
}
