/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 四层人格采集模型 —— 入驻问卷题目定义（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md）。
 * 模块：M1 身份基座 | M2 语言指纹（含关系情境）| M3 信念系统 | M4 深度对话
 */

// ==================== M1: 身份基座 ====================

export const GOAL_OPTIONS = ['认真约会', '先交朋友', '慢慢来'] as const;

export const OCCUPATION_OPTIONS = [
  '互联网',
  '金融',
  '教育',
  '医疗',
  '学生',
  '自由职业',
  '其他',
] as const;

export const INTEREST_PRESETS = ['电影', '音乐', '旅行', '美食', '阅读', '运动', '艺术', '科技'];

/** 朋友中角色 */
export const FRIEND_ROLE_OPTIONS = ['倾听者', '分享者', '兼有'] as const;

/** 群体中角色 */
export const GROUP_ROLE_OPTIONS = ['观察者', '气氛组', '视情况'] as const;

// ==================== M2: 语言指纹（含关系情境层） ====================

export const TONE_OPTIONS = ['松弛', '直接', '温柔', '幽默', '理性', '热情'] as const;

/** 每个场景含一道关系情境追问（用户面对不同亲密度的人会如何切换） */
export const STYLE_SCENARIOS = [
  {
    id: 'weekend',
    prompt: '朋友问「这周末干嘛」，你最像会回复：',
    choices: [
      { id: 'a', text: '看情况，可能宅家补觉，有局再叫我。' },
      { id: 'b', text: '冲！展览/徒步/新餐厅，清单已写好。' },
      { id: 'c', text: '哈哈随缘，你定吧，我负责带零食。' },
    ],
    /** 关系情境追问：对刚认识的人 vs 老朋友 */
    relationFollowup:
      '对方是刚认识的人 vs 老朋友，你约人出去的语气和主动程度会有什么不同？（可选）',
  },
  {
    id: 'disagree',
    prompt: '聊天里对方观点和你相反，你更常：',
    choices: [
      { id: 'a', text: '先听完，委婉说「我理解，不过我这边是…」' },
      { id: 'b', text: '直接讲理由，语气硬但不对人。' },
      { id: 'c', text: '打哈哈岔开，少在初聊里杠。' },
    ],
    relationFollowup:
      '对方是好朋友 vs 不太熟的人，你表达分歧的方式一样吗？不一样在哪？（可选）',
  },
  {
    id: 'match',
    prompt: '匹配对象发来「在吗」，你更可能：',
    choices: [
      { id: 'a', text: '在的，刚忙完，你今天怎么样？' },
      { id: 'b', text: '在～看到你喜欢 XX，我也！' },
      { id: 'c', text: '嗯在，晚点细聊？这会儿手头事。' },
    ],
    /** 此场景本身即针对陌生人/不熟的人，无关系追问 */
    relationFollowup: undefined,
  },
  {
    id: 'excitement',
    prompt: '跟你说个好消息！朋友兴奋地找你，你通常怎么接：',
    choices: [
      { id: 'a', text: '哇！！快说快说，我现在就坐在你这边。' },
      { id: 'b', text: '挺好的呀，具体咋回事？' },
      { id: 'c', text: '牛啊，请客请客。' },
    ],
    relationFollowup:
      '对方是你最好的朋友 vs 普通同事，你接兴奋的方式会有什么不同？（可选）',
  },
  {
    id: 'comfort',
    prompt: '朋友失恋/受挫了，你第一反应会说：',
    choices: [
      { id: 'a', text: '别难过了，我陪你，想哭就哭。' },
      { id: 'b', text: '那人配不上你，走，吃顿好的去。' },
      { id: 'c', text: '发生啥了？慢慢说，我在。' },
    ],
    /** 嵌入追问：你一般怎么对在乎的人表达关心 */
    relationFollowup:
      '你一般怎么对在乎的人表达关心？直接说 / 默默做事 / 分享好东西 / 调侃转移？（可选）',
  },
  {
    id: 'vent',
    prompt: '遇到无语的事，你跟朋友吐槽通常是这样：',
    choices: [
      { id: 'a', text: '一通语音轰炸，连珠炮式输出。' },
      { id: 'b', text: '截个图配一句"救命"，等对方接。' },
      { id: 'c', text: '阴阳怪气两句就过，懒得细说。' },
    ],
    relationFollowup: '跟死党和跟普通朋友吐槽，语气和尺度一样吗？哪里不一样？（可选）',
  },
] as const;

/** 聊天习惯偏好（多选） */
export const CHAT_HABIT_OPTIONS = [
  { id: 'usesPunctuation', label: '打字爱用句号' },
  { id: 'likesEmoji', label: 'emoji 用得多' },
  { id: 'prefersShortMessages', label: '爱发短消息、爱分段' },
  { id: 'sendsVoiceMessages', label: '会发语音条' },
] as const;

