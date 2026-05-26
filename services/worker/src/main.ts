import 'dotenv/config';
import {
  PrismaClient,
  ModerationStatus,
  AgentSessionStatus,
  HandoffStatus,
  CloneStatus,
} from '@prisma/client';
import { Worker, Queue } from 'bullmq';
import { createRedisClient } from './create-redis';
import { chat } from './clone-runtime/llm';
import { bridgeMatchPushes, runDailyMatchJob } from './clone-runtime/match-bridge';
import { generatePostContent, runCloneRuntimeTick, enqueueAffinityPost } from './clone-runtime/scheduler';
import { getCloneMeta, setCloneMeta } from './clone-runtime/meta';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const connection = createRedisClient(redisUrl);

async function auditForClone(
  cloneId: string,
  eventType: string,
  summaryZh: string,
  referenceId?: string,
) {
  const clone = await prisma.digitalClone.findUnique({ where: { id: cloneId } });
  if (!clone) return;
  await prisma.auditEvent.create({
    data: {
      userId: clone.userId,
      cloneId,
      eventType,
      summaryZh,
      referenceId,
    },
  });
}

new Worker(
  'post-draft',
  async (job) => {
    const { cloneId, content, trigger, context } = job.data as {
      cloneId: string;
      content?: string;
      trigger?: string;
      context?: Record<string, unknown>;
    };
    let body = content?.trim() ?? '';
    if (!body) {
      body = await generatePostContent(prisma, cloneId, trigger ?? 'manual', context ?? {});
    }
    const post = await prisma.post.create({
      data: { cloneId, content: body, moderationStatus: ModerationStatus.pending },
    });
    const q = new Queue('moderation', { connection });
    await q.add('moderate', { postId: post.id, cloneId });
    await q.close();
    console.log('[post-draft]', trigger ?? 'manual', post.id);
  },
  { connection },
);

new Worker(
  'moderation',
  async (job) => {
    const { postId, cloneId } = job.data as { postId: string; cloneId?: string };
    const post = await prisma.post.update({
      where: { id: postId },
      data: { moderationStatus: ModerationStatus.approved, publishedAt: new Date() },
      include: { clone: true },
    });
    const cid = cloneId ?? post.cloneId;
    const now = Date.now();
    await setCloneMeta(connection, cid, { lastPostAt: now });
    await auditForClone(cid, 'post.publish', `发布动态：${post.content.slice(0, 48)}…`, postId);
    console.log('[moderation] approved', postId);
  },
  { connection },
);

new Worker(
  'match-daily',
  async () => {
    const newPushes = await runDailyMatchJob(prisma);
    await bridgeMatchPushes(prisma, connection, connection, newPushes);
    console.log('[match-daily] processed pushes', newPushes.length);
  },
  { connection },
);

new Worker(
  'agent-turn',
  async (job) => {
    const { sessionId } = job.data as { sessionId: string };
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { turnIndex: 'desc' }, take: 1 } },
    });
    if (!session || session.status !== AgentSessionStatus.active) return;

    const prevAffinity = await prisma.affinityScore.findUnique({ where: { sessionId } });
    const prevScore = prevAffinity?.score ?? 0.5;

    const last = session.messages[0];
    const turnIndex = (last?.turnIndex ?? -1) + 1;
    const speakerId = turnIndex % 2 === 0 ? session.cloneBId : session.cloneAId;
    const history = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { turnIndex: 'asc' },
    });

    const speaker = await prisma.digitalClone.findUnique({
      where: { id: speakerId },
      include: { personaPrompt: true },
    });
    const persona = speaker?.personaPrompt?.promptText ?? '';
    const content = await chat([
      {
        role: 'system',
        content: `你是约会分身对话。用中文简短回复一句。persona: ${persona}`,
      },
      ...history.map((m) => ({ role: 'user' as const, content: m.content })),
    ]);

    await prisma.agentMessage.create({
      data: { sessionId, speakerCloneId: speakerId, content, turnIndex },
    });

    const score = Math.min(0.95, 0.5 + turnIndex * 0.05);
    await prisma.affinityScore.upsert({
      where: { sessionId },
      create: { sessionId, score, breakdownJson: { turns: turnIndex } },
      update: { score, breakdownJson: { turns: turnIndex } },
    });

    const now = Date.now();
    await setCloneMeta(connection, session.cloneAId, { lastSessionAt: now });
    await setCloneMeta(connection, session.cloneBId, { lastSessionAt: now });

    const cloneA = await prisma.digitalClone.findUnique({
      where: { id: session.cloneAId },
      include: { user: { include: { profile: true } } },
    });
    const cloneB = await prisma.digitalClone.findUnique({
      where: { id: session.cloneBId },
      include: { user: { include: { profile: true } } },
    });

    if (cloneA) {
      await auditForClone(
        cloneA.id,
        'session.message',
        `会话发言：${content.slice(0, 40)}…`,
        sessionId,
      );
    }

    const delta = score - prevScore;
    if (score >= 0.7 || delta >= 0.1) {
      const peerForA = cloneB?.user.profile?.displayName ?? '对方分身';
      const peerForB = cloneA?.user.profile?.displayName ?? '对方分身';
      if (cloneA?.status === CloneStatus.active) {
        await enqueueAffinityPost(prisma, connection, cloneA.id, sessionId, score, peerForA);
      }
      if (cloneB?.status === CloneStatus.active) {
        await enqueueAffinityPost(prisma, connection, cloneB.id, sessionId, score, peerForB);
      }
    }

    if (score >= 0.75 && turnIndex >= 4 && cloneA && cloneB) {
      const existing = await prisma.handoff.findUnique({ where: { sessionId } });
      if (!existing) {
        await prisma.handoff.create({
          data: {
            sessionId,
            userAId: cloneA.userId,
            userBId: cloneB.userId,
            status: HandoffStatus.pending,
          },
        });
        console.log('[handoff] created for session', sessionId);
      }
    }

    if (turnIndex < 6) {
      const q = new Queue('agent-turn', { connection });
      await q.add('turn', { sessionId }, { delay: 2000 });
      await q.close();
    } else {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: AgentSessionStatus.completed, endedAt: new Date() },
      });
    }
    console.log('[agent-turn] session', sessionId, 'turn', turnIndex, 'score', score);
  },
  { connection },
);

console.log('Echo worker started (post-draft, moderation, match-daily, agent-turn, clone-runtime)');

async function bootstrap() {
  const q = new Queue('match-daily', { connection });
  await q.add('run', {});
  await q.close();
  await bridgeMatchPushes(prisma, connection, connection);
  await runCloneRuntimeTick(prisma, connection, connection);
}

void bootstrap();

setInterval(async () => {
  const q = new Queue('match-daily', { connection });
  await q.add('run', {});
  await q.close();
}, 24 * 60 * 60 * 1000);

setInterval(async () => {
  await runCloneRuntimeTick(prisma, connection, connection);
}, 15 * 60 * 1000);
