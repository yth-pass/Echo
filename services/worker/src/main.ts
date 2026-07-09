import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  PrismaClient,
  ModerationStatus,
  AgentSessionStatus,
  HandoffStatus,
  CloneStatus,
} from '@prisma/client';
import { Worker, Queue, Job } from 'bullmq';
import { createRedisClient } from './create-redis';
// 【缺陷4修复】引入 chat 和 assertLlmKey，启动期检测 API key
import { chat, assertLlmKey } from './clone-runtime/llm';
import { bridgeMatchPushes, runDailyMatchJob } from './clone-runtime/match-bridge';
import { splitIntoBubbles } from './clone-runtime/bubble-splitter';
import { formatBoundariesClause, extractForbiddenWords, scanForbiddenWords } from './clone-runtime/boundaries';
import { generatePostContent, runCloneRuntimeTick, enqueueAffinityPost, runIdlePostCheck72h } from './clone-runtime/scheduler';
import { getCloneMeta, setCloneMeta } from './clone-runtime/meta';
import { publishLiveEvent } from './live-event';
import { composeSystemPrompt } from './agent-platform/composer/prompt-composer';
import { PromoteCheckService } from './agent-platform/memory/promote-check.service';
import type { Turn, ObjectiveFact, Preference } from './agent-platform/memory/types';
import { AffectionApplyService } from './agent-platform/affection/affection-apply.service';
import type { AffectionEvent as M6AffectionEvent } from './agent-platform/affection/types';
import { AffectionStateStore } from './agent-platform/affection/affection-state.store';
import { AffectionOverlayService } from './agent-platform/affection/affection-overlay.service';
import { DEFAULT_RECIPROCITY_CONFIG } from './agent-platform/affection/reciprocity.service';
import { runAffectionDecay } from './agent-platform/affection/affection-decay.job';
import { getMemoryBaseDir } from './agent-platform/affection/memory-base-dir';
import { createLogger } from '../../shared/observability';
import { ModerationService } from '../../api/src/moderation/moderation.service';
import type { LlmProvider } from '../../api/src/moderation/moderation.service';
import { UnifiedAnalysisService } from './agent-platform/merged/unified-analysis.service';
import type { UnifiedAnalysisResult } from './agent-platform/merged/types';
import { sendPush } from './clone-runtime/push';

const prisma = new PrismaClient();

const logger = createLogger('worker');
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const connection = createRedisClient(redisUrl);

/**
 * BullMQ Queue 单例
 *
 * 之前每次入队都 new Queue() + .close()，每次约消耗 10 条 Redis 命令。
 * 改为启动时创建一次、全局复用，显著减少 Redis 请求量。
 */
const moderationQueue = new Queue('moderation', { connection });
const manualReviewQueue = new Queue('manual-review', { connection });
const agentTurnQueue = new Queue('agent-turn', { connection });
const matchDailyQueue = new Queue('match-daily', { connection });
const postDraftQueue = new Queue('post-draft', { connection });

/** Clamp a number to [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : (min + max) / 2;
}

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

async function auditForUser(
  userId: string,
  eventType: string,
  summaryZh: string,
  referenceId?: string,
) {
  const clone = await prisma.digitalClone.findUnique({ where: { userId } });
  if (clone) {
    await auditForClone(clone.id, eventType, summaryZh, referenceId);
    return;
  }
  await prisma.auditEvent.create({
    data: { userId, eventType, summaryZh, referenceId },
  });
}

// 【步骤4修复】RelationshipLabel 健康度排序：rank >= good_terms 视为健康。
// 健康标签：good_terms / close（warmed_up 在当前类型不存在）。
// 排除：strained / distant / friendly_but_cautious / stranger / acquaintance / friendly_acquaintance。
const LABEL_RANK: Record<string, number> = {
  stranger: 0,
  acquaintance: 1,
  distant: 1,
  friendly_acquaintance: 2,
  friendly_but_cautious: 2,
  good_terms: 3,
  close: 4,
};
const HEALTHY_LABEL_RANK = LABEL_RANK['good_terms']; // >= good_terms

/**
 * 【步骤4修复】校验双方 AffectionState 的 relationship_label 是否都健康（>= good_terms）。
 * 分别读 (cloneA, cloneB) 与 (cloneB, cloneA) 两个视角；当前 per-pair 存储下两者解析到同一行，
 * 但保留双向读取以兼容未来方向性存储。任一视角未达健康阈值则返回 false。
 */
async function bothLabelsHealthy(cloneAId: string, cloneBId: string): Promise<boolean> {
  const store = new AffectionStateStore();
  const stateA = await store.read(cloneAId, cloneBId);
  const stateB = await store.read(cloneBId, cloneAId);
  const rankA = LABEL_RANK[stateA.relationship_label] ?? 0;
  const rankB = LABEL_RANK[stateB.relationship_label] ?? 0;
  return rankA >= HEALTHY_LABEL_RANK && rankB >= HEALTHY_LABEL_RANK;
}

