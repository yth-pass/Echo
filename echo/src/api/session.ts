/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MOCK_SESSION_MESSAGES } from '../data/mockData';
import { apiGetJson, apiPostJson, getApiBaseUrl, unwrap } from './client';

export type SessionMessage = {
  id: string;
  content: string;
  speaker_clone_id: string;
  turn_index: number;
  bubble_index: number;
  delay_ms: number;
  created_at: string;
  is_self?: boolean;
  speaker_name?: string;
};

export type SessionMessagesSource = 'api' | 'mock' | 'error';

export type SessionMessagesResult = {
  messages: SessionMessage[];
  source: SessionMessagesSource;
  sessionStatus?: string;
  windDownReason?: string | null;
  windDownBy?: string | null;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function mapMessage(row: Record<string, unknown>): SessionMessage | null {
  const content = typeof row.content === 'string' ? row.content : '';
  if (!content && !row.id) return null;
  return {
    id: String(row.id ?? ''),
    content,
    speaker_clone_id: String(row.speaker_clone_id ?? ''),
    turn_index: Number(row.turn_index ?? 0),
    bubble_index: Number(row.bubble_index ?? 0),
    delay_ms: Number(row.delay_ms ?? 0),
    created_at: String(row.created_at ?? ''),
    is_self: row.is_self === true,
    speaker_name: typeof row.speaker_name === 'string' ? row.speaker_name : undefined,
  };
}

/** `GET /sessions/{id}/messages` — mock only for demo-session without API. */
export async function loadSessionMessages(sessionId: string): Promise<SessionMessagesResult> {
  if (!getApiBaseUrl()) {
    if (sessionId === 'demo-session') {
      return { messages: MOCK_SESSION_MESSAGES, source: 'mock' };
    }
    return { messages: [], source: 'mock' };
  }

  const raw = unwrap(await apiGetJson<unknown>(`/sessions/${sessionId}/messages`));
  if (raw == null) {
    return { messages: [], source: 'error' };
  }

  let rows: unknown[] = [];
  if (isRecord(raw) && Array.isArray(raw.items)) rows = raw.items;

  const messages = rows
    .map((r) => (isRecord(r) ? mapMessage(r) : null))
    .filter((m): m is SessionMessage => m !== null);

  return {
    messages,
    source: 'api',
    sessionStatus: isRecord(raw) ? String(raw.session_status ?? 'active') : undefined,
    windDownReason: isRecord(raw) ? (raw.wind_down_reason as string | null) ?? null : null,
    windDownBy: isRecord(raw) ? (raw.wind_down_by as string | null) ?? null : null,
  };
}

/** `POST /sessions/{id}/end-request` — request to end a chat with reason. */
export async function requestEndChat(
  sessionId: string,
  reason: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await apiPostJson<{ reason: string }, { success: boolean; message: string }>(
      `/sessions/${sessionId}/end-request`,
      { reason },
    );
    if (r.ok) return { ok: true, message: r.data.message };
    return { ok: false, message: '请求失败' };
  } catch {
    return { ok: false, message: '网络错误' };
  }
}

export type SessionAffinity = {
  affinityPercent: number;
  affinityScore: number;
  breakdown?: unknown;
  handoff?: { id: string; status: string } | null;
};

/** `GET /sessions/{id}/affinity` — session score + optional handoff summary. */
export async function loadSessionAffinity(sessionId: string): Promise<SessionAffinity | null> {
  if (!getApiBaseUrl()) return null;
  const raw = unwrap(await apiGetJson<Record<string, unknown>>(`/sessions/${sessionId}/affinity`));
  if (!raw) return null;
  const score =
    typeof raw.affinity_score === 'number'
      ? raw.affinity_score
      : Number(raw.affinity_score ?? 0);
  const percent =
    typeof raw.affinity_percent === 'number'
      ? raw.affinity_percent
      : Math.round(score * 100);
  let handoff: SessionAffinity['handoff'] = null;
  if (isRecord(raw.handoff)) {
    handoff = {
      id: String(raw.handoff.id ?? ''),
      status: String(raw.handoff.status ?? 'pending'),
    };
  }
  return {
    affinityPercent: percent,
    affinityScore: score,
    breakdown: raw.breakdown_json,
    handoff,
  };
}

export type SessionRelationship = {
  label: string;
  compositeAffinity: number;
  dimensions: { familiarity: number; warmth: number; trust: number; tension: number };
  hints: { trust: string; tension: string };
  otherCloneId: string;
};

export async function loadSessionRelationship(sessionId: string): Promise<SessionRelationship | null> {
  if (!getApiBaseUrl()) return null;
  const raw = unwrap(await apiGetJson<Record<string, unknown>>(`/sessions/${sessionId}/relationship`));
  if (!raw) return null;
  const d = (raw.dimensions && typeof raw.dimensions === 'object' ? raw.dimensions : {}) as Record<string, unknown>;
  return {
    label: String(raw.label ?? 'stranger'),
    compositeAffinity: typeof raw.composite_affinity === 'number' ? raw.composite_affinity : 0,
    dimensions: {
      familiarity: Number(d.familiarity ?? 0),
      warmth: Number(d.warmth ?? 0),
      trust: Number(d.trust ?? 0),
      tension: Number(d.tension ?? 0),
    },
    hints: {
      trust: String((raw.hints as any)?.trust ?? ''),
      tension: String((raw.hints as any)?.tension ?? ''),
    },
    otherCloneId: String(raw.other_clone_id ?? ''),
  };
}
