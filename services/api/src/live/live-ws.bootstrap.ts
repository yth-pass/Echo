import type { Server } from 'http';
import { parse } from 'url';
import { JwtService } from '@nestjs/jwt';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { LiveWsHub } from './live-ws.hub';

export function attachLiveWebSocket(
  httpServer: Server,
  hub: LiveWsHub,
  jwt: JwtService,
): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url ?? '', true);
    if (pathname !== '/v1/ws') {
      socket.destroy();
      return;
    }

    // 【安全适配·任务2】不再从 URL query 读取 token（避免 token 泄露到 access log），
    // 改从 Sec-WebSocket-Protocol 头解析：格式为 "bearer, <token>"。
    // 浏览器侧通过 new WebSocket(url, ['bearer', token]) 传入。
    const protocols = (request.headers['sec-websocket-protocol'] ?? '')
      .toString()
      .split(',')
      .map((s) => s.trim());
    if (protocols[0] !== 'bearer' || !protocols[1]) {
      // 协议头缺失或格式不符，直接以 401 拒绝升级（而非升级后 close 1008）
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    const token = protocols[1];

    let userId: string;
    try {
      const payload = jwt.verify<{ sub: string }>(token);
      if (!payload?.sub) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      userId = payload.sub;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 注：ws 库的 handleUpgrade 默认会处理 Sec-WebSocket-Protocol 的协议回显，无需额外传 protocols 参数。
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, userId);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: unknown, userId: string) => {
    hub.register(userId, ws);
    ws.send(JSON.stringify({ type: 'connected' }));

    // 【心跳适配·任务3】收到客户端 ping 回复 pong（前端每 30s 发一次 {type:'ping'}）
    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        // 其他类型的客户端消息当前不处理（live 事件仅服务端→客户端单向推送）
      } catch {
        /* ignore malformed */
      }
    });

    ws.on('close', () => {
      hub.unregister(userId, ws);
    });
    ws.on('error', () => {
      hub.unregister(userId, ws);
    });
  });

  console.log('WebSocket live events at /v1/ws');
}