async function buildSocialMemoryBlock(
  observerId: string,
  otherId: string,
): Promise<string | undefined> {
  const baseDir = getMemoryBaseDir();
  const factsPath = path.join(baseDir, 'users', observerId, 'social', 'by_agent', otherId, 'objective_facts.jsonl');
  const prefsPath = path.join(baseDir, 'users', observerId, 'social', 'by_agent', otherId, 'preferences.jsonl');

  const readJsonl = async (p: string): Promise<any[]> => {
    try {
      const raw = await fs.readFile(p, 'utf8');
      return raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  };

  const facts = await readJsonl(factsPath);
  const prefs = await readJsonl(prefsPath);
  if (!facts.length && !prefs.length) return undefined;

  const lines: string[] = [];
  lines.push('## About the other participant — observer view');

  const activeFacts = facts.filter((f) => f.status !== 'deprecated');
  if (activeFacts.length) {
    lines.push('### Confirmed facts ①');
    for (const f of activeFacts) {
      const text = f.fact || Object.values(f.attributes ?? {}).join('，');
      if (text) lines.push(`- [explicit] ${text}`);
    }
  }

  const activePrefs = prefs.filter((p) => p.status !== 'contradicted');
  if (activePrefs.length) {
    lines.push('### Preferences / inferences ②');
    for (const p of activePrefs) {
      const tag = p.pref_type === 'implicit_inferred'
        ? `inferred|${(p.confidence ?? 0).toFixed(2)}`
        : 'opinion';
      if (p.content) lines.push(`- [${tag}] ${p.content}`);
    }
  }

  return lines.length > 1 ? lines.join('\n') : undefined;
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

    // 【缺陷5修复】入口处检查 clone.status，paused 则跳过执行、不写消息
    const cloneForCheck = await prisma.digitalClone.findUnique({
      where: { id: cloneId },
      include: { personaPrompt: true },
    });
    if (!cloneForCheck || cloneForCheck.status !== CloneStatus.active) {
      // 【缺陷5修复】分身已暂停，跳过任务，写审计日志
      await auditForClone(cloneId, 'post.skip', '分身已暂停，跳过任务');
      logger.info('分身已暂停，跳过任务', { cloneId, status: cloneForCheck?.status });
      return;
    }

    let body = content?.trim() ?? '';
    if (!body) {
      // 【缺陷2/4修复】generatePostContent 现在走 composer，返回 string | null
      const generated = await generatePostContent(prisma, cloneId, trigger ?? 'manual', context ?? {});
      // 【缺陷4修复】chat() 返回 null 时不发帖，写审计日志
      if (!generated) {
        await auditForClone(cloneId, 'post.llm_failed', 'LLM 调用失败，发帖任务跳过');
        logger.warn('LLM 调用失败，发帖任务跳过', { cloneId });
        return;
      }
      body = generated;
    }

    // 【缺陷6修复】forbiddenWords 生成后校验：生成内容入库前扫描禁用词（大小写不敏感）
    const forbiddenWords = extractForbiddenWords(cloneForCheck.personaPrompt?.boundariesJson);
    if (forbiddenWords.length > 0) {
      let hit = scanForbiddenWords(body, forbiddenWords);
      if (hit) {
        // 【缺陷6修复】命中禁用词，尝试重新生成一次（最多 1 次）
        logger.warn('分身生成内容命中禁用词，尝试重新生成', { cloneId, hit });
        const regenerated = await generatePostContent(prisma, cloneId, trigger ?? 'manual', context ?? {});
        if (regenerated) {
          body = regenerated;
          hit = scanForbiddenWords(body, forbiddenWords);
        }
        if (hit) {
          // 【缺陷6修复】重新生成后仍命中，拦截不发帖，写审计日志
          await auditForClone(cloneId, 'post.blocked', `分身生成内容命中禁用词「${hit}」，已拦截`);
          logger.warn('分身生成内容命中禁用词，已拦截', { cloneId, hit });
          return;
        }
      }
    }

    const effectiveTrigger = trigger ?? 'manual';
    const post = await prisma.post.create({
      data: {
        cloneId,
        content: body,
        moderationStatus: ModerationStatus.pending,
        // 专用列：trigger !== 'manual' 即为自动生成（idle/idle_72h/affinity_boost/welcome/seed）
        isAutoGenerated: effectiveTrigger !== 'manual',
        // metadataJson 保留 trigger 用于审计与排查；isAutoGenerated 已迁移到专用列，不再冗余存储
        metadataJson: { trigger: effectiveTrigger },
      },
    });
    await moderationQueue.add('moderate', { postId: post.id, cloneId });
    logger.info('post drafted', { trigger: effectiveTrigger, postId: post.id, isAutoGenerated: effectiveTrigger !== 'manual' });
  },
  { connection },
);

new Worker(
  'moderation',
  async (job) => {
    const { postId, cloneId } = job.data as { postId: string; cloneId?: string };

    // Fetch post without immediately updating status.
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { clone: true },
    });
    if (!post) {
      logger.warn('moderation post not found', { postId });
      return;
    }

    const cid = cloneId ?? post.cloneId;

    // REQ-03: Two-stage moderation pipeline.
    const llmProvider: LlmProvider = {
      chat: async (msgs) => {
        const result = await chat(
          msgs.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
        );
        return result || null;
      },
    };
    const modSvc = new ModerationService(llmProvider);
    const result = await modSvc.moderate(post.content);

    if (result.verdict === 'unsafe') {
      await prisma.post.update({
        where: { id: postId },
        data: { moderationStatus: ModerationStatus.rejected },
      });
      await auditForClone(
        cid,
        'post.rejected',
        `动态被拒绝：${post.content.slice(0, 48)}…`,
        postId,
      );
      // 【缺陷6 修复】审核拒绝时通知帖子所属 clone 的用户，并发布 feed 事件通知前端刷新。
      // sendPush 为 best-effort，失败仅记录不抛出；publishLiveEvent 通知前端刷新 feed。
      sendPush(prisma, post.clone.userId, 'moderation_rejected', { postId }).catch(() => {});
      await publishLiveEvent(connection, {
        type: 'feed',
        userId: post.clone.userId,
        payload: { postId, moderationStatus: 'rejected' },
      });
      logger.warn('post rejected by moderation', {
        postId,
        reason: result.reason,
        words: result.words,
      });
    } else if (result.verdict === 'needs_review') {
      // 【缺陷11修复】needs_review 不再仅打日志：
      // 1. 将帖子状态置为 pending_review（新增枚举值，需 schema 迁移）
      // 2. 写入人工审核队列 'manual-review'（BullMQ queue，供后台审核消费）
      // 3. 发布 live event 通知管理员/前端刷新
      await prisma.post.update({
        where: { id: postId },
        data: { moderationStatus: ModerationStatus.pending_review },
      });
      await manualReviewQueue.add('review', {
        postId,
        cloneId: cid,
        reason: result.reason ?? 'needs_review',
        contentSnippet: post.content.slice(0, 200),
      });
      await auditForClone(
        cid,
        'post.needs_review',
        `动态需人工审核：${post.content.slice(0, 48)}…`,
        postId,
      );
      // 【缺陷11修复】发布 live event 通知前端（如有管理员界面可监听）
      await publishLiveEvent(connection, {
        type: 'feed',
        userId: post.clone.userId,
        payload: { postId, moderationStatus: 'pending_review' },
      });
      logger.info('post flagged for manual review, enqueued', {
        postId,
        reason: result.reason,
      });
    } else {
      // verdict === 'safe'
      await prisma.post.update({
        where: { id: postId },
        data: { moderationStatus: ModerationStatus.approved, publishedAt: new Date() },
      });
      const now = Date.now();
      await setCloneMeta(connection, cid, { lastPostAt: now });
      await auditForClone(
        cid,
        'post.publish',
        `发布动态：${post.content.slice(0, 48)}…`,
        postId,
      );
      await publishLiveEvent(connection, {
        type: 'feed',
        userId: post.clone.userId,
        payload: { postId },
      });
      logger.info('post approved', { postId });
    }
  },
  { connection },
);