/** 情绪反应：心情不好时希望别人 */
export const BAD_MOOD_OPTIONS = ['陪我聊聊', '给我空间', '逗我开心', '不用管我'] as const;

/** 情绪反应：特别开心时会 */
export const HAPPY_EXPRESSION_OPTIONS = ['立刻分享', '自己消化一会', '请客庆祝', '发朋友圈'] as const;

// ==================== M3: 信念系统 ====================

/** 关系观 / 分歧观（升级，含 why 追问） */
export const VALUES_QUESTIONS = [
  {
    id: 'pace',
    prompt: '你相信「对的人」是遇到的，还是磨合出来的？',
    choices: [
      { id: 'meet', label: '遇到的，对的人天然合拍' },
      { id: 'build', label: '磨合出来的，没有天生一对' },
    ],
    whyPrompt: '为什么这么想？（可选）',
  },
  {
    id: 'conflict',
    prompt: '分歧时你更希望对方怎么做？',
    choices: [
      { id: 'talk', label: '直接沟通说清楚' },
      { id: 'space', label: '先冷静再给台阶' },
    ],
    whyPrompt: '上一次你这么处理，结果怎样？（可选）',
  },
] as const;

/** 一段关系里最不能接受什么（开放文本，附在 pace 之后） */
export const RELATIONSHIP_DEALBREAKER_PROMPT = '一段关系里，你最不能接受什么？（可选）';

/** 日常观点探针（3-4 道，选择题 + 可选 why） */
export const OPINION_PROBES = [
  {
    id: 'effort',
    prompt: '你怎么看「努力就有回报」这句话？',
    choices: [
      { id: 'agree', label: '基本认同，方向对就不会白费' },
      { id: 'partial', label: '部分认同，但运气和平台也很关键' },
      { id: 'disagree', label: '不太认同，努力和回报常常不对等' },
    ],
    whyPrompt: '为什么？（可选）',
  },
  {
    id: 'socialMedia',
    prompt: '别人在社交媒体晒「完美生活」，你什么感觉？',
    choices: [
      { id: 'inspired', label: '受鼓舞，会想努力' },
      { id: 'neutral', label: '无感，各过各的' },
      { id: 'tired', label: '有点累，想少看点' },
    ],
    whyPrompt: '为什么？（可选）',
  },
  {
    id: 'loan',
    prompt: '朋友借钱不主动还，你会怎么处理？',
    choices: [
      { id: 'ask', label: '直接开口要' },
      { id: 'hint', label: '侧面暗示一下' },
      { id: 'swallow', label: '算了，当看清一个人' },
    ],
    whyPrompt: '为什么？（可选）',
  },
  {
    id: 'rareQuality',
    prompt: '你觉得一个人最难得的品质是什么？',
    choices: [
      { id: 'honest', label: '真诚，不装' },
      { id: 'stable', label: '情绪稳定，靠得住' },
      { id: 'curious', label: '对世界保持好奇' },
      { id: 'kind', label: '骨子里的善良' },
    ],
    whyPrompt: '为什么？（可选）',
  },
] as const;

// ==================== M4: 深度对话 ====================

/** 最小对话轮数（与 API DIALOGUE_MIN_TURNS 对齐） */
export const DIALOGUE_MIN_TURNS = 6;

/** 最大对话轮数（与 API DIALOGUE_MAX_TURNS 对齐） */
export const DIALOGUE_MAX_TURNS = 12;

/** 对话引导文案 */
export const DIALOGUE_GUIDE =
  'Echo 会像好奇的朋友一样追问你。用你平时说话的口吻就行，不用想太多。';

export const DIALOGUE_INPUT_PLACEHOLDER =
  '例如：那次改变我的事其实没我想的那么戏剧化；朋友说我自来熟，但其实我看人……';

/** Tap-to-fill example openers（升级：呼应四阶段） */
export const DIALOGUE_PROMPT_CHIPS = [
  '最近一件让我觉得"今天没白过"的小事是',
  '我问卷里选的直接，但其实碰到XX话题我会绕',
  '别人怎么做我会觉得"他懂我"',
] as const;

// ==================== 模块元信息（用于进度展示与摘要） ====================

export type ModuleId = 'm1' | 'm2' | 'm3' | 'consent' | 'm4' | 'finalize';

export const MODULE_META: { id: ModuleId; title: string; subtitle: string }[] = [
  { id: 'm1', title: '身份基座', subtitle: '让分身知道你是谁、在社交中的角色' },
  { id: 'm2', title: '语言指纹', subtitle: '让分身说话像你，且面对不同人能切换' },
  { id: 'm3', title: '信念系统', subtitle: '让分身用你的方式思考、知道边界在哪' },
  { id: 'consent', title: '分身授权', subtitle: '授权 Echo 生成你的数字分身' },
  { id: 'm4', title: '深度对话', subtitle: '补盲区、捕捉矛盾、采集真实语言样本' },
  { id: 'finalize', title: '孵化分身', subtitle: '写入风格并发布首条广场动态' },
];
