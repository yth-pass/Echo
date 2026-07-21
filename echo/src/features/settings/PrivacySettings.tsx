/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Radio, BookOpen, Loader2, Users, ShieldAlert, ChevronRight } from 'lucide-react';
import { getProfile, updateProfile, notifyProfileUpdated, getSocialBoundaries, boundariesSummary, type PrivacySettings as PrivacyData, type SocialBoundaries } from '../../api/settings';

interface ToggleItem {
  key: keyof PrivacyData;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** 反转语义：某些 toggle "开"表示隐藏（对应 true），描述需要清晰 */
  invertDescription?: string;
  /** 默认值为 true（当字段为 undefined 时视为 true） */
  defaultTrue?: boolean;
}

const TOGGLE_ITEMS: ToggleItem[] = [
  {
    key: 'hideOnlineStatus',
    label: '隐藏在线状态',
    description: '关闭后他人无法看到你当前是否在线',
    icon: <EyeOff className="w-5 h-5" />,
  },
  {
    key: 'hideFromDiscovery',
    label: '暂停匹配',
    description: '暂停后你不会出现在他人的匹配推荐中，已有匹配不受影响',
    icon: <Radio className="w-5 h-5" />,
  },
  {
    key: 'showReadReceipts',
    label: '已读回执',
    description: '开启后对方可以看到你是否已读消息',
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    key: 'autoMatchEnabled',
    label: '允许自动匹配',
    description: '开启后你的分身会自动与其他用户的分身聊天',
    icon: <Users className="w-5 h-5" />,
    defaultTrue: true,
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        disabled ? 'opacity-50' : ''
      }`}
      style={{ backgroundColor: checked ? '#2B8AEF' : '#d9e3f4' }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function PrivacySettings({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [privacy, setPrivacy] = useState<PrivacyData>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [boundaries, setBoundaries] = useState<SocialBoundaries | null>(null);

  useEffect(() => {
    void (async () => {
      // 并行拉取隐私设置 + 社交边界摘要
      const [pr, br] = await Promise.allSettled([getProfile(), getSocialBoundaries()]);
      if (pr.status === 'fulfilled' && pr.value.ok && pr.value.data.privacy) {
        setPrivacy(pr.value.data.privacy);
      }
      if (br.status === 'fulfilled' && br.value.ok) {
        setBoundaries(br.value.data);
      }
    })();
  }, []);

  const handleToggle = useCallback(
    async (key: keyof PrivacyData, value: boolean) => {
      const next = { ...privacy, [key]: value };
      setPrivacy(next);
      setSaving((s) => ({ ...s, [key]: true }));
      try {
        const r = await updateProfile({ privacy: next });
        if (r.ok) {
          notifyProfileUpdated();
        } else {
          // 回滚 UI
          setPrivacy(privacy);
        }
      } catch {
        setPrivacy(privacy);
      } finally {
        setSaving((s) => ({ ...s, [key]: false }));
      }
    },
    [privacy],
  );

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
        <h1 className="text-base font-bold" style={{ color: '#121c28' }}>隐私模式</h1>
      </div>

      {/* Toggle list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {TOGGLE_ITEMS.map((item) => {
          const rawValue = privacy[item.key];
          const checked = item.defaultTrue ? rawValue !== false : !!rawValue;
          return (
            <div
              key={item.key}
              className="rounded-2xl p-4"
              style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: '#121c28' }}>{item.label}</p>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: '#7b7487' }}>
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {saving[item.key] && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#7b7487' }} />
                  )}
                  <Toggle
                    checked={checked}
                    onChange={(v) => void handleToggle(item.key, v)}
                    disabled={saving[item.key]}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* 社交边界（编辑入口，非 toggle） */}
        <button
          type="button"
          onClick={() => navigate('/settings/boundaries')}
          className="w-full rounded-2xl p-4 flex items-center justify-between text-left active:opacity-80 transition-opacity"
          style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: '#121c28' }}>社交边界</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#7b7487' }}>
                {boundariesSummary(boundaries)}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#7b7487' }} />
        </button>

        {/* 黑名单管理（占位） */}
        <div className="rounded-2xl p-4 opacity-60" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#121c28' }}>黑名单管理</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#7b7487' }}>
                查看和管理已拉黑的用户
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  );
}