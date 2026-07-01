import type { OnboardingSurveyJson } from './survey-schema';

/**
 * M4 深度对话文案（四层人格采集模型）。
 *
 * 对话分四阶段（8-12 轮）：
 *   (a) 暖场 1-2 轮 —— 轻松话题，让用户进入状态
 *   (b) 矛盾追问 2-3 轮 —— 发现回答中的内在矛盾并提问
 *   (c) 深层话题 2-3 轮 —— 基于用户兴趣/经历展开
 *   (d) 收尾 1-2 轮 —— 轻松收尾，为孵化铺垫
 *
 * AI 角色从「随便聊聊的朋友」变为「好奇的采访者」，基于前三模块答案做个性化追问。
 */

/** 个性化开场：基于四层问卷摘要，引用用户真实信息拉近距离 */
export function buildDialogueOpening(survey: OnboardingSurveyJson): string {
  const tones = survey.toneTags;
  const toneText = Array.isArray(tones) && tones.length
    ? (tones.map((t) => (typeof t === 'string' ? t : t.tag)).slice(0, 2).join('、'))
    : '轻松真诚';
  const city = survey.city?.trim();
  const occupation = survey.occupation?.trim();

  const hooks: string[] = [];
  if (occupation) hooks.push(`做${occupation}的`);
  if (city) hooks.push(`在${city}`);
  const hookText = hooks.length ? `${hooks.join('、')}，` : '';

  // 若用户填了「典型一天」或「改变我的经历」，优先用它做暖场切入
  let opener: string;
  if (survey.dailyRoutine?.trim()) {
    opener = `你问卷里提到典型一天是「${survey.dailyRoutine.trim()}」——听起来挺有意思，先随便聊聊：最近哪一刻让你觉得"今天没白过"？`;
  } else if (survey.selfDescription?.trim()) {
    opener = `你说朋友会形容你「${survey.selfDescription.trim()}」——那我好奇，最近一次朋友这么觉得是什么场景？`;
  } else if (survey.keyExperience?.trim()) {
    opener = `你提到有件事改变了你——不用展开全部，就说说当时最直接的感觉是什么？`;
  } else {
    opener = `你问卷里填了不少东西，我一条条来问。先轻松的：最近一件让你嘴角上扬的小事是什么？`;
  }

  return (
    `嗨～我是 Echo 入驻助手。我会像好奇的采访者一样问你一些问题，` +
    `用你「${toneText}」的口吻随便答就行，不用想太多。\n\n` +
    `${hookText}${opener}`
  );
}

export function isGreetingOnly(message: string): boolean {
  const t = message.trim().replace(/\s+/g, '');
  if (!t || t.length > 12) return false;
  return /^(你好|您好|嗨|哈喽|hi|hello|hey|在吗|早上好|晚上好)+[!！。~～]?$/iu.test(t);
}

export function buildGreetingReply(survey: OnboardingSurveyJson): string {
  const tones = survey.toneTags;
  const firstTone = Array.isArray(tones) && tones.length
    ? (typeof tones[0] === 'string' ? tones[0] : tones[0]?.tag)
    : '真诚';
  return (
    `嗨～不用客气，就当跟朋友聊天。我想先问你一个轻松的：` +
    `最近一件让你觉得「这就是我」的小事是什么？` +
    `（你问卷里选了「${firstTone}」这类语气，试着用那种感觉说说）`
  );
}

/**
 * 离线兜底 prompts：分四阶段，每句问法基于已有答案做个性化追问。
 * 返回一个数组，索引即轮次（从 0 开始）。
 */
