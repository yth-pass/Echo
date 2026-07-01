import { Injectable, NotFoundException } from '@nestjs/common';

import { ModerationStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BlockFilterService } from '../common/block-filter.service';



@Injectable()

export class FeedService {

  constructor(
    private readonly prisma: PrismaService,
    // 【缺陷4 修复】注入 BlockFilterService，对返回的帖子/评论做双向拉黑过滤
    private readonly blockFilter: BlockFilterService,
  ) {}



  async list(userId: string, cursor?: string, limit = 20) {

    // 【缺陷4 修复】获取与当前用户存在双向拉黑关系的对端 userId 列表，
    // 排除作者被当前用户拉黑、或拉黑了当前用户的帖子
    const blockedIds = await this.blockFilter.getBlockedUserIds(userId);

    const posts = await this.prisma.post.findMany({

      where: {
        moderationStatus: ModerationStatus.approved,
        // 过滤掉作者处于拉黑关系中的帖子（双向）
        ...(blockedIds.length > 0
          ? { clone: { user: { id: { notIn: blockedIds } } } }
          : {}),
      },

      take: limit + 1,

      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),

      orderBy: { createdAt: 'desc' },

      include: {

        clone: { include: { user: { include: { profile: true } } } },

        _count: { select: { likes: true, comments: true } },

      },

    });

    const hasMore = posts.length > limit;

    const slice = hasMore ? posts.slice(0, limit) : posts;

    const items = slice.map((p) => this.mapPost(p));

    return {

      items,

      nextCursor: hasMore ? slice[slice.length - 1]?.id : null,

    };

  }



  async getOne(userId: string, id: string) {

    // 【缺陷4 修复】获取双向拉黑对端列表，用于过滤帖子作者与评论作者
    const blockedIds = await this.blockFilter.getBlockedUserIds(userId);

    const p = await this.prisma.post.findUnique({

      where: { id },

      include: {

        clone: { include: { user: { include: { profile: true } } } },

        _count: { select: { likes: true, comments: true } },

        comments: {

          // 过滤掉评论作者处于拉黑关系中的评论（双向）
          ...(blockedIds.length > 0
            ? { where: { clone: { user: { id: { notIn: blockedIds } } } } }
            : {}),
          orderBy: { createdAt: 'asc' },

          include: {

            clone: { include: { user: { include: { profile: true } } } },

          },

        },

      },

    });

    if (!p) throw new NotFoundException('Post not found');

    // 【缺陷4 修复】若帖子作者本身处于拉黑关系中，对当前用户不可见
    if (blockedIds.includes(p.clone.userId)) {
      throw new NotFoundException('Post not found');
    }

    const base = this.mapPost(p);

    return {

      ...base,

      comments_list: p.comments.map((c) => ({

        id: c.id,

        content: c.content,

        author: c.clone.user.profile?.displayName ?? '分身',

        author_avatar: c.clone.user.profile?.avatarUrl ?? null,

        created_at: c.createdAt.toISOString(),

      })),

    };

  }



  private mapPost(

    p: {

      id: string;

      content: string;

      createdAt: Date;

      publishedAt: Date | null;

      clone: { user: { profile: { displayName: string | null; avatarUrl: string | null } | null } };

      _count: { likes: number; comments: number };

    },

  ) {

    return {

      id: p.id,

      content: p.content,

      author: p.clone.user.profile?.displayName ?? '分身',

      author_display: p.clone.user.profile?.displayName ?? '分身',

      author_avatar: p.clone.user.profile?.avatarUrl ?? null,

      created_at: (p.publishedAt ?? p.createdAt).toISOString(),

      likes: p._count.likes,

      comments: p._count.comments,

    };

  }

}

