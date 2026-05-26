/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Echo Platform API base including `/v1` when backend exists (Software Architecture §10). */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v !== 'string') return '';
  return v.replace(/\/$/, '').trim();
}

function getAccessToken(): string | null {
  try {
    return localStorage.getItem('echo_access_token');
  } catch {
    return null;
  }
}

/** GET JSON from API; returns `null` if no base URL, network error, or non-2xx. */
export async function apiGetJson<T>(path: string): Promise<T | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** POST JSON; returns `null` on failure. */
export async function apiPostJson<TBody extends object, TRes>(
  path: string,
  body: TBody,
): Promise<TRes | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as TRes;
  } catch {
    return null;
  }
}

/** PUT JSON; returns `null` on failure. */
export async function apiPutJson<TBody extends object, TRes>(
  path: string,
  body: TBody,
): Promise<TRes | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as TRes;
  } catch {
    return null;
  }
}
