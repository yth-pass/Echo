/**
 * EditWarningDialog — 首次修改已完成 phase 的提示弹窗
 *
 * 用户第一次跳回已完成 phase 修改时弹出，提醒后续阶段不会自动更新。
 * 同一用户只显示一次（localStorage 标记）。
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'echo_onboarding_edit_warning_shown';

interface EditWarningDialogProps {
  open: boolean;
  onClose: () => void;
}

export function EditWarningDialog({ open, onClose }: EditWarningDialogProps) {
  if (!open) return null;

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* silent */ }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(74, 68, 85, 0.4)' }}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 20px 60px rgba(74, 68, 85, 0.15)',
        }}
      >
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#4a4455' }}>
          提示
        </h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: '#7b7487' }}>
          修改这里只会更新当前阶段的数据，后面已生成的"人格画像""理想型画像"不会自动跟着更新。
          <br /><br />
          如果你想让后面的内容也反映这次修改，记得回到对应阶段重新生成。
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3 rounded-xl font-medium transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: '#9b8aff', color: '#fff' }}
        >
          我知道了
        </button>
      </div>
    </div>
  );
}

/** 工具函数：判断是否应该显示首次修改提示 */
export function shouldShowEditWarning(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true; // localStorage 不可用时始终显示
  }
}
