/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 角色选择卡片 — Phase 2 角色选择屏
 */

import { motion } from 'motion/react';
import { Lock, Check } from 'lucide-react';
import type { RoleAgentDef } from '../onboarding-v2.types';

export function RoleCard({
  key,
  role,
  completed,
  unreadCount = 0,
  onClick,
}: {
  key?: string;
  role: RoleAgentDef;
  completed: boolean;
  unreadCount?: number;
  onClick: () => void;
}) {
  const available = role.availableInP0 && !completed;
  return (
    <motion.button
      type="button"
      whileTap={available ? { scale: 0.97 } : undefined}
      onClick={available ? onClick : undefined}
      disabled={!available}
      className="relative p-4 rounded-2xl border text-left transition-colors"
      style={
        completed
          ? { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' }
          : available
            ? { borderColor: '#d9e3f4', backgroundColor: '#ffffff' }
            : { borderColor: '#d9e3f4', backgroundColor: '#f8f9ff', opacity: 0.5, cursor: 'not-allowed' }
      }
    >
      {/* 头像 */}
      <div className="relative w-12 h-12 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
          style={
            completed
              ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }
              : { backgroundColor: role.avatarColor ?? '#2B8AEF' }
          }
        >
          {completed ? (
            <Check className="w-5 h-5" />
          ) : (
            role.avatarText ?? role.displayName[0]
          )}
        </div>
        {!completed && !role.availableInP0 && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f8f9ff', border: '1.5px solid #d9e3f4' }}
          >
            <Lock className="w-2.5 h-2.5" style={{ color: '#7b7487' }} />
          </div>
        )}
      </div>

      <p className="text-sm font-medium" style={{ color: '#121c28' }}>{role.displayName}</p>
      <p className="text-[11px] mt-0.5" style={{ color: '#7b7487' }}>{role.description}</p>

      {!role.availableInP0 && role.unlockLabel && (
        <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
          {role.unlockLabel}
        </span>
      )}

      {completed && (
        <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
          已完成
        </span>
      )}

      {!completed && unreadCount > 0 && (
        <span
          className="absolute top-2 right-2 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-medium text-white rounded-full px-1"
          style={{ backgroundColor: '#f43f5e' }}
        >
          {unreadCount}
        </span>
      )}
    </motion.button>
  );
}
