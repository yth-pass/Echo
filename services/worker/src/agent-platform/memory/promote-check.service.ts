import { promises as fs } from 'fs';
import * as path from 'path';
import { chat, type ChatOptions } from '../../clone-runtime/llm';
import type { Preference, ObjectiveFact, Turn } from './types';
import { getMemoryBaseDir } from '../affection/memory-base-dir';

export interface AffectionEvent {
  id: string;
  observer_id: string;
  other_id: string;
  event_type: 'trust_confirm' | 'trust_break';
  deltas: { trust: number };
  evidence: { joint_session_id: string; turn_ids: number[] };
  at: string;
}

export interface PromoteResult {
  promoted: number;
  contradicted: number;
  events: AffectionEvent[];
}

export class PromoteCheckService {
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

  private async readJsonl(filePath: string): Promise<any[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private async writeJsonl(filePath: string, records: unknown[]): Promise<void> {
    await this.ensureDir(filePath);
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
    await fs.writeFile(filePath, lines, 'utf8');
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

  private normalize(text: string): string {
    return text.replace(/\s+/g, '').toLowerCase();
  }

  async check(
    observerId: string,
    otherId: string,
    turns: Turn[] = [],
    sessionId: string = '',
  ): Promise<PromoteResult> {
    const prefsPath = this.getStoragePath(observerId, otherId, 'preferences.jsonl');
    const factsPath = this.getStoragePath(observerId, otherId, 'objective_facts.jsonl');
    const allPrefs = (await this.readJsonl(prefsPath)) as Preference[];
    const allFacts = (await this.readJsonl(factsPath)) as ObjectiveFact[];
    const candidates = allPrefs.filter((p) => p.status === 'candidate' && p.subject_agent_id === otherId);
    const otherTurns = turns.length > 0 ? turns.filter((t) => t.speaker_id === otherId) : [];

    // m5-turn-match: validate that each candidate's source turn_ids are present in input turns
    const turnIndexSet = new Set(otherTurns.map((t) => t.turn_index ?? -1));
    const validCandidates = candidates.filter((p) => {
      const ids = p.source.turn_ids ?? [];
      return ids.length === 0 || ids.every((id) => turnIndexSet.has(id));
    });

    const chatOpts: ChatOptions = { temperature: 0.1, maxRetries: 3, jsonMode: true };

    let promoted = 0;
    let contradicted = 0;
    const events: AffectionEvent[] = [];

    if (validCandidates.length > 0 && otherTurns.length >= 2) {
      const judgments = await this.batchJudgeLLM(validCandidates, otherTurns, chatOpts);
      for (const pref of validCandidates) {
        const j = judgments.get(pref.id) ?? { isConfirmation: false, isContradiction: false };
        if (j.isContradiction) {
          pref.status = 'contradicted';
          contradicted++;
          events.push(this.makeTrustEvent(observerId, otherId, 'trust_break', sessionId, pref.source.turn_ids));
          continue;
        }
        if (j.isConfirmation) {
          await this.promoteAtomically(pref, allFacts, factsPath);
          promoted++;
          events.push(this.makeTrustEvent(observerId, otherId, 'trust_confirm', sessionId, pref.source.turn_ids));
        }
      }
    }

    if (promoted > 0 || contradicted > 0) {
      await this.writeJsonl(prefsPath, allPrefs);
    }

    return { promoted, contradicted, events };
  }

  private makeTrustEvent(
    observerId: string,
    otherId: string,
    type: 'trust_confirm' | 'trust_break',
    sessionId: string,
    turnIds: number[],
  ): AffectionEvent {
    return {
      id: this.generateId('evt'),
      observer_id: observerId,
      other_id: otherId,
      event_type: type,
      deltas: { trust: type === 'trust_confirm' ? 4 : -8 },
      evidence: { joint_session_id: sessionId, turn_ids: turnIds },
      at: new Date().toISOString(),
    };
  }

  private async batchJudgeLLM(
    prefs: Preference[],
    otherTurns: Turn[],
    opts: ChatOptions,
  ): Promise<Map<string, { isConfirmation: boolean; isContradiction: boolean }>> {
    const dialogue = otherTurns.map((t, i) => `[Turn ${t.turn_index ?? i}] ${t.content}`).join('\n');
    const items = prefs.map((p) => ({ id: p.id, content: p.content }));
    const system = `你是一个严格的记忆提升判断引擎。输入是多条 preference（id + content），以及 other 的完整发言记录。
对每条 preference 判断是否构成 explicit confirmation 或 contradiction。
严格规则：
1. explicit confirmation 必须：至少 2 条不同 turn + 第二次或后续明确重复/强化（使用"我真的很"、"我确认"等词）。
2. contradiction：明确否定或反转。
3. 不确定或仅单次发言 → false。
4. 输出严格 JSON 对象：{"judgments": {"<id>": {"isConfirmation": bool, "isContradiction": bool, "reason": str}, ...}}`;
    const user = `Preferences: ${JSON.stringify(items)}
Other 的发言：
${dialogue}

请输出 JSON：`;
    try {
      const raw = await chat([{ role: 'system', content: system }, { role: 'user', content: user }], opts);
      // 【缺陷4适配】chat() 可能返回 null（LLM 失败），返回空 Map 触发默认判断
      if (!raw) return new Map();
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const map = new Map<string, { isConfirmation: boolean; isContradiction: boolean }>();
      const j = parsed.judgments ?? {};
      for (const [id, v] of Object.entries<any>(j)) {
        map.set(id, { isConfirmation: !!v.isConfirmation, isContradiction: !!v.isContradiction });
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private async promoteAtomically(pref: Preference, allFacts: ObjectiveFact[], factsPath: string): Promise<void> {
    const exists = allFacts.some((f) => f.status === 'active' && this.normalize(f.fact) === this.normalize(pref.content));
    if (exists) {
      pref.status = 'promoted_to_objective';
      const match = allFacts.find((f) => f.status === 'active' && this.normalize(f.fact) === this.normalize(pref.content));
      if (match) pref.promoted_to = match.id;
      return;
    }
    const newFact: ObjectiveFact = {
      id: this.generateId('fact'),
      subject_agent_id: pref.subject_agent_id,
      fact: pref.content,
      fact_scope: 'about_self',
      fact_type: 'explicit_statement',
      confidence: 0.9,
      status: 'active',
      source: {
        session_id: pref.source.session_id,
        speaker_id: pref.subject_agent_id,
        turn_ids: pref.source.turn_ids,
        promoted_from: pref.id,
      },
      extracted_at: new Date().toISOString(),
    };
    await this.appendJsonl(factsPath, [newFact]);
    allFacts.push(newFact);
    pref.status = 'promoted_to_objective';
    pref.promoted_to = newFact.id;
  }
}
