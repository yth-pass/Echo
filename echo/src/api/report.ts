/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiPostJson, getApiBaseUrl, unwrap } from './client';

export type ReportTargetType = 'post' | 'comment' | 'user' | 'session';

export type SubmitReportParams = {
  targetType: ReportTargetType;
  targetId: string;
  reason?: string;
};

export type SubmitReportResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_api' | 'request_failed' };

/** `POST /reports` — no silent success without API. */
export async function submitReport(params: SubmitReportParams): Promise<SubmitReportResult> {
  if (!getApiBaseUrl()) {
    return { ok: false, error: 'no_api' };
  }

  const res = unwrap(
    await apiPostJson<
      { targetType: string; targetId: string; reason?: string },
      { id?: string; created?: boolean }
    >('/reports', {
      targetType: params.targetType,
      targetId: params.targetId,
      ...(params.reason ? { reason: params.reason } : {}),
    }),
  );

  if (res?.created && res.id) {
    return { ok: true, id: String(res.id) };
  }
  return { ok: false, error: 'request_failed' };
}
