/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionMessage } from '../../api/session';
import type { SessionMessagesSource } from '../../api/session';

export function SessionChatMessages({
  messages,
  loading,
  source,
  emptyHint,
}: {
  messages: SessionMessage[];
  loading?: boolean;
  source?: SessionMessagesSource | 'idle';
  emptyHint?: string;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500 text-center py-4">加载对话中…</p>;
  }
  if (source === 'error') {
    return (
      <p className="text-sm text-red-400 text-center py-4">无法加载对话，请检查 API 与登录</p>
    );
  }
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        {emptyHint ?? '暂无消息'}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {source === 'mock' && (
        <p className="text-[10px] text-amber-400/90 text-center mb-2">演示对话（Mock）</p>
      )}
      {messages.map((m) => (
        <div
          key={m.id || `turn-${m.turn_index}`}
          className={`p-3 rounded-xl border border-white/5 ${
            m.is_self
              ? 'bg-echo-blue/5 border-r-2 border-echo-blue text-right ml-8'
              : 'bg-white/5 border-l-2 border-echo-blue text-left mr-8'
          }`}
        >
          <p className={`text-[10px] mb-1 ${m.is_self ? 'text-echo-blue/50' : 'text-gray-500'}`}>
            {m.speaker_name ?? (m.is_self ? '我的分身' : '对方分身')}：
          </p>
          <p
            className={`text-sm leading-relaxed italic ${
              m.is_self ? 'text-echo-blue/80' : 'text-gray-300'
            }`}
          >
            “{m.content}”
          </p>
        </div>
      ))}
    </div>
  );
}
