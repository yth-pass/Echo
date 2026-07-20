/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 入驻 session 存取 hook
 * localStorage 即时读写 + 防抖
 * key 按 userId 隔离，防止多用户同设备串台
 */

import { useCallback, useRef, useState } from 'react';
import type { OnboardingSession } from './onboarding-v2.types';

const STORAGE_KEY_PREFIX = 'onboarding_v2_session_';
const PHASE1_KEY_PREFIX = 'onboarding_phase1_responses_';

/** 无 userId 时的兜底 key（仅极端场景，正常流程不会走到） */
const FALLBACK_KEY = 'onboarding_v2_session';
const PHASE1_FALLBACK_KEY = 'onboarding_phase1_responses';

/** 所有 onboarding 相关的 localStorage key 前缀 / 精确 key，用于批量清理 */
const ALL_PREFIXES = [STORAGE_KEY_PREFIX, PHASE1_KEY_PREFIX, 'echo_phase2_'];
const ALL_FALLBACKS = [FALLBACK_KEY, PHASE1_FALLBACK_KEY, 'echo_onboarding_gender'];

function storageKey(userId: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}${userId}` : FALLBACK_KEY;
}

function readFromStorage(userId: string): OnboardingSession | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingSession;
  } catch {
    return null;
  }
}

function writeToStorage(userId: string, session: OnboardingSession): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(session));
  } catch {
    // localStorage full or unavailable — silent
  }
}

function clearByKey(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // silent
  }
}

/**
 * 清除 onboarding session（供外部调用：退出登录 / 新用户进入 onboarding 前清理残留）。
 * 传入 userId 时精确清除；不传时清除所有 onboarding 相关的 localStorage key。
 */
export function clearOnboardingSession(userId?: string): void {
  if (userId) {
    // 精确清除当前用户的所有 onboarding key
    ALL_PREFIXES.forEach((prefix) => {
      try { localStorage.removeItem(`${prefix}${userId}`); } catch { /* silent */ }
    });
    ALL_FALLBACKS.forEach((key) => {
      try { localStorage.removeItem(key); } catch { /* silent */ }
    });
    return;
  }
  // 无 userId：遍历清除所有 onboarding 相关 key
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (ALL_PREFIXES.some((p) => k.startsWith(p)) || ALL_FALLBACKS.includes(k))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // silent
  }
}

export function useOnboardingSession(userId: string) {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restore = useCallback(async () => {
    setLoading(true);
    const stored = readFromStorage(userId);
    setSession(stored);
    setLoading(false);
  }, [userId]);

  const save = useCallback((s: OnboardingSession) => {
    setSession(s);
    writeToStorage(userId, s);

    // 防抖写入（500ms）
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      writeToStorage(userId, s);
    }, 500);
  }, [userId]);

  const clear = useCallback(() => {
    setSession(null);
    clearByKey(userId);
  }, [userId]);

  return { session, loading, restore, save, clear };
}
