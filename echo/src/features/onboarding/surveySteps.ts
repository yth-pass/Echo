/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const TONE_OPTIONS = ['松弛', '直接', '温柔', '幽默', '理性', '热情'] as const;

export const STYLE_SCENARIOS = [
  {
    id: 'weekend',
    prompt: '朋友问「这周末干嘛」，你最像会回复：',
    choices: [
      { id: 'a', text: '看情况，可能宅家补觉，有局再叫我。' },
      { id: 'b', text: '冲！展览/徒步/新餐厅，清单已写好。' },
      { id: 'c', text: '哈哈随缘，你定吧，我负责带零食。' },
    ],
  },
  {
    id: 'disagree',
    prompt: '聊天里对方观点和你相反，你更常：',
    choices: [
      { id: 'a', text: '先听完，委婉说「我理解，不过我这边是…」' },
      { id: 'b', text: '直接讲理由，语气硬但不对人。' },
      { id: 'c', text: '打哈哈岔开，少在初聊里杠。' },
    ],
  },
  {
    id: 'match',
    prompt: '匹配对象发来「在吗」，你更可能：',
    choices: [
      { id: 'a', text: '在的，刚忙完，你今天怎么样？' },
      { id: 'b', text: '在～看到你喜欢 XX，我也！' },
      { id: 'c', text: '嗯在，晚点细聊？这会儿手头事。' },
    ],
  },
] as const;

export const VALUES_QUESTIONS = [
  {
    id: 'pace',
    prompt: '约会节奏你更倾向？',
    choices: [
      { id: 'slow', label: '慢热，先线上聊透' },
      { id: 'fast', label: '合拍就尽快见面' },
    ],
  },
  {
    id: 'conflict',
    prompt: '分歧时你更希望对方？',
    choices: [
      { id: 'talk', label: '直接沟通说清楚' },
      { id: 'space', label: '先冷静再给台阶' },
    ],
  },
] as const;

/** Minimum user dialogue turns before continuing to finalize (aligned with API). */
export const DIALOGUE_MIN_TURNS = 4;

/** Maximum user dialogue turns (aligned with API `DIALOGUE_MAX_TURNS`). */
export const DIALOGUE_MAX_TURNS = 8;

/** Shown above the input — what users can talk about. */
export const DIALOGUE_GUIDE =
  '任选一种方式聊即可（每条 1–3 句话）：① 最看重对方什么 ② 如何拒绝不适的暧昧 ③ 平时怎么开玩笑、吐槽';

export const DIALOGUE_INPUT_PLACEHOLDER =
  '例如：我比较看重人品；不喜欢会直接说；熟了爱开玩笑…';

/** Tap-to-fill example openers. */
export const DIALOGUE_PROMPT_CHIPS = [
  '我比较看重人品和边界感',
  '不喜欢我会直接但礼貌地说清楚',
  '熟了之后会损友式开玩笑',
] as const;

export const INTEREST_PRESETS = ['电影', '音乐', '旅行', '美食', '阅读', '运动', '艺术', '科技'];
