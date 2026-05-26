import { Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CloneActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, type?: string) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) throw new NotFoundException('Clone not found');

    const want = type ?? 'all';
    const items: Record<string, unknown>[] = [];

    if (want === 'all' || want === 'post') {
      const posts = await this.prisma.post.findMany({
        where: { cloneId: clone.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      for (const p of posts) {
        const pending = p.moderationStatus === ModerationStatus.pending;
        items.push({
          kind: 'post',
          id: p.id,
          post_id: p.id,
          content: p.content,
          moderation_status: p.moderationStatus,
          created_at: (p.publishedAt ?? p.createdAt).toISOString(),
          summary_zh: pending
            ? `动态审核中：${p.content.slice(0, 48)}…`
            : `发布动态：${p.content.slice(0, 48)}…`,
        });
      }
    }

    if (want === 'all' || want === 'like') {
      const likes = await this.prisma.like.findMany({
        where: { cloneId: clone.id },
        include: { post: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      for (const l of likes) {
        items.push({
          kind: 'like',
          id: `${l.postId}-${l.cloneId}`,
          post_id: l.postId,
          content: l.post.content.slice(0, 80),
          created_at: l.createdAt.toISOString(),
          summary_zh: `点赞了动态：${l.post.content.slice(0, 40)}…`,
        });
      }
    }

    if (want === 'all' || want === 'comment') {
      const comments = await this.prisma.comment.findMany({
        where: { cloneId: clone.id },
        include: { post: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      for (const c of comments) {
        items.push({
          kind: 'comment',
          id: c.id,
          post_id: c.postId,
          content: c.content,
          post_snippet: c.post.content.slice(0, 60),
          created_at: c.createdAt.toISOString(),
          summary_zh: `评论：${c.content.slice(0, 48)}…`,
        });
      }
    }

    if (want === 'all' || want === 'session') {
      const sessions = await this.prisma.agentSession.findMany({
        where: { OR: [{ cloneAId: clone.id }, { cloneBId: clone.id }] },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });
      for (const s of sessions) {
        const peerCloneId = s.cloneAId === clone.id ? s.cloneBId : s.cloneAId;
        const peer = await this.prisma.digitalClone.findUnique({
          where: { id: peerCloneId },
          include: { user: { include: { profile: true } } },
        });
        const lastMsg = await this.prisma.agentMessage.findFirst({
          where: { sessionId: s.id },
          orderBy: { turnIndex: 'desc' },
        });
        items.push({
          kind: 'session',
          id: s.id,
          session_id: s.id,
          peer_name: peer?.user.profile?.displayName ?? '分身',
          content: lastMsg?.content ?? '',
          status: s.status,
          created_at: s.startedAt.toISOString(),
          summary_zh: `与「${peer?.user.profile?.displayName ?? '分身'}」对话：${(lastMsg?.content ?? '').slice(0, 40)}…`,
        });
      }
    }

    items.sort((a, b) => {
      const ta = new Date(String(a.created_at)).getTime();
      const tb = new Date(String(b.created_at)).getTime();
      return tb - ta;
    });

    return { items };
  }
}
