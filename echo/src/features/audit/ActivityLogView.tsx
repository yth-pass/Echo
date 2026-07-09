/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
  headerRight,
}: {
  onOpenPost: (id: string) => void;
  onOpenSession: (id: string) => void;
  headerRight?: ReactNode;
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
      <Header title="活动记录" rightSlot={headerRight} />
      <div className="px-5 mt-4">
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
              style={
                f === filter
                  ? { backgroundColor: '#2B8AEF', color: '#ffffff' }
                  : { backgroundColor: '#E8F4FF', color: '#7b7487' }
              }
            >
              {f}
            </button>
          ))}
        </div>

        {showError && (
          <div className="p-4 rounded-2xl text-center space-y-3 mb-4 border" style={{ backgroundColor: 'rgba(186,26,26,0.08)', borderColor: 'rgba(186,26,26,0.15)' }}>
            <p className="text-sm" style={{ color: '#ba1a1a' }}>无法加载活动记录，请检查 API 与登录</p>
            <button
              type="button"
              onClick={() => void fetchActivity()}
              className="inline-flex items-center gap-2 text-xs font-bold"
              style={{ color: '#2B8AEF' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {COPY.btn.tryAgain}
            </button>
          </div>
        )}
        {loading && (
          <div className="space-y-4 mb-4">
            <div className="flex justify-center">
              <LottieLoader size={288} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-2xl animate-pulse ml-4" style={{ backgroundColor: '#E8F4FF' }} />
            ))}
          </div>
        )}
        {showEmpty && (
          <p className="text-sm text-center py-8" style={{ color: '#7b7487' }}>{COPY.empty.activity}</p>
        )}
        {source === 'api' && hasApi && !loading && rows.length > 0 && (
          <p className="text-[10px] mb-4 text-left" style={{ color: '#7b7487' }}>
            点击可查看详情。
          </p>
        )}

        {!loading && !showError && rows.length > 0 && (
          <div className="space-y-6 relative ml-4" style={{ borderLeft: '1px solid #d9e3f4' }}>
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
                    className="absolute top-1.5 w-2 h-2 rounded-full"
                    style={{
                      left: '-4.5px',
                      backgroundColor: pending ? 'rgba(180,130,0,0.8)' : '#2B8AEF',
                      boxShadow: pending ? undefined : '0 0 8px rgba(43,138,239,0.6)',
                    }}
                  />
                  <p className="text-[10px] mb-1" style={{ color: '#7b7487' }}>
                    {log.time} · {log.type}
                    {pending && (
                      <span className="ml-2 font-bold" style={{ color: 'rgba(180,130,0,0.9)' }}>审核中</span>
                    )}
                  </p>
                  <p className="text-sm pr-4" style={{ color: '#121c28' }}>{log.content}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
