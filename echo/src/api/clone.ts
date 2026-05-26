/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, apiPostJson, apiPutJson, getApiBaseUrl } from './client';

export type CloneBoundaries = {
  forbiddenWords: string[];
  topicsToAvoid: string | null;
};

export type CloneMe = {
  id: string;
  status: string;
  persona: string | null;
  boundaries: CloneBoundaries | null;
};

const EMPTY_BOUNDARIES: CloneBoundaries = { forbiddenWords: [], topicsToAvoid: null };

function mapBoundaries(raw: unknown): CloneBoundaries {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_BOUNDARIES };
  const o = raw as Record<string, unknown>;
  const forbiddenWords = Array.isArray(o.forbiddenWords)
    ? o.forbiddenWords.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    : [];
  const topicsToAvoid =
    typeof o.topicsToAvoid === 'string' && o.topicsToAvoid.trim() ? o.topicsToAvoid.trim() : null;
  return { forbiddenWords: [...new Set(forbiddenWords)], topicsToAvoid };
}

function mapCloneMe(raw: Record<string, unknown>): CloneMe {
  return {
    id: String(raw.id ?? ''),
    status: String(raw.status ?? ''),
    persona: typeof raw.persona === 'string' ? raw.persona : null,
    boundaries: raw.boundaries != null ? mapBoundaries(raw.boundaries) : null,
  };
}

/** Parse textarea: one word per line or comma-separated. */
export function parseForbiddenWordsInput(text: string): string[] {
  const parts = text.split(/[\n,，、]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const w = raw.trim();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

export function forbiddenWordsToText(words: string[]): string {
  return words.join('\n');
}

export async function loadCloneMe(): Promise<CloneMe | null> {
  if (!getApiBaseUrl()) return null;
  const raw = await apiGetJson<Record<string, unknown>>('/clones/me');
  if (!raw) return null;
  return mapCloneMe(raw);
}

export async function pauseClone(): Promise<CloneMe | null> {
  const raw = await apiPostJson<object, Record<string, unknown>>('/clones/me/pause', {});
  return raw ? mapCloneMe(raw) : null;
}

export async function resumeClone(): Promise<CloneMe | null> {
  const raw = await apiPostJson<object, Record<string, unknown>>('/clones/me/resume', {});
  return raw ? mapCloneMe(raw) : null;
}

export async function updateClonePersona(personaText: string): Promise<CloneMe | null> {
  if (!getApiBaseUrl()) return null;
  const raw = await apiPutJson<{ personaText: string }, Record<string, unknown>>('/clones/me', {
    personaText,
  });
  return raw ? mapCloneMe(raw) : null;
}

export async function updateCloneBoundaries(boundaries: CloneBoundaries): Promise<CloneMe | null> {
  if (!getApiBaseUrl()) return null;
  const raw = await apiPutJson<
    { boundaries: { forbiddenWords: string[]; topicsToAvoid?: string | null } },
    Record<string, unknown>
  >('/clones/me', {
    boundaries: {
      forbiddenWords: boundaries.forbiddenWords,
      topicsToAvoid: boundaries.topicsToAvoid ?? undefined,
    },
  });
  return raw ? mapCloneMe(raw) : null;
}
