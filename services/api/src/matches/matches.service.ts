import { Injectable } from '@nestjs/common';
import { MatchPushStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BlockFilterService } from '../common/block-filter.service';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    // 【缺陷4 修复】注入 BlockFilterService，对匹配/会话查询做双向拉黑过滤
    private readonly blockFilter: BlockFilterService,
  ) {}

  // 【缺陷10修复】根据双方 persona/profile 与 affinity 动态生成匹配原因
  private buildMatchReasons(opts: {
    myProfile?: { city?: string | null } | null;
    candidateProfile?: { city?: string | null } | null;
    myInterests: string[];
    candidateInterests: string[];
    affinityScore: number | null;
  }): string[] {
    const reasons: string[] = [];
    const { myProfile, candidateProfile, myInterests, candidateInterests, affinityScore } = opts;

    // 原因1：同城
    const myCity = myProfile?.city?.trim();
    const candCity = candidateProfile?.city?.trim();
    if (myCity && candCity && myCity === candCity) {
      reasons.push(`同在 ${myCity}`);
    }

    // 原因2：共同兴趣（从 persona/问卷 interests 取交集）
    const common = myInterests.filter((t) => candidateInterests.includes(t));
    if (common.length > 0) {
      reasons.push(`共同兴趣：${common.slice(0, 3).join('、')}`);
    }

    // 原因3：向量相似度（基于 affinity 分数档位描述）
    if (affinityScore != null) {
      const pct = Math.round(affinityScore * 100);
      if (pct >= 80) reasons.push('语义画像高度相似');
      else if (pct >= 60) reasons.push('语义画像较相似');
      else reasons.push('语义画像互补');
    }

    // 兜底：至少返回 1 条
    if (reasons.length === 0) reasons.push('系统综合匹配推荐');
    return reasons.slice(0, 3);
  }

  /** 【缺陷10修复】从 profile.bioJson 提取 interests 数组（问卷写入）。 */
  private extractInterests(bioJson: unknown): string[] {
    if (!bioJson || typeof bioJson !== 'object') return [];
    try {
      const obj = bioJson as Record<string, unknown>;
      const arr = obj.interests;
      if (!Array.isArray(arr)) return [];
      return arr.filter((t): t is string => typeof t === 'string');
    } catch {
      return [];
    }
  }

  async list(userId: string) {
    // 【缺陷4 修复】使用 BlockFilterService 获取双向拉黑对端列表
    // （A 拉 B 后双向都不再匹配），替换原先仅排除「我拉黑的人」的单向过滤
    const blockedIds = await this.blockFilter.getBlockedUserIds(userId);
    const myClone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    // 【缺陷10修复】提前查询当前用户 profile，用于动态匹配原因
    const myProfile = await this.prisma.profile.findUnique({ where: { userId } });
    const myInterests = this.extractInterests(myProfile?.bioJson);
    const pushes = await this.prisma.matchPush.findMany({
      where: {
        userId,
        status: { not: MatchPushStatus.dismissed },
        ...(blockedIds.length > 0 ? { candidateUserId: { notIn: blockedIds } } : {}),
      },
      orderBy: { pushedAt: 'desc' },
      take: 50,
    });
    const items = await Promise.all(
      pushes.map(async (p) => {
        const profile = await this.prisma.profile.findUnique({
          where: { userId: p.candidateUserId },
        });
        const affinityPct = p.affinity != null ? Math.round(p.affinity * 100) : 0;
        const handoff = await this.prisma.handoff.findFirst({
          where: {
            OR: [
              { userAId: userId, userBId: p.candidateUserId },
              { userBId: userId, userAId: p.candidateUserId },
            ],
            status: 'pending',
          },
        });
        const candidateClone = await this.prisma.digitalClone.findUnique({
          where: { userId: p.candidateUserId },
        });
        let sessionId: string | null = null;
        let lastMessage = '';
        if (myClone && candidateClone) {
          // 【缺陷4 修复】candidateUserId 已在上方 MatchPush 查询中经双向 block 过滤，
          // 此处 session 查询仅针对非拉黑对端，保证不会返回与拉黑用户的会话
          const session = await this.prisma.agentSession.findFirst({
            where: {
              OR: [
                { cloneAId: myClone.id, cloneBId: candidateClone.id },
                { cloneAId: candidateClone.id, cloneBId: myClone.id },
              ],
            },
            orderBy: { startedAt: 'desc' },
          });
          if (session) {
            sessionId = session.id;
            const lastMsg = await this.prisma.agentMessage.findFirst({
              where: { sessionId: session.id },
              orderBy: { turnIndex: 'desc' },
            });
            if (lastMsg?.content) {
              lastMessage =
                lastMsg.content.length > 80
                  ? `${lastMsg.content.slice(0, 80)}…`
                  : lastMsg.content;
            }
          }
        }
        return {
          id: p.id,
          candidate_user_id: p.candidateUserId,
          session_id: sessionId,
          name: profile?.displayName ?? '候选用户',
          display_name: profile?.displayName ?? '候选用户',
          affinity: affinityPct,
          affinity_score: p.affinity ?? 0,
          status: p.status,
          handoff_id: handoff?.id ?? null,
          last_message: lastMessage,
          tags: profile?.city ? [profile.city] : [],
          bio: typeof profile?.bioJson === 'object' ? JSON.stringify(profile.bioJson) : '',
          // 【缺陷10修复】动态生成匹配原因（同城/共同兴趣/向量相似度），替代硬编码
          match_reasons: this.buildMatchReasons({
            myProfile,
            candidateProfile: profile,
            myInterests,
            candidateInterests: this.extractInterests(profile?.bioJson),
            affinityScore: p.affinity,
          }),
        };
      }),
    );
    return { items, matches: items };
  }

  async dismiss(userId: string, matchId: string) {
    await this.prisma.matchPush.updateMany({
      where: { id: matchId, userId },
      data: { status: MatchPushStatus.dismissed },
    });
    // 【缺陷8 修复】审计：忽略匹配
    await this.audit.log({
      userId,
      eventType: 'match_dismissed',
      summaryZh: `忽略匹配推荐 ${matchId}`,
      referenceId: matchId,
    });
    return { dismissed: true };
  }

  async block(blockerUserId: string, blockedUserId: string) {
    await this.prisma.block.upsert({
      where: {
        blockerUserId_blockedUserId: { blockerUserId, blockedUserId },
      },
      create: { blockerUserId, blockedUserId },
      update: {},
    });
    // 【缺陷8 修复】审计：拉黑用户
    await this.audit.log({
      userId: blockerUserId,
      eventType: 'user_blocked',
      summaryZh: `拉黑用户 ${blockedUserId}`,
      referenceId: blockedUserId,
    });
    return { blocked: true };
  }
}
