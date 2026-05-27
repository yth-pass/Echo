import { Injectable } from '@nestjs/common';
import type { WebSocket } from 'ws';

@Injectable()
export class LiveWsHub {
  private readonly byUser = new Map<string, Set<WebSocket>>();

  register(userId: string, ws: WebSocket) {
    let set = this.byUser.get(userId);
    if (!set) {
      set = new Set();
      this.byUser.set(userId, set);
    }
    set.add(ws);
  }

  unregister(userId: string, ws: WebSocket) {
    const set = this.byUser.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.byUser.delete(userId);
  }

  broadcastToUser(userId: string, data: Record<string, unknown>) {
    const set = this.byUser.get(userId);
    if (!set?.size) return;
    const text = JSON.stringify(data);
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) {
        ws.send(text);
      }
    }
  }
}
