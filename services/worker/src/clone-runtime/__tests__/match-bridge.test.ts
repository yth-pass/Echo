import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runDailyMatchJob } from '../match-bridge';

vi.mock('../../../shared/observability', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const validEmbedding = new Array(1536).fill(0).map((_, i) => (i % 100) / 100);
const embeddingStr = `[${validEmbedding.join(',')}]`;

function createMockPrisma() {
  return {
    agentSession: { updateMany: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    digitalClone: { findMany: vi.fn(), findUnique: vi.fn() },
    profileEmbedding: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn(), findMany: vi.fn() },
    matchPush: { findFirst: vi.fn(), create: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
}

/**
 * Sets up the baseline mocks for a single active clone user "u1"
 * with valid self + ideal embeddings, no active sessions, and no existing partners.
 */
function setupBaseline(
  mock: ReturnType<typeof createMockPrisma>,
  overrides?: {
    privacyJson?: Record<string, unknown>;
    matchPrefsJson?: Record<string, unknown>;
    autoMatchEnabled?: boolean;
  },
) {
  mock.agentSession.updateMany.mockResolvedValue({ count: 0 });
  mock.digitalClone.findMany.mockResolvedValue([
    { id: 'clone-u1', userId: 'u1', status: 'active', user: {} },
  ]);
  mock.profile.findUnique.mockResolvedValue({
    privacyJson: overrides?.privacyJson ?? {},
    matchPrefsJson: overrides?.matchPrefsJson ?? {},
    city: null,
    bioJson: null,
  });
  mock.agentSession.count.mockResolvedValue(0);
  mock.agentSession.findMany.mockResolvedValue([]);
  mock.profileEmbedding.findUnique.mockResolvedValue({
    userId: 'u1',
    embedding: validEmbedding,
  });

  // $queryRawUnsafe call order:
  //   1st: batchLoadIdealEmbeddings([userId]) → self ideal
  //   2nd: queryVectorCandidates (with prefilter if prefs active)
  //   3rd: batchLoadIdealEmbeddings(candidateUserIds)
  //   (optional 4th: fallback queryVectorCandidates without prefilter)
  // Default: empty candidates, self ideal present
  mock.$queryRawUnsafe.mockImplementation((sql: string, ...params: unknown[]) => {
    if (sql.includes('ideal_embedding IS NOT NULL')) {
      // batchLoadIdealEmbeddings — first call is self, subsequent are candidates
      const userIds = params[0] as string[];
      if (userIds.includes('u1') && userIds.length === 1) {
        return Promise.resolve([{ user_id: 'u1', ideal_embedding: embeddingStr }]);
      }
      return Promise.resolve([]);
    }
    // queryVectorCandidates
    return Promise.resolve([]);
  });

  mock.digitalClone.findUnique.mockResolvedValue(null);
  mock.profile.findMany.mockResolvedValue([]);
  mock.matchPush.findFirst.mockResolvedValue(null);
}

describe('runDailyMatchJob', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  it('should skip users with zero-vector embeddings', async () => {
    mockPrisma.agentSession.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.digitalClone.findMany.mockResolvedValue([
      { id: 'clone-u1', userId: 'u1', status: 'active', user: {} },
    ]);
    mockPrisma.profile.findUnique.mockResolvedValue({
      privacyJson: {},
      matchPrefsJson: {},
      city: null,
      bioJson: null,
    });
    mockPrisma.agentSession.count.mockResolvedValue(0);
    mockPrisma.profileEmbedding.findUnique.mockResolvedValue({
      userId: 'u1',
      embedding: new Array(1536).fill(0),
    });

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
    // queryVectorCandidates should not be called since embedding is invalid
    const vectorCalls = mockPrisma.$queryRawUnsafe.mock.calls.filter(
      (call) => !String(call[0]).includes('ideal_embedding'),
    );
    expect(vectorCalls).toHaveLength(0);
  });

  it('should skip users without ideal_embedding', async () => {
    mockPrisma.agentSession.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.digitalClone.findMany.mockResolvedValue([
      { id: 'clone-u1', userId: 'u1', status: 'active', user: {} },
    ]);
    mockPrisma.profile.findUnique.mockResolvedValue({
      privacyJson: {},
      matchPrefsJson: {},
      city: null,
      bioJson: null,
    });
    mockPrisma.agentSession.count.mockResolvedValue(0);
    mockPrisma.profileEmbedding.findUnique.mockResolvedValue({
      userId: 'u1',
      embedding: validEmbedding,
    });
    // batchLoadIdealEmbeddings returns empty for u1
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
  });

  it('should filter by gender preference when configured', async () => {
    setupBaseline(mockPrisma, { matchPrefsJson: { gender: ['女'] } });

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    // The queryVectorCandidates call should include gender prefilter
    const vectorCalls = mockPrisma.$queryRawUnsafe.mock.calls.filter(
      (call) => !String(call[0]).includes('ideal_embedding'),
    );
    expect(vectorCalls.length).toBeGreaterThanOrEqual(1);
    const [sql, ...params] = vectorCalls[0] as [string, ...unknown[]];
    expect(sql).toContain('COALESCE(p.gender');
    expect(params).toContainEqual(['女']);
  });

  it('should create bidirectional match push when both ideals align', async () => {
    setupBaseline(mockPrisma);

    const candidateEmbeddingB = new Array(1536).fill(0).map((_, i) => ((i + 7) % 100) / 100);
    const candidateEmbeddingStr = `[${candidateEmbeddingB.join(',')}]`;

    // Override $queryRawUnsafe to simulate a candidate with high bidirectional scores
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string, ...params: unknown[]) => {
      if (sql.includes('ideal_embedding IS NOT NULL')) {
        const userIds = params[0] as string[];
        if (userIds.includes('u1') && userIds.length === 1) {
          // self ideal embedding
          return Promise.resolve([{ user_id: 'u1', ideal_embedding: embeddingStr }]);
        }
        // candidate ideal embeddings
        return Promise.resolve([
          { user_id: 'u2', ideal_embedding: embeddingStr },
        ]);
      }
      // queryVectorCandidates
      return Promise.resolve([
        {
          user_id: 'u2',
          similarity: 0.85,
          candidate_embedding: candidateEmbeddingStr,
        },
      ]);
    });

    mockPrisma.digitalClone.findUnique.mockResolvedValue({
      id: 'clone-u2',
      userId: 'u2',
      status: 'active',
    });
    mockPrisma.profile.findUnique.mockImplementation(({ where }: { where: { userId: string } }) => {
      if (where.userId === 'u1') {
        return Promise.resolve({
          privacyJson: {},
          matchPrefsJson: {},
          city: null,
          bioJson: null,
        });
      }
      return Promise.resolve({ privacyJson: {}, matchPrefsJson: {}, city: null, bioJson: null });
    });
    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: 'u2', city: null, bioJson: {} },
    ]);
    mockPrisma.matchPush.findFirst.mockResolvedValue(null);
    mockPrisma.matchPush.create.mockResolvedValue({ id: 'push-1' });

    const result = await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    expect(result).toContain('push-1');
    expect(mockPrisma.matchPush.create).toHaveBeenCalledTimes(1);
    const createData = mockPrisma.matchPush.create.mock.calls[0][0] as {
      data: { userId: string; candidateUserId: string; affinity: number };
    };
    expect(createData.data.userId).toBe('u1');
    expect(createData.data.candidateUserId).toBe('u2');
    // affinity should be the adjustedScore (compatibility + possible bonuses)
    expect(createData.data.affinity).toBeGreaterThan(0);
  });

  it('should skip candidate when bidirectional score is below threshold', async () => {
    setupBaseline(mockPrisma);

    // Candidate's ideal embedding is nearly orthogonal to A's self → low scoreAtoB
    // validEmbedding is all-positive, so an all-negative vector yields cosine ≈ -1 (well below 0.3)
    const lowScoreIdeal = new Array(1536).fill(0).map((_, i) => -((i % 50) + 1) / 100);
    const lowScoreIdealStr = `[${lowScoreIdeal.join(',')}]`;

    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string, ...params: unknown[]) => {
      if (sql.includes('ideal_embedding IS NOT NULL')) {
        const userIds = params[0] as string[];
        if (userIds.includes('u1') && userIds.length === 1) {
          return Promise.resolve([{ user_id: 'u1', ideal_embedding: embeddingStr }]);
        }
        // candidate u2 has a very different ideal embedding
        return Promise.resolve([
          { user_id: 'u2', ideal_embedding: lowScoreIdealStr },
        ]);
      }
      return Promise.resolve([
        {
          user_id: 'u2',
          similarity: 0.9,
          candidate_embedding: `[${validEmbedding.join(',')}]`,
        },
      ]);
    });

    mockPrisma.digitalClone.findUnique.mockResolvedValue({
      id: 'clone-u2',
      userId: 'u2',
      status: 'active',
    });
    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: 'u2', city: null, bioJson: {} },
    ]);

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    // scoreAtoB = cosine(selfA, idealB_very_different) ≈ 0, below 0.3 threshold
    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
  });

  it('should deduplicate matches already pushed', async () => {
    setupBaseline(mockPrisma);

    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string, ...params: unknown[]) => {
      if (sql.includes('ideal_embedding IS NOT NULL')) {
        const userIds = params[0] as string[];
        if (userIds.includes('u1') && userIds.length === 1) {
          return Promise.resolve([{ user_id: 'u1', ideal_embedding: embeddingStr }]);
        }
        return Promise.resolve([
          { user_id: 'u2', ideal_embedding: embeddingStr },
        ]);
      }
      return Promise.resolve([
        {
          user_id: 'u2',
          similarity: 0.85,
          candidate_embedding: embeddingStr,
        },
      ]);
    });

    mockPrisma.digitalClone.findUnique.mockResolvedValue({
      id: 'clone-u2',
      userId: 'u2',
      status: 'active',
    });
    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: 'u2', city: null, bioJson: {} },
    ]);
    // MatchPush already exists
    mockPrisma.matchPush.findFirst.mockResolvedValue({ id: 'existing' });

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
  });

  it('should skip users with autoMatchEnabled=false', async () => {
    setupBaseline(mockPrisma, { privacyJson: { autoMatchEnabled: false } });

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
    // Should not even reach queryVectorCandidates
    const vectorCalls = mockPrisma.$queryRawUnsafe.mock.calls.filter(
      (call) => !String(call[0]).includes('ideal_embedding'),
    );
    expect(vectorCalls).toHaveLength(0);
  });

  it('should skip users at max active sessions', async () => {
    setupBaseline(mockPrisma);
    mockPrisma.agentSession.count.mockResolvedValue(2); // MAX_ACTIVE_SESSIONS = 2

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient, { force: true });

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
  });
});
