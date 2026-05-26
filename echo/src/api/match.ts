/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Match } from '../types';
import { MOCK_MATCHES } from '../data/mockData';
import { apiGetJson, apiPostJson, getApiBaseUrl } from './client';

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
  return {
    id,
    name,
    affinity,
    handoffId,
    candidateUserId,
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

/** `GET /matches` — mock only without API base URL; empty API list does not substitute mock. */
export async function loadMatches(): Promise<MatchLoadResult> {
  if (!getApiBaseUrl()) {
    return { matches: MOCK_MATCHES, source: 'mock' };
  }

  const raw = await apiGetJson<unknown>('/matches');
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
  const res = await apiPostJson<Record<string, never>, { dismissed?: boolean }>(
    `/matches/${matchPushId}/dismiss`,
    {},
  );
  return res?.dismissed === true;
}

export async function blockUser(blockedUserId: string): Promise<boolean> {
  if (!getApiBaseUrl()) return false;
  const res = await apiPostJson<{ blockedUserId: string }, { blocked?: boolean }>('/blocks', {
    blockedUserId,
  });
  return res?.blocked === true;
}
