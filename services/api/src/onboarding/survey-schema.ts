/** Canonical onboarding survey shape stored in Profile.bioJson / OnboardingSession.surveyJson
 *
 * 四层人格采集模型（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md）：
 *   M1 身份基座 | M2 语言指纹（含关系情境层）| M3 信念系统 | M4 深度对话（dialogueJson 单独存储）
 * 新字段全部 optional，向后兼容旧问卷数据。
 */

// ---------- M1: 身份基座 ----------

export type SocialSpectrum = {
  /** 和陌生人：0=拘谨, 100=自来熟 */
  strangerComfort?: number;
  /** 和朋友：倾听者 / 分享者 / 兼有 */
  friendRole?: string;
  /** 在群体中：观察者 / 气氛组 / 视情况 */
  groupRole?: string;
};

// ---------- M2: 语言指纹（含关系情境层） ----------

export type ToneTagWithEvidence = {
  /** 语气标签，如 "幽默" */
  tag: string;
  /** 该标签对应的真实原话证据 */
  evidence?: string;
};

export type StyleReplyWithContext = {
  scenarioId: string;
  choiceId: string;
  text: string;
  /** 关系情境追问的回答：面对不同亲密度的人，语气/主动程度有何不同 */
  relationContext?: string;
};

export type ChatHabits = {
  usesPunctuation?: boolean;
  likesEmoji?: boolean;
  prefersShortMessages?: boolean;
  sendsVoiceMessages?: boolean;
};

export type EmotionalPatterns = {
  /** 心情不好时希望别人怎么做 */
  badMoodNeed?: string;
  /** 特别开心时会怎么表达 */
  happyExpression?: string;
};

// ---------- M3: 信念系统 ----------

export type ValuesChoice = {
  questionId: string;
  choiceId: string;
  label: string;
};

export type OpinionProbe = {
  /** 日常观点探针的问题 id，如 "effort" / "socialMedia" / "loan" / "rareQuality" */
  questionId: string;
  choiceId?: string;
  label?: string;
  /** 可选 why 追问 */
  reason?: string;
};

// ---------- v2.2: Phase 0 / 1 / 1.5 / 2 辅助类型 ----------

export type FamilyMember = {
  relation: 'father' | 'mother' | 'sibling' | 'partner' | 'other';
  brief: string;
};

export type ScenarioResponse = {
  /** 情境卡片 ID，如 'forest_cabin' / 'time_machine' / 'cotton_candy' 等 */
  cardId: string;
  choice: 'A' | 'B' | 'C' | 'D' | 'custom';
  freeText?: string;
  responseTimeMs?: number;
};

export type DimensionScore = {
  /** -1 ~ +1 */
  value: number;
  confidence: 'high' | 'medium' | 'low';
  contradictions?: string[];
};

export type RoleplayChat = {
  roleName: 'stranger' | 'bestfriend' | 'crush' | 'oldfriend';
  agentName: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  startedAt: number;
  endedAt: number;
  qualityFlag?: 'good' | 'low_effort' | 'incomplete';
};

export type StyleProfile = {
  baselineParams: {
    avgReplyLength: number;
    sentenceLengthDist: Record<string, number>;
    emojiDensity: number;
    punctuationHabits: Record<string, number>;
    topCatchphrases: string[];
    commonParticles: string[];
  };
  relationSwitchRules: Record<string, string>;
  emotionalReactionPatterns: Record<string, string>;
  boundaries: string[];
};

// ---------- Phase 1.7: 个性化角色档案 ----------

/** 单个角色的个性化档案（基于 Phase 1 回答 + 人格画像生成） */
export type AgentProfile = {
  /** 角色性格特征描述（2-3 句话，如"外向话多但关键时刻很靠谱"） */
  personality: string;
  /** 说话风格特征（如"爱用反问句、喜欢夸张比喻、经常自嘲"） */
  speechStyle: string;
  /** 与用户的共同回忆/话题（如"一起熬夜赶过论文、都爱半夜点烧烤"） */
  sharedContext: string;
  /** 关系动态（如"表面互相损但内心最信任、遇到大事第一个找对方"） */
  relationshipDynamics: string;
  /** 容易产生共鸣的话题方向 */
  topicAffinity: string[];
};

/** 4 个角色的个性化档案 */
export type AgentProfiles = {
  stranger?: AgentProfile;
  bestfriend?: AgentProfile;
  crush?: AgentProfile;
  oldfriend?: AgentProfile;
  generationTimestamp?: number;
};