function buildOfflinePrompts(survey: OnboardingSurveyJson): string[] {
  const tone0 = (() => {
    const t = survey.toneTags;
    if (Array.isArray(t) && t.length) return typeof t[0] === 'string' ? t[0] : t[0]?.tag;
    return undefined;
  })();

  // 从问卷里挖一些可追问的素材
  const hasPaceChoice = survey.valuesChoices?.find((v) => v.questionId === 'pace');
  const hasConflictChoice = survey.valuesChoices?.find((v) => v.questionId === 'conflict');
  const hasKeyExperience = survey.keyExperience?.trim();
  const hasFreeWriting = survey.freeWritingSample?.trim();
  const hasCatchphrases = survey.catchphrases?.filter(Boolean).length;
  const hasSelfDescription = survey.selfDescription?.trim();
  const hasShutDownTrigger = survey.shutDownTrigger?.trim();

  const prompts: string[] = [];

  // ===== 阶段 (a) 暖场（1-2 轮） =====
  prompts.push(
    survey.dailyRoutine?.trim()
      ? `你提到典型一天是「${survey.dailyRoutine.trim()}」——这种节奏里，最让你舒服和最想逃离的分别是哪一段？`
      : '用你平时说话的语气，说说最近一件让你嘴角上扬的小事（1-2 句就行）。',
  );

  prompts.push(
    hasSelfDescription
      ? `朋友说你「${hasSelfDescription}」——你认同这个形容吗？有没有哪一刻你觉得"今天我可一点都不这样"？`
      : '如果让最好的朋友用 3 个词形容你，你觉得会是哪 3 个？为什么是这 3 个？',
  );

  // ===== 阶段 (b) 矛盾追问（3-5 轮） =====
  // 矛盾点 1：pace（节奏）vs 实际表达
  if (hasPaceChoice && hasConflictChoice) {
    prompts.push(
      `你选了「${hasPaceChoice.label}」又选「${hasConflictChoice.label}」——` +
        `这俩放一起其实有点矛盾：一边想慢慢来，一边又想直接说清楚。对你来说这两种情况到底有什么不同？`,
    );
  } else {
    prompts.push(
      `你前面选的那些，有没有哪一个其实是"我希望自己是那样、但其实没那么稳定"的？说说看。`,
    );
  }

  // 矛盾点 2：语气标签 vs 自由写作样本
  if (tone0 && hasFreeWriting) {
    prompts.push(
      `你给自己贴了「${tone0}」的标签，但给朋友发的那条消息又不太像这个感觉——` +
        `你觉得哪个才是更真实的你？还是说看人？`,
    );
  } else {
    prompts.push(
      `你选的语气标签，和你真的在跟朋友吐槽时一样吗？给我模仿一段你吐槽的口吻看看。`,
    );
  }

  // 矛盾点 3：社交角色 vs 实际行为
  if (survey.socialSpectrum?.friendRole) {
    prompts.push(
      `你说和朋友时偏「${survey.socialSpectrum.friendRole}」——` +
        `但有没有一次你明明想倾听/想分享，却做了相反的事？那次发生了什么？`,
    );
  } else {
    prompts.push(
      `有没有一次，你在朋友面前"演"了一个不像自己的角色？为什么那次要那样？`,
    );
  }

  // ===== 阶段 (c) 深层话题（6-9 轮） =====
  if (hasKeyExperience) {
    prompts.push(
      `回到你说的那件改变你的事——不用讲细节，就说说它之后，你做决定的方式有没有变？怎么变的？`,
    );
  } else {
    prompts.push('有没有一件小事，当时没觉得，后来越想越觉得"它改变了我"？');
  }

  if (survey.happinessView?.trim()) {
    prompts.push(
      `你说真正让你开心的是「${survey.happinessView.trim()}」——上一次你明明拥有它、却还是不开心，是什么时候？`,
    );
  } else {
    prompts.push('什么让你真正感到开心？别给标准答案，说个具体的。');
  }

  if (survey.trustView?.trim()) {
    prompts.push(
      `你说判断一个人值不值得信任靠「${survey.trustView.trim()}」——那有没有一次你这套判断失灵了？后来呢？`,
    );
  } else {
    prompts.push('你一般怎么判断一个人值不值得信任？有没有判断错过的时候？');
  }

  if (survey.feelingHeardSignal?.trim()) {
    prompts.push(
      `你说过「${survey.feelingHeardSignal.trim()}」会让你觉得被理解——那反过来，有没有一次别人明明想懂你、却让你觉得"算了不说了"？`,
    );
  } else if (hasShutDownTrigger) {
    prompts.push(
      `你提到「${hasShutDownTrigger}」会让你不想说话——最近一次触发是什么时候？你怎么收场的？`,
    );
  } else {
    prompts.push('别人说什么/做什么，会让你突然不想聊了？举个真实的例子。');
  }

  // ===== 阶段 (d) 收尾（10-12 轮） =====
  if (hasCatchphrases) {
    prompts.push(
      `差不多了。最后让你用一句你自己的口头禅收个尾——就你最常说的那种，给这段对话画个句号。`,
    );
  } else {
    prompts.push('差不多了。最后用你最自然的一句话收个尾，就像平时跟朋友道别那样。');
  }

  prompts.push('聊得不错，你的语气特点我已经记下了。点击下方「继续」，进入分身孵化吧～');

  return prompts;
}

/**
 * 根据 turnCount 选择对应阶段的离线兜底回复。
 * turnCount 从 1 开始（用户已发言轮数）。
 */
export function buildOfflineDialogueReply(
  turnCount: number,
  survey: OnboardingSurveyJson,
): string {
  const prompts = buildOfflinePrompts(survey);
  const idx = Math.max(0, Math.min(turnCount - 1, prompts.length - 1));
  return prompts[idx] ?? prompts[0]!;
}
