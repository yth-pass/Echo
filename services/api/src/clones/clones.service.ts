import { Injectable, NotFoundException } from '@nestjs/common';
import { CloneStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CloneBoundariesDto,
  mergeBoundariesJson,
  parseBoundariesJson,
} from './clone-boundaries';

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

    const [postCount, commentCount, likeCount, sessionCount] = await Promise.all([
      this.prisma.post.count({ where: { cloneId: clone.id } }),
      this.prisma.comment.count({ where: { cloneId: clone.id } }),
      this.prisma.like.count({ where: { cloneId: clone.id } }),
      this.prisma.agentSession.count({
        where: { OR: [{ cloneAId: clone.id }, { cloneBId: clone.id }] },
      }),
    ]);

    return {
      id: clone.id,
      status: clone.status,
      consentAt: clone.consentAt,
      persona: clone.personaPrompt?.promptText ?? null,
      boundaries: clone.personaPrompt
        ? (parseBoundariesJson(clone.personaPrompt.boundariesJson) ?? {
            forbiddenWords: [],
            topicsToAvoid: null,
          })
        : null,
      interactionCount: postCount + commentCount + likeCount + sessionCount,
    };
  }

  async updateMe(
    userId: string,
    data: { status?: CloneStatus; personaText?: string; boundaries?: CloneBoundariesDto },
  ) {
    let clone = await this.prisma.digitalClone.findUnique({
      where: { userId },
      include: { personaPrompt: true },
    });
    if (!clone) {
      clone = await this.prisma.digitalClone.create({
        data: { userId, status: data.status ?? CloneStatus.draft },
        include: { personaPrompt: true },
      });
    } else if (data.status) {
      clone = await this.prisma.digitalClone.update({
        where: { id: clone.id },
        data: { status: data.status },
        include: { personaPrompt: true },
      });
    }

    const needsPersonaUpsert =
      data.personaText !== undefined || data.boundaries !== undefined;

    if (needsPersonaUpsert) {
      const existingJson = clone.personaPrompt?.boundariesJson ?? null;
      const boundariesJson: Prisma.InputJsonValue = data.boundaries
        ? (mergeBoundariesJson(existingJson, data.boundaries) as Prisma.InputJsonValue)
        : ((existingJson ?? {
            handoff: true,
            forbiddenWords: [],
            topicsToAvoid: null,
          }) as Prisma.InputJsonValue);

      const promptText =
        data.personaText !== undefined
          ? data.personaText
          : (clone.personaPrompt?.promptText ?? '');

      await this.prisma.personaPrompt.upsert({
        where: { cloneId: clone.id },
        create: {
          cloneId: clone.id,
          promptText: promptText || ' ',
          boundariesJson,
        },
        update: {
          ...(data.personaText !== undefined
            ? { promptText: data.personaText, version: { increment: 1 } }
            : {}),
          ...(data.boundaries !== undefined ? { boundariesJson } : {}),
        },
      });
    }

    const summaryZh = data.boundaries
      ? '更新分身社交边界'
      : data.personaText
        ? '更新分身人格设定'
        : `更新分身状态：${clone.status}`;

    await this.audit.log({
      userId,
      cloneId: clone.id,
      eventType: 'clone.update',
      summaryZh,
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