new Worker(
  'match-daily',
  async (job) => {
    const force = !!(job.data as Record<string, unknown>)?.force;
    const newPushes = await runDailyMatchJob(prisma, { force });
    for (const pushId of newPushes) {
      const push = await prisma.matchPush.findUnique({ where: { id: pushId } });
      if (push) {
        await publishLiveEvent(connection, {
          type: 'match',
          userId: push.userId,
          payload: {
            matchPushId: push.id,
            candidateUserId: push.candidateUserId,
          },
        });
        // REQ-10: Push match notification.
        sendPush(prisma, push.userId, 'match_push', {
          matchPushId: push.id,
          candidateUserId: push.candidateUserId,
        }).catch(() => {});
      }
    }
    await bridgeMatchPushes(prisma, connection, connection, newPushes, agentTurnQueue);
    logger.info('match daily processed', { pushCount: newPushes.length });
  },
  { connection },
);

new Worker(
  'agent-turn',
  async (job) => {
    // 【缺陷1修复】从 job payload 接收 turnIndex（由 enqueueAgentTurn 传入），用于幂等去重
    const { sessionId, turnIndex } = job.data as { sessionId: string; turnIndex: number };

    // 幂等检查：检查该 turn 是否已有消息（通过 sessionId + turnIndex 判断）
    const existing = await prisma.agentMessage.findFirst({
      where: { sessionId, turnIndex },
    });
    if (existing) {
      logger.info('agent turn already processed (idempotent skip)', { sessionId, turnIndex });
      return;
    }

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { turnIndex: 'desc' }, take: 1 } },
    });
    if (!session || (session.status !== AgentSessionStatus.active && session.status !== AgentSessionStatus.wind_down)) return;

    const prevAffinity = await prisma.affinityScore.findUnique({ where: { sessionId } });
    const prevScore = prevAffinity?.score ?? 0.5;

    // 每日轮次限制检查（UTC+8）
    const DAILY_TURN_LIMIT = 100;
    const nowUTC8 = new Date(Date.now() + 8 * 3600 * 1000);
    const todayStr = nowUTC8.toISOString().slice(0, 10); // YYYY-MM-DD
    const sessionDateStr = session.dailyTurnDate ? new Date(session.dailyTurnDate.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) : null;

    if (sessionDateStr !== todayStr) {
      // 跨天：重置计数
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { dailyTurnCount: 0, dailyTurnDate: new Date() },
      });
    } else if (session.dailyTurnCount >= DAILY_TURN_LIMIT) {
      logger.info('daily turn limit reached, pausing until tomorrow', { sessionId, dailyTurnCount: session.dailyTurnCount });
      return; // 不入队下一轮，等待明天 daily job 恢复
    }

    // 【缺陷1修复】使用 payload 传入的 turnIndex（替代原先从 DB 计算的值），保证与 jobId/turnId 一致
    const speakerId = turnIndex % 2 === 0 ? session.cloneBId : session.cloneAId;
    const allMessages = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: [{ turnIndex: 'asc' }, { bubbleIndex: 'asc' }],
    });

    // 将同一 turn 的多个气泡合并为一段完整文本（用 \n 连接）
    const turnMap = new Map<number, { speakerCloneId: string; content: string }>();
    for (const m of allMessages) {
      const existing = turnMap.get(m.turnIndex);
      if (existing) {
        existing.content += '\n' + m.content;
      } else {
        turnMap.set(m.turnIndex, { speakerCloneId: m.speakerCloneId, content: m.content });
      }
    }
    const historyMerged = Array.from(turnMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([turnIdx, { speakerCloneId, content }]) => ({
        speakerCloneId,
        content,
        turnIndex: turnIdx,
      }));

    const speaker = await prisma.digitalClone.findUnique({
      where: { id: speakerId },
      include: { personaPrompt: true },
    });

    // 【缺陷5修复】检查说话分身状态，paused 则跳过执行、不写消息
    if (!speaker || speaker.status !== CloneStatus.active) {
      await auditForClone(speakerId, 'session.skip', '分身已暂停，跳过任务', sessionId);
      logger.info('分身已暂停，跳过任务', { sessionId, turnIndex, speakerId, status: speaker?.status });
      return;
    }

    const persona = speaker?.personaPrompt?.promptText ?? '';
    const boundaryClause = formatBoundariesClause(speaker?.personaPrompt?.boundariesJson);

    // M2 Style Engine — L2 style.md 注入（说话者本人风格）
    let augmentedPersona = persona;
    if (speaker?.userId) {
      try {
        const profile = await prisma.profile.findUnique({
          where: { userId: speaker.userId },
          select: { styleMd: true },
        });
        if (profile?.styleMd) {
          augmentedPersona = `${persona}\n\n沟通风格指导:\n${profile.styleMd}`;
        }
      } catch (err) {
        logger.warn('failed to read style.md for L2 persona', {
          error: err instanceof Error ? err.message : String(err),
          userId: speaker.userId,
        });
      }
    }

    // M6: Inject session_contact at first turn of each session — accumulates familiarity
    if (turnIndex === 0) {
      try {
        const contactSvc = new AffectionApplyService(undefined, { ...DEFAULT_RECIPROCITY_CONFIG, enabled: true });
        const now = new Date().toISOString();
        const makeContactEvent = (observerId: string, otherId: string, id: string): M6AffectionEvent => ({
          id,
          observer_id: observerId,
          other_id: otherId,
          event_type: 'session_contact',
          deltas: {},
          evidence: { joint_session_id: sessionId, turn_ids: [0], strength: 'weak' },
          at: now,
          correlation_id: `${sessionId}:session_contact:${observerId}:${otherId}`,
        });
        await contactSvc.apply(session.cloneAId, session.cloneBId, [
          makeContactEvent(session.cloneAId, session.cloneBId, `evt_sc_${Date.now()}_a`),
        ]);
        await contactSvc.apply(session.cloneBId, session.cloneAId, [
          makeContactEvent(session.cloneBId, session.cloneAId, `evt_sc_${Date.now()}_b`),
        ]);
        logger.info('session_contact injected', {
          cloneAId: session.cloneAId,
          cloneBId: session.cloneBId,
        });
      } catch (err) {
        logger.warn('session_contact injection failed', {
          error: err instanceof Error ? err.message : String(err),
          sessionId,
          cloneAId: session.cloneAId,
          cloneBId: session.cloneBId,
        });
      }
    }

    // M6 R3: Inject relationship overlay into system prompt for joint sessions
    const otherSpeakerId = speakerId === session.cloneAId ? session.cloneBId : session.cloneAId;
    let affectionOverlay: string | undefined;
    try {
      const overlaySvc = new AffectionOverlayService();
      affectionOverlay = await overlaySvc.render(speakerId, otherSpeakerId);
    } catch (err) {
      logger.warn('affection overlay render failed', {
        error: err instanceof Error ? err.message : String(err),
        sessionId,
        speakerId,
        otherSpeakerId,
      });
    }
    let socialMemory: string | undefined;
    try {
      socialMemory = await buildSocialMemoryBlock(speakerId, otherSpeakerId);
    } catch (err) {
      logger.warn('failed to retrieve social memory for L6', {
        error: err instanceof Error ? err.message : String(err),
        speakerId,
        otherSpeakerId,
      });
    }
    // Wind-down context: 当 session 处于 wind_down 状态时注入告别提示
    let windDownContext: string | undefined;
    if (session.status === AgentSessionStatus.wind_down && session.windDownReason) {
      const requesterName = session.windDownBy ?? '用户';
      windDownContext = [
        `[系统提示] 这次聊天即将结束。${requesterName} 表示希望结束这次对话，原因是："${session.windDownReason}"。`,
        '请在聊天中自然地提及告别，感谢对方的陪伴，并温和地解释结束的原因。',
        '保持友好的语气，不要表现出受伤或愤怒。',
      ].join('\n');
    }

    const systemPrompt = composeSystemPrompt({
      persona: augmentedPersona,
      boundaryClause,
      affectionOverlay,
      socialMemory,
      windDownContext,
    });
    const rawContent = await chat([
      { role: 'system', content: systemPrompt },
      ...historyMerged.map((m) => ({
        role: (m.speakerCloneId === speakerId ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      })),
    ]);

    // chat() 返回 null 时（LLM 调用失败）
    if (rawContent === null) {
      // 注：当前 Prisma 枚举 AgentSessionStatus 仅有 active/completed/cancelled，
      // 此处用 cancelled 表示异常终止；'error' 状态待阶段4 schema 迁移后启用。
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: AgentSessionStatus.cancelled },
      });
      await auditForClone(speakerId, 'session.llm_failed', 'LLM 调用失败，会话标记错误', sessionId);
      // 【缺陷4修复】通知前端会话出错（best-effort，失败不阻断）
      if (speaker?.userId) {
        await publishLiveEvent(connection, {
          type: 'session_error',
          userId: speaker.userId,
          payload: { sessionId, reason: 'llm_failed', turnIndex },
        }).catch(() => {});
      }
      logger.error('LLM 调用失败，会话标记错误', { sessionId, turnIndex });
      return;
    }

    // 气泡拆分：将 LLM 原始回复拆分为多个聊天气泡
    const bubbles = splitIntoBubbles(rawContent, {
      enableImperfection: session.status !== AgentSessionStatus.wind_down,
    });

    // 持久化每个气泡为一条 AgentMessage
    for (let i = 0; i < bubbles.length; i++) {
      await prisma.agentMessage.create({
        data: {
          sessionId,
          speakerCloneId: speakerId,
          content: bubbles[i].content,
          turnIndex,
          bubbleIndex: i,
          delayMs: bubbles[i].delayMs,
          turnId: `${sessionId}-${turnIndex}-${i}`,
        },
      });
    }

    // 递增每日轮次计数
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        dailyTurnCount: { increment: 1 },
        dailyTurnDate: new Date(),
      },
    });

    // REQ-08: Unified analysis replaces TopicJudge + SocialExtract + RelationshipExtract.
    // Stores result in session metadata for M5/M6 triggers to consume.
    let m6Triggered = false;
    let unifiedResult: UnifiedAnalysisResult | null = null;
    const meta = (session as any).metadataJson || {};
    let currentTopic: any = meta.current_topic || {
      main_topic: { topic_id: `main_${Date.now()}`, label: 'Conversation start', phase: 'opening', summary: '' },
      active_subtopic: null,
      subtopic_history: [],
      focus: 'main',
    };

    try {
      const unifiedSvc = new UnifiedAnalysisService();
      const fullTurns: Turn[] = historyMerged.map((m, idx) => ({
        speaker_id: m.speakerCloneId,
        content: m.content,
        turn_index: m.turnIndex ?? idx,
      }));
      fullTurns.push({ speaker_id: speakerId, content: rawContent, turn_index: turnIndex });
      unifiedResult = await unifiedSvc.analyze(
        fullTurns,
        session.cloneAId,
        session.cloneBId,
        sessionId,
      );

      // --- Topic state machine (from unifiedResult.topic) ---
      const ut = unifiedResult.topic;
      if (ut.main_topic_update?.summary) {
        currentTopic.main_topic.summary = ut.main_topic_update.summary.slice(0, 150);
      }
      if (ut.main_topic_update?.label) {
        currentTopic.main_topic.label = ut.main_topic_update.label.slice(0, 80);
      }
      if (ut.transition === 'new_sub' && ut.subtopic) {
        currentTopic.active_subtopic = {
          topic_id: `sub_${Date.now()}`,
          label: ut.subtopic.label,
          summary: ut.subtopic.summary?.slice(0, 150),
        };
        currentTopic.focus = 'sub';
      }
      if (ut.transition === 'return_to_main' && currentTopic.active_subtopic) {
        currentTopic.subtopic_history = currentTopic.subtopic_history || [];
        currentTopic.subtopic_history.push({
          ...currentTopic.active_subtopic,
          ended_at: new Date().toISOString(),
        });
        currentTopic.active_subtopic = null;
        currentTopic.focus = 'main';
      }
      if (ut.transition === 'new_main' && ut.new_main_topic) {
        const topicHistory = meta.topic_history || [];
        topicHistory.push({ ...currentTopic, archived_at: new Date().toISOString() });
        currentTopic = {
          main_topic: {
            topic_id: `main_${Date.now()}`,
            label: ut.new_main_topic.label,
            phase: 'opening' as const,
            summary: ut.new_main_topic.summary?.slice(0, 150) || '',
          },
          active_subtopic: null,
          subtopic_history: [],
          focus: 'main' as const,
        };
        meta.topic_history = topicHistory;
      }
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          metadataJson: {
            ...meta,
            current_topic: currentTopic,
            last_topic_judge: ut,
            last_unified_analysis: unifiedResult
              ? { social: unifiedResult.social, affection: unifiedResult.affection }
              : undefined,
          } as any,
        } as any,
      });

      logger.info('unified analysis stored', {
        sessionId,
        turnIndex,
        transition: ut.transition,
        sentiment: unifiedResult.affection.sentiment,
        compatibility: unifiedResult.affection.compatibility,
      });
    } catch (err) {
      logger.warn('unified analysis failed', {
        error: err instanceof Error ? err.message : String(err),
        sessionId,
        turnIndex,
      });
    }

    // REQ-08: Unified M5/M6 pipeline — replaces SocialExtract & RelationshipExtract
    // LLM calls with data from UnifiedAnalysisResult. PromoteCheck & AffectionApply
    // still run as before.
    async function runM5M6Unified(
      cloneAId: string,
      cloneBId: string,
      turns: Turn[],
      sid: string,
      result: UnifiedAnalysisResult,
    ): Promise<void> {
      const promoteSvc = new PromoteCheckService();
      const affectionStateStore = new AffectionStateStore();
      const baseDir = getMemoryBaseDir();
      const now = new Date().toISOString();

      // Helper: write social facts to JSONL files (mirrors SocialExtract paths)
      async function writeFactsFromUnified(
        observerId: string,
        otherId: string,
      ): Promise<void> {
        const factsPath = path.join(
          baseDir,
          'users',
          observerId,
          'social',
          'by_agent',
          otherId,
          'objective_facts.jsonl',
        );
        const prefsPath = path.join(
          baseDir,
          'users',
          observerId,
          'social',
          'by_agent',
          otherId,
          'preferences.jsonl',
        );

        const otherFacts = result.social.facts.filter(
          (f) => f.agent_id === otherId,
        );
        const facts: ObjectiveFact[] = otherFacts.map((f, i) => ({
          id: `fact_unified_${Date.now()}_${i}`,
          subject_agent_id: otherId,
          fact: f.observer_relative.preference
            ?? f.observer_relative.dislike
            ?? f.observer_relative.habit
            ?? f.observer_relative.other_tag
            ?? '',
          fact_scope: 'about_self' as const,
          fact_type: 'explicit_statement' as const,
          confidence: f.observer_relative.confidence ?? 0.85,
          status: 'active' as const,
          source: {
            session_id: sid,
            speaker_id: otherId,
            turn_ids: turns
              .filter((t) => t.speaker_id === otherId)
              .map((t) => t.turn_index ?? 0),
          },
          extracted_at: now,
        }));

        const prefs: Preference[] = otherFacts.map((f, i) => ({
          id: `pref_unified_${Date.now()}_${i}`,
          subject_agent_id: otherId,
          content: f.observer_relative.preference
            ?? f.observer_relative.other_tag
            ?? '',
          pref_type: 'implicit_inferred' as const,
          confidence: (f.observer_relative.confidence ?? 0.7) * 0.8,
          status: 'candidate' as const,
          source: {
            session_id: sid,
            turn_ids: turns
              .filter((t) => t.speaker_id === otherId)
              .map((t) => t.turn_index ?? 0),
          },
          extracted_at: now,
        }));

        if (facts.length > 0 || prefs.length > 0) {
          await fs.mkdir(path.dirname(factsPath), { recursive: true });
          await fs.appendFile(
            factsPath,
            facts.map((f) => JSON.stringify(f)).join('\n') + (facts.length ? '\n' : ''),
            'utf8',
          );
          await fs.appendFile(
            prefsPath,
            prefs.map((p) => JSON.stringify(p)).join('\n') + (prefs.length ? '\n' : ''),
            'utf8',
          );
        }
      }

      // ----- A→B -----
      try {
        await writeFactsFromUnified(cloneAId, cloneBId);
      } catch (err) {
        logger.warn('writeFacts A->B failed', {
          error: err instanceof Error ? err.message : String(err),
          sessionId: sid,
        });
      }

      const resA = await promoteSvc.check(cloneAId, cloneBId, turns, sid);
      if (resA.events.length > 0) {
        logger.info('M5 promote events', {
          observerId: cloneAId.slice(-6),
          otherId: cloneBId.slice(-6),
          eventTypes: resA.events.map((e) => e.event_type),
          sessionId: sid,
        });
        try {
          const affectionSvc = new AffectionApplyService(undefined, {
            ...DEFAULT_RECIPROCITY_CONFIG,
            enabled: true,
          });
          const m6Events: M6AffectionEvent[] = resA.events.map((e) => ({
            id: e.id,
            observer_id: e.observer_id,
            other_id: e.other_id,
            event_type: e.event_type,
            deltas: e.deltas,
            evidence: { ...e.evidence, strength: 'moderate' as const },
            at: e.at,
            correlation_id: `${sid}:promote:${e.event_type}:${e.other_id}:${e.id}`,
          }));
          await affectionSvc.apply(cloneAId, cloneBId, m6Events);
        } catch (err) {
          logger.warn('M5 promote apply failed', {
            error: err instanceof Error ? err.message : String(err),
            observerId: cloneAId,
            otherId: cloneBId,
            sessionId: sid,
          });
        }
      }

      // M6: Affection events from unified analysis → apply for A→B
      const affEventsA = (result.affection.events ?? [])
        .filter((e) => e.confidence >= 0.6)
        .map((e, i) => ({
          id: `evt_ua_${Date.now()}_a_${i}`,
          observer_id: cloneAId,
          other_id: cloneBId,
          event_type: e.event_type as M6AffectionEvent['event_type'],
          deltas: {},
          evidence: {
            joint_session_id: sid,
            turn_ids: e.turn_ids,
            strength: e.strength,
            evidence_span: e.evidence_span,
          },
          at: now,
          correlation_id: `${sid}:unified:${e.event_type}:${cloneBId}:${Date.now()}`,
        })) as M6AffectionEvent[];

      if (affEventsA.length > 0) {
        logger.info('M6 unified affection events A->B', {
          observerId: cloneAId.slice(-6),
          otherId: cloneBId.slice(-6),
          eventTypes: affEventsA.map((e) => e.event_type),
          sessionId: sid,
        });
        try {
          const priorA = await affectionStateStore.read(cloneAId, cloneBId);
          const affectionSvc = new AffectionApplyService(undefined, {
            ...DEFAULT_RECIPROCITY_CONFIG,
            enabled: true,
          });
          await affectionSvc.apply(cloneAId, cloneBId, affEventsA, {
            priorState: priorA,
            incrementalTurns: turns,
          });
        } catch (err) {
          logger.warn('M6 unified affection apply A->B failed', {
            error: err instanceof Error ? err.message : String(err),
            sessionId: sid,
          });
        }
      }

      // ----- B→A (symmetric) -----
      try {
        await writeFactsFromUnified(cloneBId, cloneAId);
      } catch (err) {
        logger.warn('writeFacts B->A failed', {
          error: err instanceof Error ? err.message : String(err),
          sessionId: sid,
        });
      }

      const resB = await promoteSvc.check(cloneBId, cloneAId, turns, sid);
      if (resB.events.length > 0) {
        logger.info('M5 promote events', {
          observerId: cloneBId.slice(-6),
          otherId: cloneAId.slice(-6),
          eventTypes: resB.events.map((e) => e.event_type),
          sessionId: sid,
        });
        try {
          const affectionSvc = new AffectionApplyService(undefined, {
            ...DEFAULT_RECIPROCITY_CONFIG,
            enabled: true,
          });
          const m6Events: M6AffectionEvent[] = resB.events.map((e) => ({
            id: e.id,
            observer_id: e.observer_id,
            other_id: e.other_id,
            event_type: e.event_type,
            deltas: e.deltas,
            evidence: { ...e.evidence, strength: 'moderate' as const },
            at: e.at,
            correlation_id: `${sid}:promote:${e.event_type}:${e.other_id}:${e.id}`,
          }));
          await affectionSvc.apply(cloneBId, cloneAId, m6Events);
        } catch (err) {
          logger.warn('M5 promote apply failed', {
            error: err instanceof Error ? err.message : String(err),
            observerId: cloneBId,
            otherId: cloneAId,
            sessionId: sid,
          });
        }
      }

      // M6: Affection events from unified analysis → apply for B→A
      const affEventsB = (result.affection.events ?? [])
        .filter((e) => e.confidence >= 0.6)
        .map((e, i) => ({
          id: `evt_ua_${Date.now()}_b_${i}`,
          observer_id: cloneBId,
          other_id: cloneAId,
          event_type: e.event_type as M6AffectionEvent['event_type'],
          deltas: {},
          evidence: {
            joint_session_id: sid,
            turn_ids: e.turn_ids,
            strength: e.strength,
            evidence_span: e.evidence_span,
          },
          at: now,
          correlation_id: `${sid}:unified:${e.event_type}:${cloneAId}:${Date.now()}`,
        })) as M6AffectionEvent[];

      if (affEventsB.length > 0) {
        logger.info('M6 unified affection events B->A', {
          observerId: cloneBId.slice(-6),
          otherId: cloneAId.slice(-6),
          eventTypes: affEventsB.map((e) => e.event_type),
          sessionId: sid,
        });
        try {
          const priorB = await affectionStateStore.read(cloneBId, cloneAId);
          const affectionSvc = new AffectionApplyService(undefined, {
            ...DEFAULT_RECIPROCITY_CONFIG,
            enabled: true,
          });
          await affectionSvc.apply(cloneBId, cloneAId, affEventsB, {
            priorState: priorB,
            incrementalTurns: turns,
          });
        } catch (err) {
          logger.warn('M6 unified affection apply B->A failed', {
            error: err instanceof Error ? err.message : String(err),
            sessionId: sid,
          });
        }
      }
    }

    // M5/M6 trigger #1: Topic transition (return_to_main / new_main) from unified
    try {
      const transition = unifiedResult?.topic.transition ?? 'continue_main';
      if (transition === 'return_to_main' || transition === 'new_main') {
        m6Triggered = true;
        logger.info('M6 topic transition trigger', { transition, sessionId });
        const fullTurns: Turn[] = historyMerged.map((m, idx) => ({
          speaker_id: m.speakerCloneId,
          content: m.content,
          turn_index: m.turnIndex ?? idx,
        }));
        fullTurns.push({ speaker_id: speakerId, content: rawContent, turn_index: turnIndex });
        if (unifiedResult) {
          await runM5M6Unified(
            session.cloneAId,
            session.cloneBId,
            fullTurns,
            sessionId,
            unifiedResult,
          );
        }
      }
    } catch (err) {
      logger.warn('M5/M6 transition trigger failed', {
        error: err instanceof Error ? err.message : String(err),
        sessionId,
        transition: unifiedResult?.topic.transition,
      });
    }

    // M5/M6 trigger #2: Session-end fallback
    if (!m6Triggered && turnIndex >= 5) {
      logger.info('M6 session-end fallback triggered', { sessionId: sessionId.slice(-8) });
      try {
        const fullTurns: Turn[] = historyMerged.map((m, idx) => ({
          speaker_id: m.speakerCloneId,
          content: m.content,
          turn_index: m.turnIndex ?? idx,
        }));
        fullTurns.push({ speaker_id: speakerId, content: rawContent, turn_index: turnIndex });
        if (unifiedResult) {
          await runM5M6Unified(
            session.cloneAId,
            session.cloneBId,
            fullTurns,
            sessionId,
            unifiedResult,
          );
          m6Triggered = true;
        }
      } catch (err) {
        logger.warn('M5/M6 session-end fallback failed', {
          error: err instanceof Error ? err.message : String(err),
          sessionId,
          turnIndex,
        });
      }
    }

    // REQ-02: Real affinity score from unified analysis.
    // Weighted combination of affection dimensions, EMA smoothing.
    const ALPHA = 0.3;
    let turnScore: number;
    if (unifiedResult) {
      const aff = unifiedResult.affection;
      turnScore =
        aff.sentiment * 0.25 +
        aff.topic_overlap * 0.25 +
        aff.compatibility * 0.30 +
        aff.engagement * 0.20;
    } else {
      // 【步骤6修复】fallback 改为固定中性分数 0.5（不随 turnIndex 递增），
      // 避免无 LLM 结果时人为推高 affinity 触发误 handoff。写审计日志。
      logger.warn('unified analysis unavailable, using neutral fallback score', {
        sessionId,
        turnIndex,
      });
      turnScore = 0.5;
      try {
        await auditForClone(speakerId, 'session.fallback_score', 'LLM 失败，使用中性分数', sessionId);
      } catch {
        // 审计失败不阻断主流程
      }
    }
    const previousScore = prevAffinity?.score ?? 0.5;
    const score = clamp(previousScore * (1 - ALPHA) + turnScore * ALPHA, 0, 1);

    await prisma.affinityScore.upsert({
      where: { sessionId },
      create: {
        sessionId,
        score,
        breakdownJson: {
          turns: turnIndex,
          sentiment: unifiedResult?.affection.sentiment,
          topic_overlap: unifiedResult?.affection.topic_overlap,
          compatibility: unifiedResult?.affection.compatibility,
          engagement: unifiedResult?.affection.engagement,
          turn_score: turnScore,
          previous_score: previousScore,
          alpha: ALPHA,
        },
      },
      update: {
        score,
        breakdownJson: {
          turns: turnIndex,
          sentiment: unifiedResult?.affection.sentiment,
          topic_overlap: unifiedResult?.affection.topic_overlap,
          compatibility: unifiedResult?.affection.compatibility,
          engagement: unifiedResult?.affection.engagement,
          turn_score: turnScore,
          previous_score: previousScore,
          alpha: ALPHA,
        },
      },
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

    const affinityPercent = Math.round(score * 100);
    const affinityPayload = { sessionId, affinityPercent, score };
    if (cloneA) {
      await publishLiveEvent(connection, {
        type: 'affinity',
        userId: cloneA.userId,
        payload: affinityPayload,
      });
    }
    if (cloneB) {
      await publishLiveEvent(connection, {
        type: 'affinity',
        userId: cloneB.userId,
        payload: affinityPayload,
      });
    }

    if (cloneA) {
      await auditForClone(
        cloneA.id,
        'session.message',
        `会话发言：${rawContent.slice(0, 40)}…`,
        sessionId,
      );
    }

    const delta = score - prevScore;
    if (score >= 0.7 || delta >= 0.1) {
      const peerForA = cloneB?.user.profile?.displayName ?? '对方分身';
      const peerForB = cloneA?.user.profile?.displayName ?? '对方分身';
      if (cloneA?.status === CloneStatus.active) {
        await enqueueAffinityPost(prisma, connection, cloneA.id, sessionId, score, peerForA, postDraftQueue);
      }
      if (cloneB?.status === CloneStatus.active) {
        await enqueueAffinityPost(prisma, connection, cloneB.id, sessionId, score, peerForB, postDraftQueue);
      }
    }

    // 【步骤4修复】触发条件增加 bothLabelsHealthy：要求双方 AffectionState 的 relationship_label
    // 都 >= good_terms（good_terms / close），排除 strained / acquaintance / stranger 等。
    let labelsHealthy = false;
    if (cloneA && cloneB) {
      try {
        labelsHealthy = await bothLabelsHealthy(cloneA.id, cloneB.id);
      } catch (err) {
        logger.warn('bothLabelsHealthy check failed, defaulting to unhealthy', {
          error: err instanceof Error ? err.message : String(err),
          sessionId,
        });
      }
    }
    if (score >= 0.75 && turnIndex >= 4 && labelsHealthy && cloneA && cloneB) {
      const existing = await prisma.handoff.findUnique({ where: { sessionId } });
      if (!existing) {
        const handoff = await prisma.handoff.create({
          data: {
            sessionId,
            userAId: cloneA.userId,
            userBId: cloneB.userId,
            status: HandoffStatus.pending,
            // 【步骤5修复】创建时设过期时间 now + 7 days，超时 cron 置为 expired
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        const handoffPayload = {
          handoffId: handoff.id,
          sessionId,
          status: 'pending',
        };
        await publishLiveEvent(connection, {
          type: 'handoff',
          userId: cloneA.userId,
          payload: handoffPayload,
        });
        await publishLiveEvent(connection, {
          type: 'handoff',
          userId: cloneB.userId,
          payload: handoffPayload,
        });
        logger.info('handoff created', { sessionId });

        // REQ-10: Push both users on handoff creation.
        sendPush(prisma, cloneA.userId, 'handoff', {
          handoffId: handoff.id,
          sessionId,
        }).catch(() => {});
        sendPush(prisma, cloneB.userId, 'handoff', {
          handoffId: handoff.id,
          sessionId,
        }).catch(() => {});
      }
    }

    // Wind-down 24h 自动完成检查
    if (session.status === AgentSessionStatus.wind_down && session.windDownAt) {
      const hoursSinceWindDown = (Date.now() - session.windDownAt.getTime()) / (1000 * 3600);
      if (hoursSinceWindDown >= 24) {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { status: AgentSessionStatus.completed, endedAt: new Date() },
        });
        logger.info('wind-down period ended, session completed', { sessionId, turnIndex });
        return; // 不入队下一轮
      }
    }

    // 自链入队下一轮（无固定轮次上限，由每日限额控制）
    const nextTurnIndex = turnIndex + 1;
    await agentTurnQueue.add('turn', { sessionId, turnIndex: nextTurnIndex }, {
      jobId: `agent-turn:${sessionId}:${nextTurnIndex}`,
      delay: 3000,
    });

    logger.info('agent turn completed', { sessionId, turnIndex, score });
  },
  { connection },
);

new Worker(
  'report-triage',
  async (job) => {
    const { reportId, targetType, targetId, reporterId, reason } = job.data as {
      reportId: string;
      targetType: string;
      targetId: string;
      reporterId: string;
      reason?: string;
    };
    const reasonSnippet = reason?.trim() ? reason.trim().slice(0, 48) : '';
    const summary = reasonSnippet
      ? `举报已受理（${targetType}）：${reasonSnippet}…`
      : `举报已受理（${targetType}）`;

    if (targetType === 'post') {
      const post = await prisma.post.findUnique({ where: { id: targetId } });
      if (post?.moderationStatus === ModerationStatus.approved) {
        await prisma.post.update({
          where: { id: targetId },
          data: { moderationStatus: ModerationStatus.pending, publishedAt: null },
        });
        await auditForClone(
          post.cloneId,
          'report.post_flagged',
          `动态因举报重新进入审核：${post.content.slice(0, 40)}…`,
          reportId,
        );
        // 【缺陷3 修复】举报触发重审：将帖子重新入队 moderation 队列再次审核。
        // 使用单例 Queue，不再每次 new + close。
        await moderationQueue.add('moderate', { postId: targetId });
        // 审计：举报触发重审
        await auditForClone(
          post.cloneId,
          'report.remoderate',
          `举报触发重审，已重新入队审核：${post.content.slice(0, 40)}…`,
          reportId,
        );
        logger.info('report triggered re-moderation', { reportId, postId: targetId });
      }
    }

    await auditForUser(reporterId, 'report.submit', summary, reportId);
    logger.info('report triaged', { reportId, targetType, targetId });
  },
  { connection },
);

// 【任务4·人工审核队列消费】manual-review 队列：消费 needs_review 入队的待审核帖子。
// MVP 阶段仅记录日志 + 审计，等待后续管理员后台界面接入（届时可发布通知或写入 admin_inbox）。
// 复用现有 auditForClone 与 logger；消费方幂等——同一帖子若被多次入队，审计表会留多条记录，
// 但不影响主流程，后续管理员界面可按 postId 去重展示。
new Worker(
  'manual-review',
  async (job: Job<{ postId: string; cloneId: string; reason: string; contentSnippet: string }>) => {
    const { postId, cloneId, reason, contentSnippet } = job.data;
    logger.info('manual review item received', { postId, cloneId, reason });
    await auditForClone(
      cloneId,
      'post.needs_review_queued',
      `动态已进入人工审核队列：${contentSnippet.slice(0, 48)}…（原因：${reason}）`,
      postId,
    );
  },
  { connection },
);

// 【缺陷4修复】启动期检测 API key，缺失则直接 throw，不让 worker 启动
assertLlmKey();

console.log(
  'Echo worker started (post-draft, moderation, match-daily, agent-turn, report-triage, manual-review, clone-runtime, idle-72h-post)',
);

/**
 * bootstrap：启动时初始化 match-daily + bridgeMatchPushes + cloneRuntimeTick。
 * 开发时设 DEV_SKIP_BOOTSTRAP=true 可跳过，避免热重载反复烧 Redis 请求。
 */
async function bootstrap() {
  if (process.env.DEV_SKIP_BOOTSTRAP === 'true') {
    logger.info('bootstrap skipped (DEV_SKIP_BOOTSTRAP=true)');
    return;
  }
  await matchDailyQueue.add('run', {});
  await bridgeMatchPushes(prisma, connection, connection, undefined, agentTurnQueue);
  await runCloneRuntimeTick(prisma, connection, connection, postDraftQueue);
}

void bootstrap();

setInterval(async () => {
  await matchDailyQueue.add('run', {});
}, 24 * 60 * 60 * 1000);

setInterval(async () => {
  await runCloneRuntimeTick(prisma, connection, connection, postDraftQueue);
}, 15 * 60 * 1000);

// 72 小时上下文发帖巡检（每小时一次）：对最近 >72h 无帖或从未发帖的 active clone，
// 拉取最近会话上下文入队发帖。详见 runIdlePostCheck72h 的 JSDoc。
setInterval(async () => {
  try {
    await runIdlePostCheck72h(prisma, postDraftQueue);
  } catch (err) {
    logger.warn('idle-72h post check cron error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}, 60 * 60 * 1000);

// M8 前置 — Affection decay cron（每 24h 扫描所有 pair 并执行衰减）
setInterval(async () => {
  try {
    const stateStore = new AffectionStateStore();
    const pairs = await stateStore.listAllPairs();
    logger.info('decay cron scanning', { pairCount: pairs.length });
    for (const { observerId, otherId } of pairs) {
      try {
        const result = await runAffectionDecay(observerId, otherId);
        if (result.applied) {
          logger.info('decay applied', { observerId, otherId, daysSinceContact: result.daysSinceContact });
        }
      } catch (err) {
        logger.warn('decay per-pair failed', {
          error: err instanceof Error ? err.message : String(err),
          observerId,
          otherId,
        });
      }
    }
  } catch (err) {
    logger.warn('decay cron error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}, 24 * 60 * 60 * 1000);

// 【步骤5修复】Handoff 超时 cron（每小时跑一次）：
// 查 status=pending 且 expiresAt < now 的 handoff，置为 expired，
// publishLiveEvent 通知双方，写审计日志。
setInterval(async () => {
  try {
    const expired = await prisma.handoff.findMany({
      where: {
        status: HandoffStatus.pending,
        expiresAt: { lt: new Date() },
      },
      include: { session: true },
    });
    if (expired.length === 0) return;
    logger.info('handoff expiry cron scanning', { expiredCount: expired.length });
    for (const handoff of expired) {
      await prisma.handoff.update({
        where: { id: handoff.id },
        data: { status: HandoffStatus.expired },
      });
      const payload = { handoffId: handoff.id, sessionId: handoff.sessionId, status: 'expired' };
      // 通知双方
      await publishLiveEvent(connection, { type: 'handoff', userId: handoff.userAId, payload }).catch(() => {});
      await publishLiveEvent(connection, { type: 'handoff', userId: handoff.userBId, payload }).catch(() => {});
      // 审计日志（双方各写一条）
      try {
        await auditForUser(handoff.userAId, 'handoff.expired', '真人接力超时未响应，已失效', handoff.id);
        await auditForUser(handoff.userBId, 'handoff.expired', '真人接力超时未响应，已失效', handoff.id);
      } catch {
        // 审计失败不阻断
      }
      logger.info('handoff expired', { handoffId: handoff.id, sessionId: handoff.sessionId });
    }
  } catch (err) {
    logger.warn('handoff expiry cron error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}, 60 * 60 * 1000);
