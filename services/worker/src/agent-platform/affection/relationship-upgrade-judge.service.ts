import { chat } from '../../clone-runtime/llm';
import type { AffectionState, AffectionEvent } from './types';

export type ChangeDirection = 'upgrade' | 'downgrade';

export class RelationshipChangeJudgeService {
  async judge(
    prior: AffectionState,
    events: AffectionEvent[],
    candidate: AffectionState,
    direction: ChangeDirection = 'upgrade',
    styleExcerpt?: string
  ): Promise<{ changed: boolean; reason: string; adjustment?: number }> {
    const priorSummary = {
      label: prior.relationship_label,
      dimensions: prior.dimensions,
    };
    const candidateSummary = {
      label: candidate.relationship_label,
      dimensions: candidate.dimensions,
    };
    const eventSummary = events.map((e) => ({
      type: e.event_type,
      confidence: e.confidence,
      span: e.evidence?.span,
    }));

    const styleNote = styleExcerpt
      ? `\n6. 参考 observer 的说话风格基线（style.md 摘录），判断该风格下此类事件是否更可能触发真实关系变化。`
      : '';

    const systemPrompt = `你是一个关系变更仲裁器。你的任务是判断：基于新增的事件证据，数值计算出的关系标签${direction === 'upgrade' ? '升级' : '降级'}是否“实质性”成立。
规则：
1. 如果新增事件证据充分且与${direction === 'upgrade' ? '升级' : '降级'}方向一致，则 changed=true。
2. 如果证据不足、语义模糊、或变更跨度过大（例如从 acquaintance 直接到 close，或突然从 close 降到 strained），则 changed=false，并给出理由。
3. 输出严格 JSON：{"changed": boolean, "reason": string, "adjustment": number | null, "direction": "upgrade"|"downgrade"}
4. adjustment 是建议的 delta 调整系数（0.0-1.0），如果 changed=false 则建议降低 delta。
5. 仅依据提供的 prior、events、candidate 做判断，不要幻觉。${styleNote}`;

    const userPrompt = `Direction: ${direction}
Prior state: ${JSON.stringify(priorSummary)}
Candidate state after events: ${JSON.stringify(candidateSummary)}
New events: ${JSON.stringify(eventSummary)}
${styleExcerpt ? `Observer style excerpt:\n${styleExcerpt}\n` : ''}
请输出 JSON 判断是否实质性${direction === 'upgrade' ? '升级' : '降级'}：`;

    try {
      const raw = await chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      // 【缺陷4适配】chat() 可能返回 null（LLM 失败），走 catch 返回默认允许结果
      if (!raw) throw new Error('LLM returned null');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        changed: Boolean(parsed.changed),
        reason: String(parsed.reason || 'LLM judgment'),
        adjustment: typeof parsed.adjustment === 'number' ? parsed.adjustment : undefined,
      };
    } catch {
      return { changed: true, reason: 'LLM judge failed, default to allow', adjustment: undefined };
    }
  }
}
