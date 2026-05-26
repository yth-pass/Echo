/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MOCK_SESSION_MESSAGES } from '../data/mockData';
import { apiGetJson, getApiBaseUrl } from './client';

export type SessionMessage = {
  id: string;
  content: string;
  speaker_clone_id: string;
  turn_index: number;
  created_at: string;
  is_self?: boolean;
  speaker_name?: string;
};

export type SessionMessagesSource = 'api' | 'mock' | 'error';

export type SessionMessagesResult = {
  messages: SessionMessage[];
  source: SessionMessagesSource;
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

  const raw = await apiGetJson<unknown>(`/sessions/${sessionId}/messages`);
  if (raw == null) {
    return { messages: [], source: 'error' };
  }

  let rows: unknown[] = [];
  if (isRecord(raw) && Array.isArray(raw.items)) rows = raw.items;

  const messages = rows
    .map((r) => (isRecord(r) ? mapMessage(r) : null))
    .filter((m): m is SessionMessage => m !== null);

  return { messages, source: 'api' };
}
