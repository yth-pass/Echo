/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApiBaseUrl, getAccessToken, refreshAccessToken } from './client';

export type LiveEventType = 'match' | 'handoff' | 'affinity' | 'feed' | 'session_error' | 'notification';

export type LiveWsMessage = {
  type: LiveEventType | 'connected';
  payload?: Record<string, unknown>;
};

export type LiveWsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/** Derive `ws(s)://host/v1/ws` from `VITE_API_BASE_URL`. */
export function getLiveWsUrl(): string | null {
  const base = getApiBaseUrl();
  if (!base) return null;
  const wsBase = base.replace(/^http/i, 'ws');
  return `${wsBase}/ws`;
}

/**
 * 【缺陷2修复】解析 JWT exp 字段，判断 token 是否已过期。
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (typeof payload.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false; // 无法解析时不阻断（由后端校验）
  }
}

// ---------------------------------------------------------------------------
// 【缺陷5修复】多 Tab WS 协调：用 localStorage lock 选举单 Tab 维护 WS，
// BroadcastChannel 广播 live 事件给所有 Tab。
// ---------------------------------------------------------------------------

const WS_LOCK_KEY = 'echo_ws_lock';
const LOCK_TTL_MS = 15000; // lock 15s 过期，持有者定期续期
const LOCK_RENEW_MS = 5000; // 每 5s 续期
const BC_NAME = 'echo_live';

type LockInfo = { tabId: string; ts: number };

function getMyTabId(): string {
  // 每个 Tab 一个唯一 id（sessionStorage 隔离）
  let id = sessionStorage.getItem('echo_tab_id');
  if (!id) {
    id = `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('echo_tab_id', id);
  }
  return id;
}

function readLock(): LockInfo | null {
  try {
    const raw = localStorage.getItem(WS_LOCK_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as LockInfo;
    if (!obj.tabId || typeof obj.ts !== 'number') return null;
    // 过期 lock 视为无主
    if (Date.now() - obj.ts > LOCK_TTL_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeLock(tabId: string): void {
  try {
    localStorage.setItem(WS_LOCK_KEY, JSON.stringify({ tabId, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearLock(tabId: string): void {
  try {
    const cur = readLock();
    if (cur?.tabId === tabId) localStorage.removeItem(WS_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 尝试获取 lock（成为 WS 主 Tab）。成功返回 true。
 */
function tryAcquireLock(tabId: string): boolean {
  const cur = readLock();
  if (cur && cur.tabId === tabId) {
    writeLock(tabId); // 续期
    return true;
  }
  if (cur && cur.tabId !== tabId) return false; // 别人持有
  // 无主，竞争写入
  writeLock(tabId);
  // 再读一次确认竞争胜出（非原子，但够用）
  const after = readLock();
  return after?.tabId === tabId;
}

/**
 * 【缺陷5修复】多 Tab 协调的 live 事件连接。
 *
 * - 第一个 Tab 获取 lock，建立 WS，收到消息后通过 BroadcastChannel 广播
 * - 其他 Tab 不建 WS，仅监听 BroadcastChannel
 * - 主 Tab 关闭时释放 lock，其他 Tab 检测到后重新选举
 * - 所有 Tab 都通过 handlers.onEvent 收到消息
 */
