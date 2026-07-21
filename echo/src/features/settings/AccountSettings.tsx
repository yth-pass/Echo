/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle, Smartphone, User, AlertTriangle, Pencil, Loader2, Check } from 'lucide-react';
import { getProfile, updateProfile, type ProfileData } from '../../api/settings';

function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

export function AccountSettings({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const r = await getProfile();
      if (r.ok) setProfile(r.data);
      // 尝试从 localStorage 获取 userId 关联的手机号（AuthShell 不存 phone，暂用脱敏占位）
      // 实际项目中可通过 GET /auth/me 获取 phone
      const { apiGetJson } = await import('../../api/client');
      const meResult = await apiGetJson<{ phone?: string }>('/auth/me');
      if (meResult.ok) setPhone(meResult.data.phone ?? null);
    })();
  }, []);

  const saveDisplayName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setNameSaving(true);
    const r = await updateProfile({ displayName: trimmed });
    setNameSaving(false);
    if (r.ok) {
      setProfile((prev) => prev ? { ...prev, displayName: trimmed } : prev);
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1500);
    }
  }, [nameDraft]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="fixed inset-0 z-[100] flex justify-center"
    >
      <div className="w-full max-w-[375px] flex flex-col h-full relative" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14" style={{ borderBottom: '1px solid #d9e3f4' }}>
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl active:opacity-80" style={{ color: '#121c28' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold" style={{ color: '#121c28' }}>账号与安全</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* 手机号 */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs" style={{ color: '#7b7487' }}>绑定手机号</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#121c28' }}>{maskPhone(phone)}</p>
            </div>
            <div className="flex items-center gap-1" style={{ color: '#2e7d32' }}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-[10px] font-medium">已验证</span>
            </div>
          </div>
        </div>

        {/* 昵称 */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: '#7b7487' }}>昵称</p>
              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveDisplayName(); }}
                    maxLength={20}
                    placeholder="输入昵称"
                    className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    style={{ backgroundColor: '#E8F4FF', border: '1px solid #d9e3f4', color: '#121c28' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void saveDisplayName()}
                    disabled={nameSaving || !nameDraft.trim()}
                    className="p-1.5 rounded-lg active:opacity-80 disabled:opacity-50 transition-all"
                    style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
                  >
                    {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(profile?.displayName ?? '');
                    setEditingName(true);
                  }}
                  className="flex items-center gap-1.5 mt-0.5 group"
                >
                  <p className="text-sm font-bold" style={{ color: '#121c28' }}>{profile?.displayName || '未设置'}</p>
                  <Pencil className="w-3.5 h-3.5" style={{ color: '#7b7487' }} />
                  {nameSaved && <span className="text-[10px] ml-1" style={{ color: '#2e7d32' }}>已保存</span>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 登录方式 */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
          <p className="text-xs mb-2" style={{ color: '#7b7487' }}>登录方式</p>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs rounded-lg font-medium" style={{ backgroundColor: 'rgba(43,138,239,0.1)', color: '#2B8AEF' }}>
              短信验证码
            </span>
          </div>
          <p className="text-[10px] mt-2" style={{ color: '#7b7487' }}>
            当前通过手机验证码登录，无需密码
          </p>
        </div>

        {/* 注销账号 */}
        <div className="pt-6">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: 'rgba(186,26,26,0.08)', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.15)' }}
          >
            <AlertTriangle className="w-5 h-5" />
            注销账号
          </button>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-8">
          <div className="rounded-3xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: '#ba1a1a' }} />
              <p className="text-base font-bold" style={{ color: '#121c28' }}>确认注销账号？</p>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#7b7487' }}>
                注销后你的所有数据（个人资料、分身、匹配记录）将被永久删除，且无法恢复。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all"
                style={{ backgroundColor: '#E8F4FF', color: '#121c28' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  // MVP: 提示联系客服
                  setShowDeleteConfirm(false);
                  alert('如需注销账号，请联系客服：support@echo.app');
                }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all"
                style={{ backgroundColor: '#ba1a1a', color: '#ffffff' }}
              >
                确认注销
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </motion.div>
  );
}
