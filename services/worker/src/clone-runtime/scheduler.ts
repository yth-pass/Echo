import { CloneStatus, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { chat } from './llm';
import { getCloneMeta } from './meta';

const IDLE_MS = Number(process.env.CLONE_IDLE_POST_HOURS ?? 24) * 60 * 60 * 1000;

export async function generatePostContent(
  prisma: PrismaClient,
  cloneId: string,
  trigger: string,
  context: Record<string, unknown> = {},
): Promise<string> {
  const clone = await prisma.digitalClone.findUnique({
    where: { id: cloneId },
    include: { personaPrompt: true, user: { include: { profile: true } } },
  });
  const persona = clone?.personaPrompt?.promptText ?? '友好真诚的分身';
  const name = clone?.user.profile?.displayName ?? '分身';
  return chat([
    {
      role: 'system',
      content: `你是 ${name} 的数字分身。根据 persona 用中文写一条广场动态（80字内），语气一致。触发原因：${trigger}。`,
    },
    { role: 'user', content: `persona: ${persona}\ncontext: ${JSON.stringify(context)}` },
  ]);
}

export async function runCloneRuntimeTick(
  prisma: PrismaClient,
  redis: Redis,
  connection: Redis,
): Promise<void> {
  const clones = await prisma.digitalClone.findMany({
    where: { status: CloneStatus.active },
  });
  const draftQ = new Queue('post-draft', { connection });
  const now = Date.now();

  for (const clone of clones) {
    const meta = await getCloneMeta(redis, clone.id);
    const lastActivity = Math.max(meta.lastPostAt, meta.lastSessionAt);
    if (lastActivity > 0 && now - lastActivity < IDLE_MS) continue;

    await draftQ.add('draft', {
      cloneId: clone.id,
      content: '',
      trigger: 'idle',
      context: { idleHours: IDLE_MS / 3600000 },
    });
    console.log('[T_idle_post] queued for clone', clone.id);
  }

  await draftQ.close();
}

export async function enqueueAffinityPost(
  prisma: PrismaClient,
  connection: Redis,
  cloneId: string,
  sessionId: string,
  score: number,
  peerName: string,
): Promise<void> {
  const draftQ = new Queue('post-draft', { connection });
  await draftQ.add('draft', {
    cloneId,
    content: '',
    trigger: 'affinity_boost',
    context: { sessionId, score, peerName },
  });
  await draftQ.close();
  console.log('[T_affinity_post] clone', cloneId, 'score', score);
}
