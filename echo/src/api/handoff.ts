/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiPostJson, getApiBaseUrl } from './client';

export async function respondHandoff(
  handoffId: string,
  accept: boolean,
): Promise<{ status?: string } | null> {
  if (!getApiBaseUrl()) return null;
  return apiPostJson<{ accept: boolean }, { status?: string }>(
    `/handoffs/${handoffId}/respond`,
    { accept },
  );
}
