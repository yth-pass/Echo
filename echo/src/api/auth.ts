/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiGetJson, apiPostJson } from './client';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  onboardingComplete: boolean;
  isNewUser: boolean;
};

export function saveTokens(tokens: Pick<AuthSession, 'accessToken' | 'refreshToken' | 'userId'>) {
  localStorage.setItem('echo_access_token', tokens.accessToken);
  localStorage.setItem('echo_refresh_token', tokens.refreshToken);
  localStorage.setItem('echo_user_id', tokens.userId);
}

export function clearTokens() {
  localStorage.removeItem('echo_access_token');
  localStorage.removeItem('echo_refresh_token');
  localStorage.removeItem('echo_user_id');
}

export function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem('echo_access_token');
  } catch {
    return null;
  }
}

export async function registerPhone(phone: string) {
  return apiPostJson<{ phone: string }, { userId: string; isNewUser?: boolean }>(
    '/auth/register',
    { phone },
  );
}

export async function requestOtp(phone: string): Promise<boolean> {
  const res = await apiPostJson<{ phone: string }, { sent?: boolean }>('/auth/otp', {
    phone,
  });
  return res?.sent === true;
}

export async function loginWithOtp(phone: string, code: string): Promise<AuthSession | null> {
  const res = await apiPostJson<{ phone: string; code: string }, AuthSession>('/auth/login', {
    phone,
    code,
  });
  if (res?.accessToken) {
    saveTokens(res);
    return res;
  }
  return null;
}

export async function fetchMe(): Promise<AuthSession | null> {
  const res = await apiGetJson<{
    userId: string;
    phone?: string;
    onboardingComplete: boolean;
    isNewUser: boolean;
  }>('/auth/me');
  if (!res?.userId) return null;
  const accessToken = getStoredAccessToken();
  const refreshToken = localStorage.getItem('echo_refresh_token') ?? '';
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken,
    userId: res.userId,
    onboardingComplete: res.onboardingComplete,
    isNewUser: res.isNewUser,
  };
}
