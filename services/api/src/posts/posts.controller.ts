import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

class DraftPostDto {
  @IsOptional()
  @IsString()
  content?: string;
}

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Post('draft')
  async enqueueDraft(@CurrentUser() userId: string, @Body() dto: DraftPostDto) {
    const clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) return { queued: false, reason: 'no_clone' };
    await this.queue.enqueuePostDraft({
      cloneId: clone.id,
      content: dto.content,
      trigger: 'manual',
    });    return { queued: true };
  }
}