// ---------- 完整问卷结构 ----------

export type OnboardingSurveyJson = {
  // --- M1: 身份基座 ---
  displayName?: string;
  city?: string;
  goal?: string;
  interests?: string[];
  /** NEW: 职业/领域 */
  occupation?: string;
  /** NEW: 朋友们怎么形容你（社交人格锚点） */
  selfDescription?: string;
  /** NEW: 典型一天（生活节奏） */
  dailyRoutine?: string;
  /** NEW: 每个兴趣的"为什么/怎么喜欢"，key=兴趣名 */
  interestContexts?: Record<string, string>;
  /** NEW: 一个改变了你的经历 */
  keyExperience?: string;
  /** NEW: 社交角色基准 */
  socialSpectrum?: SocialSpectrum;

  // --- M2: 语言指纹（含关系情境层） ---
  /** 升级：每场景追加 relationContext */
  styleReplies?: StyleReplyWithContext[];
  /** 升级：加了 evidence 字段 */
  toneTags?: string[] | ToneTagWithEvidence[];
  /** NEW: 给朋友的消息（自由写作样本） */
  freeWritingSample?: string;
  /** NEW: 口头禅/惯用语列表 */
  catchphrases?: string[];
  /** NEW: 聊天习惯偏好 */
  chatHabits?: ChatHabits;
  /** NEW: 情绪反应模式 */
  emotionalPatterns?: EmotionalPatterns;
  /** NEW: 对在乎的人怎么表达关心（来自安慰场景追问） */
  caringStyle?: string;

  // --- M3: 信念系统 ---
  /** 保持，题目扩充 */
  valuesChoices?: ValuesChoice[];
  /** NEW: 每个价值观选择的理由，key=questionId */
  valuesWhy?: Record<string, string>;
  /** NEW: 信任观 */
  trustView?: string;
  /** NEW: 幸福观 */
  happinessView?: string;
  /** NEW: 日常观点探针 */
  opinionProbes?: OpinionProbe[];
  /** NEW: 改变过想法的事 */
  changedMind?: string;
  /** NEW: 被理解的信号 */
  feelingHeardSignal?: string;
  /** NEW: 不想说话的触发 */
  shutDownTrigger?: string;

  // --- v2.2 Phase 0: 身份基座（扩展） ---
  identity?: {
    displayName: string;
    preferredAddress: string;
    genderIdentity: 'male' | 'female' | 'nonbinary' | 'unspecified';
    ageBand: '18-22' | '23-27' | '28-32' | '33-38' | '39-45' | '46+';
    hometownCity: string;
    currentCity: string;
    education: 'highschool' | 'college' | 'bachelor' | 'master' | 'phd' | 'overseas';
    occupation: string;
    industry: string;
    workDescription: string;
    keyLifeExperiences: string[];
    selfIntroOneLiner: string;
    goalOnEcho?: string;
    familyMembers?: FamilyMember[];
  };

  // --- v2.2 Phase 1: 情境卡片 ---
  scenarioCards?: ScenarioResponse[];
  dimensionScores?: {
    bigFive?: Record<string, DimensionScore>;
    timePerspective?: string;
    moralFoundations?: Record<string, number>;
    attachmentStyle?: string;
  };

  // --- v2.2 Phase 1.5: 人格画像合成 ---
  personaSketch?: {
    narrative: string;
    sections: {
      identityNarrative: string;
      personalityTexture: string;
      coreBeliefs: string;
      valuesInAction: string;
      caringStyle: string;
      socialBoundaries: string;
      contradictions: string;
      voiceAnchors: string[];
    };
    generationTimestamp: number;
  };
  userFeedback?: {
    accepted: boolean;
    sectionAdjustments?: Array<{
      section: string;
      originalText: string;
      userCorrection: string;
    }>;
  };

  // --- v2.2 Phase 1.7: 个性化角色档案 ---
  agentProfiles?: AgentProfiles;

  // --- v2.2 Phase 2: 对话式角色扮演 ---
  roleplayChats?: RoleplayChat[];
  styleProfile?: StyleProfile;

  // --- 兼容 ---
  /** 弃用，合并到 catchphrases；向后兼容读取 */
  sampleMessage?: string;
  extra?: Record<string, unknown>;
};

