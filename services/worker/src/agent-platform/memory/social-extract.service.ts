import { promises as fs } from 'fs';
import * as path from 'path';
import { chat } from '../../clone-runtime/llm';
import type { Turn, ObjectiveFact, Preference, ExtractResult } from './types';
import { getMemoryBaseDir } from '../affection/memory-base-dir';

/**
 * Complete list of schema-defined attributes for dating/social memory extraction.
 * LLM is instructed to populate these keys when facts contain matching information.
 */
const SCHEMA_ATTRIBUTE_KEYS = [
  'name',
  'age',
  'gender',
  'city',
  'occupation',
  'education',
  'height',
  'weight',
  'hometown',
  'family',
  'marital_status',
  'hobbies',
  'work_schedule',
  'living_situation',
  'smoking',
  'drinking',
  'pets',
  'personality',
  'values',
  'income_level',
  'relationship_goal',
  'zodiac',
  'languages',
  'appearance',
  'diet',
] as const;

export type SchemaAttributeKey = (typeof SCHEMA_ATTRIBUTE_KEYS)[number];

interface SocialExtractOptions {
  sessionId?: string;
}

export class SocialExtractService {
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

  private async appendJsonl(filePath: string, records: unknown[]): Promise<void> {
    if (records.length === 0) return;
    await this.ensureDir(filePath);
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    await fs.appendFile(filePath, lines, 'utf8');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async extract(
    observerId: string,
    otherId: string,
    turns: Turn[],
    options: SocialExtractOptions = {},
  ): Promise<ExtractResult> {
    const sessionId = options.sessionId ?? `session_${Date.now()}`;

    // Filter turns spoken by the other agent (the subject of extraction)
    const otherTurns = turns.filter((t) => t.speaker_id === otherId);
    if (otherTurns.length === 0) {
      return { objective_facts: [], preferences: [] };
    }

    const dialogueText = otherTurns
      .map((t, idx) => `[Turn ${t.turn_index ?? idx}] ${t.content}`)
      .join('\n');

    const attributeList = SCHEMA_ATTRIBUTE_KEYS.join(', ');
    const systemPrompt = `你是一个严格的记忆提取引擎。只从"对方"（subject）的明确发言中提取信息。
规则：
1. objective_facts（①）：仅提取对方明确陈述的可验证事实，置信度 ≥0.85。必须是 explicit_statement。fact_scope 为 about_self 或 about_third_party。
2. preferences（②）：提取对方表达的意见、偏好或隐含推断，置信度 0.4–0.7。pref_type 为 explicit_opinion 或 implicit_inferred。
3. 严禁从 assistant 或 observer 自己的发言中提取。严禁幻觉或推断未明说的内容。
4. 输出必须是严格的 JSON 对象：{"objective_facts": [...], "preferences": [...]}
5. 每个条目必须包含 subject_agent_id=${otherId}，source.session_id="${sessionId}"，source.speaker_id=${otherId}，source.turn_ids 对应原 turn 索引数组，extracted_at=当前 ISO 时间。
6. confidence 必须符合规则范围。status 统一为 "active"（facts）或 "candidate"（preferences）。
7. **重要**：对于每个 objective_fact，如果发言中包含以下任一属性信息，请在 fact 对象中添加 "attributes" 字段（对象形式），key 必须来自此列表：${attributeList}。只提取明确提到的属性，不要推断。示例：如果对方说"我叫张明远，今年29岁，在北京做工程师"，则 attributes = {"name":"张明远","age":"29","city":"北京","occupation":"工程师"}。
8. 如果没有符合条件的内容，返回空数组。`;

    const userPrompt = `以下是对方（${otherId}）在与观察者（${observerId}）对话中的发言记录。请严格按规则提取：

${dialogueText}

请输出 JSON：`;

    const raw = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // 【缺陷4适配】chat() 可能返回 null（LLM 失败），返回空结果
    if (!raw) return { objective_facts: [], preferences: [] };

    let parsed: { objective_facts?: unknown[]; preferences?: unknown[] };
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { objective_facts: [], preferences: [] };
    }

    const now = new Date().toISOString();
    const objectiveFacts: ObjectiveFact[] = (parsed.objective_facts ?? []).map((item: any, i: number) => ({
      id: this.generateId('fact'),
      subject_agent_id: otherId,
      fact: String(item.fact ?? ''),
      fact_scope: item.fact_scope ?? 'about_self',
      fact_type: 'explicit_statement',
      confidence: Math.max(0.85, Math.min(1, Number(item.confidence) || 0.9)),
      status: 'active',
      source: {
        session_id: sessionId,
        speaker_id: otherId,
        turn_ids: Array.isArray(item.turn_ids) ? item.turn_ids : otherTurns.map((_, idx) => idx),
        quoted_span: item.quoted_span,
      },
      extracted_at: now,
      // Preserve LLM-populated attributes for L6 retrieval (no regex fallback)
      ...(item.attributes && typeof item.attributes === 'object' ? { attributes: item.attributes } : {}),
    }));

    const preferences: Preference[] = (parsed.preferences ?? []).map((item: any) => ({
      id: this.generateId('pref'),
      subject_agent_id: otherId,
      content: String(item.content ?? ''),
      pref_type: item.pref_type ?? 'explicit_opinion',
      confidence: Math.max(0.4, Math.min(0.7, Number(item.confidence) || 0.55)),
      status: 'candidate',
      source: {
        session_id: sessionId,
        turn_ids: Array.isArray(item.turn_ids) ? item.turn_ids : otherTurns.map((_, idx) => idx),
      },
      extracted_at: now,
    }));

    // Write to observer-relative paths
    const factsPath = this.getStoragePath(observerId, otherId, 'objective_facts.jsonl');
    const prefsPath = this.getStoragePath(observerId, otherId, 'preferences.jsonl');

    await this.appendJsonl(factsPath, objectiveFacts);
    await this.appendJsonl(prefsPath, preferences);

    return { objective_facts: objectiveFacts, preferences };
  }

  private async readJsonl(filePath: string): Promise<any[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /**
   * L6 retrieval helper: returns aggregated attributes from objective_facts for (observer, other).
   * Used by TopicJudge / Composer to avoid repeating questions about known social memory.
   */
  async getKnownAttributes(observerId: string, otherId: string): Promise<Record<string, string>> {
    const factsPath = this.getStoragePath(observerId, otherId, 'objective_facts.jsonl');
    const facts = await this.readJsonl(factsPath);
    const attrs: Record<string, string> = {};
    for (const f of facts) {
      // Only rely on LLM-populated attributes; no regex/keyword fallback
      if (f.attributes && typeof f.attributes === 'object') {
        Object.assign(attrs, f.attributes);
      }
    }
    return attrs;
  }
}