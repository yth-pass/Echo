import { Injectable } from '@nestjs/common';
import { CloneStatus, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../redis/redis.service';
import {
  buildDialogueOpening,
  buildGreetingReply,
  buildOfflineDialogueReply,
  isGreetingOnly,
} from './dialogue-copy';
import {
  buildPersonaSeedFromSurvey,
  type OnboardingSurveyJson,
} from './survey-schema';

export const DIALOGUE_MIN_TURNS = 4;
export const DIALOGUE_MAX_TURNS = 8;

const DIALOGUE_WRAP_UP_REPLY =
  '聊得不错，你的语气特点我已经记下了。点击下方「继续」，进入分身孵化吧～';

const DIALOGUE_FALLBACK_REPLY =
  '谢谢分享！能再用你自己的话说说，约会时你最看重对方哪一点吗？';

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
        data: {
          surveyJson: body as Prisma.InputJsonValue,
          dialogueJson: [],
        },
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

  async startDialogue(userId: string, sessionId?: string) {
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
    const opening = buildDialogueOpening(survey);
    const history = [{ role: 'assistant', content: opening }];
    session = await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { dialogueJson: history },
    });
    return {
      sessionId: session.id,
      turnCount: 0,
      history: [{ role: 'assistant' as const, text: opening }],
    };
  }

  async dialogueTurn(userId: string, message: string, sessionId?: string) {
    try {
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
      } else if (isGreetingOnly(message)) {
        reply = buildGreetingReply(survey);
      } else {
        const wrapUpHint =
          turnCount >= 7
            ? '这是第 7 轮：简短回应并自然收尾，可提示用户若还想补充可再说一句，或点击「继续」进入孵化；不要声称已完全掌握语气。'
            : turnCount >= DIALOGUE_MIN_TURNS
              ? `这是第 ${turnCount} 轮（至少需 ${DIALOGUE_MIN_TURNS} 轮）：继续用一句话追问，挖掘语气与价值观，不要提前结束或让用户去点「继续」。`
              : `这是第 ${turnCount} 轮（未满 ${DIALOGUE_MIN_TURNS} 轮）：必须继续追问，每次只问一个问题，不要重复问卷内容，不要提示用户结束对话。`;
        const llmReply = await this.llm.chat([
          {
            role: 'system',
            content:
              `你是 Echo 入驻助手。根据用户问卷，用简短、口语化的中文回复：先简短承接用户刚说的话（1 句），再只追问 1 个具体问题。` +
              `若用户只是打招呼，引导其举例说明约会看重什么、如何拒绝暧昧等。问卷摘要：\n${surveyBrief}\n${wrapUpHint}`,
          },
          ...history.map((h) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
          })),
        ]);
        reply = llmReply ?? buildOfflineDialogueReply(turnCount, survey);
      }

      history.push({ role: 'assistant', content: reply });
      await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { dialogueJson: history },
      });
      return { sessionId: session.id, reply, turnCount, maxReached };
    } catch {
      return {
        sessionId: sessionId ?? '',
        reply: DIALOGUE_FALLBACK_REPLY,
        turnCount: 0,
        maxReached: false,
      };
    }
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
