/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { loadSessionMessages, type SessionMessage } from '../../api/session';
import type { SessionMessagesSource } from '../../api/session';
import { SessionChatMessages } from '../session/SessionChatMessages';
import { ReportSheet } from '../report/ReportSheet';

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
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadSessionMessages(sessionId).then(({ messages: m, source: s }) => {
      if (!cancelled) {
        setMessages(m);
        setSource(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed inset-0 bg-echo-dark z-[110] flex flex-col"
    >
      <div className="p-4 glass flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-gray-400 text-sm">
          返回
        </button>
        <h2 className="font-bold text-sm">分身对话记录</h2>
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="text-amber-400/90 text-xs font-bold"
        >
          举报
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <SessionChatMessages
          messages={messages}
          loading={loading}
          source={source === 'idle' ? undefined : source}
          emptyHint="暂无消息或会话尚未产生对话"
        />
      </div>

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
