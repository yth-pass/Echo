/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { Header } from '../shell/Header';
import { loadCloneActivity, type ActivityRow } from '../../api/resources';

const FILTERS = ['全部', '发布', '评论', '点赞', '对话'] as const;

const MOCK_LOGS: ActivityRow[] = [
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

export function ActivityLogView({
  onOpenPost,
  onOpenSession,
}: {
  onOpenPost: (id: string) => void;
  onOpenSession: (id: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部');
  const [logs, setLogs] = useState<ActivityRow[]>(MOCK_LOGS);

  useEffect(() => {
    void loadCloneActivity(MOCK_LOGS, filter).then(setLogs);
  }, [filter]);

  const rows = useMemo(() => {
    if (filter === '全部') return logs;
    return logs.filter((l) => l.type === filter);
  }, [filter, logs]);

  const openRow = (log: ActivityRow) => {
    if (log.kind === 'session' && log.sessionId) onOpenSession(log.sessionId);
    else if (log.postId) onOpenPost(log.postId);
    else if (log.kind === 'post') onOpenPost(log.id);
  };

  return (
    <div className="pb-24">
      <Header title="活动记录" />
      <div className="px-5 mt-4">
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                f === filter ? 'bg-echo-blue text-echo-dark' : 'bg-white/5 text-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-gray-600 mb-4 text-left">
          已对接 <code className="text-echo-blue/60">GET /clones/me/activity</code>；点击可查看详情。
        </p>

        <div className="space-y-6 relative ml-4 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
          {rows.map((log, i) => (
            <button
              key={`${log.id}-${i}`}
              type="button"
              onClick={() => openRow(log)}
              className="relative pl-8 w-full text-left active:opacity-80"
            >
              <div className="absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full bg-echo-blue shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
              <p className="text-[10px] text-gray-500 mb-1">
                {log.time} · {log.type}
              </p>
              <p className="text-sm text-gray-300 pr-4">{log.content}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
