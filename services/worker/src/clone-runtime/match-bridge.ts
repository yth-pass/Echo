import { AgentSessionStatus, CloneStatus, MatchPushStatus, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { setCloneMeta } from './meta';
import { createLogger } from '../../../shared/observability';

const logger = createLogger('match-bridge');

export type MatchPrefs = {
  gender?: string[];
  ageMin?: number;
  ageMax?: number;
  distanceKm?: number;
  relationshipIntent?: string;
};

export type VectorCandidate = {
  user_id: string;
  similarity: number;
};

export type RankedCandidate = VectorCandidate & { adjustedScore: number };

type SeekerProfile = {
  city?: string | null;
  bioJson?: unknown;
};

type CandidateProfile = {
  userId: string;
  city?: string | null;
  bioJson?: unknown;
};

export const VECTOR_TOP_K = 10;
export const FINAL_TOP_N = 3;

export function hasActiveMatchPrefs(prefs: MatchPrefs): boolean {
  return !!(
    prefs.gender?.length ||
    prefs.ageMin != null ||
    prefs.ageMax != null ||
    prefs.relationshipIntent?.trim()
  );
}

export function buildPrefilterConditions(
  prefs: MatchPrefs,
  paramStart: number,
): { conditions: string[]; params: unknown[]; nextIdx: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = paramStart;
  const currentYear = new Date().getFullYear();

  if (prefs.gender?.length) {
    conditions.push(
      `COALESCE(p.gender, p.bio_json->>'gender') = ANY($${idx}::text[])`,
    );
    params.push(prefs.gender);
    idx++;
  }

  if (prefs.ageMax != null) {
    conditions.push(
      `COALESCE(p.birth_year, (p.bio_json->>'birthYear')::int) >= $${idx}`,
    );
    params.push(currentYear - prefs.ageMax);
    idx++;
  }

  if (prefs.ageMin != null) {
    conditions.push(
      `COALESCE(p.birth_year, (p.bio_json->>'birthYear')::int) <= $${idx}`,
    );
    params.push(currentYear - prefs.ageMin);
    idx++;
  }

  const relationshipIntent = prefs.relationshipIntent?.trim();
  if (relationshipIntent) {
    conditions.push(
      `COALESCE(p.bio_json->>'goal', p.bio_json->>'datingGoal') = $${idx}`,
    );
    params.push(relationshipIntent);
    idx++;
  }

  return { conditions, params, nextIdx: idx };
}

async function queryVectorCandidates(
  prisma: PrismaClient,
  vectorStr: string,
  excludeUserId: string,
  prefs: MatchPrefs,
  limit: number,
  applyPrefilter: boolean,
): Promise<VectorCandidate[]> {
  const whereConditions = ['pe.user_id != $2'];
  const params: unknown[] = [vectorStr, excludeUserId];
  let paramIdx = 3;

  // 【缺陷1 修复】双向排除拉黑关系：$2 即发起匹配的 seeker userId。
  // Block 是单向的，A 拉 B 后 A 不应再收到 B，B 也不应被动收到 A，
  // 因此同时排除「seeker 拉黑的人」与「拉黑 seeker 的人」。
  // 这里复用 $2，不消耗新的参数位。
  whereConditions.push(
    `pe.user_id NOT IN (SELECT blocked_user_id FROM blocks WHERE blocker_user_id = $2)`,
  );
  whereConditions.push(
    `pe.user_id NOT IN (SELECT blocker_user_id FROM blocks WHERE blocked_user_id = $2)`,
  );

  if (applyPrefilter && hasActiveMatchPrefs(prefs)) {
    const built = buildPrefilterConditions(prefs, paramIdx);
    whereConditions.push(...built.conditions);
    params.push(...built.params);
    paramIdx = built.nextIdx;
  }

  params.push(limit);
  const limitParam = `$${paramIdx}`;

  const sql = `
    SELECT pe.user_id,
           1 - (pe.embedding <=> $1::vector) AS similarity
    FROM profile_embeddings pe
    JOIN profiles p ON p.user_id = pe.user_id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY pe.embedding <=> $1::vector
    LIMIT ${limitParam}
  `;

  return prisma.$queryRawUnsafe<VectorCandidate[]>(sql, ...params);
}

function asBioRecord(bioJson: unknown): Record<string, unknown> | undefined {
  return typeof bioJson === 'object' && bioJson !== null
    ? (bioJson as Record<string, unknown>)
    : undefined;
}

function getRelationshipIntent(bioJson: unknown): string | undefined {
  const bio = asBioRecord(bioJson);
  const goal = bio?.goal;
  const datingGoal = bio?.datingGoal;
  if (typeof goal === 'string' && goal.trim()) return goal.trim();
  if (typeof datingGoal === 'string' && datingGoal.trim()) return datingGoal.trim();
  return undefined;
}

function getInterests(bioJson: unknown): string[] {
  const bio = asBioRecord(bioJson);
  const interests = bio?.interests;
  if (!Array.isArray(interests)) return [];
  return interests.filter((item): item is string => typeof item === 'string');
}

export function rankCandidatesByRules(
  seeker: SeekerProfile,
  candidates: VectorCandidate[],
  candidateProfiles: CandidateProfile[],
  prefs: MatchPrefs,
  topN: number = FINAL_TOP_N,
): RankedCandidate[] {
  const profileByUserId = new Map(candidateProfiles.map((p) => [p.userId, p]));
  const seekerInterests = new Set(getInterests(seeker.bioJson));
  const prefIntent = prefs.relationshipIntent?.trim();

  const ranked = candidates.map((c) => {
    const profile = profileByUserId.get(c.user_id);
    let adjustedScore = Number(c.similarity);

    if (prefIntent && getRelationshipIntent(profile?.bioJson) === prefIntent) {
      adjustedScore += 0.1;
    }

    const seekerCity = seeker.city?.trim();
    const candidateCity = profile?.city?.trim();
    if (seekerCity && candidateCity && seekerCity === candidateCity) {
      adjustedScore += 0.05;
    }

    const candidateInterests = getInterests(profile?.bioJson);
    if (
      seekerInterests.size > 0 &&
      candidateInterests.some((interest) => seekerInterests.has(interest))
    ) {
      adjustedScore += 0.05;
    }

    return { ...c, adjustedScore };
  });

  ranked.sort((a, b) => b.adjustedScore - a.adjustedScore);
  return ranked.slice(0, topN);
}

export function isUsableEmbeddingVector(vec: number[]): boolean {
  if (vec.every((v) => v === 0)) return false;
  const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
  const variance = vec.reduce((a, v) => a + (v - mean) ** 2, 0) / vec.length;
  return Math.sqrt(variance) >= 0.001;
}

export async function runDailyMatchJob(prisma: PrismaClient, opts?: { force?: boolean }): Promise<string[]> {
  // 时间窗口检查：只在 UTC+8 的 8:00-9:00 之间执行（force=true 时跳过）
  if (!opts?.force) {
    const nowUTC8 = new Date(Date.now() + 8 * 3600 * 1000);
    const hourUTC8 = nowUTC8.getUTCHours();
    if (hourUTC8 < 8 || hourUTC8 >= 9) {
      logger.info('daily match job: outside 8:00-9:00 UTC+8 window, skipping');
      return [];
    }
  } else {
    logger.info('daily match job: force=true, skipping time window check');
  }

  // 1. 重置所有 active session 的每日轮次计数
  await prisma.agentSession.updateMany({
    where: { status: AgentSessionStatus.active },
    data: { dailyTurnCount: 0, dailyTurnDate: new Date() },
  });

  // 2. 获取所有有 active clone 的用户
  const activeClones = await prisma.digitalClone.findMany({
    where: { status: CloneStatus.active },
    include: { user: true },
  });

  const newPushIds: string[] = [];
  const MAX_ACTIVE_SESSIONS = 2;

  for (const clone of activeClones) {
    const userId = clone.userId;

    // 检查 autoMatchEnabled（从 privacyJson 读取，缺省 true）
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { privacyJson: true, matchPrefsJson: true, city: true, bioJson: true },
    });
    const privacy = (profile?.privacyJson ?? {}) as { autoMatchEnabled?: boolean };
    if (privacy.autoMatchEnabled === false) continue;

    // 统计该用户的 active session 数量（active + wind_down 都算）
    const activeSessionCount = await prisma.agentSession.count({
      where: {
        status: { in: [AgentSessionStatus.active, AgentSessionStatus.wind_down] },
        OR: [{ cloneAId: clone.id }, { cloneBId: clone.id }],
      },
    });

    if (activeSessionCount >= MAX_ACTIVE_SESSIONS) continue;
    const slotsNeeded = MAX_ACTIVE_SESSIONS - activeSessionCount;

    // 获取该用户的 embedding
    const embedding = await prisma.profileEmbedding.findUnique({ where: { userId } });
    if (!embedding) continue;
    const targetVector = embedding.embedding as number[];
    if (!isUsableEmbeddingVector(targetVector)) continue;
    const vectorStr = `[${targetVector.join(',')}]`;

    // 获取已有 active session 的对端 userId，排除这些人
    const existingSessions = await prisma.agentSession.findMany({
      where: {
        status: { in: [AgentSessionStatus.active, AgentSessionStatus.wind_down] },
        OR: [{ cloneAId: clone.id }, { cloneBId: clone.id }],
      },
      select: { cloneAId: true, cloneBId: true },
    });
    const existingPartnerCloneIds = new Set(
      existingSessions.map((s) => (s.cloneAId === clone.id ? s.cloneBId : s.cloneAId)),
    );

    // 用 pgvector 找候选（多取一些以备过滤）
    const matchPrefs = (profile?.matchPrefsJson ?? {}) as MatchPrefs;
    let candidates = await queryVectorCandidates(
      prisma,
      vectorStr,
      userId,
      matchPrefs,
      VECTOR_TOP_K * 2,
      true,
    );

    if (candidates.length === 0 && hasActiveMatchPrefs(matchPrefs)) {
      candidates = await queryVectorCandidates(
        prisma,
        vectorStr,
        userId,
        matchPrefs,
        VECTOR_TOP_K * 2,
        false,
      );
    }

    // 过滤：排除已有 session 的、autoMatchEnabled=false 的、clone 不是 active 的
    const filteredCandidates: VectorCandidate[] = [];
    for (const c of candidates) {
      if (filteredCandidates.length >= slotsNeeded) break;

      const partnerClone = await prisma.digitalClone.findUnique({ where: { userId: c.user_id } });
      if (!partnerClone || partnerClone.status !== CloneStatus.active) continue;
      if (existingPartnerCloneIds.has(partnerClone.id)) continue;

      const partnerProfile = await prisma.profile.findUnique({
        where: { userId: c.user_id },
        select: { privacyJson: true },
      });
      const partnerPrivacy = (partnerProfile?.privacyJson ?? {}) as { autoMatchEnabled?: boolean };
      if (partnerPrivacy.autoMatchEnabled === false) continue;

      filteredCandidates.push(c);
    }

    // 排名并创建 MatchPush
    const candidateIds = filteredCandidates.map((c) => c.user_id);
    const candidateProfiles = candidateIds.length
      ? await prisma.profile.findMany({
          where: { userId: { in: candidateIds } },
          select: { userId: true, city: true, bioJson: true },
        })
      : [];

    const ranked = rankCandidatesByRules(
      profile ?? { city: null, bioJson: null },
      filteredCandidates,
      candidateProfiles,
      matchPrefs,
    ).slice(0, slotsNeeded);

    for (const c of ranked) {
      const exists = await prisma.matchPush.findFirst({
        where: { userId, candidateUserId: c.user_id },
      });
      if (!exists) {
        const push = await prisma.matchPush.create({
          data: { userId, candidateUserId: c.user_id, affinity: c.adjustedScore },
        });
        newPushIds.push(push.id);
        logger.info('match push created', {
          userId,
          candidateUserId: c.user_id,
          adjustedScore: c.adjustedScore,
        });
      }
    }
  }

  logger.info('daily match job complete', { totalPushes: newPushIds.length });
  return newPushIds;
}

