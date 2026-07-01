/**
 * Phase 1.5 人格画像合成器
 *
 * 把 Phase 0 identity + Phase 1 维度分数 + 情境卡片回答
 * 翻译成 800-1200 字叙事散文（人物小传），供下游 LLM 克隆直接消费。
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
import type { OnboardingSurveyJson } from './survey-schema';

// ---------- 类型定义 ----------

export interface PersonaSketchSections {
  identityNarrative: string;
  personalityTexture: string;
  coreBeliefs: string;
  valuesInAction: string;
  caringStyle: string;
  socialBoundaries: string;
  contradictions: string;
  voiceAnchors: string[];
}

export interface PersonaSketch {
  narrative: string;
  sections: PersonaSketchSections;
  generationTimestamp: number;
}

/** 8 节的 key，用于 adjust 校验 */
const VALID_SECTIONS = [
  'identityNarrative',
  'personalityTexture',
  'coreBeliefs',
  'valuesInAction',
  'caringStyle',
  'socialBoundaries',
  'contradictions',
  'voiceAnchors',
] as const;

type SectionKey = (typeof VALID_SECTIONS)[number];

/** 中文标题 → section key 映射（解析 LLM 输出时使用） */
const HEADER_TO_KEY: Record<string, SectionKey> = {
  '身份脉络': 'identityNarrative',
  'identity narrative': 'identityNarrative',
  '性格底色': 'personalityTexture',
  'personality texture': 'personalityTexture',
  '核心信念': 'coreBeliefs',
  'core beliefs': 'coreBeliefs',
  '价值观优先级': 'valuesInAction',
  'values in action': 'valuesInAction',
  '关心方式': 'caringStyle',
  'caring style': 'caringStyle',
  '社交边界': 'socialBoundaries',
  'social boundaries': 'socialBoundaries',
  '内在矛盾': 'contradictions',
  'contradictions to preserve': 'contradictions',
  '语言锚点': 'voiceAnchors',
  'voice anchors': 'voiceAnchors',
};

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `你是 Echo 的人格画像合成器。你的任务是把用户的心理学维度分数 + 选择题回答 + 自由文本，
翻译成一份 800-1200 字的「人物小传」，供下游的 LLM 克隆直接消费。

硬规则：
1. 全程使用散文叙事，禁用维度标签（不许写"高外向性""MFT Care=0.8"等任何术语）
2. 每个节都要用**具体的行为描述**，不要用形容词
   （"你体贴" ❌ → "你会默默记住朋友随口提过的餐厅，下次直接订好位置" ✅）
3. 「内在矛盾」一节必须保留矛盾的两边，不要试图"解释掉"或"和解"
4. 「语言锚点」一节必须**逐字引用**用户原话，不要改写
5. 字数控制在 800-1200 字之间——超过 1500 字会让克隆 prompt 膨胀，低于 600 字不够用
6. 如果维度分数与自由文本矛盾，**优先信任自由文本**（那是用户自己的话，不是选择题的猜测）

输出结构（严格按此 8 节输出 markdown）：

# [用户昵称] 的人物画像

## 身份脉络（Identity Narrative）
[基于 identity 字段的叙事化描述]

## 性格底色（Personality Texture）
[基于 E/O/C 维度的具体行为描述，包含陌生/朋友/独处三种场景]

## 核心信念（Core Beliefs）
[基于 MFT + Card 4 自由文本]

## 价值观优先级（Values in Action）
[基于 MFT + Card 6/11 的选择]

## 关心方式（Caring Style）
[基于 A 维度 + Card 14 的选择]

## 社交边界（Social Boundaries）
[基于 N 维度 + Card 9/15 的选择与自由文本]

## 内在矛盾（Contradictions to Preserve）
[从维度内矛盾 + Card 选择矛盾中提取，保留两边]

## 语言锚点（Voice Anchors）
[逐字引用用户在各卡片自由文本中的原话片段]`;

// ---------- Service ----------

