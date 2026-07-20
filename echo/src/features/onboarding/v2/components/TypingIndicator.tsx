/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "对方正在输入..." 三点跳动动画
 */

import { motion } from 'motion/react';

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <span className="text-xs mr-1" style={{ color: '#7b7487' }}>对方正在输入</span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#2B8AEF' }}
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
