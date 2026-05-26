/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { loadSessionMessages, type SessionMessage } from '../../api/resources';

export function SessionTranscriptView({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);

  useEffect(() => {
    void loadSessionMessages(sessionId).then(setMessages);
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
        <div className="w-8" />
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center">暂无消息或 API 未连接</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="p-3 rounded-xl bg-echo-card border border-white/5">
            <p className="text-[10px] text-gray-500 mb-1">轮次 {m.turn_index + 1}</p>
            <p className="text-sm text-gray-200 leading-relaxed">{m.content}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
