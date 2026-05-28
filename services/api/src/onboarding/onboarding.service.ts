import { Injectable } from '@nestjs/common';
import { CloneStatus, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../redis/redis.service';
import {
  buildPersonaSeedFromSurvey,
  type OnboardingSurveyJson,
} from './survey-schema';

export const DIALOGUE_MAX_TURNS = 8;

const DIALOGUE_WRAP_UP_REPLY =
  '太好了，你的语气我已经捕捉得差不多了。点击下方「继续」，进入分身孵化吧～';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
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

    const userTurnsBefore = history.filter((h) => h.role === 'user').length;
    if (userTurnsBefore >= DIALOGUE_MAX_TURNS) {
      return {
        sessionId: session.id,
        reply: DIALOGUE_WRAP_UP_REPLY,
        turnCount: userTurnsBefore,
        maxReached: true,
      };
    }

    history.push({ role: 'user', content: message });
    const turnCount = history.filter((h) => h.role === 'user').length;

    let reply: string;
    let maxReached = false;

    if (turnCount >= DIALOGUE_MAX_TURNS) {
      reply = DIALOGUE_WRAP_UP_REPLY;
      maxReached = true;
    } else {
      const wrapUpHint =
        turnCount >= 6
          ? '这是第 6 轮或之后：用一句简短总结收尾，并提示用户可点击「继续」进入分身孵化，不要再提新问题。'
          : '整体对话控制在 8 轮以内；每次只问一个问题，不要重复问卷已问过的事实。';
      reply =
        (await this.llm.chat([
          {
            role: 'system',
            content: `你是 Echo 入驻助手。根据用户问卷与语气样本，用简短中文再追问 1 个问题，以捕捉其语言风格与价值观。问卷摘要：\n${surveyBrief}\n${wrapUpHint}`,
          },
          ...history.map((h) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
          })),
        ])) ?? '谢谢分享！还有什么想补充的吗？';
    }

    history.push({ role: 'assistant', content: reply });
    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { dialogueJson: history },
    });
    return { sessionId: session.id, reply, turnCount, maxReached };
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
      create: {
        cloneId: clone.id,
        promptText: personaText,
        boundariesJson: { handoff: true, forbiddenWords: [], topicsToAvoid: null },
      },
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

    await this.queue.enqueueMatchDaily();

    await this.audit.log({
      userId,
      cloneId: clone.id,
      eventType: 'onboarding.finalize',
      summaryZh: '完成入驻并激活数字分身',
    });

    const tokens = await this.auth.issueTokensForUser(userId);

    return {
      cloneId: clone.id,
      status: clone.status,
      onboardingComplete: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId: tokens.userId,
    };
  }

  private fakeEmbedding(seed: string): number[] {
    const vec = new Array(8).fill(0);
    for (let i = 0; i < seed.length; i++) vec[i % 8] += seed.charCodeAt(i) / 1000;
    return vec;
  }
}
