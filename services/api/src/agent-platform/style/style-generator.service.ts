import { Injectable } from '@nestjs/common';
import { LlmService } from '../../llm/llm.service';
import type { OnboardingSurveyJson } from '../../onboarding/survey-schema';

export interface StyleGenerationResult {
  styleMd: string;
  coreCandidates: {
    display_name?: string;
    gender?: string;
    core_relationships?: Array<{ relation: string; name: string; person_id: string }>;
    hard_preferences?: string[];
  };
}

/**
 * 四层人格采集模型升级版 STYLE_PROMPT（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md §5.3）。
 * 新增 Adaptation（关系切换）、Boundaries（社交边界）章节，Avoid 部分新增 Contradictions（矛盾标记）。
 */
const STYLE_PROMPT = `你是 Echo 的专业风格分析器。任务：仅从用户提供的四层问卷和深度对话中提取"说话方式"与"社交适应模式"，生成 style.md。

严格要求：
1. 先做语言学分析（思考步骤不输出）：句长分布、语气词（啊/呢/吧/呀）、emoji 密度、直接/委婉程度、幽默类型（自嘲/吐槽/温暖）、重复句式、是否爱用短句或反问。优先使用自由写作样本和对话原文做分析。
2. Tone：3-6 个具体形容词 + 简短证据（例如：直接、带点自嘲、喜欢用"哈哈"和短句）。
3. Adaptation（关系切换模式）：从 M2 各场景的 relationContext（关系情境追问）和 M1 socialSpectrum 中提取——用户面对不同亲密度的人（陌生人/普通朋友/死党/在乎的人）时，语气、主动程度、尺度会如何切换。写成可执行规则，如"对刚认识的人：简短、礼貌、少主动；对死党：损友式调侃、不分段"。
4. Boundaries（社交安全边界）：从 M3 feelingHeardSignal（被理解的信号）和 shutDownTrigger（不想说话的触发）中提取——什么话会让用户感到被理解、什么话会踩雷让用户闭嘴。写成"该做/不该做"清单。
5. Avoid：3-5 条具体禁忌，必须可验证。其中新增 Contradictions（矛盾标记）子项：标注用户内在的不一致，例如"大部分时候直接，但触及 X 话题时会绕弯"——保留用户的复杂性，不要把它磨平。
6. Few-shots：必须尽量使用用户问卷自由写作样本、口头禅、对话中的**原话或极接近的改写**，每例 1-2 句，体现上述 Tone。每条例子标注适用场景（如"对死党""对刚认识的人"）。
7. 绝不编造任何事实、姓名、事件、职业。只输出语气与适应特征。
8. **必须**在最后返回一个 \`\`\`json 块（即使没有明确信息，也请返回空对象 {}）。此 json 块是强制要求的，不能省略。

输出格式严格为：
# Style

## Tone
...

## Adaptation
...

## Boundaries
...

## Avoid
...

## Few-shots
1. ...

\`\`\`json
{...}
\`\`\`
`;

@Injectable()
export class StyleGeneratorService {
  constructor(private readonly llm: LlmService) {}

  async generate(survey: OnboardingSurveyJson, dialogue?: Array<{ role: string; content: string }>): Promise<StyleGenerationResult> {
    const seed = this.buildSeed(survey, dialogue);
    let styleMd = '';
    let core: any = {};
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const raw =
        (await this.llm.chat([
          { role: 'system', content: STYLE_PROMPT },
          { role: 'user', content: seed },
        ])) ?? this.fallbackStyle(survey);

      const parsed = this.parseOutput(raw, survey);
      styleMd = parsed.styleMd;
      core = parsed.core;

      // 自检步骤：让 LLM 评估该 style 是否能让模型 ≥85% 复刻原用户
      const score = await this.selfCheck(styleMd, seed);
      if (score >= 85 || attempt === maxAttempts) {
        break;
      }
      // 低于 85 分且还有重试机会 → 继续下一轮
    }

