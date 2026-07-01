/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 气泡拆分共享模块 — 将 LLM 原始回复文本拆分为多个聊天气泡。
 * 从 roleplay-agent.service.ts 提取，供 agent-turn worker 和 roleplay 共用。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BubbleMessage {
  content: string;
  delayMs: number;
  isTypoCorrection: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const IMPERFECTION_PROBS = {
  splitMessage: 0.30,
  typo: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Delay helpers
// ---------------------------------------------------------------------------

/**
 * 打字延迟：每字 500ms，下限 1.5s，上限 20s，±10% 抖动。
 */
export function calcTypingDelayMs(content: string): number {
  const charCount = content.length;
  const base = Math.max(1_500, Math.min(20_000, charCount * 500));
  const jitter = base * 0.1 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

/**
 * 分段间隔延迟：0.5-1.5s。
 */
export function calcSplitDelayMs(): number {
  return 500 + Math.round(Math.random() * 1000);
}

// ---------------------------------------------------------------------------
// Split helpers
// ---------------------------------------------------------------------------

/** 在有序数组中找最接近 target 的值 */
function closestTo(sorted: number[], target: number): number {
  if (sorted.length === 0) return -1;
  let best = sorted[0];
  let bestDist = Math.abs(best - target);
  for (const v of sorted) {
    const dist = Math.abs(v - target);
    if (dist < bestDist) {
      best = v;
      bestDist = dist;
    }
  }
  return best;
}

/** 把文本拆成 2-3 段（模拟分段发送） */
export function splitIntoSegments(text: string): string[] {
  const breakPoints: number[] = [];
  const breakChars = ['。', '！', '？', '…', '.'];

  for (let i = 0; i < text.length; i++) {
    if (breakChars.includes(text[i])) {
      breakPoints.push(i + 1);
    }
  }

  if (breakPoints.length === 0) {
    // 没有自然断句点，整条发送，不强行拆分
    return [text.trim()].filter(Boolean);
  }

  const len = text.length;
  const ideal1 = len / 3;
  const ideal2 = (len * 2) / 3;

  const split1 = closestTo(breakPoints, ideal1);
  const split2 = closestTo(
    breakPoints.filter((p) => p > split1),
    ideal2,
  );

  const segments: string[] = [];
  let prev = 0;
  if (split1 > 0 && split1 < len) {
    segments.push(text.slice(prev, split1).trim());
    prev = split1;
  }
  if (split2 > split1 && split2 < len) {
    segments.push(text.slice(prev, split2).trim());
    prev = split2;
  }
  const last = text.slice(prev).trim();
  if (last) segments.push(last);

  return mergeShortSegments(segments.filter((s) => s.length > 0));
}

/** 合并过短片段（<5 字）到上一条，防止碎片气泡 */
function mergeShortSegments(segments: string[]): string[] {
  const merged: string[] = [];
  for (const s of segments) {
    if (s.length < 5 && merged.length > 0) {
      merged[merged.length - 1] += s;
    } else {
      merged.push(s);
    }
  }
  return merged.length > 0 ? merged : segments;
}

// ---------------------------------------------------------------------------
// Typo injection
// ---------------------------------------------------------------------------

/**
 * 拼音输入法常见同音字映射表。
 * 双向映射：键和值互为同音替代。
 */
const HOMOPHONE_MAP: Record<string, string[]> = {
  // 高频语法虚词
  '的': ['地', '得'], '地': ['的', '得'], '得': ['的', '地'],
  '在': ['再'],       '再': ['在'],
  '做': ['作'],       '作': ['做'],
  '像': ['象'],       '象': ['像'],
  '那': ['哪'],       '哪': ['那'],
  '已': ['以'],       '以': ['已'],
  '带': ['代'],       '代': ['带'],
  '必': ['毕'],       '毕': ['必'],
  // 日常实词
  '话': ['化'],       '化': ['话'],
  '元': ['原'],       '原': ['元'],
  '玩': ['完'],       '完': ['玩'],
  '看': ['堪'],       '堪': ['看'],
  '想': ['相'],       '相': ['想'],
  '到': ['道'],       '道': ['到'],
  '事': ['是'],       '是': ['事'],
  '长': ['常'],       '常': ['长'],
  '觉': ['绝'],       '绝': ['觉'],
  // 口语高频
  '嘛': ['妈'],       '妈': ['嘛'],
  '吧': ['把'],       '把': ['吧'],
  '没': ['每'],       '每': ['没'],
  '谁': ['水'],       '水': ['谁'],
  '去': ['取'],       '取': ['去'],
  '要': ['药'],       '药': ['要'],
  '和': ['合'],       '合': ['和'],
  '干': ['赶'],       '赶': ['干'],
};

/** 注入打字错误：用同音字替换（模拟拼音输入法选错字）。
 *  无匹配时返回 null，不强行注入。 */
export function injectTypo(text: string): {
  mainText: string;
  correction: string;
} | null {
  const chars = [...text];

  // 收集文本中所有可替换的同音字位置
  const matches: { idx: number; original: string; replacement: string }[] = [];
  for (let i = 0; i < chars.length; i++) {
    const alternatives = HOMOPHONE_MAP[chars[i]];
    if (alternatives?.length) {
      const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
      matches.push({ idx: i, original: chars[i], replacement });
    }
  }

  if (matches.length === 0) return null;

  const pick = matches[Math.floor(Math.random() * matches.length)];
  const typoChars = [...chars];
  typoChars[pick.idx] = pick.replacement;
  return {
    mainText: typoChars.join(''),
    correction: pick.original,
  };
}

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

/** agent-to-agent 通用 follow-up（不依赖 RoleName） */
const AGENT_FOLLOW_UPS = [
  '哈哈', '嗯', '对了对了', '是吗', '然后呢',
  '哦哦', '啊还有', '话说', '你知道吗', '嗯嗯',
];

export function generateAgentFollowUp(): string | null {
  if (Math.random() >= 0.4) return null;
  return AGENT_FOLLOW_UPS[Math.floor(Math.random() * AGENT_FOLLOW_UPS.length)];
}

// ---------------------------------------------------------------------------
// Main: split raw LLM text into bubbles
// ---------------------------------------------------------------------------

export interface BubbleOptions {
  /** 是否启用不完美行为（typo / split）；wind-down 告别阶段建议关闭 */
  enableImperfection?: boolean;
}

/**
 * 将 LLM 原始回复拆分为多个聊天气泡。
 *
 * 流程：
 * 1. 按 \n 拆段 → 过滤无意义段落
 * 2. 合并过短片段（≤3 字符）
 * 3. 不完美行为：5% typo / 30% split
 * 4. 偶尔追加 follow-up
 */
export function splitIntoBubbles(
  raw: string,
  options?: BubbleOptions,
): BubbleMessage[] {
  const enableImperfection = options?.enableImperfection ?? true;

  // 1. 拆段 + 过滤
  const rawParagraphs = raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      return /[\u4e00-\u9fffA-Za-z]/.test(s);
    });

  // 2. 合并过短片段
  const paragraphs: string[] = [];
  for (const p of rawParagraphs) {
    if (p.length <= 3 && paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1] += p;
    } else {
      paragraphs.push(p);
    }
  }

  if (paragraphs.length === 0) {
    return [{ content: '嗯', delayMs: calcTypingDelayMs('嗯'), isTypoCorrection: false }];
  }

  // 3. 不完美行为决策
  let shouldSplit = false;
  let shouldTypo = false;
  if (enableImperfection) {
    const r = Math.random();
    if (r < IMPERFECTION_PROBS.splitMessage) {
      shouldSplit = true;
    } else if (r < IMPERFECTION_PROBS.splitMessage + IMPERFECTION_PROBS.typo) {
      shouldTypo = true;
    }
  }

  // 4. 生成气泡
  const replies: BubbleMessage[] = [];

  for (const para of paragraphs) {
    if (shouldTypo) {
      const typoResult = injectTypo(para);
      if (typoResult) {
        replies.push({
          content: typoResult.mainText,
          delayMs: calcTypingDelayMs(typoResult.mainText),
          isTypoCorrection: false,
        });
        replies.push({
          content: typoResult.correction,
          delayMs: calcSplitDelayMs(),
          isTypoCorrection: true,
        });
        shouldTypo = false;
        continue;
      }
      // 没有同音字可替换，放弃本次 typo
      shouldTypo = false;
    }
    if (shouldSplit) {
      const segments = splitIntoSegments(para);
      for (const seg of segments) {
        replies.push({
          content: seg,
          delayMs: calcTypingDelayMs(seg),
          isTypoCorrection: false,
        });
      }
    } else {
      replies.push({
        content: para,
        delayMs: calcTypingDelayMs(para),
        isTypoCorrection: false,
      });
    }
  }

  // 5. Follow-up
  if (shouldSplit && paragraphs.length <= 2) {
    const followUp = generateAgentFollowUp();
    if (followUp) {
      replies.push({
        content: followUp,
        delayMs: calcSplitDelayMs(),
        isTypoCorrection: false,
      });
    }
  }

  return replies;
}
