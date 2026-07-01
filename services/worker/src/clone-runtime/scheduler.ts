import { CloneStatus, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { chat } from './llm';
import { formatBoundariesClause } from './boundaries';
import { getCloneMeta } from './meta';
// 【缺陷2修复】引入 composeSystemPrompt，发帖场景也走 composer 统一组装 system prompt
import { composeSystemPrompt } from '../agent-platform/composer/prompt-composer';

const IDLE_MS = Number(process.env.CLONE_IDLE_POST_HOURS ?? 24) * 60 * 60 * 1000;

export async function generatePostContent(
  prisma: PrismaClient,
  cloneId: string,
  trigger: string,
  context: Record<string, unknown> = {},
): Promise<string | null> {
  const clone = await prisma.digitalClone.findUnique({
    where: { id: cloneId },
    include: { personaPrompt: true, user: { include: { profile: true } } },
  });
  const persona = clone?.personaPrompt?.promptText ?? '友好真诚的分身';
  const name = clone?.user.profile?.displayName ?? '分身';
  const boundaryClause = formatBoundariesClause(clone?.personaPrompt?.boundariesJson);

  // 【缺陷2修复】改用 composeSystemPrompt() 组装 system prompt（与 agent-turn 一致），
  // safety/skill 层和 boundary 信息通过 composer 的 L1 安全层注入，不再手动拼接。
  const systemPrompt = composeSystemPrompt({ persona, boundaryClause });

  // 【缺陷2修复】user prompt 保留发帖场景的指令；chat() 返回 string | null，直接透传
  const userPrompt = `你是 ${name} 的数字分身。根据上述 persona 用中文写一条广场动态（80字内），语气一致。触发原因：${trigger}。\ncontext: ${JSON.stringify(context)}`;
  return chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
}

export async function runCloneRuntimeTick(
  prisma: PrismaClient,
  redis: Redis,
  connection: Redis,
  postDraftQueue: Queue,
): Promise<void> {
  const clones = await prisma.digitalClone.findMany({
    where: { status: CloneStatus.active },
  });
  const now = Date.now();

  for (const clone of clones) {
    const meta = await getCloneMeta(redis, clone.id);
    const lastActivity = Math.max(meta.lastPostAt, meta.lastSessionAt);
    if (lastActivity > 0 && now - lastActivity < IDLE_MS) continue;

    await postDraftQueue.add('draft', {
      cloneId: clone.id,
      content: '',
      trigger: 'idle',
      context: { idleHours: IDLE_MS / 3600000 },
    });
    console.log('[T_idle_post] queued for clone', clone.id);
  }
}

export async function enqueueAffinityPost(
  prisma: PrismaClient,
  connection: Redis,
  cloneId: string,
  sessionId: string,
  score: number,
  peerName: string,
  postDraftQueue: Queue,
): Promise<void> {
  await postDraftQueue.add('draft', {
    cloneId,
    content: '',
    trigger: 'affinity_boost',
    context: { sessionId, score, peerName },
  });
  console.log('[T_affinity_post] clone', cloneId, 'score', score);
}
