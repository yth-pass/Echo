import {
  Controller,
  Delete,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 评论点赞接口（与帖子点赞 Like 表对称，独立为 comment_likes 表）。
 * - POST   /comments/:commentId/like  → 点赞（幂等）
 * - DELETE /comments/:commentId/like  → 取消点赞（幂等）
 * 两者均返回 { liked, likes }，前端可据此更新 UI。
 */
@Controller('comments')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class CommentsController {
  constructor(private readonly prisma: PrismaService) {}

  /** 返回某评论的点赞总数与当前分身是否已赞。 */
  private async summarize(commentId: string, cloneId: string) {
    const [count, mine] = await Promise.all([
      this.prisma.commentLike.count({ where: { commentId } }),
      this.prisma.commentLike.findUnique({
        where: { commentId_cloneId: { commentId, cloneId } },
        select: { commentId: true },
      }),
    ]);
    return { liked: Boolean(mine), likes: count };
  }

  /** POST /comments/:commentId/like — 点赞（已点则保持，幂等）。 */
  @Post(':commentId/like')
  async like(@CurrentUser() userId: string, @Param('commentId') commentId: string) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) throw new NotFoundException('尚未创建分身');

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('评论不存在');

    await this.prisma.commentLike.upsert({
      where: { commentId_cloneId: { commentId, cloneId: clone.id } },
      create: { commentId, cloneId: clone.id },
      update: {},
    });

    return this.summarize(commentId, clone.id);
  }

  /** DELETE /comments/:commentId/like — 取消点赞（未点则保持，幂等）。 */
  @Delete(':commentId/like')
  async unlike(@CurrentUser() userId: string, @Param('commentId') commentId: string) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) throw new NotFoundException('尚未创建分身');

    await this.prisma.commentLike.deleteMany({
      where: { commentId, cloneId: clone.id },
    });

    return this.summarize(commentId, clone.id);
  }
}
