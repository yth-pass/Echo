/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageSquare, RefreshCw, Sparkles } from 'lucide-react';
import type { Match } from '../../types';
import type { MatchSource } from '../../api/match';
import { getApiBaseUrl } from '../../api/client';
import { Header } from '../shell/Header';

export function MatchView({
  matches,
  loading,
  source,
  actionError,
  onRefresh,
  onSelect,
  onDismiss,
  onBlock,
  onOpenSession,
}: {
  matches: Match[];
  loading?: boolean;
  source?: MatchSource | 'idle';
  actionError?: string | null;
  onRefresh?: () => void;
  onSelect: (m: Match) => void;
  onDismiss: (m: Match) => void;
  onBlock: (m: Match) => void;
  onOpenSession?: (sessionId: string) => void;
}) {
  const hasApi = Boolean(getApiBaseUrl());
  const showMockBanner = source === 'mock';
  const showError = source === 'error';
  const showEmpty = !loading && source === 'api' && matches.length === 0;
  const pendingHandoff = matches.some((m) => m.handoffId);

  const handleBlock = (match: Match) => {
    if (!match.candidateUserId && hasApi) return;
    const label = match.name;
    if (
      !window.confirm(`确定拉黑「${label}」？对方将不再出现在匹配列表中。`)
    ) {
      return;
    }
    onBlock(match);
  };

  return (
    <div className="pb-24">
      <Header title="社交实验室" />
      <div className="px-5 mt-4 space-y-4">
        {showMockBanner && (
          <p className="text-[10px] text-amber-400/90 text-center">演示数据（Mock）</p>
        )}
        {showError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-3">
            <p className="text-sm text-red-300">无法连接匹配服务，请检查 API 与登录</p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 text-xs font-bold text-echo-blue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重试
              </button>
            )}
          </div>
        )}
        {actionError && (
          <p className="text-sm text-red-400 text-center">{actionError}</p>
        )}
        {pendingHandoff && source === 'api' && (
          <div className="p-4 bg-echo-orange/10 border border-echo-orange/20 rounded-2xl flex items-center gap-4">
            <Sparkles className="w-8 h-8 text-echo-orange shrink-0" />
            <div>
              <p className="text-sm font-bold text-echo-orange">有待确认的缘分</p>
              <p className="text-xs text-echo-orange/80">部分匹配可开启真人联络，请查看详情。</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-echo-card border border-white/5 animate-pulse h-40"
              />
            ))}
            <p className="text-center text-xs text-gray-500">加载中…</p>
          </div>
        )}
        {!loading && showEmpty && (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm text-gray-400">暂无匹配，后台正在为你寻找缘分</p>
            <p className="text-[10px] text-gray-600">
              请确认 Worker 已运行；新用户完成入驻后会自动触发匹配任务
            </p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-echo-blue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                刷新
              </button>
            )}
          </div>
        )}
        {!loading && (
          <>
            {matches.length > 0 && (
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest pt-2 mb-2">
                正在进行的秘密外交
              </h2>
            )}
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-5 rounded-3xl bg-echo-card border border-white/5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-echo-blue">{match.affinity}%</p>
                    <p className="text-[10px] text-echo-blue/60 uppercase">Affinity</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${match.name}`}
                      alt="match"
                      className="w-10 h-10"
                    />
                  </div>
                  <div>
                    <p className="font-bold">{match.name}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {match.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] bg-white/5 px-2 py-0.5 rounded-md text-gray-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> 分身对话摘要
                  </p>
                  <p className="text-sm text-gray-300 italic">
                    {match.lastMessage ? `“${match.lastMessage}”` : '分身对话进行中…'}
                  </p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onDismiss(match)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-400"
                  >
                    忽略
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlock(match)}
                    disabled={hasApi && !match.candidateUserId}
                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-xs font-bold text-red-400 disabled:opacity-40"
                  >
                    拉黑
                  </button>
                </div>

                {match.sessionId && onOpenSession && (
                  <button
                    type="button"
                    onClick={() => onOpenSession(match.sessionId!)}
                    className="w-full mt-2 py-3 bg-echo-blue/10 hover:bg-echo-blue/20 rounded-xl text-xs font-bold text-echo-blue transition-colors"
                  >
                    查看对话记录
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(match)}
                  className="w-full mt-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-colors"
                >
                  查看详情
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
