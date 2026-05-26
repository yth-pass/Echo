/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { Match } from '../../types';
import { getApiBaseUrl } from '../../api/client';
import { respondHandoff } from '../../api/handoff';
import { loadSessionMessages, type SessionMessage } from '../../api/session';
import type { SessionMessagesSource } from '../../api/session';
import { SessionChatMessages } from '../session/SessionChatMessages';

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
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSource, setMsgSource] = useState<SessionMessagesSource | 'idle'>('idle');
  const hasApi = Boolean(getApiBaseUrl());

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

  const acceptHandoff = async () => {
    if (!hasApi || !match.handoffId) {
      onBack();
      return;
    }
    const res = await respondHandoff(match.handoffId, true);
    setHandoffStatus(res?.status ?? 'accepted');
  };

  const showMockStaticDialogue = !hasApi;

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
            <p className="text-4xl font-bold text-echo-blue">{match.affinity}%</p>
            <p className="text-[10px] text-echo-blue/50 uppercase tracking-tighter">契合度报告</p>
          </div>
        </div>

        <div className="px-6 py-8 space-y-8">
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 text-left">分身契合理由</h4>
            <div className="space-y-3 text-left">
              {match.matchReasons.map((reason, i) => (
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
            <p className="text-gray-400 leading-relaxed text-sm">{match.bio}</p>
          </section>

          <section className="text-left">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 text-left">分身对话精选</h4>
            {showMockStaticDialogue ? (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-400/90 mb-2">演示对话（Mock）</p>
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
                    ? '暂无分身对话，请确认 worker 已运行 match-daily / agent-turn'
                    : '尚未建立分身会话'
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
                忽略
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
                拉黑
              </button>
            )}
          </div>
        )}
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
            onClick={() => void acceptHandoff()}
            className="flex-[2] py-4 bg-echo-blue text-echo-dark rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.4)]"
          >
            <Heart className="w-5 h-5 fill-current" />
            {handoffStatus ? `已${handoffStatus}` : '开启真实联络'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
