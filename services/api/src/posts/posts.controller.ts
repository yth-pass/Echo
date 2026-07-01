import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';

class DraftPostDto {
  @IsOptional()
  @IsString()
  content?: string;
}

@Controller('posts')
@UseGuards(JwtAuthGuard)
// 【缺陷9 修复】posts 限流：每分钟 20 次
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PostsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  @Post('draft')
  async enqueueDraft(@CurrentUser() userId: string, @Body() dto: DraftPostDto) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) return { queued: false, reason: 'no_clone' };

    // 入队和审计在后台执行，不阻塞前端响应
    this.queue
      .enqueuePostDraft({
        cloneId: clone.id,
        content: dto.content,
        trigger: 'manual',
      })
      .then(() =>
        this.audit.log({
          userId,
          eventType: 'post_drafted',
          summaryZh: `提交帖子草稿（clone=${clone.id}）`,
          referenceId: clone.id,
        }),
      )
      .catch((err) => {
        // 静默处理：不影响用户体验，生产环境可接入告警
        console.warn('[PostsController] enqueue/audit failed:', err?.message ?? err);
      });

    return { queued: true };
  }
}
