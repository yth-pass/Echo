/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson } from './client';

export type { FeedLoadResult, FeedSource, PostDetail } from './feed';
export { loadFeed, loadPostDetail } from './feed';
export type { PostDraftResult } from './posts';
export { enqueuePostDraft, pollFeedUntilNewPost } from './posts';
export type { MatchLoadResult, MatchSource } from './match';
export { blockUser, dismissMatch, loadMatches } from './match';

function isPostRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

export type AuditRow = { time: string; type: string; content: string };

/** `GET /audit/events` — falls back to `mock`. */
export async function loadAuditEvents(mock: AuditRow[]): Promise<AuditRow[]> {
  const raw = await apiGetJson<unknown>('/audit/events');
  if (raw == null) return mock;

  let rows: unknown[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (isPostRecord(raw) && Array.isArray(raw.items)) rows = raw.items;

  const mapped = rows
    .map((r) => {
      if (!isPostRecord(r)) return null;
      const summary =
        typeof r.summary_zh === 'string'
          ? r.summary_zh
          : typeof r.summaryZh === 'string'
            ? r.summaryZh
            : '';
      const created =
        typeof r.created_at === 'string'
          ? r.created_at
          : typeof r.createdAt === 'string'
            ? r.createdAt
            : '';
      const time = created
        ? new Date(created).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '';
      const eventType = typeof r.event_type === 'string' ? r.event_type : '';
      const type = eventType.includes('comment')
        ? '评论'
        : eventType.includes('handoff')
          ? '对话'
          : eventType.includes('post') || eventType.includes('publish')
            ? '发布'
            : eventType.includes('like')
              ? '点赞'
              : '对话';
      if (!summary) return null;
      return { time, type, content: summary };
    })
    .filter((x): x is AuditRow => x !== null);

  return mapped.length ? mapped : mock;
}

export type ActivityRow = {
  kind: string;
  id: string;
  time: string;
  type: string;
  content: string;
  postId?: string;
  sessionId?: string;
  moderationStatus?: string;
};

const KIND_TO_TYPE: Record<string, string> = {
  post: '发布',
  like: '点赞',
  comment: '评论',
  session: '对话',
};

const FILTER_TO_API: Record<string, string> = {
  发布: 'post',
  评论: 'comment',
  点赞: 'like',
  对话: 'session',
};

export async function loadCloneActivity(
  mock: ActivityRow[],
  filter?: string,
): Promise<ActivityRow[]> {
  const q =
    filter && filter !== '全部' && FILTER_TO_API[filter]
      ? `?type=${FILTER_TO_API[filter]}`
      : '';
  const raw = await apiGetJson<unknown>(`/clones/me/activity${q}`);
  if (raw == null) return mock;

  let rows: unknown[] = [];
  if (isPostRecord(raw) && Array.isArray(raw.items)) rows = raw.items;

  const mapped = rows
    .map((r) => {
      if (!isPostRecord(r)) return null;
      const kind = String(r.kind ?? '');
      const created = String(r.created_at ?? '');
      const time = created
        ? new Date(created).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '';
      const moderationStatus =
        typeof r.moderation_status === 'string' ? r.moderation_status : undefined;
      return {
        kind,
        id: String(r.id ?? ''),
        time,
        type: KIND_TO_TYPE[kind] ?? '对话',
        content: String(r.summary_zh ?? r.content ?? ''),
        postId: r.post_id != null ? String(r.post_id) : undefined,
        sessionId: r.session_id != null ? String(r.session_id) : undefined,
        moderationStatus,
      };
    })
    .filter((x): x is ActivityRow => x !== null);

  return mapped.length ? mapped : mock;
}

export type SessionMessage = {
  id: string;
  content: string;
  speaker_clone_id: string;
  turn_index: number;
  created_at: string;
};

export async function loadSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const raw = await apiGetJson<unknown>(`/sessions/${sessionId}/messages`);
  if (raw == null) return [];
  let rows: unknown[] = [];
  if (isPostRecord(raw) && Array.isArray(raw.items)) rows = raw.items;
  return rows
    .map((r) => {
      if (!isPostRecord(r)) return null;
      return {
        id: String(r.id ?? ''),
        content: String(r.content ?? ''),
        speaker_clone_id: String(r.speaker_clone_id ?? ''),
        turn_index: Number(r.turn_index ?? 0),
        created_at: String(r.created_at ?? ''),
      };
    })
    .filter((m): m is SessionMessage => m !== null);
}
