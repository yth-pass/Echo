/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { Match } from '../../types';
import { getApiBaseUrl } from '../../api/client';
import { fetchHandoff, respondHandoff } from '../../api/handoff';
import {
  loadSessionAffinity,
  loadSessionMessages,
  loadSessionRelationship,
  type SessionAffinity,
  type SessionMessage,
  type SessionRelationship,
} from '../../api/session';
import type { SessionMessagesSource } from '../../api/session';
import { SessionChatMessages } from '../session/SessionChatMessages';
import { ReportSheet } from '../report/ReportSheet';
import { COPY } from '../../copy';

const HANDOFF_THRESHOLD_PERCENT = 75;

function formatBio(bio: string): string {
  const t = bio.trim();
  if (!t || t === '{}') return COPY.empty.bio;
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      const parts = Object.values(o).filter((v): v is string => typeof v === 'string' && Boolean(v));
      if (parts.length) return parts.join(' · ');
    } catch {
      /* ignore */
    }
    return COPY.empty.bio;
  }
  return t;
}

function breakdownTurns(breakdown: unknown): number | null {
  if (breakdown && typeof breakdown === 'object' && 'turns' in breakdown) {
    const n = Number((breakdown as { turns: unknown }).turns);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function MatchDetailView({
  match,
  onBack,
  onDismiss,
  onBlock,
}: {
  match: Match;
  onBack: () => void;
  onDismiss?: (m: Match) => void;
  onBlock?: (m: Match) => void;
}) {
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [handoffResponding, setHandoffResponding] = useState(false);
  const [sessionAffinity, setSessionAffinity] = useState<SessionAffinity | null>(null);
  const [sessionRelationship, setSessionRelationship] = useState<SessionRelationship | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSource, setMsgSource] = useState<SessionMessagesSource | 'idle'>('idle');
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState<'user' | 'session' | 'manual'>('user');
  const hasApi = Boolean(getApiBaseUrl());

  const effectiveHandoffId = match.handoffId ?? sessionAffinity?.handoff?.id ?? null;
  const resolvedHandoffStatus = handoffStatus ?? sessionAffinity?.handoff?.status ?? null;

  const displayAffinityPercent = hasApi
    ? (sessionAffinity?.affinityPercent ?? match.affinity)
    : match.affinity;

  useEffect(() => {
    if (!hasApi || !match.sessionId) {
      setSessionAffinity(null);
      return;
    }
    let cancelled = false;
    void loadSessionAffinity(match.sessionId).then((a) => {
      if (!cancelled) setSessionAffinity(a);
    });
    return () => {
      cancelled = true;
    };
  }, [match.sessionId, hasApi]);

  useEffect(() => {
    if (!hasApi || !match.sessionId) {
      setSessionRelationship(null);
      return;
    }
    let cancelled = false;
    void loadSessionRelationship(match.sessionId).then((r) => {
      if (!cancelled) setSessionRelationship(r);
    });
    return () => {
      cancelled = true;
    };
  }, [match.sessionId, hasApi]);

  useEffect(() => {
    if (!hasApi || !match.handoffId) return;
    let cancelled = false;
    void fetchHandoff(match.handoffId).then((h) => {
      if (!cancelled && h?.status) setHandoffStatus(h.status);
    });
    return () => {
      cancelled = true;
    };
  }, [match.handoffId, hasApi]);

  useEffect(() => {
    if (!match.sessionId) {
      setMessages([]);
      setMsgSource('idle');
      return;
    }
    if (!hasApi) {
      void loadSessionMessages(match.sessionId).then(({ messages: m, source }) => {
        setMessages(m);
        setMsgSource(source);
      });
      return;
    }
    let cancelled = false;
    setMsgLoading(true);
    void loadSessionMessages(match.sessionId).then(({ messages: m, source }) => {
      if (!cancelled) {
        setMessages(m);
        setMsgSource(source);
        setMsgLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [match.sessionId, hasApi]);

  const respond = async (accept: boolean) => {
    if (!hasApi || !effectiveHandoffId) return;
    setHandoffResponding(true);
    const res = await respondHandoff(effectiveHandoffId, accept);
    setHandoffResponding(false);
    if (res?.status) setHandoffStatus(res.status);
  };

  const affinityReasons = useMemo(() => {
    if (!hasApi) return match.matchReasons;
    const turns = breakdownTurns(sessionAffinity?.breakdown) ?? messages.length;
    const reasons: string[] = [];
    if (turns > 0) reasons.push(`分身对话已进行 ${turns} 轮`);
    reasons.push(`当前会话好感度 ${displayAffinityPercent}%`);
    if (resolvedHandoffStatus === 'pending') {
      reasons.push('已达接力阈值，可确认真人联络');
    } else if (
      displayAffinityPercent >= HANDOFF_THRESHOLD_PERCENT &&
      !effectiveHandoffId
    ) {
      reasons.push('好感度较高，接力邀请生成中，请稍后刷新');
    } else if (displayAffinityPercent < HANDOFF_THRESHOLD_PERCENT) {
      reasons.push(`好感度未达接力阈值（需 ${HANDOFF_THRESHOLD_PERCENT}%）`);
    }
    return reasons.length ? reasons : match.matchReasons;
  }, [
    hasApi,
    match.matchReasons,
    sessionAffinity,
    messages.length,
    displayAffinityPercent,
    resolvedHandoffStatus,
    effectiveHandoffId,
  ]);

  const showMockStaticDialogue = !hasApi;
  const showMockHandoff = !hasApi;
  const handoffPending = resolvedHandoffStatus === 'pending';
  const handoffSettled =
    resolvedHandoffStatus === 'accepted' || resolvedHandoffStatus === 'declined';

  const renderHandoffActions = () => {
    if (showMockHandoff) {
      return (
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-4 bg-white/5 rounded-2xl font-bold text-gray-400 text-sm"
          >
            再观察一下
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex-[2] py-4 bg-echo-blue text-echo-dark rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <Heart className="w-5 h-5 fill-current" />
            开启真实联络
          </button>
        </div>
      );
    }
    if (effectiveHandoffId && handoffPending) {
      return (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void respond(false)}
            disabled={handoffResponding}
            className="flex-1 py-4 bg-white/5 rounded-2xl font-bold text-gray-400 text-sm disabled:opacity-50"
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={() => void respond(true)}
            disabled={handoffResponding}
            className="flex-[2] py-4 bg-echo-blue text-echo-dark rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.4)] disabled:opacity-50"
          >
            <Heart className="w-5 h-5 fill-current" />
            {handoffResponding ? COPY.loading.handoff : '接受真人联络'}
          </button>
        </div>
      );
    }
    if (effectiveHandoffId && handoffSettled) {
      return (
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-4 bg-white/5 rounded-2xl font-bold text-gray-400 text-sm"
          >
            返回
          </button>
          <button
            type="button"
            disabled
            className="flex-[2] py-4 bg-white/10 rounded-2xl font-bold text-gray-400 text-sm"
          >
            {resolvedHandoffStatus === 'accepted' ? '已接受联络' : '已拒绝联络'}
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 text-center">
          {displayAffinityPercent < HANDOFF_THRESHOLD_PERCENT
            ? `好感度未达接力阈值（演示约 ${HANDOFF_THRESHOLD_PERCENT}%）`
            : '接力邀请生成中，请稍后刷新或继续让分身对话'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-4 bg-white/5 rounded-2xl font-bold text-gray-400 text-sm"
        >
          返回
        </button>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed inset-0 bg-echo-dark z-[100] flex flex-col"
    >
      <div className="p-6 glass flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-gray-400">
          返回
        </button>
        <h2 className="font-bold">缘分详情</h2>
        <div className="w-4" />
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="relative h-64 flex items-end justify-center pb-8 border-b border-echo-blue/20 text-center">
          <div className="absolute inset-0 bg-gradient-to-t from-echo-blue/20 to-transparent" />
          <div className="relative flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-2 border-echo-blue p-1 echo-glow-blue mb-4">
              <img
                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${match.name}`}
                alt="match"
                className="w-full h-full rounded-full"
              />
            </div>
            <h3 className="text-2xl font-bold">{match.name}</h3>
            <div className="flex gap-2 mt-2">
              {match.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] bg-echo-blue/10 text-echo-blue px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="absolute top-4 right-6 text-right">
            <p className="text-4xl font-bold text-echo-blue">{displayAffinityPercent}%</p>
            <p className="text-[10px] text-echo-blue/50 uppercase tracking-tighter">
              {hasApi && sessionAffinity ? '会话好感度' : '契合度报告'}
            </p>
          </div>
        </div>

        {hasApi && sessionRelationship && (
          <div className="mx-6 -mt-2 mb-4 p-4 rounded-2xl bg-echo-card/60 border border-white/5 text-left text-xs text-gray-400">
            <div className="font-bold text-gray-300 mb-1">关系提示 · {sessionRelationship.label}</div>
            <div>信任：{sessionRelationship.hints.trust}</div>
            <div>张力：{sessionRelationship.hints.tension}</div>
            <div className="mt-1 text-[10px] opacity-70">熟悉度 {sessionRelationship.dimensions.familiarity} / 温暖 {sessionRelationship.dimensions.warmth}</div>
          </div>
        )}

        <div className="px-6 py-8 space-y-8">
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 text-left">分身契合理由</h4>
            <div className="space-y-3 text-left">
              {affinityReasons.map((reason, i) => (
                <div
                  key={i}
                  className="flex gap-3 bg-echo-card p-4 rounded-2xl border border-white/5"
                >
                  <Sparkles className="w-5 h-5 text-echo-blue shrink-0" />
                  <p className="text-sm text-gray-300">{reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="text-left">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 text-left">关于她 (真人摘要)</h4>
            <p className="text-gray-400 leading-relaxed text-sm">{formatBio(match.bio)}</p>
          </section>

          <section className="text-left">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 text-left">分身对话精选</h4>
            {showMockStaticDialogue ? (
              <div className="space-y-2">
                <div className="p-3 bg-white/5 rounded-xl border-l-2 border-echo-blue text-left">
                  <p className="text-[10px] text-gray-500 mb-1">{match.name}：</p>
                  <p className="text-sm italic text-gray-300">
                    “其实比起结局，我更在意那些在城市缝隙里独自看海的瞬间。”
                  </p>
                </div>
                <div className="p-3 bg-echo-blue/5 rounded-xl border-r-2 border-echo-blue text-right">
                  <p className="text-[10px] text-echo-blue/50 mb-1">我的分身：</p>
                  <p className="text-sm italic text-echo-blue/80">
                    “那种孤独感并非缺失，而是一种清醒。很高兴我们的「算法」捕捉到了这一点。”
                  </p>
                </div>
              </div>
            ) : (
              <SessionChatMessages
                messages={messages}
                loading={msgLoading}
                source={msgSource === 'idle' ? undefined : msgSource}
                emptyHint={
                  match.sessionId
                    ? COPY.empty.sessionUpcoming
                    : COPY.empty.noSessionStarted
                }
              />
            )}
          </section>
        </div>
      </div>

      <div className="p-6 pb-10 glass border-t border-white/10 space-y-3">
        {(onDismiss || onBlock) && (
          <div className="flex gap-2">
            {onDismiss && (
              <button
                type="button"
                onClick={() => {
                  onDismiss(match);
                  onBack();
                }}
                className="flex-1 py-3 bg-white/5 rounded-2xl font-bold text-gray-400 text-xs"
              >
                {COPY.btn.dismiss}
              </button>
            )}
            {onBlock && (
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(`确定拉黑「${match.name}」？对方将不再出现在匹配列表中。`)
                  ) {
                    return;
                  }
                  onBlock(match);
                  onBack();
                }}
                disabled={hasApi && !match.candidateUserId}
                className="flex-1 py-3 bg-red-500/10 rounded-2xl font-bold text-red-400 text-xs disabled:opacity-40"
              >
                {COPY.btn.block}
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setReportMode(match.candidateUserId ? 'user' : 'manual');
              setShowReport(true);
            }}
            disabled={hasApi && !match.candidateUserId}
            className="flex-1 py-3 bg-amber-500/10 rounded-2xl font-bold text-amber-400/90 text-xs disabled:opacity-40"
          >
            举报分身
          </button>
          {match.sessionId && (
            <button
              type="button"
              onClick={() => {
                setReportMode('session');
                setShowReport(true);
              }}
              className="flex-1 py-3 bg-amber-500/10 rounded-2xl font-bold text-amber-400/90 text-xs"
            >
              举报会话
            </button>
          )}
        </div>
        {renderHandoffActions()}
      </div>

      {showReport && reportMode === 'user' && match.candidateUserId && (
        <ReportSheet
          initialTargetType="user"
          initialTargetId={match.candidateUserId}
          onClose={() => setShowReport(false)}
        />
      )}
      {showReport && reportMode === 'session' && match.sessionId && (
        <ReportSheet
          initialTargetType="session"
          initialTargetId={match.sessionId}
          onClose={() => setShowReport(false)}
        />
      )}
      {showReport && reportMode === 'manual' && (
        <ReportSheet onClose={() => setShowReport(false)} />
      )}
    </motion.div>
  );
}
