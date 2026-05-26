import { Injectable, NotFoundException } from '@nestjs/common';
import { CloneStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(userId: string) {
    const clone = await this.prisma.digitalClone.findUnique({
      where: { userId },
      include: { personaPrompt: true },
    });
    if (!clone) throw new NotFoundException('Clone not found');
    return {
      id: clone.id,
      status: clone.status,
      consentAt: clone.consentAt,
      persona: clone.personaPrompt?.promptText ?? null,
    };
  }

  async updateMe(userId: string, data: { status?: CloneStatus; personaText?: string }) {
    let clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) {
      clone = await this.prisma.digitalClone.create({
        data: { userId, status: data.status ?? CloneStatus.draft },
      });
    } else if (data.status) {
      clone = await this.prisma.digitalClone.update({
        where: { id: clone.id },
        data: { status: data.status },
      });
    }
    if (data.personaText) {
      await this.prisma.personaPrompt.upsert({
        where: { cloneId: clone.id },
        create: { cloneId: clone.id, promptText: data.personaText },
        update: { promptText: data.personaText, version: { increment: 1 } },
      });
    }
    await this.audit.log({
      userId,
      cloneId: clone.id,
      eventType: 'clone.update',
      summaryZh: `更新分身状态：${clone.status}`,
    });
    return this.getMe(userId);
  }

  async pause(userId: string) {
    return this.updateMe(userId, { status: CloneStatus.paused });
  }

  async resume(userId: string) {
    return this.updateMe(userId, { status: CloneStatus.active });
  }
}
