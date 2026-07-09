/**
 * 18 张情境卡片定义（v2.2 Phase 1）
 *
 * Card 1-15：测量"你是谁"（人格 / 价值观 / 依恋）
 * Card 16-18：测量"你需要什么样的伴侣"（理想伴侣探测）
 *
 * 每张卡锚定至少一个已验证心理学量表，同一维度多卡互证。
 * 见 docs_CN/Onboarding-Survey-Redesign-Proposal.md §五
 *
 * 维度 key 说明：
 *   Big Five      — extraversion / agreeableness / conscientiousness / neuroticism / openness
 *   时间观        — timeFuture / timePast / timePresent
 *   延迟满足      — delayedGratification
 *   信任基线      — trustBaseline
 *   风险偏好      — riskTolerance
 *   道德基础(MFT) — care / fairness / authority / loyalty
 *   依恋          — attachAvoidance / attachAnxiety
 *   归因          — attributionInternal / attributionExternal
 *   谦逊度        — modesty
 *   社交面具      — socialMask
 *   理想伴侣      — needEmotionalSafety / needSpaceRespect / needDirectCommunication / needConflictResolution
 */

export interface ScenarioCardOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
  /** 每个选项在各维度上的得分贡献（-1 ~ +1） */
  dimensionContributions: Record<string, number>;
}

export interface ScenarioCardDefinition {
  cardId: string;
  scenarioText: string;
  options: ScenarioCardOption[];
  allowCustomText: boolean;
  customTextMaxLength: number;
  /** Card 4 必填，其他选填 */
  requiredFreeText: boolean;
  freeTextMaxLength: number;
  sources: string[];
  measuredDimensions: string[];
}

// ─── Card 1: 森林小木屋 ───────────────────────────────────────────────────────

