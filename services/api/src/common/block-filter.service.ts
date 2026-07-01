import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 拉黑过滤服务（可复用）。
 *
 * Echo 的 Block 是单向关系：A 拉黑 B 后，
 *  - A 不应再收到任何与 B 相关的内容（主动屏蔽）；
 *  - B 也不应被动收到与 A 相关的内容（被拉黑方保护）。
 * 因此所有读取路径都需要「双向排除」拉黑对端。
 *
 * 该服务封装双向拉黑列表查询与 where 合并逻辑，
 * 供 feed / sessions / matches 及后续阶段复用，避免重复代码。
 */
@Injectable()
export class BlockFilterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取与 userId 存在拉黑关系（双向）的所有对端用户 ID。
   *
   * 查询 blocks 表中 blockerUserId = userId（我拉黑的人）
   * 或 blockedUserId = userId（拉黑我的人），返回所有对端 userId。
   * 两个方向都排除，保证单向 block 产生双向隔离效果。
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
      select: { blockerUserId: true, blockedUserId: true },
    });
    const peerSet = new Set<string>();
    for (const r of rows) {
      // 我拉黑的对端
      if (r.blockerUserId === userId) peerSet.add(r.blockedUserId);
      // 拉黑我的对端
      else peerSet.add(r.blockerUserId);
    }
    return [...peerSet];
  }

  /**
   * 将双向 block 过滤合并进一个 Prisma where 子句。
   *
   * @param prismaWhere 原始 where 对象
   * @param userId 当前用户 ID
   * @param field 目标用户 ID 字段名（如 'candidateUserId'、'authorUserId'）
   * @returns 合并后的新 where 对象，目标字段被限制为 notIn 拉黑对端
   *
   * 若原 where 已存在该字段的对象条件，则与其合并（保留既有约束），
   * 避免覆盖调用方已设置的条件。
   */
  async applyBlockFilter<T extends Record<string, unknown>>(
    prismaWhere: T,
    userId: string,
    field: string,
  ): Promise<T> {
    const blockedIds = await this.getBlockedUserIds(userId);
    if (blockedIds.length === 0) return prismaWhere;
    const existing = (prismaWhere as Record<string, unknown>)[field];
    // 合并既有字段条件与 notIn，避免覆盖
    const mergedField =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>), notIn: blockedIds }
        : { notIn: blockedIds };
    return { ...prismaWhere, [field]: mergedField };
  }
}
