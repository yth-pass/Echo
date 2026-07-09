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
  /** raw self-embedding of the candidate, populated by queryVectorCandidates for bidirectional scoring */
  candidate_embedding?: number[];
};

export type BidirectionalCandidate = {
  user_id: string;
  scoreAtoB: number;      // cosine(self_A, ideal_B) — A 符合 B 的理想型程度
  scoreBtoA: number;      // cosine(self_B, ideal_A) — B 符合 A 的理想型程度
  compatibility: number;  // sqrt(scoreAtoB * scoreBtoA) — 几何均值
};

export type RankedCandidate = BidirectionalCandidate & { adjustedScore: number };

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
export const IDEAL_MATCH_THRESHOLD = 0.3;

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

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
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

  // 双向排除拉黑关系
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
           1 - (pe.embedding <=> $1::vector) AS similarity,
           pe.embedding AS candidate_embedding
    FROM profile_embeddings pe
    JOIN profiles p ON p.user_id = pe.user_id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY pe.embedding <=> $1::vector
    LIMIT ${limitParam}
  `;

  type RawRow = { user_id: string; similarity: number | string; candidate_embedding: string };
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(sql, ...params);

  // pgvector raw query returns embedding as "[0.1,0.2,...]" string; parse to number[]
  return rows.map((r) => ({
    user_id: r.user_id,
    similarity: Number(r.similarity),
    candidate_embedding: parseVectorString(r.candidate_embedding),
  }));
}

function parseVectorString(raw: unknown): number[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : undefined;
  } catch {
    return undefined;
  }
}

async function batchLoadIdealEmbeddings(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (userIds.length === 0) return map;

  const sql = `
    SELECT user_id, ideal_embedding
    FROM profile_embeddings
    WHERE user_id = ANY($1::text[]) AND ideal_embedding IS NOT NULL
  `;
  type Row = { user_id: string; ideal_embedding: unknown };
  const rows = await prisma.$queryRawUnsafe<Row[]>(sql, userIds);

  for (const row of rows) {
    const vec = parseVectorString(row.ideal_embedding) ?? (row.ideal_embedding as number[] | null);
    if (Array.isArray(vec) && vec.length > 0) {
      map.set(row.user_id, vec);
    }
  }
  return map;
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
  candidates: BidirectionalCandidate[],
  candidateProfiles: CandidateProfile[],
  prefs: MatchPrefs,
  topN: number = FINAL_TOP_N,
): RankedCandidate[] {
  const profileByUserId = new Map(candidateProfiles.map((p) => [p.userId, p]));
  const seekerInterests = new Set(getInterests(seeker.bioJson));
  const prefIntent = prefs.relationshipIntent?.trim();

  const ranked = candidates.map((c) => {
    const profile = profileByUserId.get(c.user_id);
    let adjustedScore = c.compatibility;

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

    // 获取该用户的 self embedding
    const embedding = await prisma.profileEmbedding.findUnique({ where: { userId } });
    if (!embedding) continue;
    const embeddingA = embedding.embedding as number[];
    if (!isUsableEmbeddingVector(embeddingA)) continue;
    const vectorStr = `[${embeddingA.join(',')}]`;

    // 获取该用户的 ideal embedding
    const selfIdealMap = await batchLoadIdealEmbeddings(prisma, [userId]);
    const idealEmbeddingA = selfIdealMap.get(userId);
    if (!idealEmbeddingA) {
      logger.info('daily match job: user has no ideal_embedding, skipping', { userId });
      continue;
    }

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

    // 批量加载所有候选人的 ideal embedding
    const candidateUserIds = candidates.map((c) => c.user_id);
    const idealEmbeddings = await batchLoadIdealEmbeddings(prisma, candidateUserIds);

    // 双向评分
    const bidirectionalCandidates: BidirectionalCandidate[] = [];
    for (const candidate of candidates) {
      const idealEmbeddingB = idealEmbeddings.get(candidate.user_id);
      if (!idealEmbeddingB) continue;
      const embeddingB = candidate.candidate_embedding;
      if (!embeddingB) continue;

      // scoreAtoB: A 的自画像与 B 的理想型的匹配度
      const scoreAtoB = cosineSimilarity(embeddingA, idealEmbeddingB);
      // scoreBtoA: B 的自画像与 A 的理想型的匹配度
      const scoreBtoA = cosineSimilarity(embeddingB, idealEmbeddingA);

      // 阈值过滤：双向最低分必须达标
      if (Math.min(scoreAtoB, scoreBtoA) < IDEAL_MATCH_THRESHOLD) continue;

      // 几何均值
      const compatibility = Math.sqrt(scoreAtoB * scoreBtoA);
      bidirectionalCandidates.push({
        user_id: candidate.user_id,
        scoreAtoB,
        scoreBtoA,
        compatibility,
      });
    }

    // 过滤：排除已有 session 的、autoMatchEnabled=false 的、clone 不是 active 的
    const filteredCandidates: BidirectionalCandidate[] = [];
    for (const c of bidirectionalCandidates) {
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
          scoreAtoB: c.scoreAtoB,
          scoreBtoA: c.scoreBtoA,
          compatibility: c.compatibility,
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
    pushes = await prisma.matchPush.findMany({
      where: { id: { in: pushIds }, status: MatchPushStatus.pending },
    });
  } else {
    pushes = await prisma.matchPush.findMany({
      where: { status: MatchPushStatus.pending },
      take: 50,
      orderBy: { pushedAt: 'desc' },
    });
  }

  // 双向排除拉黑关系
  const involvedUserIds = new Set<string>();
  for (const p of pushes) {
    involvedUserIds.add(p.userId);
    involvedUserIds.add(p.candidateUserId);
  }
  const blockedPairs = new Set<string>();
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
  pushes = pushes.filter(
    (p) => !blockedPairs.has(pairKey(p.userId, p.candidateUserId)),
  );

  for (const push of pushes) {
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
