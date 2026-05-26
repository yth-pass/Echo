import { AgentSessionStatus, CloneStatus, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { setCloneMeta } from './meta';

export async function runDailyMatchJob(prisma: PrismaClient): Promise<string[]> {
  const embeddings = await prisma.profileEmbedding.findMany();
  const newPushIds: string[] = [];
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
      const exists = await prisma.matchPush.findFirst({
        where: { userId: e.userId, candidateUserId: s.candidateUserId },
      });
      if (!exists) {
        const push = await prisma.matchPush.create({
          data: {
            userId: e.userId,
            candidateUserId: s.candidateUserId,
            affinity: s.score,
          },
        });
        newPushIds.push(push.id);
      }
    }
  }
  return newPushIds;
}

/** Start agent sessions for match pushes that do not yet have an active session. */
export async function bridgeMatchPushes(
  prisma: PrismaClient,
  redis: Redis,
  connection: Redis,
  pushIds?: string[],
): Promise<void> {
  const agentQ = new Queue('agent-turn', { connection });
  let pushes;
  if (pushIds?.length) {
    pushes = await prisma.matchPush.findMany({ where: { id: { in: pushIds } } });
  } else {
    pushes = await prisma.matchPush.findMany({ take: 50, orderBy: { pushedAt: 'desc' } });
  }
  for (const push of pushes) {
    const cloneA = await prisma.digitalClone.findUnique({
      where: { userId: push.userId },
    });
    const cloneB = await prisma.digitalClone.findUnique({
      where: { userId: push.candidateUserId },
    });
    if (!cloneA || !cloneB) continue;
    if (cloneA.status !== CloneStatus.active || cloneB.status !== CloneStatus.active) continue;

    const existing = await prisma.agentSession.findFirst({
      where: {
        status: AgentSessionStatus.active,
        OR: [
          { cloneAId: cloneA.id, cloneBId: cloneB.id },
          { cloneAId: cloneB.id, cloneBId: cloneA.id },
        ],
      },
    });
    if (existing) continue;

    const session = await prisma.agentSession.create({
      data: { cloneAId: cloneA.id, cloneBId: cloneB.id, status: AgentSessionStatus.active },
    });
    const now = Date.now();
    await setCloneMeta(redis, cloneA.id, { lastSessionAt: now });
    await setCloneMeta(redis, cloneB.id, { lastSessionAt: now });
    await agentQ.add('turn', { sessionId: session.id });
    console.log('[T_match_session] session', session.id, 'for push', push.id);
  }
  await agentQ.close();
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
