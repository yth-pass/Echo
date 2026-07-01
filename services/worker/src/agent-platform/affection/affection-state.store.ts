import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import type { AffectionState } from './types';
import { DEFAULT_AFFECTION_DIMENSIONS, DEFAULT_REPAIR_ARC } from './types';
import { getMemoryBaseDir } from './memory-base-dir';

/**
 * 【步骤2修复】AffectionStateStore — 从文件存储迁移到 DB（Prisma）。
 *
 * 存储约定：pair 排序后 userAId < userBId（字典序），保证双向查询一致。
 * 一对用户共享一行关系状态。
 *
 * 乐观锁：read 时记 version，write 时 where 加 version 匹配，
 * 不匹配则返回 { success: false, current } 由调用方决定是否重试。
 *
 * 保留原有 read/write 接口签名，调用方无需改。
 * 保留旧 JSON 文件读取做一次性迁移（migrateLegacyFile）。
 */

// 模块级共享 Prisma 单例：smoke test / decay job 等独立入口无 prisma 注入时使用
let sharedPrisma: PrismaClient | null = null;
function getSharedPrisma(): PrismaClient {
  if (!sharedPrisma) sharedPrisma = new PrismaClient();
  return sharedPrisma;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeComposite(d: { familiarity: number; warmth: number; trust: number; tension: number }): number {
  const raw = 0.25 * d.familiarity + 0.35 * d.warmth + 0.3 * d.trust - 0.4 * d.tension;
  return clamp(Math.round(raw), 0, 100);
}

/** 将 DB 行映射为 AffectionState（兼容旧类型，补齐 DB 未持久化的派生字段）。 */
function rowToState(
  row: { userAId: string; userBId: string; familiarity: number; warmth: number; trust: number; tension: number; relationshipLabel: string; lastInteractionAt: Date; version: number },
  observerId: string,
  otherId: string,
): AffectionState {
  const dimensions = {
    familiarity: row.familiarity,
    warmth: row.warmth,
    trust: row.trust,
    tension: row.tension,
    // DB schema 未持久化 tension_quality，读取时默认 situational（步骤1 schema 约束）
    tension_quality: 'situational' as const,
  };
  return {
    other_agent_id: otherId,
    dimensions,
    composite_affinity: computeComposite(dimensions),
    relationship_label: row.relationshipLabel as AffectionState['relationship_label'],
    // DB schema 未持久化 repair_arc，读取时默认（步骤1 schema 约束）
    repair_arc: DEFAULT_REPAIR_ARC,
    last_interaction_at: row.lastInteractionAt.toISOString(),
    last_updated_at: row.version.toString(),
    version: row.version,
  };
}

export class AffectionStateStore {
  private baseDir: string;
  private prisma: PrismaClient;

  constructor(baseDir?: string, prisma?: PrismaClient) {
    this.baseDir = baseDir ?? getMemoryBaseDir();
    this.prisma = prisma ?? getSharedPrisma();
  }

  /** pair 排序：保证 userAId < userBId（字典序）。 */
  private sortPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private getLegacyStoragePath(observerId: string, otherId: string): string {
    return path.join(this.baseDir, 'users', observerId, 'social', 'by_agent', otherId, 'affection.json');
  }

  /**
   * 一次性迁移：读取旧 JSON 文件并导入 DB，导入后重命名为 .migrated。
   * 启动时由 read/write 触发检测。失败不阻断主流程（仅告警）。
   */
  private async migrateLegacyFile(observerId: string, otherId: string): Promise<void> {
    const filePath = this.getLegacyStoragePath(observerId, otherId);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      return; // 无旧文件，无需迁移
    }
    try {
      const legacy = JSON.parse(content) as AffectionState;
      const [a, b] = this.sortPair(observerId, otherId);
      // upsert（不覆盖已存在的 DB 行：仅当 DB 无记录时导入）
      await this.prisma.affectionState.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        create: {
          userAId: a,
          userBId: b,
          familiarity: legacy.dimensions?.familiarity ?? 0,
          warmth: legacy.dimensions?.warmth ?? 0,
          trust: legacy.dimensions?.trust ?? 0,
          tension: legacy.dimensions?.tension ?? 0,
          relationshipLabel: legacy.relationship_label ?? 'stranger',
          lastInteractionAt: legacy.last_interaction_at ? new Date(legacy.last_interaction_at) : new Date(),
          version: legacy.version ?? 0,
        },
        update: {}, // 已存在则不覆盖
      });
      // 导入成功，重命名旧文件为 .migrated（保留备份，不再读取）
      const migratedPath = filePath + '.migrated';
      await fs.rename(filePath, migratedPath).catch(() => {});
    } catch (err) {
      console.warn('[AffectionStateStore] legacy migration failed (non-blocking):', (err as Error).message);
    }
  }

  async read(observerId: string, otherId: string): Promise<AffectionState> {
    // 触发一次性旧文件迁移
    await this.migrateLegacyFile(observerId, otherId);

    const [a, b] = this.sortPair(observerId, otherId);
    const row = await this.prisma.affectionState.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    if (!row) {
      // 初始化：不落库（避免空读产生噪声行），返回内存默认态，write 时再 upsert。
      // 【步骤7修复】last_interaction_at 留空（undefined），以便 reciprocity 等调用方
      // 据此识别"对方 store 不存在（新用户）"并返回 multiplier=1.0。
      const init: AffectionState = {
        other_agent_id: otherId,
        dimensions: { ...DEFAULT_AFFECTION_DIMENSIONS },
        composite_affinity: 0,
        relationship_label: 'stranger',
        repair_arc: DEFAULT_REPAIR_ARC,
        last_interaction_at: undefined,
        last_updated_at: new Date().toISOString(),
        version: 0,
      };
      return init;
    }
    return rowToState(row, observerId, otherId);
  }

  /**
   * 乐观锁写入：where 匹配 version，不匹配则返回 { success: false, current }。
   * 调用方可据此 read-modify-write 重试（最多 3 次，由调用方控制）。
   */
  async write(
    observerId: string,
    otherId: string,
    expectedVersion: number,
    newState: AffectionState,
  ): Promise<{ success: boolean; current?: AffectionState }> {
    const [a, b] = this.sortPair(observerId, otherId);

    // 用 updateMany + where(version) 实现乐观锁：
    // - 命中且 version 匹配 → count=1，成功，version 自增
    // - 不存在或 version 冲突 → count=0，转 upsert(create) 或返回冲突
    const updated = await this.prisma.affectionState.updateMany({
      where: { userAId: a, userBId: b, version: expectedVersion },
      data: {
        familiarity: newState.dimensions.familiarity,
        warmth: newState.dimensions.warmth,
        trust: newState.dimensions.trust,
        tension: newState.dimensions.tension,
        relationshipLabel: newState.relationship_label,
        lastInteractionAt: newState.last_interaction_at ? new Date(newState.last_interaction_at) : new Date(),
        version: expectedVersion + 1,
      },
    });

    if (updated.count === 1) {
      return { success: true };
    }

    // count=0：要么行不存在（expectedVersion=0 首次写），要么 version 冲突
    const current = await this.prisma.affectionState.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    if (!current) {
      // 行不存在 → 首次创建（expectedVersion=0）。用 create 兜底（并发安全：唯一约束冲突则视为冲突）
      try {
        await this.prisma.affectionState.create({
          data: {
            userAId: a,
            userBId: b,
            familiarity: newState.dimensions.familiarity,
            warmth: newState.dimensions.warmth,
            trust: newState.dimensions.trust,
            tension: newState.dimensions.tension,
            relationshipLabel: newState.relationship_label,
            lastInteractionAt: newState.last_interaction_at ? new Date(newState.last_interaction_at) : new Date(),
            version: 1,
          },
        });
        return { success: true };
      } catch {
        // 并发：行已被另一写入创建，视为版本冲突
        const retry = await this.prisma.affectionState.findUnique({
          where: { userAId_userBId: { userAId: a, userBId: b } },
        });
        return { success: false, current: retry ? rowToState(retry, observerId, otherId) : undefined };
      }
    }

    // version 冲突：返回当前态供调用方重试
    return { success: false, current: rowToState(current, observerId, otherId) };
  }

  async getMtime(observerId: string, otherId: string): Promise<number | null> {
    // 【步骤2修复】DB 模式下用 updatedAt 作为 mtime 等价物
    const [a, b] = this.sortPair(observerId, otherId);
    const row = await this.prisma.affectionState.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      select: { updatedAt: true },
    });
    return row ? row.updatedAt.getTime() : null;
  }

  /**
   * 列出所有 pair（DB 查询，替代文件系统扫描）。
   * 用于 decay cron 扫描所有已知关系。
   */
  async listAllPairs(): Promise<Array<{ observerId: string; otherId: string }>> {
    const rows = await this.prisma.affectionState.findMany({
      select: { userAId: true, userBId: true },
    });
    return rows.map((r) => ({ observerId: r.userAId, otherId: r.userBId }));
  }
}
