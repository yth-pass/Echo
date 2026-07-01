/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, apiPostJson, unwrap, setAccessToken, getAccessToken, refreshAccessToken } from './client';

export type AuthSession = {
  accessToken: string;
  // 【缺陷7修复】refreshToken 不再持久化到 localStorage，依赖 httpOnly cookie（后端 TODO）。
  // 保留字段兼容现有类型引用，但前端不再存储。
  refreshToken?: string;
  userId: string;
  onboardingComplete: boolean;
  isNewUser: boolean;
  avatarUrl?: string | null;
  displayName?: string | null;
};

/**
 * 【缺陷7修复】保存 token：access token 存内存，userId 存 localStorage（非敏感）。
 * refresh token 不再存 localStorage，依赖后端 httpOnly cookie（后端 TODO）。
 */
export function saveTokens(tokens: { accessToken: string; refreshToken?: string; userId: string }) {
  // 【缺陷7修复】access token 存内存（模块级变量），不持久化
  setAccessToken(tokens.accessToken);
  // userId 非敏感，可保留 localStorage
  try {
    localStorage.setItem('echo_user_id', tokens.userId);
  } catch {
    /* ignore */
  }
  // 【缺陷7修复】refresh token 不存 localStorage（后端通过 Set-Cookie 设置 httpOnly cookie）
}

/** 清除所有认证状态：内存 token + localStorage userId。 */
export function clearTokens() {
  setAccessToken(null);
  try {
    localStorage.removeItem('echo_user_id');
  } catch {
    /* ignore */
  }
}

/** 获取内存中的 access token（缺陷7修复：不再读 localStorage）。 */
export function getStoredAccessToken(): string | null {
  return getAccessToken();
}

/** 获取 localStorage 中的 userId（非敏感，用于 fetchMe 回填）。 */
function getStoredUserId(): string | null {
  try {
    return localStorage.getItem('echo_user_id');
  } catch {
    return null;
  }
}

export async function registerPhone(phone: string) {
  const result = await apiPostJson<{ phone: string }, { userId: string; isNewUser?: boolean }>(
    '/auth/register',
    { phone },
  );
  return unwrap(result);
}

export async function requestOtp(phone: string): Promise<{ sent: boolean; error?: string }> {
  const result = await apiPostJson<{ phone: string }, { sent?: boolean }>('/auth/otp', {
    phone,
  });
  if (result.ok) {
    return { sent: result.data?.sent === true };
  }
  // 提取具体错误信息
  const err = result as { ok: false; status: number; message: string };
  if (err.status === 429) {
    return { sent: false, error: '发送过于频繁，请 60 秒后重试' };
  }
  if (err.status === 503) {
    return { sent: false, error: err.message || '短信服务暂时不可用，请稍后重试' };
  }
  if (err.status === 0) {
    return { sent: false, error: '网络连接失败，请检查网络' };
  }
  return { sent: false, error: err.message || '验证码发送失败' };
}

export async function loginWithOtp(phone: string, code: string): Promise<AuthSession | null> {
  // 后端返回 snake_case（access_token / user_id / onboarding_complete / is_new_user）
  // 前端 AuthSession 用 camelCase，这里做字段映射
  const result = await apiPostJson<
    { phone: string; code: string },
    { access_token?: string; user_id?: string; onboarding_complete?: boolean; is_new_user?: boolean }
  >('/auth/login', {
    phone,
    code,
  });
  const res = unwrap(result);
  if (res?.access_token) {
    const session: AuthSession = {
      accessToken: res.access_token,
      userId: res.user_id ?? '',
      onboardingComplete: res.onboarding_complete ?? false,
      isNewUser: res.is_new_user ?? false,
    };
    saveTokens(session);
    // 【缺陷9修复】登录成功后调度主动刷新
    scheduleProactiveRefresh();
    return session;
  }
  return null;
}

/**
 * 【缺陷7/缺陷3修复】refreshSession 使用 client.ts 的 refreshAccessToken（raw fetch，绕过 request()）。
 * 依赖 httpOnly cookie 传递 refresh token。成功后更新内存 access token。
 */
export async function refreshSession(): Promise<AuthSession | null> {
  const newToken = await refreshAccessToken();
  if (!newToken) return null;
  // refresh 成功后重新调度主动刷新
  scheduleProactiveRefresh();
  const userId = getStoredUserId() ?? '';
  return {
    accessToken: newToken,
    userId,
    onboardingComplete: true, // refresh 不改变 onboarding 状态
    isNewUser: false,
  };
}

/**
 * 【缺陷7修复】fetchMe：启动时检查登录态。
 * 无内存 access token 时直接返回 null（不再依赖 localStorage 持久化）。
 */
export async function fetchMe(signal?: AbortSignal): Promise<AuthSession | null> {
  const accessToken = getStoredAccessToken();
  if (!accessToken) return null;
  const result = await apiGetJson<{
    userId: string;
    phone?: string;
    onboardingComplete: boolean;
    isNewUser: boolean;
    avatarUrl?: string | null;
    displayName?: string | null;
  }>('/auth/me', signal);
  const res = unwrap(result);
  if (!res?.userId) return null;
  // 【缺陷9修复】fetchMe 成功说明 token 有效，调度主动刷新
  scheduleProactiveRefresh();
  return {
    accessToken,
    userId: res.userId,
    onboardingComplete: res.onboardingComplete,
    isNewUser: res.isNewUser,
    avatarUrl: res.avatarUrl ?? null,
    displayName: res.displayName ?? null,
  };
}

// ---------------------------------------------------------------------------
// 【缺陷9修复】主动刷新：access token 剩余 5 分钟时自动调 refreshSession。
// ---------------------------------------------------------------------------

/** 解析 JWT payload 中的 exp 字段（秒级 Unix 时间戳）。 */
function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // JWT payload 是 base64url，需转为 base64 再 atob
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (typeof payload.exp === 'number') return payload.exp * 1000; // 转毫秒
    return null;
  } catch {
    return null;
  }
}

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 【缺陷9修复】调度主动刷新：在 access token 过期前 5 分钟触发 refresh。
 * 登录成功 / fetchMe 成功 / refresh 成功后均应调用。
 */
export function scheduleProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  const token = getStoredAccessToken();
  if (!token) return;
  const expMs = parseJwtExp(token);
  if (!expMs) return; // 无法解析 exp，不调度
  const remainingMs = expMs - Date.now();
  const refreshAtMs = remainingMs - 5 * 60 * 1000; // 提前 5 分钟
  if (refreshAtMs <= 0) {
    // 已在 5 分钟内 → 立即刷新
    void refreshSession().then((s) => {
      if (s) scheduleProactiveRefresh();
    });
    return;
  }
  proactiveRefreshTimer = setTimeout(() => {
    void refreshSession().then((s) => {
      if (s) scheduleProactiveRefresh();
    });
  }, refreshAtMs);
}

/** 清除主动刷新定时器（登出时调用）。 */
export function clearProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}
