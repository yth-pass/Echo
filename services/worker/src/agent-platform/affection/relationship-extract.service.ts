import { promises as fs } from 'fs';
import * as path from 'path';
import { chat } from '../../clone-runtime/llm';
import type { Turn } from '../memory/types';
import type { AffectionEvent, AffectionEventType, AffectionState } from './types';
import { getMemoryBaseDir } from './memory-base-dir';

const EVENT_TYPES: AffectionEventType[] = [
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
  'session_contact',
  'value_alignment',
  'preference_match',
];

interface RelationshipExtractOptions {
  sessionId?: string;
  priorState?: AffectionState;
  topicId?: string;
  extractFromObserver?: boolean;
}

export class RelationshipExtractService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? getMemoryBaseDir();
  }

  private getStoragePath(observerId: string, otherId: string, filename: string): string {
    return path.join(this.baseDir, 'users', observerId, 'social', 'by_agent', otherId, filename);
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async extract(
    observerId: string,
    otherId: string,
    turns: Turn[],
    options: RelationshipExtractOptions = {},
  ): Promise<AffectionEvent[]> {
    const sessionId = options.sessionId ?? `session_${Date.now()}`;
    const extractFromObserver = options.extractFromObserver ?? false;

    // Phase 2: Directionality - filter turns based on flag
    const relevantTurns = turns.filter((t) =>
      extractFromObserver ? t.speaker_id === observerId : t.speaker_id === otherId
    );
    if (relevantTurns.length === 0) {
      return [];
    }

    const incrementalDialogue = relevantTurns
      .map((t, idx) => `[Turn ${t.turn_index ?? idx}] ${t.content}`)
      .join('\n');

    const priorStateJson = options.priorState
      ? JSON.stringify({
          label: options.priorState.relationship_label,
          dimensions: options.priorState.dimensions,
        })
      : JSON.stringify({ label: 'unknown', dimensions: { familiarity: 0, warmth: 0, trust: 0, tension: 0 } });

    const isActiveMode = extractFromObserver;
    const systemPrompt = isActiveMode
      ? `你是一个严格的主动关系表态提取引擎。只从 observer 自己的发言中提取 explicit_bond 和 value_alignment。
【输入】prior_relationship_state + incremental_dialogue（observer 的发言）
【约束】只输出 explicit_bond 或 value_alignment；没有明确表态则返回空数组。
【输出】严格 JSON：{"events": [{"event_type": "explicit_bond"|"value_alignment", "turn_ids": [...], "confidence": 0.XX, "strength": "weak"|"moderate"|"strong"（必填，默认 moderate）}]}`
      : `你是一个严格的关系事件增量提取引擎。你的任务是：基于对方当前的关系状态，只判断自上次提取之后新增的对话中，是否产生了**新的**关系事件。

【输入说明】
- prior_relationship_state：对方当前的关系标签 + 四个维度数值（0-100）
- incremental_dialogue：自上次提取后，对方（otherId）新增的发言记录（已按 turn_index 排序）

【严格约束】
1. 只考虑 incremental_dialogue 中的内容，严禁引用或重复 prior 状态里已经存在的事件。
2. 只输出以下 13 种事件类型之一：positive_engagement, compliment, helpful_share, agreement, conflict, insult_or_rude, apology_or_repair, trust_confirm, trust_break, explicit_bond, session_contact, value_alignment, preference_match。
3. 不要输出 deltas，deltas 由后续规则引擎计算。
4. **每个事件必须包含 strength 字段**（"weak" | "moderate" | "strong"），根据表述明确程度与情感强度判断；默认 moderate，强烈信号用 strong，轻微用 weak。
5. 如果新增对话中没有明显的新事件，返回空数组。

【多步思考流程（必须严格按顺序执行）】
步骤 1：理解当前关系基础
- 阅读 prior_relationship_state，明确对方当前处于什么标签区间（stranger / acquaintance / good_terms / close 等）。
- 特别注意当前 warmth 和 trust 的数值区间，这会影响你对“是否构成新事件”的判断标准。

步骤 2：逐条分析 incremental_dialogue
- 按 turn_index 从小到大逐句阅读。
- 对每一句发言，判断它是否表达了明确的情感倾向、评价、冲突、和解、信任信号或关系定义。
- 特别识别“观点契合”（value_alignment）：对方明确表达与你一致的价值观、人生观或重要偏好，且超出当前关系基础；以及“偏好匹配”（preference_match）：双方偏好高度重合的信号。

步骤 3：判断是否为“新事件”
- 如果该发言的内容在 prior 状态下已经可以被合理预期（例如双方已经是 good_terms，再次说一句普通的感谢），则不视为新事件。
- 只有当发言包含**超出当前关系基础的明显信号**时，才视为新事件。
- 示例：
  - 当前是 stranger，对方第一次说“你今天帮我太多了，我真的很感动”→ 可能构成 compliment 或 helpful_share
  - 当前已经是 close，对方只是说“谢谢”→ 不构成新事件

步骤 4：归类事件类型
- 严格对照 11 种类型进行匹配，不要创造新类型。
- 一个发言可能同时触发多个事件类型（例如既 compliment 又 agreement），此时可以输出多条事件。

步骤 5：提取证据并打分
- 为每个事件记录对应的 turn_ids。
- 给出 0.6-0.95 的 confidence（基于表述的明确程度）。
- 可选记录 evidence_span（引用的原句片段，用于审计）。

步骤 6：输出前自检
- 再次确认所有事件都是基于 incremental_dialogue 的新增内容。
- 确认没有把历史已知的事实或偏好当作新事件输出。
- 如果没有任何符合条件的内容，必须返回空数组，而不是编造。

【输出格式要求】
必须返回严格的 JSON 对象，格式如下：
{
  "events": [
    {
      "event_type": "compliment",
      "turn_ids": [3, 5],
      "confidence": 0.85,
      "evidence_span": "你今天帮我太多了，我真的很感动",
      "strength": "moderate"
    }
  ]
}
如果没有新事件，返回 {"events": []}。`;

    const userPrompt = isActiveMode
      ? `当前关系状态：
${priorStateJson}

观察者（${observerId}）自己的发言：
${incrementalDialogue}

请输出 JSON（仅 explicit_bond / value_alignment）。`
      : `当前关系状态：
${priorStateJson}

自上次提取后新增的对方发言：
${incrementalDialogue}

请按多步思考流程输出 JSON。`;

    const raw = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // 【缺陷4适配】chat() 可能返回 null（LLM 失败），返回空事件数组
    if (!raw) return [];

    let parsed: { events?: unknown[] };
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { events: [] };
    }

    const now = new Date().toISOString();
    const events: AffectionEvent[] = (parsed.events ?? [])
      .map((item: any) => {
        const eventType = String(item.event_type || '') as AffectionEventType;
        if (!EVENT_TYPES.includes(eventType)) return null;
        return {
          id: this.generateId('aff_evt'),
          observer_id: observerId,
          other_id: otherId,
          event_type: eventType,
          deltas: {},
          evidence: {
            joint_session_id: sessionId,
            turn_ids: Array.isArray(item.turn_ids) ? item.turn_ids : [],
            span: item.evidence_span,
            ...(options.topicId ? { topic_id: options.topicId } : {}),
            ...(item.strength ? { strength: item.strength } : {}),
          },
          confidence: Math.max(0.6, Math.min(0.95, Number(item.confidence) || 0.75)),
          at: now,
          correlation_id: `${sessionId}:rel:${eventType}:${Date.now()}`,
        };
      })
      .filter(Boolean) as AffectionEvent[];

    return events;
  }
}
