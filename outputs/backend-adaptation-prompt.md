# 后端适配任务提示词（直接复制给后端 AI）

## 项目背景

你是 Echo 项目的后端工程师。后端 services/api（NestJS）+ services/worker（BullMQ）。
客户端 Echo/（Vite+React）已完成安全修复，对后端提出了 4 项适配要求。前端已标注 TODO，本阶段由后端落实。

## 现状（请先确认）

- `services/api/src/auth/auth.controller.ts`：`/auth/refresh` 从 `@Body() dto: RefreshDto` 读 `refreshToken`；`login`/`register`/`refresh` 返回 JSON 含 `refresh_token` 字段
- `services/api/src/auth/auth.service.ts`：`issueTokensForUser` 返回 `AuthSessionPayload { accessToken, refreshToken, ... }`；`refresh(refreshToken)` 从参数接收 token
- `services/api/src/live/live-ws.bootstrap.ts`：WS 升级时从 `query.token`（URL 查询参数）读 token；`wss.on('connection')` 内只 `ws.send({type:'connected'})`，不处理客户端消息
- `services/api/src/main.ts`：`app.enableCors({ credentials: true })` 已开启，但未配置 cookie 相关
- `services/worker/src/main.ts`：`needs_review` 分支已 `new Queue('manual-review').add('review', {...})`，但无消费 worker

## 任务1：refresh token 改用 httpOnly cookie

**目标**：refresh token 不再走 JSON body，改用 httpOnly cookie，前端 `credentials: 'include'` 自动携带。

**改动**：

1. `auth.controller.ts` 的 `login`/`register`/`refresh` 三个接口：
   - 注入 `@Res({ passthrough: true }) res: Response`（来自 `express`）
   - 调用 service 后，用 `res.cookie('refresh_token', tokens.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/v1/auth', maxAge: 7 * 24 * 3600 * 1000 })` 设置 cookie
   - 返回值中**移除** `refresh_token` 字段（只保留 `access_token`/`user_id`/`onboarding_complete`/`is_new_user`）

2. `auth.controller.ts` 的 `/auth/refresh`：
   - 签名改为 `refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response)`
   - 从 `req.cookies?.refresh_token` 读取（需先 `app.use(cookieParser())`）
   - 调用 `auth.refresh(cookieRefreshToken)`
   - 成功后重新 `res.cookie(...)` 刷新 cookie（rotation）
   - `RefreshDto` 的 `refreshToken` 字段改为 `@IsOptional()`（兼容旧客户端，但优先用 cookie）

3. `auth.controller.ts` 的 `/auth/logout`：
   - `res.clearCookie('refresh_token', { path: '/v1/auth' })`

4. `main.ts`：
   - `import cookieParser from 'cookie-parser'`
   - `app.use(cookieParser())`（在 `enableCors` 之后）

5. `auth.service.ts`：
   - `SnakeAuthResponse` 类型移除 `refresh_token` 字段（或保留但永不赋值，标注 deprecated）
   - `toSnakeAuthResponse` 不再返回 `refresh_token`

**约束**：
- `secure` 仅生产环境开启（本地 http 测试需要 false）
- `sameSite: 'strict'` 防 CSRF
- `path: '/v1/auth'` 限制 cookie 仅在 auth 接口发送
- 保留 7 天 maxAge（与 JWT_REFRESH_TTL 一致）

## 任务2：WebSocket 子协议鉴权

**目标**：前端已改用 `new WebSocket(url, ['bearer', token])`，token 通过 `Sec-WebSocket-Protocol` 头传递，不再走 URL query。

**改动 `services/api/src/live/live-ws.bootstrap.ts`**：

1. `httpServer.on('upgrade', ...)` 内：
   - 移除 `const token = query.token`
   - 改为从 `request.headers['sec-websocket-protocol']` 解析：格式为 `bearer, <token>`，按逗号 split 后 trim，第一项为 `'bearer'`，第二项为 token
   - 若协议头不存在或格式不符，`socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return`
   - `wss.handleUpgrade(request, socket, head, callback)` 的第四个参数需传入 `protocols`（`WebSocketServer` 的 `handleUpgrade` 签名要求回显协议，否则浏览器报错）