export function connectLiveEvents(handlers: {
  onEvent: (msg: LiveWsMessage) => void;
  onStatus?: (status: LiveWsStatus) => void;
}): () => void {
  const wsUrl = getLiveWsUrl();
  if (!wsUrl) {
    handlers.onStatus?.('idle');
    return () => {};
  }

  let closed = false;
  const myTabId = getMyTabId();

  // 【缺陷5修复】BroadcastChannel：所有 Tab 共享，主 Tab 广播 WS 消息
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
  } catch {
    bc = null; // 不支持 BroadcastChannel 的环境降级为直连
  }

  let ws: WebSocket | null = null;
  let retryMs = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // 【缺陷7修复】心跳定时器与 pong 超时定时器
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let waitingPong = false;
  // 【缺陷5修复】lock 续期定时器 + 选举检测定时器
  let lockRenewTimer: ReturnType<typeof setInterval> | null = null;
  let electionTimer: ReturnType<typeof setInterval> | null = null;
  let isLeader = false;

  const clearHeartbeat = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (pongTimeoutTimer) {
      clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = null;
    }
    waitingPong = false;
  };

  // 【缺陷5修复】广播消息给其他 Tab
  const broadcast = (msg: LiveWsMessage) => {
    try {
      bc?.postMessage(msg);
    } catch {
      /* ignore */
    }
  };

  // 【缺陷5修复】处理收到的 live 消息（WS 主 Tab 直接触发，非主 Tab 从 BC 接收）
  const dispatch = (msg: LiveWsMessage) => {
    handlers.onEvent(msg);
  };

  // 【缺陷2修复】WS 建连（仅主 Tab 调用）
  const connect = async () => {
    if (closed) return;

    let token = getAccessToken();
    if (!token) {
      handlers.onStatus?.('idle');
      return;
    }

    if (isTokenExpired(token)) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        handlers.onStatus?.('idle');
        return;
      }
      token = getAccessToken();
      if (!token) {
        handlers.onStatus?.('idle');
        return;
      }
    }

    handlers.onStatus?.('connecting');
    ws = new WebSocket(wsUrl, ['bearer', token]);

    ws.onopen = () => {
      retryMs = 1000;
      handlers.onStatus?.('open');
      clearHeartbeat();
      // 【缺陷7修复】每 30s 发 ping，10s 无 pong 视为 stale 主动 close 重连
      pingTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (waitingPong) {
          handlers.onStatus?.('error');
          ws.close(4000, 'heartbeat stale');
          return;
        }
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          waitingPong = true;
          pongTimeoutTimer = setTimeout(() => {
            if (waitingPong && ws) {
              handlers.onStatus?.('error');
              ws.close(4000, 'heartbeat timeout');
            }
          }, 10000);
        } catch {
          /* ignore */
        }
      }, 30000);
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(String(ev.data)) as Record<string, unknown>;
        const type = raw.type;
        if (type === 'pong') {
          waitingPong = false;
          if (pongTimeoutTimer) {
            clearTimeout(pongTimeoutTimer);
            pongTimeoutTimer = null;
          }
          return;
        }
        if (
          type === 'match' ||
          type === 'handoff' ||
          type === 'affinity' ||
          type === 'feed' ||
          type === 'session_error' ||
          type === 'notification' ||
          type === 'connected'
        ) {
          const payload =
            raw.payload && typeof raw.payload === 'object' && raw.payload !== null
              ? (raw.payload as Record<string, unknown>)
              : undefined;
          const msg: LiveWsMessage = { type, payload };
          // 【缺陷5修复】主 Tab 本地处理 + 广播给其他 Tab
          dispatch(msg);
          broadcast(msg);
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onerror = () => {
      handlers.onStatus?.('error');
    };

    ws.onclose = (ev) => {
      handlers.onStatus?.('closed');
      clearHeartbeat();
      ws = null;
      if (ev.code === 1008) {
        handlers.onStatus?.('idle');
        return;
      }
      if (!closed && isLeader) {
        retryTimer = setTimeout(() => {
          retryMs = Math.min(retryMs * 2, 30000);
          void connect();
        }, retryMs);
      }
    };
  };

  // 【缺陷5修复】成为主 Tab：建 WS + 启动 lock 续期
  const becomeLeader = () => {
    if (isLeader || closed) return;
    isLeader = true;
    writeLock(myTabId);
    void connect();
    // 定期续期 lock
    lockRenewTimer = setInterval(() => {
      if (closed) return;
      writeLock(myTabId);
    }, LOCK_RENEW_MS);
  };

  // 【缺陷5修复】卸任主 Tab：关 WS + 清 lock + 清定时器
  const stepDown = () => {
    isLeader = false;
    if (lockRenewTimer) {
      clearInterval(lockRenewTimer);
      lockRenewTimer = null;
    }
    clearHeartbeat();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    ws?.close();
    ws = null;
    clearLock(myTabId);
  };

  // 【缺陷5修复】选举检测：定期检查是否需要成为主 Tab
  const runElection = () => {
    if (closed) return;
    const cur = readLock();
    if (!cur || cur.tabId === myTabId || Date.now() - cur.ts > LOCK_TTL_MS) {
      // 无主或 lock 过期，尝试获取
      if (tryAcquireLock(myTabId)) {
        becomeLeader();
      }
    }
  };

  // 【缺陷5修复】监听 BroadcastChannel：非主 Tab 从此接收消息
  if (bc) {
    bc.onmessage = (ev) => {
      const msg = ev.data as LiveWsMessage;
      if (msg && typeof msg.type === 'string') {
        dispatch(msg);
      }
    };
  }

  // 【缺陷5修复】监听 storage 事件：主 Tab 关闭时其他 Tab 触发选举
  const onStorage = (e: StorageEvent) => {
    if (e.key === WS_LOCK_KEY && !e.newValue) {
      // lock 被清除（主 Tab 关闭），触发选举
      runElection();
    }
  };
  window.addEventListener('storage', onStorage);

  // 【缺陷5修复】启动：先尝试选举，若失败则定期重试
  runElection();
  electionTimer = setInterval(() => {
    if (closed) return;
    if (!isLeader) runElection();
  }, LOCK_RENEW_MS);

  // 【缺陷5修复】页面卸载时释放 lock（让其他 Tab 接管）
  const onUnload = () => {
    stepDown();
  };
  window.addEventListener('beforeunload', onUnload);

  return () => {
    closed = true;
    stepDown();
    if (electionTimer) {
      clearInterval(electionTimer);
      electionTimer = null;
    }
    if (bc) {
      bc.onmessage = null;
      bc.close();
      bc = null;
    }
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('beforeunload', onUnload);
    handlers.onStatus?.('idle');
  };
}
