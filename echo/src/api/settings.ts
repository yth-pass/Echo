/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGetJson, apiPutJson, getApiBaseUrl, getAccessToken, type ApiResult } from './client';
import { loadCloneMe, updateCloneBoundaries, type CloneBoundaries } from './clone';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchPrefs {
  preferredGender?: string;
  preferredAgeBand?: string[];
  preferredCity?: string;
  preferredOccupation?: string[];
  relationshipIntent?: string;
}

export interface PrivacySettings {
  hideOnlineStatus?: boolean;
  hideFromDiscovery?: boolean;
  showReadReceipts?: boolean;
  autoMatchEnabled?: boolean;
}

/**
 * 社交边界（分身的 forbiddenWords + topicsToAvoid）。
 * 与 clone.ts 的 CloneBoundaries 同构，此处别名复用避免重复定义。
 */
export type SocialBoundaries = CloneBoundaries;

/** Phase 0 注册时填写的基础身份信息（bioJson.identity） */
export interface IdentityData {
  displayName?: string;
  preferredAddress?: string;
  genderIdentity?: string;
  ageBand?: string;
  hometownCity?: string;
  currentCity?: string;
  education?: string;
  occupation?: string;
  industry?: string;
  entrepreneurshipField?: string;
  workDescription?: string;
  keyLifeExperiences?: string[];
  selfIntroOneLiner?: string;
  goalOnEcho?: string;
  familyMembers?: { relation: string; brief: string }[];
  matchPreference?: {
    preferredGender?: string;
    preferredAgeBand?: string[];
    preferredCity?: string;
    preferredOccupation?: string[];
  };
}

export interface ProfileData {
  displayName: string | null;
  hasAvatar: boolean;
  birthYear: number | null;
  gender: string | null;
  city: string | null;
  matchPrefs: MatchPrefs | null;
  privacy: PrivacySettings | null;
  goalOnEcho?: string | null;
  identity?: IdentityData | null;
}

// ---------------------------------------------------------------------------
// Profile cache + 跨组件刷新事件
// ---------------------------------------------------------------------------
// 进入设置子页面（/settings/prefs 等）时 MainLayout 卸载、SettingsView state 丢失；
// 返回 /settings 时 SettingsView 重新挂载，重新拉取 /profile 期间会短暂显示"未设置"。
// 用模块级缓存保存上一次拉到的 profile，重挂载时秒显旧值，后台再刷新——消除信息闪烁。

let profileCache: ProfileData | null = null;

/** 读取缓存的 profile（SettingsView 重挂载时用作初始值）。 */
export function getCachedProfile(): ProfileData | null {
  return profileCache;
}

/** 写入 profile 缓存（loadProfile 成功后调用）。 */
export function setCachedProfile(p: ProfileData | null): void {
  profileCache = p;
}

const PROFILE_EVENT = 'echo-profile-updated';

/**
 * 通知 SettingsView 等消费方 profile 已变更（子页面保存成功后调用）。
 * SettingsView 监听此事件并重新 loadProfile；即使当前未挂载，
 * 重挂载时也会从缓存秒显 + 自动刷新，双重保障。
 */
export function notifyProfileUpdated(): void {
  try { window.dispatchEvent(new CustomEvent(PROFILE_EVENT)); } catch { /* SSR */ }
}

// ---------------------------------------------------------------------------
// Avatar localStorage cache（按 userId 缓存 Base64 Data URI，登录时秒显）
// ---------------------------------------------------------------------------

function avatarCacheKey(): string {
  const uid = (() => { try { return localStorage.getItem('echo_user_id'); } catch { return null; } })();
  return uid ? `echo_avatar_${uid}` : 'echo_avatar_cache';
}

/** 写入头像缓存（上传成功或 getAvatar 成功后调用） */
export function cacheAvatar(url: string): void {
  try { localStorage.setItem(avatarCacheKey(), url); } catch { /* quota */ }
}

/** 读取头像缓存（SettingsView 秒显用） */
export function getCachedAvatar(): string | null {
  try { return localStorage.getItem(avatarCacheKey()); } catch { return null; }
}

/** 清除头像缓存（删除头像或登出时调用） */
export function clearAvatarCache(): void {
  try { localStorage.removeItem(avatarCacheKey()); } catch { /* ignore */ }
}

export interface UpdateProfilePayload {
  displayName?: string;
  matchPrefs?: MatchPrefs;
  privacy?: PrivacySettings;
  identity?: Partial<IdentityData>;
}

