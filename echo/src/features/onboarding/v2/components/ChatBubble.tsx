/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 微信式消息气泡 — Phase 2 聊天界面
 */

import { motion } from 'motion/react';

export function ChatBubble({
  role,
  text,
  avatarText,
  avatarColor,
}: {
  role: 'user' | 'assistant';
  text: string;
  avatarText?: string;
  avatarColor?: string;
}) {
  const isUser = role === 'user';
  const showAvatar = !isUser && avatarText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {showAvatar && (
        <div
          className="w-7 h-7 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-white text-xs font-semibold"
          style={{ backgroundColor: avatarColor ?? '#2B8AEF' }}
        >
          {avatarText}
        </div>
      )}
      <div
        className="max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
        style={
          isUser
            ? { backgroundColor: '#2B8AEF', color: '#ffffff', borderBottomRightRadius: '6px' }
            : { backgroundColor: '#ffffff', color: '#121c28', border: '1px solid #d9e3f4', borderBottomLeftRadius: '6px' }
        }
      >
        {text}
      </div>
    </motion.div>
  );
}
