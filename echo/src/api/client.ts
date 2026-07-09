/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 【缺陷5修复】ApiResult 三态类型：成功 / HTTP错误 / 网络错误 / 无基址。
 * 调用方用 ok 区分成功失败，用 status 区分错误类型。
 * 401 由 client 内部拦截处理（缺陷3），不暴露给调用方。
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }
  | { ok: false; status: 0; message: 'network' }
  | { ok: false; status: -1; message: 'no-base' };

/** Echo Platform API base including `/v1` when backend exists (Software Architecture §10). */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v !== 'string') return '';
  return v.replace(/\/$/, '').trim();
}

// ---------------------------------------------------------------------------
// 【缺陷7修复】access token 改存内存（模块级变量），不持久化到 localStorage。
// 刷新页面后 token 丢失，靠 refresh cookie 静默续期（后端 TODO httpOnly cookie）。
// ---------------------------------------------------------------------------
let accessToken: string | null = null;

/** 设置内存中的 access token（登录/刷新成功时调用）。 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** 获取内存中的 access token。 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * 【缺陷3修复】401 拦截：单例 refresh Promise 防并发。
 * 多个请求同时 401 时，只发一次 refresh，所有请求共享结果。
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * 【缺陷7/缺陷3修复】使用 raw fetch 调用 /auth/refresh（绕过 request() 避免递归 401）。
 * 依赖 httpOnly cookie 传递 refresh token（后端 TODO：登录接口 Set-Cookie）。
 * 成功后更新内存 access token 并返回。
 */
export async function refreshAccessToken(): Promise<string | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      // 【缺陷7修复】携带 httpOnly cookie 中的 refresh token
      credentials: 'include',
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    // 后端返回 snake_case（access_token），兼容两种命名
    const json = (await res.json()) as { access_token?: string; accessToken?: string };
    const token = json?.access_token ?? json?.accessToken;
    if (typeof token === 'string') {
      setAccessToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

/** 单例 refresh：并发 401 共享同一次 refresh 调用。 */
function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * 【缺陷3修复】鉴权失败回调：由 App.tsx 注册，refresh 失败时触发跳转登录页。
 */
let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(fn: (() => void) | null): void {
  authFailureHandler = fn;
}

function handleAuthFailure(): void {
  setAccessToken(null);
  try {
    localStorage.removeItem('echo_user_id');
  } catch {
    /* ignore */
  }
  if (authFailureHandler) authFailureHandler();
}

/**
 * 【缺陷5修复】核心 request 函数，返回 ApiResult。
 * - 401 时自动 refresh + 重试一次（缺陷3）
 * - 支持 AbortSignal（缺陷4：fetchMe 超时取消）
 * - credentials: 'include' 携带 httpOnly cookie
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object,
  options?: { signal?: AbortSignal; _isRetry?: boolean },
): Promise<ApiResult<T>> {
  const base = getApiBaseUrl();
  // 【缺陷5修复】无基址返回 no-base，不再静默返回 null
  if (!base) return { ok: false, status: -1, message: 'no-base' };

  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: options?.signal,
    });
  } catch {
    // 网络错误或 abort
    if (options?.signal?.aborted) return { ok: false, status: 0, message: 'network' };
    return { ok: false, status: 0, message: 'network' };
  }

  // 【缺陷3修复】401 拦截：refresh + 重试一次（仅首次，_isRetry 防递归）
  if (res.status === 401 && !options?._isRetry) {
    const newToken = await refreshOnce();
    if (newToken) {
      return request<T>(method, path, body, { ...options, _isRetry: true });
    }
    // refresh 失败 → 清 token + 触发跳转登录页
    handleAuthFailure();
    return { ok: false, status: 401, message: 'auth expired' };
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (typeof errBody?.message === 'string') {
        detail = errBody.message;
      } else if (Array.isArray(errBody?.message)) {
        // NestJS ValidationPipe: message 是 string[]
        detail = errBody.message.join('；');
      } else if (typeof errBody?.error === 'string') {
        detail = errBody.error;
      }
    } catch {
      /* body 非 JSON，保留默认 detail */
    }
    return { ok: false, status: res.status, message: detail };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: res.status, message: 'invalid json' };
  }
}

/**
 * 【缺陷5修复】辅助函数：将 ApiResult 解包为 T | null（兼容旧调用方）。
 * 调用方无需关心错误细节时使用；需要区分错误类型时直接处理 ApiResult。
 */
export function unwrap<T>(r: ApiResult<T>): T | null {
  return r.ok ? r.data : null;
}

/** GET JSON from API; returns ApiResult（缺陷5修复）。 */
export async function apiGetJson<T>(path: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  return request<T>('GET', path, undefined, { signal });
}

/** POST JSON; returns ApiResult（缺陷5修复）。 */
export async function apiPostJson<TBody extends object, TRes>(
  path: string,
  body: TBody,
  signal?: AbortSignal,
): Promise<ApiResult<TRes>> {
  return request<TRes>('POST', path, body, { signal });
}

/** PUT JSON; returns ApiResult（缺陷5修复）。 */
export async function apiPutJson<TBody extends object, TRes>(
  path: string,
  body: TBody,
  signal?: AbortSignal,
): Promise<ApiResult<TRes>> {
  return request<TRes>('PUT', path, body, { signal });
}

/** DELETE JSON; returns ApiResult. */
export async function apiDeleteJson<TRes>(
  path: string,
  signal?: AbortSignal,
): Promise<ApiResult<TRes>> {
  return request<TRes>('DELETE', path, undefined, { signal });
}

// ---------------------------------------------------------------------------
// LLM Proxy (REQ-11)
// ---------------------------------------------------------------------------

export interface LlmProxyMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProxyOptions {
  temperature?: number;
  max_tokens?: number;
}

interface LlmProxyResponse {
  code: number;
  data: { content: string | null };
  message: string;
}

/**
 * Proxy an LLM chat request through the API so the browser never holds an
 * API key. Returns the assistant's text content, or `null` on any failure.
 * 【缺陷5修复】适配新 request() 返回类型。
 */
export async function llmProxy(
  messages: LlmProxyMessage[],
  options?: LlmProxyOptions,
): Promise<string | null> {
  const result = await request<LlmProxyResponse>('POST', '/llm/proxy', { messages, options });
  if (!result.ok) return null;
  return result.data?.data?.content ?? null;
}
