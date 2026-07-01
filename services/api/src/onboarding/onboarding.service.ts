import { ConflictException, Injectable, BadRequestException } from '@nestjs/common';
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
  buildTextForEmbedding,
  type OnboardingSurveyJson,
} from './survey-schema';
import { Phase0IdentityDto, Phase1Dto } from './onboarding.dto';
import { StyleGeneratorService } from '../agent-platform/style/style-generator.service';
import { createLogger } from '../../../shared/observability';
import {
  calculateDimensionScores,
  toSurveyDimensionScores,
} from './dimension-scorer';
import { ALL_SCENARIO_CARDS } from './scenario-cards';
import type { ScenarioResponse } from './survey-schema';

const logger = createLogger('onboarding');

/**
 * 四层人格采集模型 M4 深度对话轮数（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md §Module 4）。
 * 最小 6 轮、推荐 10 轮、上限 12 轮，分四阶段：暖场(1-2) / 矛盾追问(3-5) / 深层话题(6-9) / 收尾(10-12)。
 */
export const DIALOGUE_MIN_TURNS = 6;
export const DIALOGUE_MAX_TURNS = 12;

// 【缺陷8修复】finalize 最小对话轮数支持环境变量覆盖（默认 4）
function resolveFinalizeMinTurns(): number {
  const raw = process.env.DIALOGUE_MIN_TURNS;
  const n = raw ? Number.parseInt(raw, 10) : DIALOGUE_MIN_TURNS;
  return Number.isFinite(n) && n > 0 ? n : DIALOGUE_MIN_TURNS;
}

const DIALOGUE_WRAP_UP_REPLY =
  '聊得不错，你的语气和想法我都记下了。点击下方「继续」，进入分身孵化吧～';

const DIALOGUE_FALLBACK_REPLY =
  '能再用你自己的话说说吗？比如：最近一件让你觉得「这就是我」的小事，或者别人说什么会让你突然不想聊了？';

/**
 * 根据 turnCount 返回当前对话阶段的提示（暖场 / 矛盾追问 / 深层话题 / 收尾）。
 * turnCount 为用户已发言轮数（从 1 开始）。
 */