export type ProfileForEmbedding = {
  displayName?: string | null;
  gender?: string | null;
  birthYear?: number | null;
  city?: string | null;
  styleMd?: string | null;
  bioJson?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArrayField(
  record: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const value = record?.[key];
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

/** 把 toneTags 归一化为纯字符串数组（兼容旧的 string[] 与新的 ToneTagWithEvidence[]） */
function normalizeToneTags(
  raw: string[] | ToneTagWithEvidence[] | undefined,
): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof item.tag === 'string') return item.tag;
      return '';
    })
    .filter((t) => t.trim().length > 0);
}

/** 把 toneTags 归一化为带证据结构（兼容旧数据） */
function normalizeToneTagsWithEvidence(
  raw: string[] | ToneTagWithEvidence[] | undefined,
): ToneTagWithEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { tag: item };
      if (item && typeof item === 'object' && typeof item.tag === 'string') {
        return { tag: item.tag, evidence: typeof item.evidence === 'string' ? item.evidence : undefined };
      }
      return null;
    })
    .filter((t): t is ToneTagWithEvidence => t !== null && t.tag.trim().length > 0);
}

/**
 * Build structured embedding input for profile compatibility ranking (FR-041).
 * Uses `key:value` segments joined by ` | ` for DeepSeek embedding sensitivity.
 * 纳入四层模型的新字段，提升匹配质量。
 */
export function buildTextForEmbedding(
  profile: ProfileForEmbedding | null,
  survey: OnboardingSurveyJson,
  userId: string,
): string {
  const parts: string[] = [];
  const bio = asRecord(profile?.bioJson);

  const displayName = profile?.displayName?.trim() || survey.displayName?.trim();
  if (displayName) parts.push(`昵称:${displayName}`);

  if (profile?.gender?.trim()) parts.push(`性别:${profile.gender.trim()}`);

  if (profile?.birthYear != null) parts.push(`年龄:${profile.birthYear}`);

  const city = profile?.city?.trim() || survey.city?.trim() || stringField(bio, 'city');
  if (city) parts.push(`城市:${city}`);

  const occupation = survey.occupation?.trim() || stringField(bio, 'occupation') || stringField(survey.extra, 'occupation');
  if (occupation) parts.push(`职业:${occupation}`);

  const education = stringField(bio, 'education') ?? stringField(survey.extra, 'education');
  if (education) parts.push(`学历:${education}`);

  const interests = survey.interests?.filter(Boolean);
  if (interests?.length) parts.push(`兴趣:${interests.join(',')}`);

  const hobbies = stringArrayField(bio, 'hobbies') ?? stringArrayField(survey.extra, 'hobbies');
  if (hobbies?.length) parts.push(`爱好:${hobbies.join(',')}`);

  const relationshipIntent =
    survey.goal?.trim() ||
    stringField(bio, 'datingGoal') ||
    stringField(bio, 'relationshipIntent') ||
    stringField(survey.extra, 'datingGoal') ||
    stringField(survey.extra, 'relationshipIntent');
  if (relationshipIntent) parts.push(`关系意图:${relationshipIntent}`);

  // M1: 社交角色
  if (survey.selfDescription?.trim()) parts.push(`社交人设:${survey.selfDescription.trim()}`);
  if (survey.dailyRoutine?.trim()) parts.push(`日常节奏:${survey.dailyRoutine.trim()}`);
  // v2.2: identity.keyLifeExperiences 数组优先，降级到旧版单条
  if (survey.identity?.keyLifeExperiences?.length) {
    parts.push(`关键经历:${survey.identity.keyLifeExperiences.join('；')}`);
  } else if (survey.keyExperience?.trim()) {
    parts.push(`关键经历:${survey.keyExperience.trim()}`);
  }
  if (survey.socialSpectrum) {
    const ss = survey.socialSpectrum;
    if (ss.friendRole) parts.push(`朋友中角色:${ss.friendRole}`);
    if (ss.groupRole) parts.push(`群体中角色:${ss.groupRole}`);
  }

  // M2: 语言指纹
  if (profile?.styleMd?.trim()) parts.push(`沟通风格:${profile.styleMd.trim()}`);

  const toneTags = normalizeToneTags(survey.toneTags);
  if (toneTags.length) parts.push(`语气:${toneTags.join(',')}`);

  const catchphrases = survey.catchphrases?.filter(Boolean);
  if (catchphrases?.length) parts.push(`口头禅:${catchphrases.join(',')}`);
  else if (survey.sampleMessage?.trim()) parts.push(`口头禅:${survey.sampleMessage.trim()}`);

  if (survey.freeWritingSample?.trim()) parts.push(`语言样本:${survey.freeWritingSample.trim().slice(0, 80)}`);

  // M3: 价值观与信念
  const values = survey.valuesChoices?.map((v) => v.label).filter(Boolean);
  if (values?.length) parts.push(`价值观:${values.join(',')}`);

  const opinionLabels = survey.opinionProbes?.map((o) => o.label).filter(Boolean);
  if (opinionLabels?.length) parts.push(`日常观点:${opinionLabels.join(',')}`);

  if (survey.trustView?.trim()) parts.push(`信任观:${survey.trustView.trim()}`);
  if (survey.happinessView?.trim()) parts.push(`幸福观:${survey.happinessView.trim()}`);

  const personality = stringArrayField(bio, 'personality');
  if (personality?.length) parts.push(`性格:${personality.join(',')}`);

  // v2.2 Phase 1.5: Persona Sketch（如存在，追加身份脉络和性格底色）
  if (survey.personaSketch?.sections) {
    const sk = survey.personaSketch.sections;
    if (sk.identityNarrative?.trim()) {
      parts.push(`人格画像:${sk.identityNarrative.trim().slice(0, 100)}`);
    }
    if (sk.personalityTexture?.trim()) {
      parts.push(`性格底色:${sk.personalityTexture.trim().slice(0, 80)}`);
    }
  }

  return parts.length > 0 ? parts.join(' | ') : userId;
}

