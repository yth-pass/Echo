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
      className="fixed inset-0 z-[110] flex flex-col"
      style={{ backgroundColor: '#f8f9ff' }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid #d9e3f4' }}
      >
        <button type="button" onClick={onBack} className="text-sm" style={{ color: '#7b7487' }}>
          返回
        </button>
        <h2 className="font-bold text-sm" style={{ color: '#121c28' }}>分身对话记录</h2>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#7b7487' }}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-1 w-36 rounded-xl shadow-lg overflow-hidden z-50 border"
              style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowReport(true);
                }}
                className="w-full px-4 py-2.5 text-left text-xs transition-colors"
                style={{ color: '#121c28' }}
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
                  className="w-full px-4 py-2.5 text-left text-xs transition-colors"
                  style={{ color: '#ba1a1a' }}
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
        <div className="px-5 py-2.5 flex items-center gap-2 border-b" style={{ backgroundColor: 'rgba(180,130,0,0.08)', borderColor: 'rgba(180,130,0,0.15)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'rgba(180,130,0,0.9)' }} />
          <p className="text-xs" style={{ color: 'rgba(180,130,0,0.9)' }}>
            {COPY.endChat.bannerText}
            {windDownReason && (
              <span style={{ color: 'rgba(180,130,0,0.6)' }}> — {windDownReason}</span>
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
            className="w-[calc(100%-3rem)] max-w-[375px] mx-auto rounded-2xl p-6 space-y-4 border"
            style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm" style={{ color: '#121c28' }}>{COPY.endChat.title}</h3>
              <button
                type="button"
                onClick={() => !endSubmitting && setShowEndDialog(false)}
                style={{ color: '#7b7487' }}
                disabled={endSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs" style={{ color: '#7b7487' }}>{COPY.endChat.reasonLabel}</label>
            <textarea
              value={endReason}
              onChange={(e) => setEndReason(e.target.value)}
              placeholder={COPY.endChat.reasonPlaceholder}
              rows={3}
              className="w-full rounded-xl p-3 text-sm focus:outline-none resize-none"
              style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderColor: '#d9e3f4', borderWidth: 1, color: '#121c28' }}
              disabled={endSubmitting || endSuccess}
            />
            {endError && <p className="text-xs" style={{ color: '#ba1a1a' }}>{endError}</p>}
            {endSuccess && (
              <p className="text-xs" style={{ color: '#2e7d32' }}>{COPY.endChat.success}</p>
            )}
            <button
              type="button"
              onClick={() => void handleEndChat()}
              disabled={endSubmitting || endSuccess || !endReason.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'rgba(186,26,26,0.12)', color: '#ba1a1a' }}
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
