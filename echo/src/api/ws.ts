/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApiBaseUrl } from './client';

export type LiveEventType = 'match' | 'handoff' | 'affinity' | 'feed';

export type LiveWsMessage = {
  type: LiveEventType | 'connected';
  payload?: Record<string, unknown>;
};

export type LiveWsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

function getAccessToken(): string | null {
  try {
    return localStorage.getItem('echo_access_token');
  } catch {
    return null;
  }
}

/** Derive `ws(s)://host/v1/ws` from `VITE_API_BASE_URL`. */
export function getLiveWsUrl(): string | null {
  const base = getApiBaseUrl();
  if (!base) return null;
  const wsBase = base.replace(/^http/i, 'ws');
  return `${wsBase}/ws`;
}

export function connectLiveEvents(handlers: {
  onEvent: (msg: LiveWsMessage) => void;
  onStatus?: (status: LiveWsStatus) => void;
}): () => void {
  const wsUrl = getLiveWsUrl();
  const token = getAccessToken();
  if (!wsUrl || !token) {
    handlers.onStatus?.('idle');
    return () => {};
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    handlers.onStatus?.('connecting');
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryMs = 1000;
      handlers.onStatus?.('open');
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data)) as Record<string, unknown>;
        const type = raw.type;
        if (
          type === 'match' ||
          type === 'handoff' ||
          type === 'affinity' ||
          type === 'feed' ||
          type === 'connected'
        ) {
          const payload =
            raw.payload && typeof raw.payload === 'object' && raw.payload !== null
              ? (raw.payload as Record<string, unknown>)
              : undefined;
          handlers.onEvent({ type, payload });
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onerror = () => {
      handlers.onStatus?.('error');
    };

    ws.onclose = () => {
      handlers.onStatus?.('closed');
      ws = null;
      if (!closed) {
        retryTimer = setTimeout(() => {
          retryMs = Math.min(retryMs * 2, 30000);
          connect();
        }, retryMs);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close();
    ws = null;
    handlers.onStatus?.('idle');
  };
}
