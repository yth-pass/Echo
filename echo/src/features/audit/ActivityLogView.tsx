/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { LottieLoader } from '../../components/LottieLoader';
import { Header } from '../shell/Header';
import {
  loadCloneActivity,
  type ActivityRow,
  type ActivitySource,
} from '../../api/activity';
import { getApiBaseUrl } from '../../api/client';
import { COPY } from '../../copy';

const FILTERS = ['全部', '发布', '评论', '点赞', '对话'] as const;

export function ActivityLogView({
  onOpenPost,
  onOpenSession,
}: {
  onOpenPost: (id: string) => void;
  onOpenSession: (id: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部');
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<ActivitySource | 'idle'>('idle');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    const { items: next, source: s } = await loadCloneActivity(filter);
    setItems(next);
    setSource(s);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  const rows = useMemo(() => {
    if (source !== 'mock' || filter === '全部') return items;
    return items.filter((l) => l.type === filter);
  }, [filter, items, source]);

  const showMockBanner = source === 'mock';
  const showError = source === 'error';
  const showEmpty = !loading && source === 'api' && rows.length === 0;
  const hasApi = Boolean(getApiBaseUrl());

  const openRow = (log: ActivityRow) => {
    if (log.kind === 'post' && log.moderationStatus === 'pending') return;
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

        {showError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-3 mb-4">
            <p className="text-sm text-red-300">无法加载活动记录，请检查 API 与登录</p>
            <button
              type="button"
              onClick={() => void fetchActivity()}
              className="inline-flex items-center gap-2 text-xs font-bold text-echo-blue"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {COPY.btn.tryAgain}
            </button>
          </div>
        )}
        {loading && (
          <div className="space-y-4 mb-4">
            <div className="flex justify-center py-2">
              <LottieLoader size={48} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse ml-4" />
            ))}
          </div>
        )}
        {showEmpty && (
          <p className="text-sm text-gray-500 text-center py-8">{COPY.empty.activity}</p>
        )}
        {source === 'api' && hasApi && !loading && rows.length > 0 && (
          <p className="text-[10px] text-gray-600 mb-4 text-left">
            点击可查看详情。
          </p>
        )}

        {!loading && !showError && rows.length > 0 && (
          <div className="space-y-6 relative ml-4 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {rows.map((log, i) => {
              const pending = log.kind === 'post' && log.moderationStatus === 'pending';
              return (
                <button
                  key={`${log.id}-${i}`}
                  type="button"
                  onClick={() => openRow(log)}
                  disabled={pending}
                  className={`relative pl-8 w-full text-left ${pending ? 'opacity-60 cursor-default' : 'active:opacity-80'}`}
                >
                  <div
                    className={`absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full ${
                      pending ? 'bg-amber-500/80' : 'bg-echo-blue shadow-[0_0_8px_rgba(0,242,255,0.8)]'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500 mb-1">
                    {log.time} · {log.type}
                    {pending && (
                      <span className="ml-2 text-amber-400/90 font-bold">审核中</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-300 pr-4">{log.content}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
