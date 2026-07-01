/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Post } from '../types';
import { MOCK_POSTS } from '../data/mockData';
import { apiGetJson, getApiBaseUrl, unwrap } from './client';

export type FeedSource = 'api' | 'mock' | 'error';

export type FeedLoadResult = {
  posts: Post[];
  source: FeedSource;
};

export type PostDetail = Post & {
  comments_list?: { id: string; content: string; author: string; author_avatar?: string | null; created_at: string }[];
};

function isPostRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function formatPostTime(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function mapApiPost(row: Record<string, unknown>, index: number): Post | null {
  const id = row.id != null ? String(row.id) : String(index);
  const content =
    typeof row.content === 'string'
      ? row.content
      : typeof row.body === 'string'
        ? row.body
        : null;
  if (!content) return null;
  const author =
    typeof row.author === 'string'
      ? row.author
      : typeof row.author_display === 'string'
        ? row.author_display
        : '分身';
  const created =
    typeof row.created_at === 'string'
      ? row.created_at
      : typeof row.time === 'string'
        ? row.time
        : '';
  const time = created.includes('T') || created.includes('-') ? formatPostTime(created) : created;
  const authorAvatarUrl =
    typeof row.author_avatar === 'string' ? row.author_avatar : null;
  return {
    id,
    author,
    authorType: 'clone',
    authorAvatarUrl,
    content,
    time,
    likes: typeof row.likes === 'number' ? row.likes : 0,
    comments: typeof row.comments === 'number' ? row.comments : 0,
  };
}

function parseFeedRows(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (!isPostRecord(raw)) return [];
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.posts)) return raw.posts;
  return [];
}

/** `GET /feed` — mock only when no API base URL; empty API list is not replaced with mock. */
export async function loadFeed(signal?: AbortSignal): Promise<FeedLoadResult> {
  if (!getApiBaseUrl()) {
    return { posts: MOCK_POSTS, source: 'mock' };
  }

  const raw = unwrap(await apiGetJson<unknown>('/feed', signal));
  if (raw == null) {
    return { posts: [], source: 'error' };
  }

  const rows = parseFeedRows(raw);
  const mapped = rows
    .map((r, i) => (isPostRecord(r) ? mapApiPost(r, i) : null))
    .filter((p): p is Post => p !== null);

  return { posts: mapped, source: 'api' };
}

export async function loadPostDetail(id: string): Promise<PostDetail | null> {
  const raw = unwrap(await apiGetJson<Record<string, unknown>>(`/posts/${id}`));
  if (!raw) return null;
  const base = mapApiPost(raw, 0);
  if (!base) return null;
  const comments_list = Array.isArray(raw.comments_list)
    ? (raw.comments_list as Record<string, unknown>[]).map((c) => ({
        id: String(c.id ?? ''),
        content: String(c.content ?? ''),
        author: String(c.author ?? '分身'),
        author_avatar: typeof c.author_avatar === 'string' ? c.author_avatar : null,
        created_at: String(c.created_at ?? ''),
      }))
    : [];
  return { ...base, comments_list };
}
