/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Post } from '../types';
import { apiPostJson, getApiBaseUrl } from './client';

export type PostDraftResult =
  | { ok: true; queued: true }
  | { ok: false; reason: 'no_api' | 'no_clone' | 'request_failed' };

type DraftResponse = { queued?: boolean; reason?: string };

/** `POST /posts/draft` — enqueue post-draft job (empty content → Worker LLM). */
export async function enqueuePostDraft(content?: string): Promise<PostDraftResult> {
  if (!getApiBaseUrl()) {
    return { ok: false, reason: 'no_api' };
  }

  const body = content?.trim() ? { content: content.trim() } : {};
  const res = await apiPostJson<typeof body, DraftResponse>('/posts/draft', body);
  if (!res) {
    return { ok: false, reason: 'request_failed' };
  }
  if (res.queued === true) {
    return { ok: true, queued: true };
  }
  if (res.reason === 'no_clone') {
    return { ok: false, reason: 'no_clone' };
  }
  return { ok: false, reason: 'request_failed' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll feed refresh until a post id not in `previousIds` appears, or attempts exhausted. */
export async function pollFeedUntilNewPost(
  refresh: () => Promise<Post[]>,
  previousIds: Set<string>,
  opts?: { attempts?: number; intervalMs?: number },
): Promise<boolean> {
  const attempts = opts?.attempts ?? 8;
  const intervalMs = opts?.intervalMs ?? 1500;

  for (let i = 0; i < attempts; i++) {
    const next = await refresh();
    if (next.some((p) => !previousIds.has(p.id))) {
      return true;
    }
    if (i < attempts - 1) {
      await sleep(intervalMs);
    }
  }
  return false;
}