export const CARD_FOREST_CABIN: ScenarioCardDefinition = {
  cardId: 'forest_cabin',
  scenarioText:
    '你一个人在森林徒步，天快黑时迷路了。远处有一座亮着灯的小木屋。你会——',
  options: [
    {
      key: 'A',
      text: '走上前敲门问问路',
      dimensionContributions: {
        extraversion: 0.8,
        trustBaseline: 0.6,
        riskTolerance: 0.5,
      },
    },
    {
      key: 'B',
      text: '绕着观察一圈再决定',
      dimensionContributions: {
        extraversion: 0.0,
        trustBaseline: -0.2,
        riskTolerance: -0.3,
        conscientiousness: 0.3,
      },
    },
    {
      key: 'C',
      text: '自己搭个临时营地，不打扰',
      dimensionContributions: {
        extraversion: -0.7,
        trustBaseline: -0.4,
        riskTolerance: -0.2,
      },
    },
    {
      key: 'D',
      text: '大喊一声"有人吗"，看反应',
      dimensionContributions: {
        extraversion: 0.4,
        riskTolerance: 0.6,
        trustBaseline: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['HTP (Buck, 1948)', 'BFI-2 Extraversion'],
  measuredDimensions: ['extraversion', 'trustBaseline', 'riskTolerance'],
};

// ─── Card 2: 时间机器 ───────────────────────────────────────────────────────────

export const CARD_TIME_MACHINE: ScenarioCardDefinition = {
  cardId: 'time_machine',
  scenarioText: '有人给你一张时光机票，单程，只能选一个方向。你会——',
  options: [
    {
      key: 'A',
      text: '去 10 年后的未来看看',
      dimensionContributions: {
        timeFuture: 0.8,
        openness: 0.4,
      },
    },
    {
      key: 'B',
      text: '回到人生某个节点重来',
      dimensionContributions: {
        timePast: 0.8,
        neuroticism: 0.2,
      },
    },
    {
      key: 'C',
      text: '哪儿也不去，把票撕了',
      dimensionContributions: {
        timePresent: 0.8,
        conscientiousness: 0.2,
      },
    },
    {
      key: 'D',
      text: '送给更需要的人',
      dimensionContributions: {
        agreeableness: 0.5,
        care: 0.4,
        timePresent: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['ZTPI (Zimbardo Time Perspective Inventory)'],
  measuredDimensions: ['timeFuture', 'timePast', 'timePresent'],
};

// ─── Card 3: 棉花糖 2.0 ─────────────────────────────────────────────────────────

export const CARD_COTTON_CANDY: ScenarioCardDefinition = {
  cardId: 'cotton_candy',
  scenarioText:
    '一个神秘人给你一个密封盒子："这是你未来 3 个月里最想要的东西。你现在打开，它消失；你 3 个月不打开，它会变成 3 倍。" 你会——',
  options: [
    {
      key: 'A',
      text: '现在立刻打开',
      dimensionContributions: {
        delayedGratification: -0.8,
        conscientiousness: -0.4,
        riskTolerance: 0.3,
      },
    },
    {
      key: 'B',
      text: '先偷看一眼再决定',
      dimensionContributions: {
        delayedGratification: -0.3,
        openness: 0.2,
        riskTolerance: 0.2,
      },
    },
    {
      key: 'C',
      text: '锁进抽屉，3 个月后再说',
      dimensionContributions: {
        delayedGratification: 0.8,
        conscientiousness: 0.6,
        trustBaseline: 0.2,
      },
    },
    {
      key: 'D',
      text: '把盒子转送别人',
      dimensionContributions: {
        agreeableness: 0.5,
        care: 0.3,
        delayedGratification: 0.0,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['Mischel (1972)', 'Casey et al. (2011)'],
  measuredDimensions: ['delayedGratification', 'conscientiousness', 'trustBaseline'],
};

// ─── Card 4: 未寄出的信（纯开放文本，必填 80 字）─────────────────────────────────

export const CARD_UNSENT_LETTER: ScenarioCardDefinition = {
  cardId: 'unsent_letter',
  scenarioText:
    '你发现桌上有一封写给你的信，没有署名，只有一行字："如果你知道……"。你觉得后面最可能是什么？',
  options: [], // 纯开放文本，无选项
  allowCustomText: true,
  customTextMaxLength: 80,
  requiredFreeText: true,
  freeTextMaxLength: 80,
  sources: ['TAT (Murray, 1943)'],
  measuredDimensions: ['socialMask'], // 核心关切/投射，由 LLM 分析
};

// ─── Card 5: 周六电量 ───────────────────────────────────────────────────────────

export const CARD_SATURDAY_ENERGY: ScenarioCardDefinition = {
  cardId: 'saturday_energy',
  scenarioText:
    '周六晚上，终于从忙到喘不过气的一周里停下来。理想的状态是——',
  options: [
    {
      key: 'A',
      text: '叫一帮朋友去吃夜宵',
      dimensionContributions: {
        extraversion: 0.9,
      },
    },
    {
      key: 'B',
      text: '约一个最熟的人深聊',
      dimensionContributions: {
        extraversion: 0.2,
        agreeableness: 0.2,
        attachAnxiety: 0.1,
      },
    },
    {
      key: 'C',
      text: '一个人窝在沙发上刷手机',
      dimensionContributions: {
        extraversion: -0.8,
      },
    },
    {
      key: 'D',
      text: '看心情，到时候再说',
      dimensionContributions: {
        extraversion: 0.0,
        openness: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['BFI-2 Extraversion', 'Eysenck cortical arousal theory'],
  measuredDimensions: ['extraversion'],
};

// ─── Card 6: 失控电车 ───────────────────────────────────────────────────────────

export const CARD_TROLLEY: ScenarioCardDefinition = {
  cardId: 'trolley',
  scenarioText:
    '一辆失控的电车冲向 5 个工人。你站在拉杆旁：拉下去，电车变道，但会撞到另一条轨道上的 1 个人。你会——',
  options: [
    {
      key: 'A',
      text: '拉，救 5 个',
      dimensionContributions: {
        fairness: 0.5,
        care: -0.2,
        riskTolerance: 0.3,
      },
    },
    {
      key: 'B',
      text: '不拉，不能主动伤害一个人',
      dimensionContributions: {
        authority: 0.5,
        care: 0.3,
        riskTolerance: -0.4,
      },
    },
    {
      key: 'C',
      text: '先喊那 1 个人跑',
      dimensionContributions: {
        care: 0.6,
        agreeableness: 0.3,
        extraversion: 0.2,
      },
    },
    {
      key: 'D',
      text: '僵在原地，做不出选择',
      dimensionContributions: {
        neuroticism: 0.5,
        riskTolerance: -0.5,
        attachAnxiety: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['Foot (1967)', 'CNI Model (Gawronski et al., 2017)', 'MFT'],
  measuredDimensions: ['fairness', 'care', 'authority', 'agreeableness'],
};

// ─── Card 7: 聚光灯 ─────────────────────────────────────────────────────────────

export const CARD_SPOTLIGHT: ScenarioCardDefinition = {
  cardId: 'spotlight',
  scenarioText:
    '朋友生日派对，来了 20 个你不太认识的人。你通常会——',
  options: [
    {
      key: 'A',
      text: '主动跟陌生人聊，认识新朋友',
      dimensionContributions: {
        extraversion: 0.9,
        trustBaseline: 0.3,
      },
    },
    {
      key: 'B',
      text: '守在寿星旁边，只跟熟人聊',
      dimensionContributions: {
        extraversion: -0.2,
        loyalty: 0.3,
      },
    },
    {
      key: 'C',
      text: '找个安静的角落待着，等结束',
      dimensionContributions: {
        extraversion: -0.8,
        neuroticism: 0.2,
      },
    },
    {
      key: 'D',
      text: '待一会儿就先走',
      dimensionContributions: {
        extraversion: -0.6,
        attachAvoidance: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['BFI-2 Extraversion', 'Liebowitz Social Anxiety Scale'],
  measuredDimensions: ['extraversion', 'trustBaseline'],
};

// ─── Card 8: 死线前夜 ───────────────────────────────────────────────────────────

export const CARD_DEADLINE_EVE: ScenarioCardDefinition = {
  cardId: 'deadline_eve',
  scenarioText:
    '明天早上一份重要工作要交，你今晚的状态通常是——',
  options: [
    {
      key: 'A',
      text: '早就做好了，今晚刷剧',
      dimensionContributions: {
        conscientiousness: 0.9,
        delayedGratification: 0.3,
      },
    },
    {
      key: 'B',
      text: '还剩一点收尾，按计划推进',
      dimensionContributions: {
        conscientiousness: 0.5,
      },
    },
    {
      key: 'C',
      text: '还在赶进度，但心里有数',
      dimensionContributions: {
        conscientiousness: -0.1,
        neuroticism: 0.1,
      },
    },
    {
      key: 'D',
      text: '完全没动，deadline 是第一生产力',
      dimensionContributions: {
        conscientiousness: -0.8,
        riskTolerance: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['BFI-2 Conscientiousness', 'Steel (2007) procrastination meta-analysis'],
  measuredDimensions: ['conscientiousness'],
};

// ─── Card 9: 突如其来的批评 ─────────────────────────────────────────────────────

export const CARD_CRITICISM: ScenarioCardDefinition = {
  cardId: 'criticism',
  scenarioText:
    '老板 / 导师当着 5 个同事的面，批评了你最近的一项工作。你的第一反应是——',
  options: [
    {
      key: 'A',
      text: '脸红、心里难受一整天',
      dimensionContributions: {
        neuroticism: 0.9,
        attachAnxiety: 0.3,
      },
    },
    {
      key: 'B',
      text: '当场冷静，晚上回家才消化',
      dimensionContributions: {
        neuroticism: -0.2,
        conscientiousness: 0.2,
      },
    },
    {
      key: 'C',
      text: '直接反问"哪里不对，具体说"',
      dimensionContributions: {
        neuroticism: -0.4,
        extraversion: 0.3,
        riskTolerance: 0.3,
      },
    },
    {
      key: 'D',
      text: '表面平静，心里想"又不是我的问题"',
      dimensionContributions: {
        neuroticism: 0.2,
        attributionExternal: 0.5,
        attachAvoidance: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['BFI-2 Neuroticism', 'Gross (1998) emotion regulation model'],
  measuredDimensions: ['neuroticism'],
};

// ─── Card 10: 周末的岔路 ────────────────────────────────────────────────────────

export const CARD_WEEKEND_DETOUR: ScenarioCardDefinition = {
  cardId: 'weekend_detour',
  scenarioText:
    '周末你本来计划好在家休息。朋友突然发来："我们临时决定去隔壁城市玩两天，走吗？" 你会——',
  options: [
    {
      key: 'A',
      text: '"走！"拎包就出发',
      dimensionContributions: {
        openness: 0.9,
        riskTolerance: 0.4,
        extraversion: 0.3,
      },
    },
    {
      key: 'B',
      text: '问清行程再决定',
      dimensionContributions: {
        openness: 0.2,
        conscientiousness: 0.3,
      },
    },
    {
      key: 'C',
      text: '婉拒，按计划休息',
      dimensionContributions: {
        openness: -0.5,
        conscientiousness: 0.4,
      },
    },
    {
      key: 'D',
      text: '提出折中方案（当天来回？）',
      dimensionContributions: {
        openness: 0.3,
        agreeableness: 0.3,
        conscientiousness: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['BFI-2 Openness', 'Levenson (1990) sensation seeking'],
  measuredDimensions: ['openness'],
};

// ─── Card 11: 捡到钱包 ──────────────────────────────────────────────────────────

export const CARD_FOUND_WALLET: ScenarioCardDefinition = {
  cardId: 'found_wallet',
  scenarioText:
    '你在街上捡到一个钱包，里面有 5000 元现金，没有身份证，只有一张写着"救命钱"的纸条。你会——',
  options: [
    {
      key: 'A',
      text: '交给最近的派出所',
      dimensionContributions: {
        authority: 0.7,
        fairness: 0.4,
      },
    },
    {
      key: 'B',
      text: '想办法找到失主（查附近监控等）',
      dimensionContributions: {
        care: 0.7,
        fairness: 0.4,
        conscientiousness: 0.2,
      },
    },
    {
      key: 'C',
      text: '先收着，看后续有没有人来认领',
      dimensionContributions: {
        care: -0.5,
        fairness: -0.6,
        authority: -0.3,
      },
    },
    {
      key: 'D',
      text: '捐给公益机构，"救命钱"该去救人',
      dimensionContributions: {
        care: 0.5,
        fairness: 0.3,
        openness: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['MFT (Haidt & Graham, 2007)'],
  measuredDimensions: ['care', 'fairness', 'authority'],
};

// ─── Card 12: 窗边的人 ──────────────────────────────────────────────────────────

export const CARD_CAFE_WINDOW: ScenarioCardDefinition = {
  cardId: 'cafe_window',
  scenarioText:
    '你坐在咖啡馆，看到窗外一个熟悉的身影走过——但你想不起名字。你会——',
  options: [
    {
      key: 'A',
      text: '立刻冲出去打招呼',
      dimensionContributions: {
        extraversion: 0.8,
        riskTolerance: 0.3,
      },
    },
    {
      key: 'B',
      text: '发条消息"刚看到你了！"',
      dimensionContributions: {
        extraversion: 0.3,
        attachAvoidance: -0.1,
      },
    },
    {
      key: 'C',
      text: '就当没看到，继续喝咖啡',
      dimensionContributions: {
        extraversion: -0.5,
        attachAvoidance: 0.5,
      },
    },
    {
      key: 'D',
      text: '事后翻通讯录，看能不能对上号',
      dimensionContributions: {
        conscientiousness: 0.3,
        extraversion: -0.3,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['TAT (Murray, 1943)'],
  measuredDimensions: ['extraversion', 'attachAvoidance'],
};

// ─── Card 13: 升职 / 拿奖 ───────────────────────────────────────────────────────

export const CARD_PROMOTION: ScenarioCardDefinition = {
  cardId: 'promotion',
  scenarioText:
    '你刚刚拿到了一个期待已久的升职 / 奖项。你第一反应是——',
  options: [
    {
      key: 'A',
      text: '发朋友圈，让全世界知道',
      dimensionContributions: {
        extraversion: 0.5,
        attributionInternal: 0.5,
        modesty: -0.5,
      },
    },
    {
      key: 'B',
      text: '先告诉最亲的 1-2 个人',
      dimensionContributions: {
        modesty: 0.3,
        loyalty: 0.3,
        attributionInternal: 0.2,
      },
    },
    {
      key: 'C',
      text: '自己偷偷开心一晚',
      dimensionContributions: {
        extraversion: -0.4,
        modesty: 0.4,
        attributionInternal: 0.3,
      },
    },
    {
      key: 'D',
      text: '觉得"其实运气成分很大"，不全是自己的功劳',
      dimensionContributions: {
        attributionExternal: 0.7,
        modesty: 0.7,
        neuroticism: 0.1,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['Attribution Theory (Weiner, 1985)', 'BFI-2 Agreeableness (modesty facet)'],
  measuredDimensions: [
    'attributionInternal',
    'attributionExternal',
    'modesty',
    'extraversion',
  ],
};

// ─── Card 14: 深夜电话 ──────────────────────────────────────────────────────────

export const CARD_MIDNIGHT_CALL: ScenarioCardDefinition = {
  cardId: 'midnight_call',
  scenarioText:
    '凌晨 2 点，前任打来电话，哭着说"我想见你"。你会——',
  options: [
    {
      key: 'A',
      text: '"我马上到"',
      dimensionContributions: {
        attachAnxiety: 0.7,
        loyalty: 0.5,
        attachAvoidance: -0.5,
        riskTolerance: 0.3,
      },
    },
    {
      key: 'B',
      text: '"你先冷静一下，明天说"',
      dimensionContributions: {
        attachAvoidance: 0.3,
        conscientiousness: 0.2,
        care: 0.2,
      },
    },
    {
      key: 'C',
      text: '挂掉，不回',
      dimensionContributions: {
        attachAvoidance: 0.8,
        care: -0.3,
        loyalty: -0.3,
      },
    },
    {
      key: 'D',
      text: '联系共同朋友，让 ta 去关心一下',
      dimensionContributions: {
        attachAvoidance: 0.4,
        care: 0.2,
        extraversion: 0.1,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['ECR-R (Fraley et al., 2011)', 'MFT Loyalty'],
  measuredDimensions: ['attachAvoidance', 'attachAnxiety', 'loyalty', 'care'],
};

// ─── Card 15: 被误解 ────────────────────────────────────────────────────────────

export const CARD_MISUNDERSTOOD: ScenarioCardDefinition = {
  cardId: 'misunderstood',
  scenarioText: '别人第一次认识你时，最常误会你是——',
  options: [
    {
      key: 'A',
      text: '很冷 / 难接近',
      dimensionContributions: {
        socialMask: 0.5,
        extraversion: -0.3,
        attachAvoidance: 0.2,
      },
    },
    {
      key: 'B',
      text: '很好说话 / 随和',
      dimensionContributions: {
        socialMask: -0.3,
        agreeableness: 0.3,
      },
    },
    {
      key: 'C',
      text: '话很多 / 爱闹',
      dimensionContributions: {
        socialMask: 0.2,
        extraversion: 0.4,
      },
    },
    {
      key: 'D',
      text: '很正经 / 书卷气',
      dimensionContributions: {
        socialMask: 0.3,
        conscientiousness: 0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['TAT self-narrative', 'Johari Window'],
  measuredDimensions: ['socialMask', 'extraversion'],
};

// ─── Card 16: 惊喜早餐（理想伴侣探测）────────────────────────────────────────────

export const CARD_UNEXPECTED_BREAKFAST: ScenarioCardDefinition = {
  cardId: 'unexpected_breakfast',
  scenarioText:
    '你的另一半没有任何预告，早起做了你最爱的早餐，摆盘精致。你的第一反应是——',
  options: [
    {
      key: 'A',
      text: '好感动！下次我也要这样对 ta。',
      dimensionContributions: {
        needEmotionalSafety: -0.3,
        needSpaceRespect: -0.3,
      },
    },
    {
      key: 'B',
      text: '有点不好意思……ta 是有什么期待吗？',
      dimensionContributions: {
        needEmotionalSafety: 0.7,
        needSpaceRespect: -0.4,
      },
    },
    {
      key: 'C',
      text: '挺甜的，但我更习惯各管各的早餐。',
      dimensionContributions: {
        needEmotionalSafety: -0.3,
        needSpaceRespect: 0.7,
      },
    },
    {
      key: 'D',
      text: '拍照发朋友圈，炫耀一下这种待遇。',
      dimensionContributions: {
        needEmotionalSafety: 0.4,
        needSpaceRespect: -0.2,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['ECR-R (Fraley et al., 2011)', 'Bowlby Attachment Theory'],
  measuredDimensions: ['needEmotionalSafety', 'needSpaceRespect'],
};

// ─── Card 17: 沉默的夜晚（理想伴侣探测）──────────────────────────────────────────

export const CARD_SILENT_NIGHT: ScenarioCardDefinition = {
  cardId: 'silent_night',
  scenarioText:
    '你和另一半坐在沙发上，已经 20 分钟没人说话了。你的感觉是——',
  options: [
    {
      key: 'A',
      text: '很舒服。不需要说话也知道 ta 在。',
      dimensionContributions: {
        needEmotionalSafety: -0.5,
        needSpaceRespect: -0.2,
        needDirectCommunication: -0.3,
      },
    },
    {
      key: 'B',
      text: 'ta 是不是在生我的气？',
      dimensionContributions: {
        needEmotionalSafety: 0.8,
        needDirectCommunication: 0.5,
        needSpaceRespect: 0.0,
      },
    },
    {
      key: 'C',
      text: '终于安静了，刷刷手机挺好。',
      dimensionContributions: {
        needEmotionalSafety: -0.3,
        needDirectCommunication: -0.5,
        needSpaceRespect: 0.8,
      },
    },
    {
      key: 'D',
      text: '找个话题打破沉默吧。',
      dimensionContributions: {
        needEmotionalSafety: 0.3,
        needDirectCommunication: 0.4,
        needSpaceRespect: -0.3,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['ECR-R (Fraley et al., 2011)', 'Gottman Repair Attempts Theory'],
  measuredDimensions: [
    'needEmotionalSafety',
    'needDirectCommunication',
    'needSpaceRespect',
  ],
};

// ─── Card 18: 选歌大战（理想伴侣探测）────────────────────────────────────────────

export const CARD_SONG_CHOICE: ScenarioCardDefinition = {
  cardId: 'song_choice',
  scenarioText:
    '你们一起自驾 3 小时，轮流选歌。ta 第四次放的歌你完全受不了。你会——',
  options: [
    {
      key: 'A',
      text: '切歌，直接说"这首我真的不行"。',
      dimensionContributions: {
        needDirectCommunication: 0.7,
        needConflictResolution: 0.8,
      },
    },
    {
      key: 'B',
      text: '忍着听完，但一路上都在生闷气。',
      dimensionContributions: {
        needDirectCommunication: -0.5,
        needConflictResolution: -0.8,
      },
    },
    {
      key: 'C',
      text: '笑着说"这首歌我要举报"，半开玩笑地换掉。',
      dimensionContributions: {
        needDirectCommunication: 0.4,
        needConflictResolution: -0.2,
      },
    },
    {
      key: 'D',
      text: '默默戴上耳机。',
      dimensionContributions: {
        needDirectCommunication: -0.7,
        needConflictResolution: -0.6,
      },
    },
  ],
  allowCustomText: true,
  customTextMaxLength: 20,
  requiredFreeText: false,
  freeTextMaxLength: 20,
  sources: ['Gottman Four Horsemen', 'Thomas-Kilmann Conflict Mode Instrument'],
  measuredDimensions: ['needDirectCommunication', 'needConflictResolution'],
};

// ─── 全量导出 ───────────────────────────────────────────────────────────────────

export const ALL_SCENARIO_CARDS: readonly ScenarioCardDefinition[] = [
  CARD_FOREST_CABIN,
  CARD_TIME_MACHINE,
  CARD_COTTON_CANDY,
  CARD_UNSENT_LETTER,
  CARD_SATURDAY_ENERGY,
  CARD_TROLLEY,
  CARD_SPOTLIGHT,
  CARD_DEADLINE_EVE,
  CARD_CRITICISM,
  CARD_WEEKEND_DETOUR,
  CARD_FOUND_WALLET,
  CARD_CAFE_WINDOW,
  CARD_PROMOTION,
  CARD_MIDNIGHT_CALL,
  CARD_MISUNDERSTOOD,
  CARD_UNEXPECTED_BREAKFAST,
  CARD_SILENT_NIGHT,
  CARD_SONG_CHOICE,
] as const;

/** 快速查找卡片定义 */
const cardMap = new Map(ALL_SCENARIO_CARDS.map((c) => [c.cardId, c]));
export function getCardDefinition(cardId: string): ScenarioCardDefinition | undefined {
  return cardMap.get(cardId);
}

/**
 * 维度覆盖矩阵（见文档 §五 末尾）
 * key = 维度 key, value = 测量该维度的卡片 ID 列表
 */
export const DIMENSION_COVERAGE: Record<string, string[]> = {
  extraversion: ['forest_cabin', 'saturday_energy', 'spotlight', 'cafe_window'],
  agreeableness: ['trolley', 'found_wallet', 'promotion'],
  conscientiousness: ['cotton_candy', 'deadline_eve'],
  neuroticism: ['criticism', 'midnight_call'],
  openness: ['time_machine', 'weekend_detour'],
  timeFuture: ['time_machine'],
  timePast: ['time_machine'],
  timePresent: ['time_machine'],
  delayedGratification: ['cotton_candy'],
  care: ['trolley', 'found_wallet', 'midnight_call'],
  fairness: ['trolley', 'found_wallet'],
  authority: ['trolley', 'found_wallet'],
  loyalty: ['midnight_call', 'promotion'],
  attachAvoidance: ['cafe_window', 'midnight_call'],
  attachAnxiety: ['criticism', 'midnight_call'],
  attributionInternal: ['promotion'],
  attributionExternal: ['promotion'],
  modesty: ['promotion'],
  socialMask: ['unsent_letter', 'misunderstood'],
  // 理想伴侣维度（Card 16-18）
  needEmotionalSafety: ['unexpected_breakfast', 'silent_night'],
  needSpaceRespect: ['unexpected_breakfast', 'silent_night'],
  needDirectCommunication: ['silent_night', 'song_choice'],
  needConflictResolution: ['song_choice'],
};

/** P0 最小可行集：前 8 张卡（覆盖 Big Five 全部 5 个维度） */
export const P0_CARD_IDS: readonly string[] = [
  'forest_cabin',     // E
  'saturday_energy',  // E
  'spotlight',        // E
  'deadline_eve',     // C
  'criticism',        // N
  'weekend_detour',   // O
  'trolley',          // A
  'unsent_letter',    // 投射锚点
] as const;
