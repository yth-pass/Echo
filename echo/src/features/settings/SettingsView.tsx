/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Camera,
  ChevronRight,
  Flag,
  Heart,
  LogOut,
  ShieldCheck,
  UserCircle,
  Users,
} from 'lucide-react';
import { Header } from '../shell/Header';
import { clearTokens, clearProactiveRefresh } from '../../api/auth';
import { clearAvatarCache } from '../../api/settings';
import { clearOnboardingSession } from '../onboarding/v2/useOnboardingSession';
import { ReportSheet } from '../report/ReportSheet';
import {
  getProfile,
  useAvatar,
  getCachedProfile,
  setCachedProfile,
  type ProfileData,
} from '../../api/settings';

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

export function SettingsView({ onLogout, headerRight }: { onLogout: () => void; headerRight?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showReport, setShowReport] = useState(false);
  // 【信息消失修复】用模块级缓存初始化：从子页面返回重挂载时秒显上次的 profile，
  // 避免拉取 /profile 期间显示"未设置/关闭"的空闪烁。
  const [profile, setProfile] = useState<ProfileData | null>(() => getCachedProfile());
  const avatarSrc = useAvatar();

  const loadProfile = useCallback(async () => {
    const r = await getProfile();
    if (r.ok) {
      setProfile(r.data);
      setCachedProfile(r.data);
    }
  }, []);

  useEffect(() => {
    // 挂载时刷新；同时监听子页面保存成功后派发的 echo-profile-updated 事件。
    // location.pathname 入依赖：从子页面返回 /settings 时确保重新拉取最新值。
    void loadProfile();
    const handler = () => void loadProfile();
    window.addEventListener('echo-profile-updated', handler);
    return () => window.removeEventListener('echo-profile-updated', handler);
  }, [loadProfile, location.pathname]);

  return (
    <div className="pb-24">
      <Header title="设置" rightSlot={headerRight} />

      {/* ── 头像区 ── */}
      <button
        type="button"
        onClick={() => navigate('/settings/avatar')}
        className="mt-6 mx-5 w-[calc(100%-2.5rem)] rounded-3xl p-5 flex items-center gap-4 active:opacity-80 transition-opacity"
        style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}
      >
        <div className="relative shrink-0">
          <img
            src={avatarSrc}
            alt="avatar"
            className="w-16 h-16 rounded-full object-cover"
            style={{ backgroundColor: '#E8F4FF' }}
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2B8AEF' }}>
            <Camera className="w-3 h-3 text-white" />
          </div>
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: '#121c28' }}>
            {profile?.displayName ?? '我的头像'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#7b7487' }}>点击更换头像</p>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#7b7487' }} />
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
            className="w-full p-4 rounded-2xl flex items-center justify-between text-left active:opacity-80 transition-opacity"
            style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#121c28' }}>{item.label}</p>
                <p className="text-[10px]" style={{ color: '#7b7487' }}>{item.value}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: '#7b7487' }} />
          </button>
        ))}

        {/* 举报与反馈 */}
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="w-full p-4 rounded-2xl flex items-center justify-between text-left active:opacity-80 transition-opacity"
          style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}>
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#121c28' }}>举报与反馈</p>
              <p className="text-[10px]" style={{ color: '#7b7487' }}>举报动态、评论或分身行为</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: '#7b7487' }} />
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
            className="w-full p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: 'rgba(186,26,26,0.08)', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.15)' }}
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
