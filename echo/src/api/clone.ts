/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, apiPostJson, apiPutJson, getApiBaseUrl } from './client';

export type CloneMe = {
  id: string;
  status: string;
  persona: string | null;
};

export async function loadCloneMe(): Promise<CloneMe | null> {
  if (!getApiBaseUrl()) return null;
  return apiGetJson<CloneMe>('/clones/me');
}

export async function pauseClone(): Promise<CloneMe | null> {
  return apiPostJson<object, CloneMe>('/clones/me/pause', {});
}

export async function resumeClone(): Promise<CloneMe | null> {
  return apiPostJson<object, CloneMe>('/clones/me/resume', {});
}

export async function updateClonePersona(personaText: string): Promise<CloneMe | null> {
  if (!getApiBaseUrl()) return null;
  return apiPutJson<{ personaText: string }, CloneMe>('/clones/me', { personaText });
}
