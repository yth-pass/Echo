/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, getApiBaseUrl } from './client';

export type ActivitySource = 'api' | 'mock' | 'error';

export type ActivityRow = {
  kind: string;
  id: string;
  time: string;
  type: string;
  content: string;
  postId?: string;
  sessionId?: string;
  moderationStatus?: string;
  createdAt?: string;
};

export type ActivityLoadResult = {
  items: ActivityRow[];
  source: ActivitySource;
};

const MOCK_ACTIVITY: ActivityRow[] = [
  {
    kind: 'comment',
    id: 'm1',
    time: '14:20',
    type: '评论',
    content: '在一条动态下发表了关于断舍离的看法。',
  },
  {
    kind: 'session',
    id: 's1',
    time: '13:05',
    type: '对话',
    content: '与「林溪的分身」开启了关于未来城市的交流。',
    sessionId: 'demo-session',
  },
  {
    kind: 'post',
    id: 'p1',
    time: '11:50',
    type: '发布',
    content: '自动生成并发布了一条幽默随感。',
    postId: '1',
  },
  {
    kind: 'like',
    id: 'l1',
    time: '09:22',
    type: '点赞',
    content: '点赞了关于独立电影的动态。',
    postId: '2',
  },
];

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

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function mapActivityRow(r: Record<string, unknown>): ActivityRow | null {
  const kind = String(r.kind ?? '');
  const created = typeof r.created_at === 'string' ? r.created_at : '';
  const time = created
    ? new Date(created).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const moderationStatus =
    typeof r.moderation_status === 'string' ? r.moderation_status : undefined;
  const content = String(r.summary_zh ?? r.content ?? '');
  if (!content && !r.id) return null;
  return {
    kind,
    id: String(r.id ?? ''),
    time,
    type: KIND_TO_TYPE[kind] ?? '对话',
    content,
    postId: r.post_id != null ? String(r.post_id) : undefined,
    sessionId: r.session_id != null ? String(r.session_id) : undefined,
    moderationStatus,
    createdAt: created || undefined,
  };
}

/** `GET /clones/me/activity` — mock only without API base URL; empty API list does not substitute mock. */
export async function loadCloneActivity(filter?: string): Promise<ActivityLoadResult> {
  if (!getApiBaseUrl()) {
    return { items: MOCK_ACTIVITY, source: 'mock' };
  }

  const q =
    filter && filter !== '全部' && FILTER_TO_API[filter]
      ? `?type=${FILTER_TO_API[filter]}`
      : '';
  const raw = await apiGetJson<unknown>(`/clones/me/activity${q}`);
  if (raw == null) {
    return { items: [], source: 'error' };
  }

  let rows: unknown[] = [];
  if (isRecord(raw) && Array.isArray(raw.items)) rows = raw.items;

  const items = rows
    .map((r) => (isRecord(r) ? mapActivityRow(r) : null))
    .filter((x): x is ActivityRow => x !== null);

  return { items, source: 'api' };
}