@Injectable()
export class PersonaSketchService {
  private readonly logger = new Logger(PersonaSketchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // -----------------------------------------------------------------------
  // generate
  // -----------------------------------------------------------------------

  async generate(userId: string): Promise<{ success: true; personaSketch: PersonaSketch }> {
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

    // 校验 Phase 0
    if (!survey.identity) {
      throw new BadRequestException('Phase 0 尚未完成');
    }

    // 校验 Phase 1
    const cards = survey.scenarioCards;
    if (!cards || cards.length < 8) {
      throw new BadRequestException('Phase 1 尚未完成，至少需要 8 张卡');
    }

    // 构建 user content
    const userContent = this.buildUserContent(survey);

    // 调用 LLM（含 1 次重试）
    const messages: Parameters<LlmService['chat']>[0] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];

    let raw = await this.llm.chat(messages, { temperature: 0.7, maxTokens: 2000 });
    if (!raw) {
      this.logger.warn('LLM returned null on first attempt, retrying...');
      raw = await this.llm.chat(messages, { temperature: 0.7, maxTokens: 2000 });
    }
    if (!raw) {
      throw new ServiceUnavailableException('LLM 服务暂时不可用，请稍后重试');
    }

    // 解析输出
    const personaSketch = this.parsePersonaSketch(raw);

    // 写入 surveyJson
    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      personaSketch,
    };
    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });

    return { success: true, personaSketch };
  }

  // -----------------------------------------------------------------------
  // adjust
  // -----------------------------------------------------------------------

  async adjust(
    userId: string,
    section: string,
    userCorrection: string,
  ): Promise<{ success: true; updatedSection: string; narrative: string }> {
    // 校验 section 名
    if (!VALID_SECTIONS.includes(section as SectionKey)) {
      throw new BadRequestException(
        `无效的节名 "${section}"，必须是: ${VALID_SECTIONS.join(', ')}`,
      );
    }

    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      throw new BadRequestException('尚未开始入驻流程');
    }

    const survey = session.surveyJson as unknown as OnboardingSurveyJson | null;
    const existingSketch = survey?.personaSketch;
    if (!existingSketch) {
      throw new BadRequestException('尚未生成人格画像，请先调用 generate');
    }

    const sectionKey = section as SectionKey;
    const currentText =
      sectionKey === 'voiceAnchors'
        ? (existingSketch.sections.voiceAnchors ?? []).join('\n')
        : (existingSketch.sections[sectionKey] as string) ?? '';

    // 构建调整 prompt
    const adjustSystemPrompt =
      `你是 Echo 的人格画像合成器。用户希望对人物小传的「${section}」一节进行调整。\n` +
      `规则：\n` +
      `1. 只重写这一节，不要改动其他节\n` +
      `2. 保持原有的散文叙事风格和行为描写方式\n` +
      `3. 融入用户的纠正意见\n` +
      `4. 如果是「语言锚点」节，仍然逐字引用用户原话\n` +
      `5. 字数与原节大致相当\n\n` +
      `只输出重写后的这一节内容（不包含标题）。`;

    const adjustUserContent =
      `当前「${section}」一节的内容：\n${currentText}\n\n` +
      `用户的纠正意见：${userCorrection}`;

    const messages: Parameters<LlmService['chat']>[0] = [
      { role: 'system', content: adjustSystemPrompt },
      { role: 'user', content: adjustUserContent },
    ];

    let raw = await this.llm.chat(messages, { temperature: 0.7, maxTokens: 600 });
    if (!raw) {
      this.logger.warn('LLM returned null on first attempt (adjust), retrying...');
      raw = await this.llm.chat(messages, { temperature: 0.7, maxTokens: 600 });
    }
    if (!raw) {
      throw new ServiceUnavailableException('LLM 服务暂时不可用，请稍后重试');
    }

    // 更新 sections
    const updatedSections = { ...existingSketch.sections };
    if (sectionKey === 'voiceAnchors') {
      updatedSections.voiceAnchors = this.extractVoiceAnchors(raw);
    } else {
      (updatedSections as Record<string, unknown>)[sectionKey] = raw.trim();
    }

    // 重新拼接 narrative
    const narrative = this.rebuildNarrative(updatedSections);

    const updatedSketch: PersonaSketch = {
      narrative,
      sections: updatedSections,
      generationTimestamp: existingSketch.generationTimestamp,
    };

    // 记录调整历史
    const adjustments = survey.userFeedback?.sectionAdjustments ?? [];
    adjustments.push({
      section: sectionKey,
      originalText: currentText,
      userCorrection,
    });

    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      personaSketch: updatedSketch,
      userFeedback: {
        ...survey.userFeedback,
        accepted: survey.userFeedback?.accepted ?? false,
        sectionAdjustments: adjustments,
      },
    };

    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });

    return { success: true, updatedSection: sectionKey, narrative };
  }

  // -----------------------------------------------------------------------
  // batchAdjust — 批量句子级修正
  // -----------------------------------------------------------------------

  async batchAdjust(
    userId: string,
    corrections: Array<{
      sectionKey: string;
      originalSentence: string;
      correctedSentence: string;
    }>,
  ): Promise<{ success: true; personaSketch: PersonaSketch }> {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      throw new BadRequestException('尚未开始入驻流程');
    }

    const survey = session.surveyJson as unknown as OnboardingSurveyJson | null;
    const existingSketch = survey?.personaSketch;
    if (!existingSketch) {
      throw new BadRequestException('尚未生成人格画像，请先调用 generate');
    }

    // 按 section 分组
    const bySection = new Map<string, typeof corrections>();
    for (const c of corrections) {
      if (!VALID_SECTIONS.includes(c.sectionKey as SectionKey)) {
        throw new BadRequestException(`无效的节名 "${c.sectionKey}"`);
      }
      const arr = bySection.get(c.sectionKey) ?? [];
      arr.push(c);
      bySection.set(c.sectionKey, arr);
    }

    const updatedSections = { ...existingSketch.sections };

    // 逐 section 调用 LLM 进行批量修正
    for (const [sectionKey, edits] of bySection) {
      const sk = sectionKey as SectionKey;
      const currentText =
        sk === 'voiceAnchors'
          ? (updatedSections.voiceAnchors ?? []).join('\n')
          : (updatedSections[sk] as string) ?? '';

      const editList = edits
        .map((e) => `原句: "${e.originalSentence}"\n修正为: "${e.correctedSentence}"`)
        .join('\n\n');

      const prompt =
        `你是 Echo 的人格画像合成器。用户对「${sectionKey}」一节做了如下句子级修改：\n\n${editList}\n\n` +
        `当前完整的「${sectionKey}」一节内容：\n${currentText}\n\n` +
        `请将这些修改融入原文，重写整个节。保持原有的散文叙事风格和行为描写方式。` +
        `只输出重写后的这一节内容（不包含标题）。`;

      let raw = await this.llm.chat(
        [{ role: 'system', content: '你是专业的人物小传编辑，擅长将用户的修正自然融入叙事文本。' }, { role: 'user', content: prompt }],
        { temperature: 0.7, maxTokens: 600 },
      );
      if (!raw) {
        raw = await this.llm.chat(
          [{ role: 'system', content: '你是专业的人物小传编辑。' }, { role: 'user', content: prompt }],
          { temperature: 0.7, maxTokens: 600 },
        );
      }
      if (!raw) {
        throw new ServiceUnavailableException('LLM 服务暂时不可用');
      }

      if (sk === 'voiceAnchors') {
        updatedSections.voiceAnchors = this.extractVoiceAnchors(raw);
      } else {
        (updatedSections as Record<string, unknown>)[sk] = raw.trim();
      }
    }

    const narrative = this.rebuildNarrative(updatedSections);
    const updatedSketch: PersonaSketch = {
      narrative,
      sections: updatedSections,
      generationTimestamp: existingSketch.generationTimestamp,
    };

    const updatedSurvey: OnboardingSurveyJson = {
      ...survey,
      personaSketch: updatedSketch,
    };

    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: { surveyJson: updatedSurvey as unknown as Prisma.InputJsonValue },
    });

    return { success: true, personaSketch: updatedSketch };
  }

  // -----------------------------------------------------------------------
  // generateHint — 为情境卡片生成参考答案
  // -----------------------------------------------------------------------

  async generateHint(userId: string, cardId: string): Promise<{ hint: string }> {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      throw new BadRequestException('尚未开始入驻流程');
    }

    const survey = session.surveyJson as unknown as OnboardingSurveyJson | null;
    const identity = survey?.identity;

    const contextLine = identity
      ? `用户信息：${identity.displayName}，${identity.ageBand}岁，${identity.genderIdentity}，${identity.currentCity}，${identity.occupation}`
      : '';

    const prompt =
      `你是 Echo 入驻流程的 AI 助手。用户正在填写情境卡片 "${cardId}"，需要一些灵感。\n` +
      (contextLine ? `${contextLine}\n` : '') +
      `请生成一个简短的参考答案（30-80字），展示一种"典型人格"可能的回答。\n` +
      `要求：\n` +
      `1. 真实自然，像真人会写的话\n` +
      `2. 有具体细节，不要太泛\n` +
      `3. 不要写"比如"或"例如"开头\n` +
      `4. 只输出答案本身，不要解释`;

    let raw = await this.llm.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.9, maxTokens: 150 },
    );
    if (!raw) {
      raw = await this.llm.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0.9, maxTokens: 150 },
      );
    }
    if (!raw) {
      // 回退：返回预设提示
      return { hint: this.getFallbackHint(cardId) };
    }

    return { hint: raw.trim().slice(0, 200) };
  }

  private getFallbackHint(cardId: string): string {
    const fallbacks: Record<string, string> = {
      forest_cabin: '一个人待着看看窗外，享受安静',
      time_machine: '想回到高考前那个暑假，重新做选择',
      cotton_candy: '想起小时候放学路上的那段无忧无虑',
      unsent_letter: '想对以前的自己说，别太在意别人的看法',
      saturday_energy: '约上几个朋友出去玩，热闹一下',
      trolley: '拉下那根杆子，能救就救',
      spotlight: '有点紧张但还是会上，不想错过机会',
      deadline_eve: '通宵赶完，然后第二天补觉',
      criticism: '先冷静想想，如果确实有道理就改',
      weekend_detour: '走错就走错，说不定发现新地方',
      found_wallet: '想办法找到失主还回去',
      cafe_window: '看着外面的人来人往发呆放空',
      promotion: '先评估自己能不能做好再决定',
      midnight_call: '接起来问怎么了，朋友需要就去',
      misunderstood: '先沉默，等对方愿意听的时候再解释',
    };
    return fallbacks[cardId] ?? '跟随自己的第一直觉回答';
  }

  // -----------------------------------------------------------------------
  // 内部方法：构建 user content
  // -----------------------------------------------------------------------

  private buildUserContent(survey: OnboardingSurveyJson): string {
    const parts: string[] = [];

    // 第一部分：Identity Profile
    const id = survey.identity!;
    const identityLines = [
      '## Identity Profile',
      `昵称: ${id.displayName}`,
      `称呼偏好: ${id.preferredAddress}`,
      `性别认同: ${id.genderIdentity}`,
      `年龄段: ${id.ageBand}`,
      `家乡: ${id.hometownCity}`,
      `现居城市: ${id.currentCity}`,
      `学历: ${id.education}`,
      `职业: ${id.occupation}`,
      `行业: ${id.industry}`,
      `工作描述: ${id.workDescription}`,
      `关键人生经历: ${id.keyLifeExperiences.join('；')}`,
      `一句话自我介绍: ${id.selfIntroOneLiner}`,
    ];
    if (id.goalOnEcho) identityLines.push(`来 Echo 的目标: ${id.goalOnEcho}`);
    if (id.familyMembers?.length) {
      const familyStr = id.familyMembers
        .map((f) => `${f.relation}: ${f.brief}`)
        .join('；');
      identityLines.push(`家庭成员: ${familyStr}`);
    }
    parts.push(identityLines.join('\n'));

    // 第二部分：Dimension Scores
    const ds = survey.dimensionScores as Record<string, unknown> | undefined;
    if (ds) {
      const scoreLines: string[] = ['## Dimension Scores'];

      // Big Five
      const bigFive = ds.bigFive as Record<string, { value: number; confidence: string }> | undefined;
      if (bigFive) {
        const labelMap: Record<string, string> = {
          E: '外向性 (Extraversion)',
          A: '宜人性 (Agreeableness)',
          C: '尽责性 (Conscientiousness)',
          N: '神经质 (Neuroticism)',
          O: '开放性 (Openness)',
        };
        for (const [key, score] of Object.entries(bigFive)) {
          const label = labelMap[key] ?? key;
          scoreLines.push(`${label}: ${score.value.toFixed(2)} (${score.confidence})`);
        }
      }

      // 时间视角
      if (ds.timePerspective) {
        scoreLines.push(`时间视角: ${ds.timePerspective}`);
      }

      // 道德基础
      const mft = ds.moralFoundations as Record<string, number> | undefined;
      if (mft) {
        for (const [key, val] of Object.entries(mft)) {
          scoreLines.push(`MFT ${key}: ${typeof val === 'number' ? val.toFixed(2) : val}`);
        }
      }

      // 依恋类型
      if (ds.attachmentStyle) {
        scoreLines.push(`依恋类型: ${ds.attachmentStyle}`);
      }
      const attachScores = ds.attachmentScores as { avoidance: number; anxiety: number } | undefined;
      if (attachScores) {
        scoreLines.push(`依恋回避: ${attachScores.avoidance.toFixed(2)}, 依恋焦虑: ${attachScores.anxiety.toFixed(2)}`);
      }

      // 归因风格
      if (ds.attributionStyle) {
        scoreLines.push(`归因风格: ${ds.attributionStyle}`);
      }

      // 延迟满足
      const dg = ds.delayedGratification as { value: number; confidence: string } | undefined;
      if (dg) {
        scoreLines.push(`延迟满足: ${dg.value.toFixed(2)} (${dg.confidence})`);
      }

      parts.push(scoreLines.join('\n'));
    }

    // 第三部分：Scenario Responses
    const cards = survey.scenarioCards!;
    const cardLines: string[] = ['## Scenario Responses'];
    for (const card of cards) {
      let line = `Card ${card.cardId}: 选择 ${card.choice}`;
      if (card.freeText) {
        line += `\n  自由文本: "${card.freeText}"`;
      }
      if (card.responseTimeMs != null) {
        line += ` (${card.responseTimeMs}ms)`;
      }
      cardLines.push(line);
    }
    parts.push(cardLines.join('\n'));

    return parts.join('\n\n');
  }

  // -----------------------------------------------------------------------
  // 内部方法：解析 LLM 输出
  // -----------------------------------------------------------------------

  private parsePersonaSketch(raw: string): PersonaSketch {
    const sections = this.splitSections(raw);

    // 提取 voiceAnchors（从"语言锚点"节中逐条提取）
    const voiceAnchorsRaw = sections.voiceAnchors ?? '';
    const voiceAnchors = this.extractVoiceAnchors(voiceAnchorsRaw);

    return {
      narrative: raw.trim(),
      sections: {
        identityNarrative: sections.identityNarrative ?? '',
        personalityTexture: sections.personalityTexture ?? '',
        coreBeliefs: sections.coreBeliefs ?? '',
        valuesInAction: sections.valuesInAction ?? '',
        caringStyle: sections.caringStyle ?? '',
        socialBoundaries: sections.socialBoundaries ?? '',
        contradictions: sections.contradictions ?? '',
        voiceAnchors,
      },
      generationTimestamp: Date.now(),
    };
  }

  /**
   * 按 ## 标题拆分 LLM 输出为 8 个 section。
   * 标题可能包含中文 + 英文括号注释，统一映射到 section key。
   */
  private splitSections(raw: string): Record<SectionKey, string> {
    const result: Partial<Record<SectionKey, string>> = {};

    // 按 ## 开头的行拆分
    const lines = raw.split('\n');
    let currentKey: SectionKey | null = null;
    const buffer: string[] = [];

    for (const line of lines) {
      // 检测 ## 标题行
      if (line.startsWith('## ')) {
        // 保存上一节
        if (currentKey && buffer.length > 0) {
          result[currentKey] = buffer.join('\n').trim();
        }
        buffer.length = 0;

        // 匹配标题 → key
        const headerText = line.replace(/^## /, '').trim();
        currentKey = this.matchSectionKey(headerText);
        continue;
      }

      // 跳过 # 一级标题（文档标题）
      if (line.startsWith('# ') && !currentKey) continue;

      if (currentKey) {
        buffer.push(line);
      }
    }

    // 最后一节
    if (currentKey && buffer.length > 0) {
      result[currentKey] = buffer.join('\n').trim();
    }

    return result as Record<SectionKey, string>;
  }

  /**
   * 把中文/英文标题映射到 section key。
   * 支持模糊匹配：标题可能是 "身份脉络（Identity Narrative）" 或纯中文/纯英文。
   */
  private matchSectionKey(header: string): SectionKey | null {
    const lower = header.toLowerCase();
    for (const [pattern, key] of Object.entries(HEADER_TO_KEY)) {
      if (lower.includes(pattern.toLowerCase())) {
        return key;
      }
    }
    this.logger.warn(`Unrecognized section header: "${header}"`);
    return null;
  }

  /**
   * 从"语言锚点"节文本中逐条提取原话。
   * 去除前缀序号（"1. "）、短横线（"- "）、引号等。
   */
  private extractVoiceAnchors(text: string): string[] {
    if (!text?.trim()) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) =>
        line
          .replace(/^[\d]+[.)]\s*/, '')     // 去除 "1. " / "1) "
          .replace(/^[-•*]\s*/, '')          // 去除 "- " / "• " / "* "
          .replace(/^[""「『【]/, '')        // 去除开头引号
          .replace(/[""」』】]$/, '')        // 去除结尾引号
          .trim(),
      )
      .filter((line) => line.length > 0);
  }

  /**
   * 从更新后的 sections 重新拼接完整 narrative。
   */
  private rebuildNarrative(sections: PersonaSketchSections): string {
    const partLabels: Array<[SectionKey, string]> = [
      ['identityNarrative', '身份脉络（Identity Narrative）'],
      ['personalityTexture', '性格底色（Personality Texture）'],
      ['coreBeliefs', '核心信念（Core Beliefs）'],
      ['valuesInAction', '价值观优先级（Values in Action）'],
      ['caringStyle', '关心方式（Caring Style）'],
      ['socialBoundaries', '社交边界（Social Boundaries）'],
      ['contradictions', '内在矛盾（Contradictions to Preserve）'],
      ['voiceAnchors', '语言锚点（Voice Anchors）'],
    ];

    const parts: string[] = [];
    for (const [key, label] of partLabels) {
      if (key === 'voiceAnchors') {
        const anchors = sections.voiceAnchors;
        if (anchors?.length) {
          parts.push(`## ${label}\n${anchors.map((a) => `- ${a}`).join('\n')}`);
        }
      } else {
        const text = sections[key] as string;
        if (text) {
          parts.push(`## ${label}\n${text}`);
        }
      }
    }

    return parts.join('\n\n');
  }
}