2. 关键代码示例（替换原有 token 解析逻辑）：
```typescript
const protocols = (request.headers['sec-websocket-protocol'] ?? '').toString().split(',').map(s => s.trim());
if (protocols[0] !== 'bearer' || !protocols[1]) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  socket.destroy();
  return;
}
const token = protocols[1];
// 后续 jwt.verify(token) 逻辑不变
```

3. `wss.handleUpgrade` 调用时需回显协议：
```typescript
wss.handleUpgrade(request, socket, head, (ws) => {
  wss.emit('connection', ws, request, userId);
});
```
注意：`ws` 库的 `handleUpgrade` 默认会处理协议回显，无需额外传 protocols 参数。

**约束**：鉴权失败用 HTTP 401 拒绝升级（而非升级后 close 1008），避免 token 泄露到 access log（URL 不再含 token）。

## 任务3：WebSocket 心跳 pong

**目标**：前端每 30s 发 `{type:'ping'}`，后端需在 `wss.on('connection')` 内监听 message 回 `{type:'pong'}`。

**改动 `services/api/src/live/live-ws.bootstrap.ts` 的 `wss.on('connection')` 回调**：

```typescript
wss.on('connection', (ws: WebSocket, _req: unknown, userId: string) => {
  hub.register(userId, ws);
  ws.send(JSON.stringify({ type: 'connected' }));

  // 【新增】心跳：收到 ping 回 pong
  ws.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(String(raw)) as { type?: string };
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
      // 其他类型的客户端消息当前不处理（live 事件仅服务端→客户端）
    } catch {
      /* ignore malformed */
    }
  });

  ws.on('close', () => hub.unregister(userId, ws));
  ws.on('error', () => hub.unregister(userId, ws));
});
```

## 任务4：manual-review 队列消费 worker

**目标**：worker 已在 `needs_review` 时入队 `manual-review`，需新增消费方（至少创建队列 + 日志 + 审计，供后续接入管理员界面）。

**改动 `services/worker/src/main.ts`**（在现有 Worker 定义之后新增）：

```typescript
// 【新增】manual-review 队列消费：人工审核待处理帖子
new Worker(
  'manual-review',
  async (job: Job<{ postId: string; cloneId: string; reason: string; contentSnippet: string }>) => {
    const { postId, cloneId, reason, contentSnippet } = job.data;
    logger.info('manual review item received', { postId, cloneId, reason });
    // MVP 阶段：仅记录日志 + 审计，等待管理员后台界面消费
    // 后续接入管理员界面后，此处可发布通知或写入 admin_inbox 表
    await auditForClone(
      cloneId,
      'post.needs_review_queued',
      `动态已进入人工审核队列：${contentSnippet.slice(0, 48)}…（原因：${reason}）`,
      postId,
    );
  },
  { connection },
);
```

**约束**：
- 复用现有 `auditForClone` 与 `logger`
- 消费方幂等（同一条目多次消费不重复审计——可检查审计表是否已有记录，或接受重复）
- 不阻塞主流程

## 全局约束

- 每处修改加中文注释
- 不破坏现有接口契约（除 refresh_token 从 body 移到 cookie 是 breaking change，前端已适配）
- TypeScript 严格类型

## 验收

1. `cd services/api && npx tsc --noEmit` → exit 0
2. `cd services/worker && npx tsc --noEmit` → exit 0
3. 手动验证（可选）：
   - 登录后浏览器 DevTools → Application → Cookies 看到 `refresh_token`（HttpOnly 勾选）
   - 调 `/auth/refresh` 不带 body，仅靠 cookie 能拿到新 access_token
   - WS 连接时 `Sec-WebSocket-Protocol: bearer, <token>` 能升级成功，URL 无 token
   - WS 连接后发 `{type:'ping'}` 收到 `{type:'pong'}`
4. 输出修改清单
