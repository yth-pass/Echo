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
    const { pathname, query } = parse(request.url ?? '', true);
    if (pathname !== '/v1/ws') {
      socket.destroy();
      return;
    }

    const token = typeof query.token === 'string' ? query.token : '';
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

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, userId);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: unknown, userId: string) => {
    hub.register(userId, ws);
    ws.send(JSON.stringify({ type: 'connected' }));

    ws.on('close', () => {
      hub.unregister(userId, ws);
    });
    ws.on('error', () => {
      hub.unregister(userId, ws);
    });
  });

  console.log('WebSocket live events at /v1/ws');
}
