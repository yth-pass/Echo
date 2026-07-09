/**
 * Phase 1.6 理想伴侣画像合成器
 *
 * 把 Phase 1 维度分数（依恋类型）+ 理想伴侣探测卡（Card 16-18）回答 +
 * 信任观/幸福观/关系意图 翻译成 200-400 字叙事散文——
 * "你需要什么样的伴侣"，与 Phase 1.5 PersonaSketch（"你是谁"）对称。
 *
 * 产物写入 OnboardingSession.surveyJson.idealPartnerSketch，
 * 下游 buildTextForIdealEmbedding + llm.embed → ideal_embedding 列。
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import type { IdealPartnerSketch, OnboardingSurveyJson } from './survey-schema';

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `你是 Echo 的理想伴侣画像合成器。你的任务是根据用户的心理学维度（依恋类型、理想伴侣维度、信任观、幸福观、关系意图），
合成一份 200-400 字的自然语言描述——"你需要什么样的伴侣"。

硬规则：
1. 全程使用第二人称散文叙事（"你需要的是一个……"），禁用维度标签（不许写"依恋类型=secure""needEmotionalSafety=0.8"等术语）
2. 用**具体的关系场景**来描写，不要用抽象形容词
   （"你需要安全感" ❌ → "你需要一个每天忙到很晚也会给你发一句'到家了'的人" ✅）
3. 如果维度之间有矛盾（比如高独立需求但高情感安全需求），保留矛盾不要化解
4. 字数控制在 200-400 字之间
5. 如果依恋类型为 fearful，描写要特别细腻，体现"想靠近又怕受伤"的矛盾

输出结构（严格按此 JSON 格式输出）：

{
  "narrative": "完整的 200-400 字叙事散文",
  "dimensions": {
    "emotionalSafety": -1到1之间的数字,
    "spaceRespect": -1到1之间的数字,
    "directCommunication": -1到1之间的数字,
    "conflictResolution": -1到1之间的数字
  }
}

dimensions 的值来自用户的理想伴侣维度分数，直接传入即可，不要修改。`;

// ---------- Service ----------

@Injectable()
export class IdealPartnerSketchService {
  private readonly logger = new Logger(IdealPartnerSketchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // -----------------------------------------------------------------------
  // generate
  // -----------------------------------------------------------------------

  async generate(
    userId: string,
  ): Promise<{ success: true; idealPartnerSketch: IdealPartnerSketch }> {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      throw new BadRequestException('尚未开始入驻流程');
    }

    const survey = session.surveyJson as unknown as OnboardingSurveyJson | null;
    if (!survey) {
      throw new BadRequestException('尚未开始入驻流程');
    }

    // 复用纯合成逻辑（与分身页补做共享，不查 DB 不写 DB）
    const sketch = await this.generateFromSurvey(survey);

    // 写入 surveyJson
    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      idealPartnerSketch: sketch,
    };
    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });
    // 同步写入 Profile.bioJson (dual-write)
    await this.prisma.profile.update({
      where: { userId },
      data: { bioJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });

    return { success: true, idealPartnerSketch: sketch };
  }

  /**
   * 纯合成函数：从 survey（OnboardingSurveyJson）生成 IdealPartnerSketch，不查 DB 不写 DB。
   *
   * 供两个场景复用：
   *  - 入驻流程 generate(userId)：查 OnboardingSession 后调本方法
   *  - 分身页补做（已 finalize 用户）：ClonesService 从 Profile.bioJson 构造 survey 后调本方法，
   *    绕开 OnboardingSession.completed=false 限制
   *
   * 校验：survey.scenarioCards 至少 8 张（保证有依恋维度数据可用）。
   * 若 3 道理想伴侣探测卡未答，维度全 0，LLM 仍可生成但质量较低（建议先答卡再调）。
   */
  async generateFromSurvey(
    survey: OnboardingSurveyJson,
  ): Promise<IdealPartnerSketch> {
    const cards = survey.scenarioCards;
    if (!cards || cards.length < 8) {
      throw new BadRequestException('Phase 1 尚未完成，至少需要 8 张卡');
    }

    const userContent = this.buildUserContent(survey);

    const messages: Parameters<LlmService['chat']>[0] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];

    let raw = await this.llm.chat(messages, {
      temperature: 0.7,
      maxTokens: 800,
    });
    if (!raw) {
      this.logger.warn('LLM returned null on first attempt, retrying...');
      raw = await this.llm.chat(messages, {
        temperature: 0.7,
        maxTokens: 800,
      });
    }
    if (!raw) {
      throw new ServiceUnavailableException('LLM 服务暂时不可用，请稍后重试');
    }

    return this.parseSketch(raw, survey);
  }

  // -----------------------------------------------------------------------
  // adjust — 用户纠正确认（比 PersonaSketch.adjust 简单：只接收 userFeedback）
  // -----------------------------------------------------------------------

  async adjust(
    userId: string,
    userFeedback?: string,
  ): Promise<{ success: true; idealPartnerSketch: IdealPartnerSketch }> {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      throw new BadRequestException('尚未开始入驻流程');
    }

    const survey = session.surveyJson as unknown as OnboardingSurveyJson | null;
    const existingSketch = survey?.idealPartnerSketch;
    if (!existingSketch) {
      throw new BadRequestException('尚未生成理想伴侣画像，请先调用 generate');
    }

    // adjust() 不调用 LLM —— 用户纠正是纯文本叠加，不重新生成 narrative
    // 用户反馈直接存到 sketch，后续 embedding 时前置到输入即可
    const updatedSketch: IdealPartnerSketch = {
      ...existingSketch,
      userFeedback: userFeedback || undefined,
    };

    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      idealPartnerSketch: updatedSketch,
    };

    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });
    // 同步写入 Profile.bioJson (dual-write)
    await this.prisma.profile.update({
      where: { userId },
      data: { bioJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });

    return { success: true, idealPartnerSketch: updatedSketch };
  }

  // -----------------------------------------------------------------------
  // 内部方法：构建 user content
  // -----------------------------------------------------------------------

  private buildUserContent(survey: OnboardingSurveyJson): string {
    const parts: string[] = [];

    // 依恋类型
    const attachmentStyle = survey.dimensionScores?.attachmentStyle;
    if (attachmentStyle) {
      parts.push(`依恋类型: ${attachmentStyle}`);
    }

    // 理想伴侣维度（来自 Card 16-18）
    const idealDims = survey.idealPartnerDimensions;
    if (idealDims) {
      const dimLines: string[] = ['## Ideal Partner Dimensions'];
      for (const [key, dim] of Object.entries(idealDims)) {
        if (dim && typeof dim === 'object' && 'value' in dim) {
          dimLines.push(
            `${key}: ${(dim as { value: number }).value.toFixed(2)} (${(dim as { confidence: string }).confidence})`,
          );
        }
      }
      parts.push(dimLines.join('\n'));
    }

    // 理想伴侣卡片的自由文本
    const idealCards = (survey.scenarioCards ?? []).filter((c) =>
      ['unexpected_breakfast', 'silent_night', 'song_choice'].includes(c.cardId),
    );
    if (idealCards.length) {
      const cardLines: string[] = ['## Ideal Partner Card Responses'];
      for (const card of idealCards) {
        let line = `Card ${card.cardId}: 选择 ${card.choice}`;
        if (card.freeText) {
          line += `\n  自由文本: "${card.freeText}"`;
        }
        cardLines.push(line);
      }
      parts.push(cardLines.join('\n'));
    }

    // 信任观 + 幸福观
    if (survey.trustView?.trim()) {
      parts.push(`信任观: ${survey.trustView.trim()}`);
    }
    if (survey.happinessView?.trim()) {
      parts.push(`幸福观: ${survey.happinessView.trim()}`);
    }

    // 关系意图
    const goal = survey.goal?.trim();
    if (goal) {
      parts.push(`关系意图: ${goal}`);
    }

    // 用户基本信息（给 LLM 语境）
    const id = survey.identity;
    if (id) {
      parts.push(
        `用户: ${id.displayName}, ${id.ageBand}岁, ${id.genderIdentity}, ${id.currentCity}`,
      );
    }

    return parts.join('\n\n');
  }

  // -----------------------------------------------------------------------
  // 内部方法：解析 LLM 输出
  // -----------------------------------------------------------------------

  private parseSketch(
    raw: string,
    survey: OnboardingSurveyJson,
  ): IdealPartnerSketch {
    // 尝试解析 JSON 输出
    try {
      // 提取 JSON（可能被 ```json ... ``` 包裹）
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed.narrative && typeof parsed.narrative === 'string') {
        return {
          narrative: parsed.narrative.trim(),
          dimensions: {
            emotionalSafety:
              parsed.dimensions?.emotionalSafety ??
              this.getDimValue(survey, 'needEmotionalSafety'),
            spaceRespect:
              parsed.dimensions?.spaceRespect ??
              this.getDimValue(survey, 'needSpaceRespect'),
            directCommunication:
              parsed.dimensions?.directCommunication ??
              this.getDimValue(survey, 'needDirectCommunication'),
            conflictResolution:
              parsed.dimensions?.conflictResolution ??
              this.getDimValue(survey, 'needConflictResolution'),
          },
          generatedAt: new Date().toISOString(),
        };
      }
    } catch {
      // JSON 解析失败，把整个输出当 narrative
      this.logger.warn('Failed to parse LLM output as JSON, using raw text as narrative');
    }

    // Fallback: 整段作为 narrative，维度从 survey 取
    return {
      narrative: raw.trim().slice(0, 800),
      dimensions: {
        emotionalSafety: this.getDimValue(survey, 'needEmotionalSafety'),
        spaceRespect: this.getDimValue(survey, 'needSpaceRespect'),
        directCommunication: this.getDimValue(survey, 'needDirectCommunication'),
        conflictResolution: this.getDimValue(survey, 'needConflictResolution'),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /** 从 survey.idealPartnerDimensions 取维度 value，无数据返回 0 */
  private getDimValue(survey: OnboardingSurveyJson, key: string): number {
    const dim = survey.idealPartnerDimensions?.[key];
    if (dim && typeof dim === 'object' && 'value' in dim) {
      return (dim as { value: number }).value;
    }
    return 0;
  }
}
