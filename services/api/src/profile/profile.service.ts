/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取完整 profile（含头像、匹配偏好、隐私设置）。 */
  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        birthYear: true,
        gender: true,
        city: true,
        matchPrefsJson: true,
        privacyJson: true,
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    // 用一条 raw SQL 同时提取 hasAvatar、goalOnEcho 和 identity，避免加载大字段
    let hasAvatar = false;
    let goalOnEcho: string | null = null;
    let identity: Record<string, unknown> | null = null;
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { has_avatar: boolean; goal_on_echo: string | null; identity: string | null }[]
      >(
        `SELECT (avatar_url IS NOT NULL AND avatar_url != '') AS has_avatar,
                bio_json->>'goalOnEcho' AS goal_on_echo,
                bio_json->'identity' AS identity
           FROM profiles WHERE user_id = $1`,
        userId,
      );
      hasAvatar = rows?.[0]?.has_avatar ?? false;
      goalOnEcho = rows?.[0]?.goal_on_echo ?? null;
      // PostgreSQL -> operator returns JSON; parse it if it's a string
      const rawIdentity = rows?.[0]?.identity ?? null;
      if (rawIdentity) {
        identity = typeof rawIdentity === 'string' ? JSON.parse(rawIdentity) : rawIdentity;
      }
    } catch {
      // ignore
    }

    return {
      displayName: profile.displayName,
      hasAvatar,
      birthYear: profile.birthYear,
      gender: profile.gender,
      city: profile.city,
      matchPrefs: profile.matchPrefsJson ?? null,
      privacy: profile.privacyJson ?? null,
      goalOnEcho,
      identity,
    };
  }

  /** 获取其他用户的公开资料（头像、昵称、城市、帖子数等）。 */
  async getPublicProfile(targetUserId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: targetUserId },
      select: {
        displayName: true,
        avatarUrl: true,
        city: true,
        gender: true,
        bioJson: true,
      },
    });
    if (!profile) throw new NotFoundException('User not found');

    // 查询该用户的帖子数量（已通过审核的）
    const clone = await this.prisma.digitalClone.findUnique({
      where: { userId: targetUserId },
    });
    let postCount = 0;
    if (clone) {
      postCount = await this.prisma.post.count({
        where: { cloneId: clone.id, moderationStatus: 'approved' },
      });
    }

    // 提取 bio 摘要（interests 和 goalOnEcho）
    const bioJson = profile.bioJson as Record<string, unknown> | null;
    const interests = Array.isArray(bioJson?.interests) ? bioJson!.interests : [];
    const goalOnEcho = typeof bioJson?.goalOnEcho === 'string' ? bioJson.goalOnEcho : null;

    return {
      userId: targetUserId,
      displayName: profile.displayName ?? '分身',
      avatarUrl: profile.avatarUrl ?? null,
      city: profile.city ?? null,
      gender: profile.gender ?? null,
      interests,
      goalOnEcho,
      postCount,
    };
  }

  /** 更新匹配偏好、隐私设置和/或基础身份信息。 */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { userId: true, bioJson: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const data: Record<string, unknown> = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
    }
    if (dto.matchPrefs !== undefined) {
      data.matchPrefsJson = dto.matchPrefs;
    }
    if (dto.privacy !== undefined) {
      data.privacyJson = dto.privacy;
    }

    // 更新 Phase 0 基础信息：合并到 bioJson.identity，同步顶层字段
    if (dto.identity !== undefined) {
      const existingBio = (profile.bioJson as Record<string, unknown>) ?? {};
      const existingIdentity = (existingBio.identity as Record<string, unknown>) ?? {};
      const mergedIdentity = { ...existingIdentity, ...dto.identity };
      const mergedBio = { ...existingBio, identity: mergedIdentity };
      data.bioJson = mergedBio;

      // 同步顶层 Profile 字段
      if (mergedIdentity.displayName !== undefined) {
        data.displayName = String(mergedIdentity.displayName);
      }
      if (mergedIdentity.currentCity !== undefined) {
        data.city = String(mergedIdentity.currentCity);
      }
      if (mergedIdentity.genderIdentity !== undefined) {
        data.gender = String(mergedIdentity.genderIdentity);
      }
      // 从 ageBand 重新估算 birthYear
      if (mergedIdentity.ageBand !== undefined) {
        const band = String(mergedIdentity.ageBand);
        const currentYear = new Date().getFullYear();
        const ageMap: Record<string, number> = {
          '18-22': 20, '23-27': 25, '28-32': 30,
          '33-38': 35, '39-45': 42, '46+': 50,
        };
        const age = ageMap[band];
        if (age) data.birthYear = currentYear - age;
      }
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.profile.update({ where: { userId }, data });
    }

    return this.getProfile(userId);
  }
}
