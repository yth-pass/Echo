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

function createMockPrisma() {
  return {
    profileEmbedding: { findMany: vi.fn() },
    profile: { findUnique: vi.fn(), findMany: vi.fn() },
    matchPush: { findFirst: vi.fn(), create: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
}

describe('runDailyMatchJob', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  it('should skip users with zero-vector embeddings', async () => {
    mockPrisma.profileEmbedding.findMany.mockResolvedValue([
      { userId: 'u1', embedding: new Array(1536).fill(0) },
    ]);

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('should filter by gender preference when configured', async () => {
    mockPrisma.profileEmbedding.findMany.mockResolvedValue([
      { userId: 'u1', embedding: validEmbedding },
    ]);
    mockPrisma.profile.findUnique.mockResolvedValue({
      matchPrefsJson: { gender: ['女'] },
      city: null,
      bioJson: null,
    });
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.profile.findMany.mockResolvedValue([]);

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    const [sql, ...params] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain('COALESCE(p.gender');
    expect(params).toContainEqual(['女']);
  });

  it('should fall back to pure vector when rules yield zero candidates', async () => {
    mockPrisma.profileEmbedding.findMany.mockResolvedValue([
      { userId: 'u1', embedding: validEmbedding },
    ]);
    mockPrisma.profile.findUnique.mockResolvedValue({
      matchPrefsJson: { gender: ['女'] },
      city: null,
      bioJson: null,
    });
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ user_id: 'u2', similarity: 0.9 }]);
    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: 'u2', city: '上海', bioJson: {} },
    ]);
    mockPrisma.matchPush.findFirst.mockResolvedValue(null);
    mockPrisma.matchPush.create.mockResolvedValue({ id: 'push-1' });

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    const [firstSql] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [string];
    const [secondSql] = mockPrisma.$queryRawUnsafe.mock.calls[1] as [string];
    expect(firstSql).toContain('COALESCE(p.gender');
    expect(secondSql).not.toContain('COALESCE(p.gender');
    expect(mockPrisma.matchPush.create).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate matches already pushed', async () => {
    mockPrisma.profileEmbedding.findMany.mockResolvedValue([
      { userId: 'u1', embedding: validEmbedding },
    ]);
    mockPrisma.profile.findUnique.mockResolvedValue({
      matchPrefsJson: {},
      city: null,
      bioJson: null,
    });
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { user_id: 'u2', similarity: 0.9 },
    ]);
    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: 'u2', city: null, bioJson: {} },
    ]);
    mockPrisma.matchPush.findFirst.mockResolvedValue({ id: 'existing' });

    await runDailyMatchJob(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.matchPush.create).not.toHaveBeenCalled();
  });
});
