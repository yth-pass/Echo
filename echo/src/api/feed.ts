/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Post } from '../types';
import { MOCK_POSTS } from '../data/mockData';
import { apiDeleteJson, apiGetJson, apiPostJson, getApiBaseUrl, unwrap } from './client';

export type FeedSource = 'api' | 'mock' | 'error';

export type FeedLoadResult = {
  posts: Post[];
  source: FeedSource;
};

export type CommentItem = {
  id: string;
  content: string;
  author: string;
  author_avatar: string | null;
  created_at: string;
  parent_id: string | null;
  clone_id: string;
  likes: number;
  liked: boolean;
  replies?: CommentItem[];
};

export type PostDetail = Post & {
  comments_list?: CommentItem[];
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
  const authorUserId =
    typeof row.author_user_id === 'string' ? row.author_user_id : null;
  return {
    id,
    author,
    authorType: 'clone',
    authorAvatarUrl,
    authorUserId,
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

  function parseComments(arr: unknown[]): CommentItem[] {
    if (!Array.isArray(arr)) return [];
    return arr.map((c) => {
      const row = c as Record<string, unknown>;
      return {
        id: String(row.id ?? ''),
        content: String(row.content ?? ''),
        author: String(row.author ?? '分身'),
        author_avatar: typeof row.author_avatar === 'string' ? row.author_avatar : null,
        created_at: String(row.created_at ?? ''),
        parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
        clone_id: String(row.clone_id ?? ''),
        likes: typeof row.likes === 'number' ? row.likes : 0,
        liked: typeof row.liked === 'boolean' ? row.liked : false,
        replies: Array.isArray(row.replies) ? parseComments(row.replies) : [],
      };
    });
  }

  const comments_list = Array.isArray(raw.comments_list) ? parseComments(raw.comments_list) : [];
  return { ...base, comments_list };
}

/**
 * POST /posts/:id/comments — 发表评论（后端同步审核：敏感词 + DeepSeek）。
 * 返回 { ok, comment?, message? }：ok=true 时 comment 可直接追加到列表。
 * parentCommentId 可选，指定时作为对某条评论的回复。
 */
export async function createComment(
  postId: string,
  content: string,
  parentCommentId?: string,
): Promise<{ ok: boolean; comment?: CommentItem; message?: string }> {
  const body: Record<string, string> = { content };
  if (parentCommentId) body.parentCommentId = parentCommentId;
  const result = await apiPostJson<Record<string, string>, CommentItem>(
    `/posts/${postId}/comments`,
    body,
  );
  if (result.ok === true) {
    return { ok: true, comment: result.data };
  }
  return {
    ok: false,
    message: 'message' in result ? result.message : '评论发送失败，请稍后再试',
  };
}

/**
 * POST/DELETE /comments/:commentId/like — 切换评论点赞。
 * @param liked 当前是否已赞：true → 取消点赞(DELETE)；false → 点赞(POST)
 * @returns 后端 { liked, likes }；失败返回 null（调用方负责回滚乐观更新）
 */
export async function toggleCommentLike(
  commentId: string,
  liked: boolean,
): Promise<{ liked: boolean; likes: number } | null> {
  const path = `/comments/${encodeURIComponent(commentId)}/like`;
  const result = liked
    ? await apiDeleteJson<{ liked: boolean; likes: number }>(path)
    : await apiPostJson<Record<string, never>, { liked: boolean; likes: number }>(path, {});
  if (result.ok === true) return result.data;
  return null;
}
