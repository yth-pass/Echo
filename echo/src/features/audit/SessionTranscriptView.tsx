/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Loader2, MoreVertical, X } from 'lucide-react';
import { loadSessionMessages, requestEndChat, type SessionMessage } from '../../api/session';
import type { SessionMessagesSource } from '../../api/session';
import { SessionChatMessages } from '../session/SessionChatMessages';
import { ReportSheet } from '../report/ReportSheet';
import { COPY } from '../../copy';

export function SessionTranscriptView({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<SessionMessagesSource | 'idle'>('idle');
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [windDownReason, setWindDownReason] = useState<string | null>(null);

  const [showReport, setShowReport] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* End-chat dialog */
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [endSuccess, setEndSuccess] = useState(false);

  /* Animation trigger: true on first load only */
  const [animate, setAnimate] = useState(false);

  const fetchData = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    void loadSessionMessages(sessionId).then((res) => {
      if (!cancelled) {
        setMessages(res.messages);
        setSource(res.source);
        setSessionStatus(res.sessionStatus ?? 'active');
        setWindDownReason(res.windDownReason ?? null);
        setLoading(false);
        /* Only animate on first successful load */
        setAnimate((prev) => !prev ? true : prev);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleEndChat = async () => {
    const reason = endReason.trim();
    if (!reason) return;
    setEndSubmitting(true);
    setEndError(null);
    const result = await requestEndChat(sessionId, reason);
    setEndSubmitting(false);
    if (result.ok) {
      setEndSuccess(true);
      setSessionStatus('wind_down');
      setWindDownReason(reason);
      setTimeout(() => setShowEndDialog(false), 1500);
    } else {
      setEndError(result.message ?? '请求失败');
    }
  };

  const isWindDown = sessionStatus === 'wind_down';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed inset-0 bg-echo-dark z-[110] flex flex-col"
    >
      {/* Header */}
      <div className="p-4 glass flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-gray-400 text-sm">
          返回
        </button>
        <h2 className="font-bold text-sm">分身对话记录</h2>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-echo-card border border-white/10 shadow-lg overflow-hidden z-50"
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowReport(true);
                }}
                className="w-full px-4 py-2.5 text-left text-xs text-gray-300 hover:bg-white/5 transition-colors"
              >
                举报
              </button>
              {sessionStatus === 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setShowEndDialog(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {COPY.endChat.title}
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Wind-down banner */}
      {isWindDown && (
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400/90">
            {COPY.endChat.bannerText}
            {windDownReason && (
              <span className="text-amber-400/60"> — {windDownReason}</span>
            )}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        <SessionChatMessages
          messages={messages}
          loading={loading}
          source={source === 'idle' ? undefined : source}
          emptyHint={COPY.empty.transcript}
          animate={animate}
        />
      </div>

      {/* End-chat dialog */}
      {showEndDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-[calc(100%-3rem)] max-w-sm mx-auto bg-echo-card border border-white/10 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">{COPY.endChat.title}</h3>
              <button
                type="button"
                onClick={() => !endSubmitting && setShowEndDialog(false)}
                className="text-gray-400 hover:text-white"
                disabled={endSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs text-gray-400">{COPY.endChat.reasonLabel}</label>
            <textarea
              value={endReason}
              onChange={(e) => setEndReason(e.target.value)}
              placeholder={COPY.endChat.reasonPlaceholder}
              rows={3}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-echo-blue/50 resize-none"
              disabled={endSubmitting || endSuccess}
            />
            {endError && <p className="text-xs text-red-400">{endError}</p>}
            {endSuccess && (
              <p className="text-xs text-green-400">{COPY.endChat.success}</p>
            )}
            <button
              type="button"
              onClick={() => void handleEndChat()}
              disabled={endSubmitting || endSuccess || !endReason.trim()}
              className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-sm font-bold text-red-400 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {endSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中…
                </>
              ) : endSuccess ? (
                COPY.endChat.success
              ) : (
                COPY.endChat.confirm
              )}
            </button>
          </motion.div>
        </div>
      )}

      {showReport && (
        <ReportSheet
          initialTargetType="session"
          initialTargetId={sessionId}
          onClose={() => setShowReport(false)}
        />
      )}
    </motion.div>
  );
}