/**
 * 构建四层结构化 persona seed，供 finalize 时 LLM 生成 persona prompt。
 * 替代旧的 5 行中文 seed，输出覆盖 M1-M3 的结构化摘要。
 */
export function buildPersonaSeedFromSurvey(survey: OnboardingSurveyJson): string {
  // v2.2 Phase 1.5 快速路径：如果有 Persona Sketch（LLM 合成的叙事散文），
  // 直接返回其 narrative，跳过 M1/M2/M3 字段拼接。
  // 理由：narrative 的信息密度和可扮演性远高于字段拼接。
  if (survey.personaSketch?.narrative?.trim()) {
    return survey.personaSketch.narrative.trim();
  }

  const sections: string[] = [];

  // ===== M1: 身份基座 =====
  const m1: string[] = [];
  m1.push(`昵称：${survey.displayName?.trim() || '未提供'}`);
  m1.push(`城市：${survey.city?.trim() || '未知'}`);
  m1.push(`目标：${survey.goal?.trim() || '认真约会'}`);
  if (survey.occupation?.trim()) m1.push(`职业/领域：${survey.occupation.trim()}`);
  if (survey.selfDescription?.trim()) m1.push(`朋友眼中的我：${survey.selfDescription.trim()}`);
  if (survey.dailyRoutine?.trim()) m1.push(`典型一天：${survey.dailyRoutine.trim()}`);
  const interests = survey.interests?.filter(Boolean);
  if (interests?.length) {
    let interestLine = `兴趣：${interests.join('、')}`;
    // 追加每个兴趣的"为什么"
    const contexts = interests
      .map((i) => survey.interestContexts?.[i]?.trim())
      .filter(Boolean);
    if (contexts.length) interestLine += `（${contexts.join('；')}）`;
    m1.push(interestLine);
  }
  if (survey.keyExperience?.trim()) m1.push(`改变我的经历：${survey.keyExperience.trim()}`);
  if (survey.socialSpectrum) {
    const ss = survey.socialSpectrum;
    const ssParts: string[] = [];
    if (typeof ss.strangerComfort === 'number') {
      ssParts.push(
        ss.strangerComfort >= 50 ? '对陌生人偏自来熟' : '对陌生人偏拘谨',
      );
    }
    if (ss.friendRole) ssParts.push(`和朋友时偏${ss.friendRole}`);
    if (ss.groupRole) ssParts.push(`群体中偏${ss.groupRole}`);
    if (ssParts.length) m1.push(`社交角色：${ssParts.join('，')}`);
  }
  sections.push(`【M1 身份基座】\n${m1.join('\n')}`);

  // ===== M2: 语言指纹（含关系情境） =====
  const m2: string[] = [];
  const tones = normalizeToneTagsWithEvidence(survey.toneTags);
  if (tones.length) {
    m2.push(
      `语气标签：${tones
        .map((t) => (t.evidence?.trim() ? `${t.tag}（例：${t.evidence.trim()}）` : t.tag))
        .join('、')}`,
    );
  }
  if (survey.styleReplies?.length) {
    const styleLines = survey.styleReplies
      .filter((r) => r.text?.trim())
      .map((r) => {
        let line = `- 场景 ${r.scenarioId}：${r.text.trim()}`;
        if (r.relationContext?.trim()) {
          line += `（关系情境：${r.relationContext.trim()}）`;
        }
        return line;
      });
    if (styleLines.length) {
      m2.push(`典型回复风格：\n${styleLines.join('\n')}`);
    }
  }
  if (survey.freeWritingSample?.trim()) {
    m2.push(`自由写作样本（给朋友的消息）：${survey.freeWritingSample.trim()}`);
  }
  const catchphrases = survey.catchphrases?.filter(Boolean);
  if (catchphrases?.length) {
    m2.push(`口头禅：${catchphrases.join(' / ')}`);
  } else if (survey.sampleMessage?.trim()) {
    m2.push(`口头禅：${survey.sampleMessage.trim()}`);
  }
  if (survey.caringStyle?.trim()) m2.push(`表达关心的方式：${survey.caringStyle.trim()}`);
  if (survey.chatHabits) {
    const ch: string[] = [];
    if (typeof survey.chatHabits.usesPunctuation === 'boolean')
      ch.push(survey.chatHabits.usesPunctuation ? '常用句号' : '不爱用句号');
    if (typeof survey.chatHabits.likesEmoji === 'boolean')
      ch.push(survey.chatHabits.likesEmoji ? 'emoji 多' : 'emoji 少');
    if (typeof survey.chatHabits.prefersShortMessages === 'boolean')
      ch.push(survey.chatHabits.prefersShortMessages ? '爱发短消息' : '消息偏长');
    if (typeof survey.chatHabits.sendsVoiceMessages === 'boolean')
      ch.push(survey.chatHabits.sendsVoiceMessages ? '会发语音' : '不发语音');
    if (ch.length) m2.push(`聊天习惯：${ch.join('，')}`);
  }
  if (survey.emotionalPatterns) {
    const ep: string[] = [];
    if (survey.emotionalPatterns.badMoodNeed) ep.push(`低落时需要${survey.emotionalPatterns.badMoodNeed}`);
    if (survey.emotionalPatterns.happyExpression) ep.push(`开心时会${survey.emotionalPatterns.happyExpression}`);
    if (ep.length) m2.push(`情绪反应：${ep.join('；')}`);
  }
  if (m2.length) sections.push(`【M2 语言指纹（含关系情境）】\n${m2.join('\n')}`);

  // ===== M3: 信念系统 =====
  const m3: string[] = [];
  if (survey.valuesChoices?.length) {
    const valLines = survey.valuesChoices
      .filter((v) => v.label?.trim())
      .map((v) => {
        const why = survey.valuesWhy?.[v.questionId]?.trim();
        return `- ${v.label.trim()}${why ? `（理由：${why}）` : ''}`;
      });
    if (valLines.length) m3.push(`价值观：\n${valLines.join('\n')}`);
  }
  if (survey.trustView?.trim()) m3.push(`信任观：${survey.trustView.trim()}`);
  if (survey.happinessView?.trim()) m3.push(`幸福观：${survey.happinessView.trim()}`);
  if (survey.opinionProbes?.length) {
    const opLines = survey.opinionProbes
      .filter((o) => o.label?.trim() || o.reason?.trim())
      .map((o) => {
        const label = o.label?.trim() || '未明确选择';
        const reason = o.reason?.trim();
        return `- ${o.questionId}：${label}${reason ? `（理由：${reason}）` : ''}`;
      });
    if (opLines.length) m3.push(`日常观点：\n${opLines.join('\n')}`);
  }
  if (survey.changedMind?.trim()) m3.push(`改变过想法的事：${survey.changedMind.trim()}`);
  if (survey.feelingHeardSignal?.trim()) m3.push(`被理解的信号：${survey.feelingHeardSignal.trim()}`);
  if (survey.shutDownTrigger?.trim()) m3.push(`不想说话的触发：${survey.shutDownTrigger.trim()}`);
  if (m3.length) sections.push(`【M3 信念系统】\n${m3.join('\n')}`);

  return sections.length > 0 ? sections.join('\n\n') : 'Echo 数字分身（问卷数据不足，使用默认画像）';
}
