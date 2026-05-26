import { Injectable } from '@nestjs/common';
import { MatchPushStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const pushes = await this.prisma.matchPush.findMany({
      where: { userId, status: { not: MatchPushStatus.dismissed } },
      orderBy: { pushedAt: 'desc' },
      take: 50,
    });
    const items = await Promise.all(
      pushes.map(async (p) => {
        const profile = await this.prisma.profile.findUnique({
          where: { userId: p.candidateUserId },
        });
        const affinityPct = p.affinity != null ? Math.round(p.affinity * 100) : 0;
        const handoff = await this.prisma.handoff.findFirst({
          where: {
            OR: [
              { userAId: userId, userBId: p.candidateUserId },
              { userBId: userId, userAId: p.candidateUserId },
            ],
            status: 'pending',
          },
        });
        return {
          id: p.id,
          name: profile?.displayName ?? '候选用户',
          display_name: profile?.displayName ?? '候选用户',
          affinity: affinityPct,
          affinity_score: p.affinity ?? 0,
          status: p.status,
          handoff_id: handoff?.id ?? null,
          tags: profile?.city ? [profile.city] : [],
          bio: typeof profile?.bioJson === 'object' ? JSON.stringify(profile.bioJson) : '',
          match_reasons: ['向量相似度 MVP'],
        };
      }),
    );
    return { items, matches: items };
  }

  async dismiss(userId: string, matchId: string) {
    await this.prisma.matchPush.updateMany({
      where: { id: matchId, userId },
      data: { status: MatchPushStatus.dismissed },
    });
    return { dismissed: true };
  }

  async block(blockerUserId: string, blockedUserId: string) {
    await this.prisma.block.upsert({
      where: {
        blockerUserId_blockedUserId: { blockerUserId, blockedUserId },
      },
      create: { blockerUserId, blockedUserId },
      update: {},
    });
    return { blocked: true };
  }

  /** MVP: cosine on Json embeddings for all other users with embeddings */
  async runDailyMatchJob() {
    const embeddings = await this.prisma.profileEmbedding.findMany();
    for (const e of embeddings) {
      const others = embeddings.filter((o) => o.userId !== e.userId);
      const myVec = e.embedding as number[];
      const scored = others
        .map((o) => ({
          candidateUserId: o.userId,
          score: cosine(myVec, o.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      for (const s of scored) {
        const existing = await this.prisma.matchPush.findFirst({
          where: { userId: e.userId, candidateUserId: s.candidateUserId },
        });
        if (!existing) {
          await this.prisma.matchPush.create({
            data: {
              userId: e.userId,
              candidateUserId: s.candidateUserId,
              affinity: s.score,
            },
          });
        }
      }
    }
    return { processed: embeddings.length };
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
