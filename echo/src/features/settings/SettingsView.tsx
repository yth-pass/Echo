/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ChevronRight,
  Flag,
  Heart,
  LogOut,
  ShieldCheck,
  UserCircle,
  Users,
  Zap,
} from 'lucide-react';
import { Header } from '../shell/Header';
import { clearTokens, clearProactiveRefresh } from '../../api/auth';
import { clearAvatarCache } from '../../api/settings';
import { clearOnboardingSession } from '../onboarding/v2/useOnboardingSession';
import { ReportSheet } from '../report/ReportSheet';
import { getProfile, useAvatar, type ProfileData } from '../../api/settings';
import { triggerMatch } from '../../api/match';

function genderLabel(g: string | undefined | null): string {
  if (g === 'male') return '男生';
  if (g === 'female') return '女生';
  return '不限';
}

function prefsSummary(prefs: ProfileData['matchPrefs']): string {
  if (!prefs) return '未设置';
  const parts: string[] = [];
  if (prefs.relationshipIntent) parts.push(prefs.relationshipIntent);
  if (prefs.preferredGender) parts.push(genderLabel(prefs.preferredGender));
  if (prefs.preferredAgeBand) {
    const bands = Array.isArray(prefs.preferredAgeBand)
      ? prefs.preferredAgeBand
      : [prefs.preferredAgeBand];
    if (bands.length > 0) parts.push(bands.join('、') + '岁');
  }
  return parts.length > 0 ? parts.join(' · ') : '未设置';
}

function privacySummary(p: ProfileData['privacy']): string {
  if (!p) return '关闭';
  const items: string[] = [];
  if (p.hideOnlineStatus) items.push('隐藏在线');
  if (p.hideFromDiscovery) items.push('暂停匹配');
  if (items.length === 0) return '关闭';
  return items.join('、');
}

function identitySummary(p: ProfileData | null): string {
  if (!p) return '查看注册信息';
  const id = p.identity;
  if (!id) return '查看注册信息';
  const parts: string[] = [];
  const genderMap: Record<string, string> = {
    male: '男', female: '女', nonbinary: '非二元', unspecified: '未填写',
  };
  if (id.genderIdentity) parts.push(genderMap[id.genderIdentity] ?? id.genderIdentity);
  if (id.currentCity) parts.push(id.currentCity);
  if (id.occupation) parts.push(id.occupation);
  return parts.length > 0 ? parts.join(' · ') : '查看注册信息';
}

export function SettingsView({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [showReport, setShowReport] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const avatarSrc = useAvatar();

  const loadProfile = useCallback(async () => {
    const r = await getProfile();
    if (r.ok) setProfile(r.data);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <div className="pb-24">
      <Header title="设置" />

      {/* ── 头像区 ── */}
      <button
        type="button"
        onClick={() => navigate('/settings/avatar')}
        className="mt-6 mx-5 w-[calc(100%-2.5rem)] bg-echo-card rounded-3xl p-5 flex items-center gap-4 border border-white/5 active:opacity-80 transition-opacity"
      >
        <div className="relative shrink-0">
          <img
            src={avatarSrc}
            alt="avatar"
            className="w-16 h-16 rounded-full object-cover bg-white/5"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-echo-blue flex items-center justify-center">
            <Camera className="w-3 h-3 text-echo-dark" />
          </div>
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-bold truncate">
            {profile?.displayName ?? '我的头像'}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">点击更换头像</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
      </button>

      {/* ── 设置项 ── */}
      <div className="mt-4 px-5 space-y-2">
        {([
          {
            icon: <UserCircle className="w-5 h-5" />,
            label: '基础信息',
            value: identitySummary(profile),
            path: '/settings/identity',
          },
          {
            icon: <Users className="w-5 h-5" />,
            label: '匹配偏好',
            value: prefsSummary(profile?.matchPrefs),
            path: '/settings/prefs',
          },
          {
            icon: <ShieldCheck className="w-5 h-5" />,
            label: '账号与安全',
            value: '手机号已验证',
            path: '/settings/account',
          },
          {
            icon: <Heart className="w-5 h-5" />,
            label: '隐私模式',
            value: privacySummary(profile?.privacy),
            path: '/settings/privacy',
          },
        ] as const).map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className="w-full bg-echo-card p-4 rounded-2xl flex items-center justify-between border border-white/5 text-left active:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-xl text-gray-400">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.value}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        ))}

        {/* 举报与反馈 */}
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="w-full bg-echo-card p-4 rounded-2xl flex items-center justify-between border border-white/5 text-left active:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-xl text-gray-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">举报与反馈</p>
              <p className="text-[10px] text-gray-500">举报动态、评论或分身行为</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* [Dev] 手动触发匹配 */}
        <button
          type="button"
          disabled={triggerStatus === 'loading'}
          onClick={async () => {
            setTriggerStatus('loading');
            const ok = await triggerMatch();
            setTriggerStatus(ok ? 'ok' : 'err');
            setTimeout(() => setTriggerStatus('idle'), 3000);
          }}
          className="w-full bg-amber-500/10 p-4 rounded-2xl flex items-center justify-between border border-amber-500/20 text-left active:opacity-80 transition-opacity disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300">手动触发匹配</p>
              <p className="text-[10px] text-amber-500/70">
                {triggerStatus === 'idle' && '跳过时间窗口，立即执行匹配'}
                {triggerStatus === 'loading' && '正在触发…'}
                {triggerStatus === 'ok' && '已触发，等待 Worker 处理'}
                {triggerStatus === 'err' && '触发失败，检查 Worker 是否运行'}
              </p>
            </div>
          </div>
        </button>

        {/* 退出登录 */}
        <div className="pt-6">
          <button
            type="button"
            onClick={() => {
              clearProactiveRefresh();
              clearTokens();
              clearAvatarCache();
              clearOnboardingSession();
              onLogout();
            }}
            className="w-full p-4 bg-red-500/10 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-500/20 active:bg-red-500/20 transition-all"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </div>

      {showReport && <ReportSheet onClose={() => setShowReport(false)} />}
    </div>
  );
}