/** Start agent sessions for match pushes that do not yet have an active session. */
export async function bridgeMatchPushes(
  prisma: PrismaClient,
  redis: Redis,
  connection: Redis,
  pushIds?: string[],
  agentTurnQueue?: Queue,
): Promise<void> {
  let pushes;
  if (pushIds?.length) {
    // 【缺陷2 修复】只 bridge 未处理的 MatchPush（status=pending），
    // dismissed 的不再被 bridge 成 session
    pushes = await prisma.matchPush.findMany({
      where: { id: { in: pushIds }, status: MatchPushStatus.pending },
    });
  } else {
    // 【缺陷2 修复】无指定 ID 时也仅拉取 pending 状态
    pushes = await prisma.matchPush.findMany({
      where: { status: MatchPushStatus.pending },
      take: 50,
      orderBy: { pushedAt: 'desc' },
    });
  }

  // 【缺陷2 修复】双向排除拉黑关系：若 (userId, candidateUserId) 任一方向存在 block，
  // 不应为该 pair 创建 agent session。收集涉及的用户，一次性查询 blocks，内存过滤。
  const involvedUserIds = new Set<string>();
  for (const p of pushes) {
    involvedUserIds.add(p.userId);
    involvedUserIds.add(p.candidateUserId);
  }
  const blockedPairs = new Set<string>();
  // 用排序后的键表示无向对，使 A|B 与 B|A 命中同一 key（双向匹配）
  const pairKey = (a: string, b: string) =>
    a < b ? `${a}|${b}` : `${b}|${a}`;
  if (involvedUserIds.size > 0) {
    const blockRows = await prisma.block.findMany({
      where: {
        OR: [
          { blockerUserId: { in: [...involvedUserIds] } },
          { blockedUserId: { in: [...involvedUserIds] } },
        ],
      },
    });
    for (const b of blockRows) {
      blockedPairs.add(pairKey(b.blockerUserId, b.blockedUserId));
    }
  }
  // 过滤掉处于拉黑关系中的 push
  pushes = pushes.filter(
    (p) => !blockedPairs.has(pairKey(p.userId, p.candidateUserId)),
  );

  for (const push of pushes) {
    // 【步骤9修复】双重保险：即使上游传入已 bridged 的 push（理论上查询已过滤 pending），
    // 此处再次校验 status，若非 pending 则跳过，避免重复创建 session。
    if (push.status !== MatchPushStatus.pending) continue;

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
        status: { in: [AgentSessionStatus.active, AgentSessionStatus.wind_down] },
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
    // 【步骤9修复】bridge 成功后立即将 MatchPush.status 置为 bridged，
    // 防止 session 结束后同一 push 被再次 bridge 创建新 session。
    await prisma.matchPush.update({
      where: { id: push.id },
      data: { status: MatchPushStatus.bridged },
    });
    const now = Date.now();
    await setCloneMeta(redis, cloneA.id, { lastSessionAt: now });
    await setCloneMeta(redis, cloneB.id, { lastSessionAt: now });
    await agentTurnQueue!.add('turn', { sessionId: session.id });
    logger.info('agent session started', { sessionId: session.id, pushId: push.id });
  }
}
