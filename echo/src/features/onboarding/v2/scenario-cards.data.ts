/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 18 张情境卡片前端定义（从后端 scenario-cards.ts 复制 + illustrationKey）
 * 含 3 张理想伴侣探测卡（Card 16-18：unexpected_breakfast / silent_night / song_choice）
 * 去掉 dimensionContributions（前端不需要），保留渲染所需全部字段
 */

import type { ScenarioCardDef } from './onboarding-v2.types';

export const SCENARIO_CARDS: ScenarioCardDef[] = [
  {
    cardId: 'forest_cabin',
    scenarioText: '你一个人在森林徒步，天快黑时迷路了。远处有一座亮着灯的小木屋。你会——',
    illustrationKey: 'card-forest',
    options: [
      { optionId: 'A', text: '走上前敲门问问路' },
      { optionId: 'B', text: '绕着观察一圈再决定' },
      { optionId: 'C', text: '自己搭个临时营地，不打扰' },
      { optionId: 'D', text: '大喊一声"有人吗"，看反应' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'time_machine',
    scenarioText: '有人给你一张时光机票，单程，只能选一个方向。你会——',
    illustrationKey: 'card-time',
    options: [
      { optionId: 'A', text: '去 10 年后的未来看看' },
      { optionId: 'B', text: '回到人生某个节点重来' },
      { optionId: 'C', text: '哪儿也不去，把票撕了' },
      { optionId: 'D', text: '送给更需要的人' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'cotton_candy',
    scenarioText: '一个神秘人给你一个密封盒子："这是你未来 3 个月里最想要的东西。你现在打开，它消失；你 3 个月不打开，它会变成 3 倍。" 你会——',
    illustrationKey: 'card-box',
    options: [
      { optionId: 'A', text: '现在立刻打开' },
      { optionId: 'B', text: '先偷看一眼再决定' },
      { optionId: 'C', text: '锁进抽屉，3 个月后再说' },
      { optionId: 'D', text: '把盒子转送别人' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'unsent_letter',
    scenarioText: '你发现桌上有一封写给你的信，没有署名，只有一行字："如果你知道……"。你觉得后面最可能是什么？',
    illustrationKey: 'card-letter',
    options: [],
    allowCustomText: true,
    requiredFreeText: true,
    freeTextMaxLength: 80,
  },
  {
    cardId: 'saturday_energy',
    scenarioText: '周六晚上，终于从忙到喘不过气的一周里停下来。理想的状态是——',
    illustrationKey: 'card-saturday',
    options: [
      { optionId: 'A', text: '叫一帮朋友去吃夜宵' },
      { optionId: 'B', text: '约一个最熟的人深聊' },
      { optionId: 'C', text: '一个人窝在沙发上刷手机' },
      { optionId: 'D', text: '看心情，到时候再说' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'trolley',
    scenarioText: '一辆失控的电车冲向 5 个工人。你站在拉杆旁：拉下去，电车变道，但会撞到另一条轨道上的 1 个人。你会——',
    illustrationKey: 'card-trolley',
    options: [
      { optionId: 'A', text: '拉，救 5 个' },
      { optionId: 'B', text: '不拉，不能主动伤害一个人' },
      { optionId: 'C', text: '先喊那 1 个人跑' },
      { optionId: 'D', text: '僵在原地，做不出选择' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'spotlight',
    scenarioText: '朋友生日派对，来了 20 个你不太认识的人。你通常会——',
    illustrationKey: 'card-party',
    options: [
      { optionId: 'A', text: '主动跟陌生人聊，认识新朋友' },
      { optionId: 'B', text: '守在寿星旁边，只跟熟人聊' },
      { optionId: 'C', text: '找个安静的角落待着，等结束' },
      { optionId: 'D', text: '待一会儿就先走' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'deadline_eve',
    scenarioText: '明天早上一份重要工作要交，你今晚的状态通常是——',
    illustrationKey: 'card-deadline',
    options: [
      { optionId: 'A', text: '早就做好了，今晚刷剧' },
      { optionId: 'B', text: '还剩一点收尾，按计划推进' },
      { optionId: 'C', text: '还在赶进度，但心里有数' },
      { optionId: 'D', text: '完全没动，deadline 是第一生产力' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'criticism',
    scenarioText: '老板 / 导师当着 5 个同事的面，批评了你最近的一项工作。你的第一反应是——',
    illustrationKey: 'card-criticism',
    options: [
      { optionId: 'A', text: '脸红、心里难受一整天' },
      { optionId: 'B', text: '当场冷静，晚上回家才消化' },
      { optionId: 'C', text: '直接反问"哪里不对，具体说"' },
      { optionId: 'D', text: '表面平静，心里想"又不是我的问题"' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'weekend_detour',
    scenarioText: '周末你本来计划好在家休息。朋友突然发来："我们临时决定去隔壁城市玩两天，走吗？" 你会——',
    illustrationKey: 'card-detour',
    options: [
      { optionId: 'A', text: '"走！"拎包就出发' },
      { optionId: 'B', text: '问清行程再决定' },
      { optionId: 'C', text: '婉拒，按计划休息' },
      { optionId: 'D', text: '提出折中方案（当天来回？）' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'found_wallet',
    scenarioText: '你在街上捡到一个钱包，里面有 5000 元现金，没有身份证，只有一张写着"救命钱"的纸条。你会——',
    illustrationKey: 'card-wallet',
    options: [
      { optionId: 'A', text: '交给最近的派出所' },
      { optionId: 'B', text: '想办法找到失主（查附近监控等）' },
      { optionId: 'C', text: '先收着，看后续有没有人来认领' },
      { optionId: 'D', text: '捐给公益机构，"救命钱"该去救人' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'cafe_window',
    scenarioText: '你坐在咖啡馆，看到窗外一个熟悉的身影走过——但你想不起名字。你会——',
    illustrationKey: 'card-cafe',
    options: [
      { optionId: 'A', text: '立刻冲出去打招呼' },
      { optionId: 'B', text: '发条消息"刚看到你了！"' },
      { optionId: 'C', text: '就当没看到，继续喝咖啡' },
      { optionId: 'D', text: '事后翻通讯录，看能不能对上号' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'promotion',
    scenarioText: '你刚刚拿到了一个期待已久的升职 / 奖项。你第一反应是——',
    illustrationKey: 'card-promotion',
    options: [
      { optionId: 'A', text: '发朋友圈，让全世界知道' },
      { optionId: 'B', text: '先告诉最亲的 1-2 个人' },
      { optionId: 'C', text: '自己偷偷开心一晚' },
      { optionId: 'D', text: '觉得"其实运气成分很大"，不全是自己的功劳' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'midnight_call',
    scenarioText: '凌晨 2 点，前任打来电话，哭着说"我想见你"。你会——',
    illustrationKey: 'card-midnight',
    options: [
      { optionId: 'A', text: '"我马上到"' },
      { optionId: 'B', text: '"你先冷静一下，明天说"' },
      { optionId: 'C', text: '挂掉，不回' },
      { optionId: 'D', text: '联系共同朋友，让 ta 去关心一下' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'misunderstood',
    scenarioText: '别人第一次认识你时，最常误会你是——',
    illustrationKey: 'card-mirror',
    options: [
      { optionId: 'A', text: '很冷 / 难接近' },
      { optionId: 'B', text: '很好说话 / 随和' },
      { optionId: 'C', text: '话很多 / 爱闹' },
      { optionId: 'D', text: '很正经 / 书卷气' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },

  // ── 理想伴侣探测卡（Card 16-18） ─────────────────────────────────────
  {
    cardId: 'unexpected_breakfast',
    scenarioText: '你的另一半没有任何预告，早起做了你最爱的早餐，摆盘精致。你的第一反应是——',
    illustrationKey: 'unexpected_breakfast',
    options: [
      { optionId: 'A', text: '好感动！下次我也要这样对 ta。' },
      { optionId: 'B', text: '有点不好意思……ta 是有什么期待吗？' },
      { optionId: 'C', text: '挺甜的，但我更习惯各管各的早餐。' },
      { optionId: 'D', text: '拍照发朋友圈，炫耀一下这种待遇。' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'silent_night',
    scenarioText: '你和另一半坐在沙发上，已经 20 分钟没人说话了。你的感觉是——',
    illustrationKey: 'silent_night',
    options: [
      { optionId: 'A', text: '很舒服。不需要说话也知道 ta 在。' },
      { optionId: 'B', text: 'ta 是不是在生我的气？' },
      { optionId: 'C', text: '终于安静了，刷刷手机挺好。' },
      { optionId: 'D', text: '找个话题打破沉默吧。' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
  {
    cardId: 'song_choice',
    scenarioText: '你们一起自驾 3 小时，轮流选歌。ta 第四次放的歌你完全受不了。你会——',
    illustrationKey: 'song_choice',
    options: [
      { optionId: 'A', text: '切歌，直接说"这首我真的不行"。' },
      { optionId: 'B', text: '忍着听完，但一路上都在生闷气。' },
      { optionId: 'C', text: '笑着说"这首歌我要举报"，半开玩笑地换掉。' },
      { optionId: 'D', text: '默默戴上耳机。' },
    ],
    allowCustomText: true,
    requiredFreeText: false,
    freeTextMaxLength: 20,
  },
];

/** 画像碎片揭晓文案（每 5 张卡后展示） */
export const PERSONA_FRAGMENTS = [
  '你的画像已经出现了第一笔：你对陌生世界的态度',
  '第二笔浮现了：你内心的节奏和坚持',
  '最后一笔：你的矛盾和真实',
];
