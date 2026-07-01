/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, apiPostJson, getApiBaseUrl, unwrap } from './client';

export type HandoffDetail = {
  id: string;
  status: string;
  sessionId: string;
  affinityScore: number | null;
};

export async function fetchHandoff(handoffId: string): Promise<HandoffDetail | null> {
  if (!getApiBaseUrl()) return null;
  const raw = unwrap(await apiGetJson<Record<string, unknown>>(`/handoffs/${handoffId}`));
  if (!raw) return null;
  return {
    id: String(raw.id ?? handoffId),
    status: String(raw.status ?? 'pending'),
    sessionId:
      typeof raw.session_id === 'string'
        ? raw.session_id
        : typeof raw.sessionId === 'string'
          ? raw.sessionId
          : '',
    affinityScore:
      typeof raw.affinity_score === 'number'
        ? raw.affinity_score
        : raw.affinity_score != null
          ? Number(raw.affinity_score)
          : null,
  };
}

export async function respondHandoff(
  handoffId: string,
  accept: boolean,
): Promise<{ status?: string } | null> {
  if (!getApiBaseUrl()) return null;
  // 【缺陷5适配】apiPostJson 返回 ApiResult，用 unwrap 取 data
  return unwrap(
    await apiPostJson<{ accept: boolean }, { status?: string }>(
      `/handoffs/${handoffId}/respond`,
      { accept },
    ),
  );
}
