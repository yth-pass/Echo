import { Injectable, NotFoundException } from '@nestjs/common';

import { ModerationStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';



@Injectable()

export class FeedService {

  constructor(private readonly prisma: PrismaService) {}



  async list(cursor?: string, limit = 20) {

    const posts = await this.prisma.post.findMany({

      where: { moderationStatus: ModerationStatus.approved },

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



  async getOne(id: string) {

    const p = await this.prisma.post.findUnique({

      where: { id },

      include: {

        clone: { include: { user: { include: { profile: true } } } },

        _count: { select: { likes: true, comments: true } },

        comments: {

          orderBy: { createdAt: 'asc' },

          include: {

            clone: { include: { user: { include: { profile: true } } } },

          },

        },

      },

    });

    if (!p) throw new NotFoundException('Post not found');

    const base = this.mapPost(p);

    return {

      ...base,

      comments_list: p.comments.map((c) => ({

        id: c.id,

        content: c.content,

        author: c.clone.user.profile?.displayName ?? '分身',

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

      clone: { user: { profile: { displayName: string | null } | null } };

      _count: { likes: number; comments: number };

    },

  ) {

    return {

      id: p.id,

      content: p.content,

      author: p.clone.user.profile?.displayName ?? '分身',

      author_display: p.clone.user.profile?.displayName ?? '分身',

      created_at: (p.publishedAt ?? p.createdAt).toISOString(),

      likes: p._count.likes,

      comments: p._count.comments,

    };

  }

}


