import { Injectable } from '@nestjs/common';
import { CloneStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../redis/redis.service';
import {
  buildPersonaSeedFromSurvey,
  type OnboardingSurveyJson,
} from './survey-schema';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
  ) {}

  async submitSurvey(userId: string, body: Record<string, unknown>) {
    let session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: { userId, surveyJson: body as Prisma.InputJsonValue },
      });
    } else {
      session = await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { surveyJson: body as Prisma.InputJsonValue },
      });
    }
    await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
        city: typeof body.city === 'string' ? body.city : undefined,
        bioJson: body as Prisma.InputJsonValue,
      },
      update: {
        displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
        city: typeof body.city === 'string' ? body.city : undefined,
        bioJson: body as Prisma.InputJsonValue,
      },
    });
    return { sessionId: session.id, saved: true };
  }

  async dialogueTurn(userId: string, message: string, sessionId?: string) {
    let session = sessionId
      ? await this.prisma.onboardingSession.findFirst({ where: { id: sessionId, userId } })
      : null;
    if (!session) {
      session = await this.prisma.onboardingSession.findFirst({
        where: { userId, completed: false },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: { userId, dialogueJson: [] },
      });
    }
    const survey = (session.surveyJson ?? {}) as OnboardingSurveyJson;
    const surveyBrief = buildPersonaSeedFromSurvey(survey);
    const history = Array.isArray(session.dialogueJson)
      ? (session.dialogueJson as { role: string; content: string }[])
      : [];
    history.push({ role: 'user', content: message });
    const reply =
      (await this.llm.chat([
        {
          role: 'system',
          content: `你是 Echo 入驻助手。根据用户问卷与语气样本，用简短中文再追问 1 个问题，以捕捉其语言风格与价值观。问卷摘要：\n${surveyBrief}\n每次只问一个问题，不要重复问卷已问过的事实。`,
        },
        ...history.map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
      ])) ?? '谢谢分享！还有什么想补充的吗？';
    history.push({ role: 'assistant', content: reply });
    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { dialogueJson: history },
    });
    return { sessionId: session.id, reply, turnCount: history.filter((h) => h.role === 'user').length };
  }

  async finalize(userId: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    const survey = (session?.surveyJson ?? {}) as OnboardingSurveyJson;
    const seed = buildPersonaSeedFromSurvey(survey);
    const personaText =
      (await this.llm.chat([
        {
          role: 'system',
          content:
            '根据问卷与对话生成一段中文 persona prompt（200字以内），供数字分身在广场与私聊中模仿用户语气。必须体现 toneTags、典型回复句式，禁止编造联系方式。',
        },
        { role: 'user', content: seed },
      ])) ?? seed;

    const embedding = this.fakeEmbedding(userId);
    await this.prisma.profileEmbedding.upsert({
      where: { userId },
      create: { userId, embedding },
      update: { embedding },
    });

    let clone = await this.prisma.digitalClone.findUnique({ where: { userId } });
    if (!clone) {
      clone = await this.prisma.digitalClone.create({
        data: { userId, status: CloneStatus.active, consentAt: new Date() },
      });
    } else {
      clone = await this.prisma.digitalClone.update({
        where: { id: clone.id },
        data: { status: CloneStatus.active, consentAt: new Date() },
      });
    }
    await this.prisma.personaPrompt.upsert({
      where: { cloneId: clone.id },
      create: { cloneId: clone.id, promptText: personaText, boundariesJson: { handoff: true } },
      update: { promptText: personaText, version: { increment: 1 } },
    });
    if (session) {
      await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { completed: true },
      });
    }

    const now = Date.now();
    await this.redis.client.hset(`clone:meta:${clone.id}`, {
      lastPostAt: '0',
      lastSessionAt: '0',
      lastAffinityPeak: '0',
    });

    await this.queue.enqueuePostDraft({
      cloneId: clone.id,
      content: '',
      trigger: 'welcome',
    });

    await this.audit.log({
      userId,
      cloneId: clone.id,
      eventType: 'onboarding.finalize',
      summaryZh: '完成入驻并激活数字分身',
    });
    return { cloneId: clone.id, status: clone.status, onboardingComplete: true };
  }

  private fakeEmbedding(seed: string): number[] {
    const vec = new Array(8).fill(0);
    for (let i = 0; i < seed.length; i++) vec[i % 8] += seed.charCodeAt(i) / 1000;
    return vec;
  }
}