function buildDialogueStageHint(turnCount: number): string {
  // 阶段 (a) 暖场：1-2 轮
  if (turnCount <= 2) {
    return (
      `【当前阶段：暖场（第 ${turnCount} 轮，共 1-2 轮）】` +
      `用轻松话题让用户进入状态，可从用户问卷里的"典型一天/朋友形容/兴趣"切入。` +
      `不要追问矛盾，不要问深层价值观，先建立说话节奏。`
    );
  }
  // 阶段 (b) 矛盾追问：3-5 轮
  if (turnCount <= 5) {
    return (
      `【当前阶段：矛盾追问（第 ${turnCount} 轮，共 3-5 轮）】` +
      `重点：发现用户问卷答案或发言中的内在矛盾并提问。` +
      `例如：语气标签 vs 自由写作样本不一致；pace/conflict 选择看似冲突；` +
      `社交角色自述 vs 实际行为差异。直接指出矛盾点问"为什么"，保留用户的复杂性。`
    );
  }
  // 阶段 (c) 深层话题：6-9 轮
  if (turnCount <= 9) {
    return (
      `【当前阶段：深层话题（第 ${turnCount} 轮，共 6-9 轮）】` +
      `基于用户的兴趣/经历/价值观展开。优先追问"改变你的经历"当时的感受、` +
      `"幸福观/信任观"是否失灵过、"被理解的信号"反面场景。挖掘具体感受而非抽象观点。`
    );
  }
  // 阶段 (d) 收尾：10-11 轮（第 12 轮由 maxReached 接管）
  return (
    `【当前阶段：收尾（第 ${turnCount} 轮）】` +
    `已满足最小轮数。简短承接后问一个轻松的收尾问题（如让用户用一句口头禅收尾），` +
    `为孵化做铺垫。若用户想结束，可顺势收尾，不要强行追问深层话题。`
  );
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
    private readonly styleGen: StyleGeneratorService,
  ) {}

  /** 当 .env 设置 BYPASS_REDIS=true 时跳过所有 Redis / Queue 操作 */
  private get bypassRedis() {
    return process.env.BYPASS_REDIS === 'true';
  }

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

  /**
   * Phase 0 — 注册身份采集
   * 将 12 个硬性事实字段写入 OnboardingSession.surveyJson.identity，
   * 同步 displayName / city / gender / birthYear 到 Profile 顶层列。
   * 旧的 M1/M2/M3 数据保持不变，不触发 Prisma migration。
   */
  async submitPhase0(userId: string, dto: Phase0IdentityDto) {
    // 1. 查找或创建 OnboardingSession
    let session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    const existingSurvey = (session?.surveyJson ?? {}) as Record<string, unknown>;

    // 2. 构造 identity 子对象并合并到 surveyJson
    const identity = { ...dto };
    const mergedSurvey = { ...existingSurvey, identity };
    // 经 HTTP body 反序列化后为纯 JSON，cast through unknown 安全绕过 FamilyMemberDto[] 类型检查
    const jsonPayload = mergedSurvey as unknown as Prisma.InputJsonValue;

    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: { userId, surveyJson: jsonPayload },
      });
    } else {
      session = await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { surveyJson: jsonPayload },
      });
    }

    // 3. 推算出生年份（取年龄区间中间值）
    const birthYear = this.estimateBirthYear(dto.ageBand);

    // 4. 同步到 Profile 顶层列（兼容旧读取逻辑）
    await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: dto.displayName,
        city: dto.currentCity,
        gender: dto.genderIdentity,
        birthYear,
        bioJson: jsonPayload,
      },
      update: {
        displayName: dto.displayName,
        city: dto.currentCity,
        gender: dto.genderIdentity,
        birthYear,
        bioJson: jsonPayload,
      },
    });

    const fieldsReceived = Object.keys(dto);
    return { success: true as const, phase: 'phase0' as const, fieldsReceived };
  }

  /**
   * 根据年龄区间推算出生年份（取中间值）。
   * 当前年份动态计算，'46+' 统一取 1975。
   */
  private estimateBirthYear(ageBand: string): number {
    const currentYear = new Date().getFullYear();
    const midpoints: Record<string, number> = {
      '18-22': 20,
      '23-27': 25,
      '28-32': 30,
      '33-38': 35,
      '39-45': 42,
      '46+': 50,
    };
    return currentYear - (midpoints[ageBand] ?? 25);
  }

  /**
   * Phase 1 — 情境卡片（15 张）
   * 接收用户对 15 张情境卡片的回答，计算维度分数，写入 surveyJson。
   * 允许部分回答（记录 completionRate），P0 最小可行集为 8 张卡。
   */
  async submitPhase1(userId: string, dto: Phase1Dto) {
    // 1. 查找或创建 OnboardingSession
    let session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    const existingSurvey = (session?.surveyJson ?? {}) as Record<string, unknown>;

    // 2. 校验卡片数量 & 计算完成率
    const totalCards = ALL_SCENARIO_CARDS.length; // 15
    const answeredIds = new Set(dto.cards.map((c) => c.cardId));
    const validIds = new Set(ALL_SCENARIO_CARDS.map((c) => c.cardId));
    const validAnswered = [...answeredIds].filter((id) => validIds.has(id));
    const completionRate = validAnswered.length / totalCards;

    if (validAnswered.length === 0) {
      throw new BadRequestException('至少需要回答 1 张情境卡片');
    }

    // 3. 调用维度评分器
    const responses: ScenarioResponse[] = dto.cards.map((c) => ({
      cardId: c.cardId,
      choice: c.choice,
      freeText: c.freeText,
      responseTimeMs: c.responseTimeMs,
    }));
    const scores = calculateDimensionScores(responses);
    const surveyScores = toSurveyDimensionScores(scores);

    // 4. 合并到 surveyJson（保留已有数据）
    const mergedSurvey = {
      ...existingSurvey,
      scenarioCards: responses,
      dimensionScores: surveyScores,
    };
    const jsonPayload = mergedSurvey as unknown as Prisma.InputJsonValue;

    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: { userId, surveyJson: jsonPayload },
      });
    } else {
      session = await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { surveyJson: jsonPayload },
      });
    }

    // 5. 同步到 Profile.bioJson（保持双写一致）
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, bioJson: jsonPayload },
      update: { bioJson: jsonPayload },
    });

    logger.info(
      `Phase 1 submitted: userId=${userId}, cards=${validAnswered.length}/${totalCards}, ` +
        `completionRate=${(completionRate * 100).toFixed(1)}%`,
    );

    return {
      success: true as const,
      phase: 'phase1' as const,
      dimensionScores: surveyScores,
      completionRate,
      completionTimestamp: dto.completionTimestamp ?? Date.now(),
    };
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
        // 四阶段对话提示（暖场 / 矛盾追问 / 深层话题 / 收尾）
        const stageHint = buildDialogueStageHint(turnCount);
        const llmReply = await this.llm.chat([
          {
            role: 'system',
            content:
              `你是 Echo 入驻助手，角色是「好奇的采访者」，不是闲聊朋友。` +
              `你的任务：基于用户的四层问卷答案，用简短、口语化的中文，先简短承接用户刚说的话（1 句），再只追问 1 个具体问题。\n` +
              `追问原则：\n` +
              `- 优先发现用户问卷答案或发言中的内在矛盾并提问（例：选了"直接"但分歧场景选了委婉）。\n` +
              `- 优先追问"为什么"，而非"是什么"。\n` +
              `- 引用用户问卷里的真实选择/经历/口头禅来提问，让用户觉得"它真的看过我的回答"。\n` +
              `- 每次只问 1 个问题，不要重复问卷已问过的内容，不要主动提及约会/暧昧等场景，除非用户先说。\n` +
              `- 不要声称已完全掌握用户语气，不要提示用户结束对话或点击「继续」。\n\n` +
              `四层问卷摘要：\n${surveyBrief}\n\n${stageHint}`,
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
    const FINALIZE_TIMEOUT_MS = Number(process.env.FINALIZE_TIMEOUT_MS ?? 300_000);
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      this.finalizeCore(userId),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('入驻处理超时，请稍后重试')),
          FINALIZE_TIMEOUT_MS,
        );
      }),
    ]).then((r) => {
      clearTimeout(timer!);
      return r;
    }).catch((err) => {
      clearTimeout(timer!);
      throw err;
    });
  }

  private async finalizeCore(userId: string) {
    // 【缺陷8修复】入口校验：未完成对话最小轮数不可跳步 finalize
    const minTurns = resolveFinalizeMinTurns();
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });

    // 【缺陷8修复】统计对话中用户轮次（role === 'user'）
    const dialogueHistory = Array.isArray(session?.dialogueJson)
      ? (session.dialogueJson as { role: string; content: string }[])
      : [];
    const userTurns = dialogueHistory.filter((h) => h.role === 'user').length;

    const survey = (session?.surveyJson ?? {}) as OnboardingSurveyJson;

    // v2.2 完成度校验：当 v2.2 数据存在时，使用新校验逻辑
    const hasV22Data = !!(survey.identity && survey.scenarioCards);
    if (hasV22Data) {
      this.validateV22Completion(survey);
    } else if (userTurns < minTurns) {
      // 旧逻辑：未达最小对话轮数 → 拒绝 finalize
      throw new BadRequestException(
        `对话轮次不足，至少需 ${minTurns} 轮（当前 ${userTurns} 轮）`,
      );
    }

    // 【缺陷8修复】已 finalize（clone 已存在且 active）→ 冲突
    const existingClone = await this.prisma.digitalClone.findUnique({
      where: { userId },
    });
    if (existingClone && existingClone.status === CloneStatus.active && session?.completed) {
      throw new ConflictException('入驻已完成，不可重复 finalize');
    }

    // survey 已在上方声明
    const seed = buildPersonaSeedFromSurvey(survey);

    // v2.2 改动 A: personaText 生成升级
    let personaText: string;
    if (survey.personaSketch?.narrative) {
      // 以 Persona Sketch 为基础，提炼 ≤300 字角色设定 prompt
      personaText =
        (await this.llm.chat([
          {
            role: 'system',
            content:
              '以 Persona Sketch 为基础，提炼出 ≤300 字的角色设定 prompt，保留叙事性和矛盾。' +
              '这个 prompt 将用于数字分身在广场与私聊中模仿用户语气。' +
              '要求：保留人物的行为细节和内在矛盾，禁止抽象标签化，禁止编造联系方式。',
          },
          { role: 'user', content: survey.personaSketch.narrative },
        ])) ?? seed;
    } else {
      // 旧逻辑：从问卷 seed 生成 persona prompt
      personaText =
        (await this.llm.chat([
          {
            role: 'system',
            content:
              '根据问卷与对话生成一段中文 persona prompt（200字以内），供数字分身在广场与私聊中模仿用户语气。必须体现 toneTags、典型回复句式，禁止编造联系方式。',
          },
          { role: 'user', content: seed },
        ])) ?? seed;
    }

    // M2: 生成 style.md（dual-write，不破坏 persona_prompts）
    let styleMd = '';
    try {
      const dialogue = Array.isArray(session?.dialogueJson)
        ? (session.dialogueJson as { role: string; content: string }[])
        : undefined;
      const result = await this.styleGen.generate(survey, dialogue);
      styleMd = result.styleMd;
      // coreCandidates 可在后续存储 profile.core 时使用，此处暂不处理
      if (styleMd) {
        await this.prisma.profile.upsert({
          where: { userId },
          create: { userId, styleMd },
          update: { styleMd },
        });
      }
    } catch {
      // fallback：不影响主流程
    }

    // REQ-01: Real embedding from LLM, written via raw SQL for pgvector.
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const textForEmbedding = buildTextForEmbedding(profile, survey, userId);

    const { vector: embedding, quality } = await this.llm.embed(textForEmbedding);

    if (quality === 'fake') {
      logger.error(`User embedding is fake — matching quality degraded for userId=${userId}`);
    }

    const isValidEmbedding = (vec: number[]): boolean => {
      if (vec.every((v) => v === 0)) return false;
      const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
      const variance =
        vec.reduce((a, v) => a + (v - mean) ** 2, 0) / vec.length;
      return Math.sqrt(variance) >= 0.001;
    };

    if (quality === 'real' && isValidEmbedding(embedding)) {
      // Use raw SQL for pgvector compatibility (Prisma Json type cannot hold
      // native vector literals).
      try {
        const vectorStr = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`
          INSERT INTO profile_embeddings (user_id, embedding)
          VALUES (${userId}, ${vectorStr}::vector)
          ON CONFLICT (user_id) DO UPDATE SET embedding = ${vectorStr}::vector
        `;
      } catch (e) {
        logger.error(`pgvector write failed for userId=${userId}: ${(e as Error).message}`);
      }
    } else if (quality === 'real') {
      logger.error(`Invalid embedding vector skipped for userId=${userId}`);
    }

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
    // v2.2 改动 B: boundariesJson 从 personaSketch 提取
    let boundariesJson: Prisma.InputJsonValue = {
      handoff: true,
      forbiddenWords: [],
      topicsToAvoid: null,
    };
    if (survey.personaSketch?.sections) {
      const sk = survey.personaSketch.sections;
      const boundaries: string[] = [];
      if (sk.socialBoundaries?.trim()) {
        boundaries.push(sk.socialBoundaries.trim());
      }
      if (sk.contradictions?.trim()) {
        boundaries.push(sk.contradictions.trim());
      }
      if (boundaries.length > 0) {
        boundariesJson = {
          handoff: true,
          forbiddenWords: [],
          socialBoundaries: sk.socialBoundaries?.trim() || '',
          contradictions: sk.contradictions?.trim() || '',
        } as Prisma.InputJsonValue;
      }
    }

    await this.prisma.personaPrompt.upsert({
      where: { cloneId: clone.id },
      create: {
        cloneId: clone.id,
        promptText: personaText,
        boundariesJson,
      },
      update: {
        promptText: personaText,
        boundariesJson,
        version: { increment: 1 },
      },
    });

    // v2.2 改动 C: 合并 roleplayChats 到 dialogueJson
    let mergedDialogue: unknown[] = dialogueHistory;
    if (survey.roleplayChats?.length) {
      mergedDialogue = [
        ...dialogueHistory,
        ...survey.roleplayChats.map((chat) => ({
          source: 'roleplay',
          roleName: chat.roleName,
          agentName: chat.agentName,
          messages: chat.messages,
          startedAt: chat.startedAt,
          endedAt: chat.endedAt,
          qualityFlag: chat.qualityFlag,
        })),
      ];
    }

    if (session) {
      await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: {
          completed: true,
          ...(survey.roleplayChats?.length
            ? { dialogueJson: mergedDialogue as Prisma.InputJsonValue }
            : {}),
        },
      });
    }

    const now = Date.now();
    if (!this.bypassRedis) {
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
    } else {
      logger.info(`finalize(bypass): skip Redis hset + Queue enqueue for clone=${clone.id}`);
    }

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

  /**
   * v2.2 完成度校验：Phase 0 + Phase 1 + Phase 1.5 + Phase 2 完整性检查。
   * 当 v2.2 数据路径存在时替代旧的对话轮数校验。
   */
  private validateV22Completion(survey: OnboardingSurveyJson): void {
    // Phase 0: identity 必填字段完整
    const id = survey.identity;
    if (!id || !id.displayName || !id.occupation) {
      throw new BadRequestException('Phase 0 身份信息不完整');
    }

    // Phase 1: 至少 8 张卡完成
    const cards = survey.scenarioCards;
    if (!cards || cards.length < 8) {
      throw new BadRequestException(
        `Phase 1 情境卡片不足，至少需 8 张（当前 ${cards?.length ?? 0} 张）`,
      );
    }

    // Phase 1.5: personaSketch 已生成
    if (!survey.personaSketch?.narrative) {
      throw new BadRequestException('Phase 1.5 人格画像尚未生成');
    }

    // Phase 2: 至少 2 段 roleplayChat 完成（建议 Role 2 + Role 3）
    const completedChats = (survey.roleplayChats ?? []).filter(
      (c) => c.endedAt > 0,
    );
    if (completedChats.length < 2) {
      throw new BadRequestException(
        `Phase 2 角色扮演对话不足，至少需完成 2 段（当前 ${completedChats.length} 段）`,
      );
    }
  }
}
