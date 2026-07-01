/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Match } from '../types';
import { MOCK_MATCHES } from '../data/mockData';
import { apiGetJson, apiPostJson, getApiBaseUrl, unwrap } from './client';

export type MatchSource = 'api' | 'mock' | 'error';

export type MatchLoadResult = {
  matches: Match[];
  source: MatchSource;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function mapApiMatch(row: Record<string, unknown>, index: number): Match | null {
  const id = row.id != null ? String(row.id) : String(index);
  const name =
    typeof row.name === 'string'
      ? row.name
      : typeof row.display_name === 'string'
        ? row.display_name
        : null;
  if (!name) return null;
  const affinity =
    typeof row.affinity === 'number'
      ? row.affinity
      : typeof row.affinity_score === 'number'
        ? Math.round((row.affinity_score as number) * 100)
        : 0;
  const tags = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : [];
  const matchReasons = Array.isArray(row.matchReasons)
    ? row.matchReasons.filter((t): t is string => typeof t === 'string')
    : Array.isArray(row.match_reasons)
      ? row.match_reasons.filter((t): t is string => typeof t === 'string')
      : [];
  const handoffId =
    typeof row.handoff_id === 'string'
      ? row.handoff_id
      : typeof row.handoffId === 'string'
        ? row.handoffId
        : undefined;
  const candidateUserId =
    typeof row.candidate_user_id === 'string'
      ? row.candidate_user_id
      : typeof row.candidateUserId === 'string'
        ? row.candidateUserId
        : undefined;
  const sessionId =
    typeof row.session_id === 'string'
      ? row.session_id
      : typeof row.sessionId === 'string'
        ? row.sessionId
        : undefined;
  const sessionStatus =
    typeof row.session_status === 'string' ? row.session_status : undefined;
  const windDownReason =
    typeof row.wind_down_reason === 'string' ? row.wind_down_reason : undefined;
  const dailyTurnCount =
    typeof row.daily_turn_count === 'number' ? row.daily_turn_count : undefined;
  return {
    id,
    name,
    affinity,
    handoffId,
    candidateUserId,
    sessionId,
    sessionStatus,
    windDownReason,
    dailyTurnCount,
    status: typeof row.status === 'string' ? row.status : '',
    lastMessage:
      typeof row.lastMessage === 'string'
        ? row.lastMessage
        : typeof row.last_message === 'string'
          ? row.last_message
          : '',
    tags,
    bio: typeof row.bio === 'string' ? row.bio : '',
    matchReasons,
  };
}

function parseMatchRows(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.matches)) return raw.matches;
  return [];
}

/**
 * `GET /matches` — mock only without API base URL; empty API list does not substitute mock.
 * 【缺陷3修复】移除独立的 refreshSession 逻辑，由 client.ts 统一 401 拦截处理。
 */
export async function loadMatches(signal?: AbortSignal): Promise<MatchLoadResult> {
  if (!getApiBaseUrl()) {
    return { matches: MOCK_MATCHES, source: 'mock' };
  }

  // 【缺陷3修复】401 由 client 内部拦截（refresh + 重试），此处无需手动 refresh
  const raw = unwrap(await apiGetJson<unknown>('/matches', signal));
  if (raw == null) {
    return { matches: [], source: 'error' };
  }

  const rows = parseMatchRows(raw);
  const mapped = rows
    .map((r, i) => (isRecord(r) ? mapApiMatch(r, i) : null))
    .filter((m): m is Match => m !== null);

  return { matches: mapped, source: 'api' };
}

export async function dismissMatch(matchPushId: string): Promise<boolean> {
  if (!getApiBaseUrl()) return false;
  const res = unwrap(
    await apiPostJson<Record<string, never>, { dismissed?: boolean }>(
      `/matches/${matchPushId}/dismiss`,
      {},
    ),
  );
  return res?.dismissed === true;
}

export async function blockUser(blockedUserId: string): Promise<boolean> {
  if (!getApiBaseUrl()) return false;
  const res = unwrap(
    await apiPostJson<{ blockedUserId: string }, { blocked?: boolean }>('/blocks', {
      blockedUserId,
    }),
  );
  return res?.blocked === true;
}

/** POST /matches/trigger — 手动触发匹配（跳过时间窗口），用于本地测试 */
export async function triggerMatch(): Promise<boolean> {
  if (!getApiBaseUrl()) return false;
  const res = unwrap(
    await apiPostJson<Record<string, never>, { triggered?: boolean }>(
      '/matches/trigger',
      {},
    ),
  );
  return res?.triggered === true;
}
