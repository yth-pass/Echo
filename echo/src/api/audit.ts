/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, unwrap } from './client';

export type AuditRow = { time: string; type: string; content: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/**
 * `GET /audit/events` — 不再回退 mock。
 * 【缺陷8修复】API 失败/空列表均返回空数组（不回退 mock）。
 */
export async function loadAuditEvents(_mock: AuditRow[]): Promise<AuditRow[]> {
  const raw = unwrap(await apiGetJson<unknown>('/audit/events'));
  // 【缺陷8修复】raw == null → 返回空数组（非 mock）
  if (raw == null) return [];

  let rows: unknown[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (isRecord(raw) && Array.isArray(raw.items)) rows = raw.items;

  const mapped = rows
    .map((r) => {
      if (!isRecord(r)) return null;
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

  // 【缺陷8修复】直接返回 mapped，空就是空（不再回退 mock）
  return mapped;
}