    return { styleMd, coreCandidates: core };
  }

  private async selfCheck(styleMd: string, seed: string): Promise<number> {
    const checkPrompt = `请严格评估以下 style.md 是否能让另一个模型以 ≥85% 相似度复刻原用户的说话语气和社交适应模式。只输出一个 0-100 的整数分数，不要解释。`;
    const resp = await this.llm.chat([
      { role: 'system', content: checkPrompt },
      { role: 'user', content: `style.md:\n${styleMd}\n\n原用户样本：\n${seed}` },
    ]);
    const num = parseInt((resp || '0').match(/\d+/)?.[0] || '0', 10);
    return Math.max(0, Math.min(100, num));
  }

  /**
   * 构建四层问卷 + 对话的 seed，供 LLM 做 style 分析。
   * 纳入 M1 身份基座、M2 语言指纹（含关系情境）、M3 信念系统、M4 深度对话样本。
   */
  private buildSeed(survey: OnboardingSurveyJson, dialogue?: Array<{ role: string; content: string }>): string {
    const lines: string[] = [];

    // ===== M1: 身份基座 =====
    lines.push('===== M1 身份基座 =====');
    if (survey.displayName) lines.push(`displayName: ${survey.displayName}`);

    // v2.2: identity 字段优先级高于旧字段
    const id = survey.identity;
    if (id?.occupation) lines.push(`occupation: ${id.occupation}`);
    else if (survey.occupation) lines.push(`occupation: ${survey.occupation}`);
    if (id?.selfIntroOneLiner) lines.push(`一句话自介: ${id.selfIntroOneLiner}`);
    else if (survey.selfDescription) lines.push(`朋友眼中: ${survey.selfDescription}`);
    if (survey.dailyRoutine) lines.push(`典型一天: ${survey.dailyRoutine}`);
    if (id?.keyLifeExperiences?.length) lines.push(`关键经历: ${id.keyLifeExperiences.join('；')}`);
    else if (survey.keyExperience) lines.push(`改变我的经历: ${survey.keyExperience}`);
    if (survey.interests?.length) lines.push(`interests: ${survey.interests.join(', ')}`);
    if (survey.socialSpectrum) {
      const ss = survey.socialSpectrum;
      const ssParts: string[] = [];
      if (typeof ss.strangerComfort === 'number') {
        ssParts.push(ss.strangerComfort >= 50 ? '对陌生人自来熟' : '对陌生人拘谨');
      }
      if (ss.friendRole) ssParts.push(`朋友中偏${ss.friendRole}`);
      if (ss.groupRole) ssParts.push(`群体中偏${ss.groupRole}`);
      if (ssParts.length) lines.push(`社交角色: ${ssParts.join('; ')}`);
    }

    // ===== M2: 语言指纹（含关系情境） =====
    lines.push('===== M2 语言指纹（含关系情境）=====');
    // 归一化 toneTags
    if (survey.toneTags?.length) {
      const tones = survey.toneTags
        .map((t) => {
          if (typeof t === 'string') return t;
          if (t && typeof t === 'object' && 'tag' in t) {
            const tt = t as { tag: string; evidence?: string };
            return tt.evidence ? `${tt.tag}（例：${tt.evidence}）` : tt.tag;
          }
          return '';
        })
        .filter(Boolean);
      if (tones.length) lines.push(`toneTags: ${tones.join(', ')}`);
    }
    if (survey.styleReplies?.length) {
      lines.push('styleReplies（含关系情境）:');
      survey.styleReplies.forEach((r, i) => {
        let line = `  ${i + 1}. [${r.scenarioId}] ${r.text}`;
        if (r.relationContext) line += ` || 关系情境: ${r.relationContext}`;
        lines.push(line);
      });
    }
    if (survey.freeWritingSample) lines.push(`自由写作样本: ${survey.freeWritingSample}`);
    if (survey.catchphrases?.length) lines.push(`口头禅: ${survey.catchphrases.join(' / ')}`);
    else if (survey.sampleMessage) lines.push(`口头禅(旧): ${survey.sampleMessage}`);
    if (survey.caringStyle) lines.push(`表达关心的方式: ${survey.caringStyle}`);
    if (survey.chatHabits) {
      const ch: string[] = [];
      if (typeof survey.chatHabits.usesPunctuation === 'boolean')
        ch.push(survey.chatHabits.usesPunctuation ? '常用句号' : '不爱句号');
      if (typeof survey.chatHabits.likesEmoji === 'boolean')
        ch.push(survey.chatHabits.likesEmoji ? 'emoji多' : 'emoji少');
      if (typeof survey.chatHabits.prefersShortMessages === 'boolean')
        ch.push(survey.chatHabits.prefersShortMessages ? '爱短消息' : '消息偏长');
      if (typeof survey.chatHabits.sendsVoiceMessages === 'boolean')
        ch.push(survey.chatHabits.sendsVoiceMessages ? '发语音' : '不发语音');
      if (ch.length) lines.push(`聊天习惯: ${ch.join(', ')}`);
    }
    if (survey.emotionalPatterns) {
      const ep: string[] = [];
      if (survey.emotionalPatterns.badMoodNeed) ep.push(`低落时需${survey.emotionalPatterns.badMoodNeed}`);
      if (survey.emotionalPatterns.happyExpression) ep.push(`开心时会${survey.emotionalPatterns.happyExpression}`);
      if (ep.length) lines.push(`情绪反应: ${ep.join('; ')}`);
    }

    // ===== M3: 信念系统 =====
    lines.push('===== M3 信念系统 =====');
    if (survey.valuesChoices?.length) {
      lines.push('values:');
      survey.valuesChoices.forEach((v) => {
        const why = survey.valuesWhy?.[v.questionId];
        lines.push(`  - ${v.label}${why ? `（理由：${why}）` : ''}`);
      });
    }
    if (survey.trustView) lines.push(`信任观: ${survey.trustView}`);
    if (survey.happinessView) lines.push(`幸福观: ${survey.happinessView}`);
    if (survey.opinionProbes?.length) {
      lines.push('日常观点:');
      survey.opinionProbes.forEach((o) => {
        const label = o.label || '未明确';
        lines.push(`  - [${o.questionId}] ${label}${o.reason ? `（理由：${o.reason}）` : ''}`);
      });
    }
    if (survey.changedMind) lines.push(`改变过想法的事: ${survey.changedMind}`);
    if (survey.feelingHeardSignal) lines.push(`被理解的信号: ${survey.feelingHeardSignal}`);
    if (survey.shutDownTrigger) lines.push(`不想说话的触发: ${survey.shutDownTrigger}`);

    // ===== M4: 深度对话样本 =====
    if (dialogue && dialogue.length) {
      lines.push('===== M4 深度对话样本 =====');
      // 最多取最后 10 轮，保证语言学分析样本量
      dialogue.slice(-10).forEach((t) => lines.push(`  ${t.role}: ${t.content}`));
    }

    // ===== Phase 2: 角色扮演对话 =====
    if (survey.roleplayChats?.length) {
      lines.push('===== Phase 2 角色扮演对话 =====');
      for (const chat of survey.roleplayChats) {
        if (!chat.endedAt) continue; // 只取已完成的对话
        const userMsgs = chat.messages.filter((m) => m.role === 'user');
        if (userMsgs.length === 0) continue;
        lines.push(`--- 与 ${chat.agentName}（${chat.roleName}）对话 ---`);
        // 取用户消息作为语言样本（最多 10 条）
        userMsgs.slice(0, 10).forEach((m) => lines.push(`  user: ${m.content}`));
      }
    }

    return lines.join('\n');
  }

  private parseOutput(raw: string, survey: OnboardingSurveyJson): { styleMd: string; core: any } {
    // 简单解析：取 ```json 块作为 core，其余作为 styleMd
    let styleMd = raw.trim();
    let core: any = {};
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        core = JSON.parse(jsonMatch[1]);
        styleMd = raw.replace(/```json[\s\S]*?```/, '').trim();
      } catch {
        // ignore parse error, use fallback
      }
    }
    // 兜底：从 survey 提取 display_name
    if (!core.display_name && survey.displayName) core.display_name = survey.displayName;
    if (!core.hard_preferences) core.hard_preferences = [];
    return { styleMd, core };
  }

  private fallbackStyle(survey: OnboardingSurveyJson): string {
    const name = survey.displayName || '用户';
    const tonesRaw = survey.toneTags;
    const tones = Array.isArray(tonesRaw) && tonesRaw.length
      ? tonesRaw.map((t) => (typeof t === 'string' ? t : (t as { tag: string }).tag)).join('、')
      : '自然、亲切';
    const catchphrase = survey.catchphrases?.[0] || survey.sampleMessage || '哈哈，这个我懂～';
    return `# Style

## Tone
${tones}，简短直接，偶尔带点幽默。

## Adaptation
- 对刚认识的人：简短、礼貌、少主动展开。
- 对熟悉的朋友：可调侃、可发短句不分段。

## Boundaries
- 该做：直接回应、用具体细节证明在听。
- 不该做：长篇说教、上来就称呼"亲爱的"。

## Avoid
不要长篇大论、不要使用过多敬语、避免说教语气。
- Contradictions：若无明确矛盾标记，保持上述基调。

## Few-shots
1. "${catchphrase}"
2. "其实我更喜欢..."
3. "说实话，我觉得..."

\`\`\`json
{"display_name":"${name}","hard_preferences":[]}
\`\`\``;
  }
}