// ---------------------------------------------------------------------------
// Profile API
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<ApiResult<ProfileData>> {
  const r = await apiGetJson<ProfileData>('/profile');
  if (!r.ok) return r;
  // 降级合并：若 matchPrefsJson 缺字段，从 Phase 0 的 bioJson.identity.matchPreference 补齐。
  // 这样即使后端 matchPrefsJson 未写入（旧用户），前端也能正常显示注册时的偏好。
  const data = r.data;
  const idMatchPref = data.identity?.matchPreference;
  if (idMatchPref) {
    const cur = data.matchPrefs ?? {};
    data.matchPrefs = {
      preferredGender: cur.preferredGender ?? idMatchPref.preferredGender,
      preferredAgeBand: cur.preferredAgeBand ?? idMatchPref.preferredAgeBand,
      preferredCity: cur.preferredCity ?? idMatchPref.preferredCity,
      preferredOccupation: cur.preferredOccupation ?? idMatchPref.preferredOccupation,
      relationshipIntent: cur.relationshipIntent,
    };
    if (!data.matchPrefs.relationshipIntent && data.goalOnEcho) {
      data.matchPrefs.relationshipIntent = data.goalOnEcho;
    }
  }
  return { ok: true, data };
}

export async function updateProfile(
  data: UpdateProfilePayload,
): Promise<ApiResult<ProfileData>> {
  return apiPutJson<UpdateProfilePayload, ProfileData>('/profile', data);
}

// ---------------------------------------------------------------------------
// Avatar API（使用 raw fetch + FormData，不走 client.ts 的 request()）
// ---------------------------------------------------------------------------

export async function uploadAvatar(
  file: File,
): Promise<ApiResult<{ avatarUrl: string }>> {
  const base = getApiBaseUrl();
  if (!base) return { ok: false, status: -1, message: 'no-base' };

  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // 不设置 Content-Type，让浏览器自动添加 boundary

  try {
    const res = await fetch(`${base}/avatar`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        if (typeof err?.message === 'string') detail = err.message;
      } catch { /* ignore */ }
      return { ok: false, status: res.status, message: detail };
    }

    const data = (await res.json()) as { avatarUrl: string };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: 'network' };
  }
}

export async function getAvatar(): Promise<ApiResult<{ avatarUrl: string | null }>> {
  return apiGetJson<{ avatarUrl: string | null }>('/avatar');
}

export async function deleteAvatar(): Promise<ApiResult<{ removed: boolean }>> {
  const base = getApiBaseUrl();
  if (!base) return { ok: false, status: -1, message: 'no-base' };

  const token = getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${base}/avatar`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      return { ok: false, status: res.status, message: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { removed: boolean };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: 'network' };
  }
}

// ---------------------------------------------------------------------------
// Cross-component avatar sync（自定义事件 + useAvatar hook）
// ---------------------------------------------------------------------------

const AVATAR_EVENT = 'echo-avatar-updated';

/** 通知所有 useAvatar 消费者头像已变更（上传/删除后调用） */
export function notifyAvatarChanged(): void {
  try { window.dispatchEvent(new CustomEvent(AVATAR_EVENT)); } catch { /* SSR */ }
}

/**
 * React hook：返回当前头像 URL（缓存优先），自动监听跨组件更新。
 * 用于 Header、SettingsView、CloneView 等所有显示头像的地方。
 */
export function useAvatar(fallback?: string): string {
  const DICEBEAR = fallback ?? 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix';

  const [src, setSrc] = useState<string>(() => getCachedAvatar() ?? DICEBEAR);

  const refresh = useCallback(() => {
    setSrc(getCachedAvatar() ?? DICEBEAR);
  }, [DICEBEAR]);

  useEffect(() => {
    refresh();
    window.addEventListener(AVATAR_EVENT, refresh);
    return () => window.removeEventListener(AVATAR_EVENT, refresh);
  }, [refresh]);

  return src;
}

// ---------------------------------------------------------------------------
// Social Boundaries API（包装 clone.ts，供 PrivacySettings / SocialBoundariesSettings 使用）
// ---------------------------------------------------------------------------

/** 读取当前分身的社交边界（GET /clones/me → boundaries）。 */
export async function getSocialBoundaries(): Promise<ApiResult<SocialBoundaries>> {
  try {
    const me = await loadCloneMe();
    if (!me) return { ok: false, status: -1, message: 'no-clone' };
    return { ok: true, data: me.boundaries ?? { forbiddenWords: [], topicsToAvoid: null } };
  } catch {
    return { ok: false, status: 0, message: 'network' };
  }
}

/** 保存社交边界（PUT /clones/me { boundaries }）。 */
export async function saveSocialBoundaries(
  b: SocialBoundaries,
): Promise<ApiResult<SocialBoundaries>> {
  try {
    const me = await updateCloneBoundaries(b);
    if (!me) return { ok: false, status: -1, message: 'no-clone' };
    return { ok: true, data: me.boundaries ?? b };
  } catch {
    return { ok: false, status: 0, message: 'network' };
  }
}

/** 社交边界摘要（用于设置列表展示）。 */
export function boundariesSummary(b: SocialBoundaries | null | undefined): string {
  if (!b) return '未设置';
  const words = b.forbiddenWords?.length ?? 0;
  const topics = b.topicsToAvoid?.trim();
  if (words === 0 && !topics) return '未设置';
  const parts: string[] = [];
  if (words > 0) parts.push(`${words} 个禁忌词`);
  if (topics) parts.push('已设回避话题');
  return parts.join(' · ');
}
