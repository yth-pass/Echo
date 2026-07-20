/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 画像碎片揭晓覆盖层 — 每 5 张卡后短暂展示
 */

import { motion } from 'motion/react';
import { LottieLoader } from '../../../../components/LottieLoader';

export function PersonaFragment({
  key,
  text,
  onDismiss,
}: {
  key?: string;
  text: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(6px)' }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
        className="max-w-xs text-center"
      >
        <div className="flex justify-center mb-1">
          <LottieLoader size={384} />
        </div>
        <p className="text-base font-bold leading-relaxed tracking-wide" style={{ color: '#121c28' }}>{text}</p>
        <p className="text-sm font-bold mt-1" style={{ color: '#7b7487' }}>轻触继续</p>
      </motion.div>
    </motion.div>
  );
}
