/**
 * Unified Analysis Service (REQ-08).
 *
 * Replaces five separate LLM calls (TopicJudge, SocialExtract ×2,
 * RelationshipExtract ×2) with a single JSON-mode LLM call that
 * returns topic, social, and affection sections in one response.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { chat } from '../../clone-runtime/llm';
import { createLogger } from '../../../../shared/observability';
import type { Turn } from '../memory/types';
import type {
  UnifiedAnalysisResult,
  UnifiedTopic,
  UnifiedSocial,
  UnifiedAffection,
} from './types';

const logger = createLogger('unified-analysis');

/** Turn window sent to the LLM (keep under ~3000 tokens). */
const MAX_TURNS = 8;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class UnifiedAnalysisService {
  /**
   * Perform a single unified analysis call.
   *
   * @param turns     Recent conversation turns (all speakers, in order).
   * @param cloneAId  First participant's clone id.
   * @param cloneBId  Second participant's clone id.
   * @param sessionId Session identifier for provenance.
   */
  async analyze(
    turns: Turn[],
    cloneAId: string,
    cloneBId: string,
    sessionId: string,
  ): Promise<UnifiedAnalysisResult> {
    const window = turns.slice(-MAX_TURNS);

    const dialogueText = window
      .map(
        (t, idx) =>
          `[Turn ${t.turn_index ?? idx}] ${t.speaker_id === cloneAId ? 'A' : 'B'}: ${t.content}`,
      )
      .join('\n');

    const systemPrompt = buildSystemPrompt(cloneAId, cloneBId, sessionId);
    const userPrompt = `对话记录（session=${sessionId}）：\n\n${dialogueText}\n\n请输出统一分析 JSON：`;

    try {
      const raw = await chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { jsonMode: true, temperature: 0.1, maxRetries: 2 },
      );

      // 【缺陷4适配】chat() 可能返回 null（LLM 失败），返回默认结果
      if (!raw) return defaultResult();
      const parsed = parseResponse(raw);
      logger.info('unified analysis complete', { sessionId, turnCount: window.length });
      return parsed;
    } catch (err) {
      logger.warn('unified analysis failed, returning defaults', {
        error: err instanceof Error ? err.message : String(err),
        sessionId,
      });
      return defaultResult();
    }
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  cloneAId: string,
  cloneBId: string,
  _sessionId: string,
): string {
  return `你是一个对话分析引擎。你需要同时分析：(1) 话题流转，(2) 社交事实提取，(3) 关系/情感信号。
输入是一段两人对话（A=${cloneAId}, B=${cloneBId}），按 turn 排序。

## 1. 话题分析 (topic)
判断话题转换类型 transition（continue_main | continue_sub | new_sub | return_to_main | new_main），
给出 confidence（0-1）。
- main_topic_update：可选更新 topic label/summary（≤150字）。
- subtopic：新建/更新子话题时给出 action/label/summary/return_hint。
- subtopic_close：关闭子话题时给出 topic_id/final_summary/valence。
- new_main_topic：new_main 时给出新主话题 label/summary。

### 开场阶段 (opening) — 关键约束
- 开场阶段目标：收集姓名、职业、城市、兴趣等基础信息。
- 判断 transition 前必须先扫描完整对话历史（L6/已知事实优先级最高）：
  * 若对方已明确说出姓名或职业（如「我叫小明，是程序员」），视为信息已收集，**禁止**仅因 opening 规则而继续停留在「追问基础信息」模式。
  * 检查最近 4 轮：若 agent 已问过姓名/职业/城市/兴趣且对方已回答，**禁止**在 summary 中暗示重复追问。
  * 对话历史中已确认的事实优先于 opening 收集规则。
- 满足以下任一条件时，transition 应倾向 continue_main，或自然过渡（new_sub / return_to_main / continue_sub），并在 main_topic_update.summary 体现已知信息（≤150字）：
  * 至少 2 项基础事实（姓名、职业或兴趣）已从对话中确认；或
  * 已提出 3 个开场问题仍无新信息；或
  * 对方已引入具体话题。
- 若姓名/职业已知，summary 示例：「已知对方姓名XX/职业XX，继续自然交谈」；若仍缺信息，summary 示例：「正在了解对方姓名和职业」。
- 禁止在 reason/summary 中建议 agent 重复询问已在对话中确认的信息。

## 2. 社交事实提取 (social)
- facts：对每个说话者（A 和 B）提取 observer_relative 信息：
  { "agent_id": "...", "observer_relative": { "preference": "...", "dislike": "...", "habit": "...", "other_tag": "...", "confidence": 0.XX } }
  只提取明确陈述的内容，置信度 ≥0.7。
- tags：提取对话中显露的兴趣/性格标签，用短词表示。

## 3. 关系信号 (affection)
计算 4 个归一化维度（0.0–1.0）：
- sentiment：情感对齐度（温暖/共情/语气和谐度）
- topic_overlap：话题重叠度（双方兴趣重合度）
- compatibility：兼容性（价值观/生活方式的匹配度）
- engagement：互动深度（提问质量、回复长度、轮次深度）

**默认 mid-range 起始值**：如果对话轮次较少（<3轮），所有维度倾向于 0.4–0.6 的中性区间，
不要因为信息不足就给出极端值。仅在 multi-turn 深度互动后才提升超过 0.7。

另外提取可能的新关系事件（events），类型限制为：
positive_engagement, compliment, helpful_share, agreement, conflict, insult_or_rude,
apology_or_repair, trust_confirm, trust_break, explicit_bond, value_alignment, preference_match。
每个 event 包含 event_type, turn_ids, confidence, strength(weak|moderate|strong), evidence_span。

## 输出格式
严格返回单个 JSON 对象，顶层包含 topic, social, affection 三个字段。
不要包裹在 markdown 代码块中，不要添加任何解释文字。

{
  "topic": {
    "transition": "continue_main",
    "confidence": 0.9,
    "reason": "...",
    "main_topic_update": { "label": "...", "summary": "..." },
    "subtopic": null,
    "subtopic_close": null,
    "new_main_topic": null
  },
  "social": {
    "facts": [
      { "agent_id": "${cloneAId}", "observer_relative": { "preference": "...", "confidence": 0.85 } },
      { "agent_id": "${cloneBId}", "observer_relative": { "habit": "...", "confidence": 0.8 } }
    ],
    "tags": ["tag1", "tag2"]
  },
  "affection": {
    "sentiment": 0.55,
    "topic_overlap": 0.50,
    "compatibility": 0.48,
    "engagement": 0.52,
    "reasoning": "简短归因（≤60字）",
    "events": [
      { "event_type": "compliment", "turn_ids": [2], "confidence": 0.85, "strength": "moderate", "evidence_span": "原句片段" }
    ]
  }
}

Respond in JSON only.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseResponse(raw: string): UnifiedAnalysisResult {
  let cleaned = raw.trim();

  // Strip markdown code fences if present.
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try balanced-brace extraction.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } else {
      return defaultResult();
    }
  }

  return {
    topic: normalizeTopic(parsed.topic ?? {}),
    social: normalizeSocial(parsed.social ?? {}),
    affection: normalizeAffection(parsed.affection ?? {}),
  };
}

function normalizeTopic(raw: any): UnifiedTopic {
  return {
    transition: validTransition(raw.transition),
    confidence: clamp(Number(raw.confidence) || 0.5, 0, 1),
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 200) : undefined,
    main_topic_update: raw.main_topic_update
      ? {
          label: typeof raw.main_topic_update.label === 'string' ? raw.main_topic_update.label.slice(0, 80) : undefined,
          summary: typeof raw.main_topic_update.summary === 'string' ? raw.main_topic_update.summary.slice(0, 150) : undefined,
        }
      : undefined,
    subtopic: raw.subtopic
      ? {
          action: raw.subtopic.action === 'update' ? 'update' : 'create',
          label: typeof raw.subtopic.label === 'string' ? raw.subtopic.label.slice(0, 80) : 'untitled',
          summary: typeof raw.subtopic.summary === 'string' ? raw.subtopic.summary.slice(0, 150) : undefined,
          return_hint: typeof raw.subtopic.return_hint === 'string' ? raw.subtopic.return_hint.slice(0, 100) : undefined,
        }
      : undefined,
    subtopic_close: raw.subtopic_close
      ? {
          topic_id: typeof raw.subtopic_close.topic_id === 'string' ? raw.subtopic_close.topic_id : '',
          final_summary: typeof raw.subtopic_close.final_summary === 'string' ? raw.subtopic_close.final_summary.slice(0, 150) : undefined,
          valence: validValence(raw.subtopic_close.valence),
        }
      : undefined,
    new_main_topic: raw.new_main_topic
      ? {
          label: typeof raw.new_main_topic.label === 'string' ? raw.new_main_topic.label.slice(0, 80) : 'untitled',
          summary: typeof raw.new_main_topic.summary === 'string' ? raw.new_main_topic.summary.slice(0, 150) : undefined,
        }
      : undefined,
  };
}

function normalizeSocial(raw: any): UnifiedSocial {
  const facts = Array.isArray(raw.facts) ? raw.facts : [];
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t: any) => typeof t === 'string').map((t: string) => t.slice(0, 40))
    : [];
  return {
    facts: facts.map((f: any) => ({
      agent_id: typeof f.agent_id === 'string' ? f.agent_id : '',
      observer_relative: {
        preference: typeof f.observer_relative?.preference === 'string' ? f.observer_relative.preference.slice(0, 200) : undefined,
        dislike: typeof f.observer_relative?.dislike === 'string' ? f.observer_relative.dislike.slice(0, 200) : undefined,
        habit: typeof f.observer_relative?.habit === 'string' ? f.observer_relative.habit.slice(0, 200) : undefined,
        other_tag: typeof f.observer_relative?.other_tag === 'string' ? f.observer_relative.other_tag.slice(0, 100) : undefined,
        confidence: clamp(Number(f.observer_relative?.confidence) || 0.7, 0, 1),
      },
    })),
    tags,
  };
}

function normalizeAffection(raw: any): UnifiedAffection {
  const events = Array.isArray(raw.events) ? raw.events : [];
  return {
    sentiment: clamp(Number(raw.sentiment) || 0.5, 0, 1),
    topic_overlap: clamp(Number(raw.topic_overlap) || 0.5, 0, 1),
    compatibility: clamp(Number(raw.compatibility) || 0.5, 0, 1),
    engagement: clamp(Number(raw.engagement) || 0.5, 0, 1),
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning.slice(0, 120) : undefined,
    events: events.map((e: any) => ({
      event_type: validEventType(e.event_type),
      turn_ids: Array.isArray(e.turn_ids) ? e.turn_ids.map(Number) : [],
      confidence: clamp(Number(e.confidence) || 0.7, 0, 1),
      strength: validStrength(e.strength),
      evidence_span: typeof e.evidence_span === 'string' ? e.evidence_span.slice(0, 200) : undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS = new Set([
  'continue_main',
  'continue_sub',
  'new_sub',
  'return_to_main',
  'new_main',
]);

function validTransition(v: unknown): UnifiedTopic['transition'] {
  return typeof v === 'string' && VALID_TRANSITIONS.has(v)
    ? (v as UnifiedTopic['transition'])
    : 'continue_main';
}

function validValence(v: unknown): 'positive' | 'neutral' | 'negative' | undefined {
  if (v === 'positive' || v === 'neutral' || v === 'negative') return v;
  return undefined;
}

const VALID_EVENT_TYPES = new Set([
  'positive_engagement',
  'compliment',
  'helpful_share',
  'agreement',
  'conflict',
  'insult_or_rude',
  'apology_or_repair',
  'trust_confirm',
  'trust_break',
  'explicit_bond',
  'value_alignment',
  'preference_match',
]);

function validEventType(v: unknown): UnifiedAffection['events'] extends (infer E)[] | undefined ? (E extends { event_type: infer T } ? T : never) : never {
  return (typeof v === 'string' && VALID_EVENT_TYPES.has(v)
    ? v
    : 'positive_engagement') as any;
}

function validStrength(v: unknown): 'weak' | 'moderate' | 'strong' {
  if (v === 'weak' || v === 'moderate' || v === 'strong') return v;
  return 'moderate';
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : (min + max) / 2;
}

// ---------------------------------------------------------------------------
// Default / fallback
// ---------------------------------------------------------------------------

function defaultResult(): UnifiedAnalysisResult {
  return {
    topic: {
      transition: 'continue_main',
      confidence: 0.5,
    },
    social: { facts: [], tags: [] },
    affection: {
      sentiment: 0.5,
      topic_overlap: 0.5,
      compatibility: 0.5,
      engagement: 0.5,
    },
  };
}
