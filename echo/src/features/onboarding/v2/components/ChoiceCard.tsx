/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 选项卡片 — 单选按钮式选择，用于性别/年龄/教育/职业等
 */

import { motion } from 'motion/react';

export function ChoiceCard({
  key,
  label,
  selected,
  onClick,
  disabled,
}: {
  key?: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={
        selected
          ? {
              borderColor: '#2B8AEF',
              backgroundColor: 'rgba(43,138,239,0.08)',
              color: '#2B8AEF',
            }
          : {
              borderColor: 'transparent',
              backgroundColor: '#ffffff',
              color: '#121c28',
            }
      }
    >
      <span className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: selected ? '#2B8AEF' : '#d9e3f4' }}
        />
        {label}
      </span>
    </motion.button>
  );
}
