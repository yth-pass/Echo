/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, MessageSquare, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { LottieLoader } from '../../components/LottieLoader';
import type { Match } from '../../types';
import type { MatchSource } from '../../api/match';
import { triggerMatch } from '../../api/match';
import { getApiBaseUrl } from '../../api/client';
import { Header } from '../shell/Header';
import { COPY } from '../../copy';

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
  headerRight,
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
  headerRight?: ReactNode;
}) {
  const hasApi = Boolean(getApiBaseUrl());
  const showMockBanner = source === 'mock';
  const showError = source === 'error';
  const showEmpty = !loading && source === 'api' && matches.length === 0;
  const pendingHandoff = matches.some((m) => m.handoffId);
  const [triggerStatus, setTriggerStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');

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
      <Header title="社交实验室" rightSlot={headerRight} />
      <div className="px-5 mt-4 space-y-4">
        {/* [Dev] 手动触发匹配 */}
        <button
          type="button"
          disabled={triggerStatus === 'loading'}
          onClick={async () => {
            setTriggerStatus('loading');
            const ok = await triggerMatch();
            setTriggerStatus(ok ? 'ok' : 'err');
            setTimeout(() => setTriggerStatus('idle'), 3000);
          }}
          className="w-full p-4 rounded-2xl flex items-center justify-between text-left active:opacity-80 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'rgba(43,138,239,0.08)', border: '1px solid rgba(43,138,239,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(43,138,239,0.08)', color: '#2B8AEF' }}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#2B8AEF' }}>手动触发匹配</p>
              <p className="text-[10px]" style={{ color: '#7b7487' }}>
                {triggerStatus === 'idle' && '跳过时间窗口，立即执行匹配'}
                {triggerStatus === 'loading' && '正在触发…'}
                {triggerStatus === 'ok' && '已触发，等待 Worker 处理'}
                {triggerStatus === 'err' && '触发失败，检查 Worker 是否运行'}
              </p>
            </div>
          </div>
        </button>

        {showError && (
          <div className="p-4 rounded-2xl border text-center space-y-3" style={{ backgroundColor: 'rgba(186,26,26,0.08)', borderColor: 'rgba(186,26,26,0.15)' }}>
            <p className="text-sm" style={{ color: '#ba1a1a' }}>无法连接匹配服务，请检查 API 与登录</p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 text-xs font-bold"
                style={{ color: '#2B8AEF' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {COPY.btn.tryAgain}
              </button>
            )}
          </div>
        )}
        {actionError && (
          <p className="text-sm text-center" style={{ color: '#ba1a1a' }}>{actionError}</p>
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
            <div className="flex justify-center">
              <LottieLoader size={288} />
            </div>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="p-5 rounded-3xl border animate-pulse h-40"
                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
              />
            ))}
            <p className="text-center text-base font-bold tracking-wide" style={{ color: '#121c28' }}>
            {COPY.loading.match}</p>
          </div>
        )}
        {!loading && showEmpty && (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm" style={{ color: '#7b7487' }}>{COPY.empty.match}</p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold"
                style={{ color: '#2B8AEF' }}
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
              <h2 className="text-xs font-bold uppercase tracking-widest pt-2 mb-2" style={{ color: '#7b7487' }}>
                正在进行的秘密外交
              </h2>
            )}
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-5 rounded-3xl border relative overflow-hidden"
                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
              >
                <div className="absolute top-0 right-0 p-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: '#2B8AEF' }}>{match.affinity}%</p>
                    <p className="text-[10px] uppercase" style={{ color: 'rgba(43,138,239,0.6)' }}>Affinity</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full border flex items-center justify-center" style={{ backgroundColor: '#E8F4FF', borderColor: '#d9e3f4' }}>
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${match.name}`}
                      alt="match"
                      className="w-10 h-10"
                    />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: '#121c28' }}>{match.name}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {match.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl border" style={{ backgroundColor: '#E8F4FF', borderColor: '#d9e3f4' }}>
                  <p className="text-[11px] mb-1 flex items-center gap-1" style={{ color: '#7b7487' }}>
                    <MessageSquare className="w-3 h-3" /> {COPY.status.chatSummary}
                  </p>
                  <p className="text-sm italic" style={{ color: '#121c28' }}>
                    {match.lastMessage ? `"${match.lastMessage}"` : COPY.status.chatOngoing}
                  </p>
                </div>

                {/* Session status badges */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {match.sessionStatus === 'wind_down' && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {COPY.status.chatWindingDown}
                    </span>
                  )}
                  {typeof match.dailyTurnCount === 'number' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#7b7487', backgroundColor: '#E8F4FF' }}>
                      今天 {match.dailyTurnCount}/100 轮
                    </span>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => onDismiss(match)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}
                  >
                    {COPY.btn.dismiss}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlock(match)}
                    disabled={hasApi && !match.candidateUserId}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                    style={{ backgroundColor: 'rgba(186,26,26,0.08)', color: '#ba1a1a' }}
                  >
                    {COPY.btn.block}
                  </button>
                </div>

                {match.sessionId && onOpenSession && (
                  <button
                    type="button"
                    onClick={() => onOpenSession(match.sessionId!)}
                    className="w-full mt-2 py-3 rounded-xl text-xs font-bold transition-colors"
                    style={{ backgroundColor: 'rgba(43,138,239,0.1)', color: '#2B8AEF' }}
                  >
                    查看对话记录
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(match)}
                  className="w-full mt-2 py-3 rounded-xl text-xs font-bold transition-colors"
                  style={{ backgroundColor: '#E8F4FF', color: '#121c28' }}
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
