# Echo 后端安全适配（4 项）— 修改清单

> 客户端 Echo/（Vite+React）已完成安全修复，本阶段由后端 services/api（NestJS）+ services/worker（BullMQ）落实 4 项适配。

## 验收结果

| 步骤 | 验收命令 | 结果 |
|------|----------|------|
| 1 | `cd services/api && npx tsc --noEmit` | ✅ exit 0（零错误） |
| 2 | `cd services/worker && npx tsc --noEmit` | ✅ exit 0（零错误） |

手动验证项（可选，前端已适配）：
- 登录后浏览器 DevTools → Application → Cookies 可见 `refresh_token`（HttpOnly 勾选，Path=/v1/auth）
- 调 `/v1/auth/refresh` 不带 body，仅靠 cookie 能拿到新 `access_token`
- WS 连接时 `Sec-WebSocket-Protocol: bearer, <token>` 能升级成功，URL 无 token
- WS 连接后发 `{type:'ping'}` 收到 `{type:'pong'}`

## 任务1 — refresh token 改用 httpOnly cookie

**目标**：refresh token 不再走 JSON body，改用 httpOnly cookie，前端 `credentials: 'include'` 自动携带。

| 文件 | 改动 |
|------|------|
| `services/api/src/main.ts` | `import cookieParser`；在 `enableCors` 之后 `app.use(cookieParser())` |
| `services/api/src/auth/auth.dto.ts` | `RefreshDto.refreshToken` 加 `@IsOptional()`，改为可选（兼容旧客户端，cookie 优先） |
| `services/api/src/auth/auth.service.ts` | `SnakeAuthResponse` 移除 `refresh_token` 字段；`toSnakeAuthResponse` 改 public 且不再返回 `refresh_token`；`registerWithPassword`/`loginWithPassword` 返回类型改为 `AuthSessionPayload`（含 refreshToken，供 controller 写 cookie） |
| `services/api/src/auth/auth.controller.ts` | `login`/`register`/`refresh` 注入 `@Res({passthrough:true})`，调用 service 后 `res.cookie('refresh_token', ..., {httpOnly, secure=生产, sameSite:'strict', path:'/v1/auth', maxAge:7d})`；返回值经 `toSnakeAuthResponse` 转换（不含 refresh_token）；`/auth/refresh` 改签名 `(@Req req, @Res res, @Body dto)`，优先从 `req.cookies.refresh_token` 读，成功后 rotation 重设 cookie；`/auth/logout` 调 `res.clearCookie('refresh_token', {path:'/v1/auth'})`；新增 `REFRESH_COOKIE_OPTIONS` 常量统一配置 |

**约束遵守**：
- ✅ `secure` 仅生产开启（本地 http 测试 false）
- ✅ `sameSite:'strict'` 防 CSRF
- ✅ `path:'/v1/auth'` 限制 cookie 仅在 auth 接口发送
- ✅ `maxAge: 7d` 与 `JWT_REFRESH_TTL` 一致
- ✅ breaking change：refresh_token 从 body 移到 cookie（前端已适配）

## 任务2 — WebSocket 子协议鉴权

**目标**：前端改用 `new WebSocket(url, ['bearer', token])`，token 通过 `Sec-WebSocket-Protocol` 头传递，不再走 URL query。

| 文件 | 改动 |
|------|------|
| `services/api/src/live/live-ws.bootstrap.ts` | `httpServer.on('upgrade')` 内移除 `query.token` 解析；改为从 `request.headers['sec-websocket-protocol']` 解析，按逗号 split + trim，第一项须为 `'bearer'`、第二项为 token；缺失/格式不符 → `socket.write('HTTP/1.1 401 Unauthorized')` + `socket.destroy()`；后续 `jwt.verify` 逻辑不变；`wss.handleUpgrade` 第四参数回调照常（ws 库默认处理协议回显，无需额外传 protocols） |

**约束遵守**：
- ✅ 鉴权失败用 HTTP 401 拒绝升级（而非升级后 close 1008）
- ✅ URL 不再含 token，避免泄露到 access log

## 任务3 — WebSocket 心跳 pong

**目标**：前端每 30s 发 `{type:'ping'}`，后端在 `wss.on('connection')` 内监听 message 回 `{type:'pong'}`。

| 文件 | 改动 |
|------|------|
| `services/api/src/live/live-ws.bootstrap.ts` | `wss.on('connection')` 回调内新增 `ws.on('message', (raw) => { JSON.parse; if type==='ping' → ws.send({type:'pong'}) })`，try/catch 忽略 malformed；保留原 `close`/`error` 注销逻辑 |

## 任务4 — manual-review 队列消费 worker

**目标**：worker 已在 needs_review 时入队 `manual-review`，新增消费方（日志 + 审计，供后续管理员界面接入）。

| 文件 | 改动 |
|------|------|
| `services/worker/src/main.ts` | `import { Worker, Queue, Job } from 'bullmq'`（加 `Job` 类型）；在 `report-triage` worker 之后新增 `new Worker('manual-review', async (job: Job<{postId, cloneId, reason, contentSnippet}>) => {...})`，复用 `auditForClone` 写 `post.needs_review_queued` 审计 + `logger.info`；启动日志 console.log 补 `manual-review` |

**约束遵守**：
- ✅ 复用现有 `auditForClone` 与 `logger`
- ✅ 不阻塞主流程（独立 worker）
- ✅ 幂等说明：同一帖子多次入队会留多条审计记录，后续管理员界面按 postId 去重展示

## 全局约束遵守

- ✅ 每处修改加中文注释（标注【安全适配·任务N】等）
- ✅ 不破坏现有接口契约（除 refresh_token 从 body 移到 cookie 是 breaking change，前端已适配）
- ✅ TypeScript 严格类型（两项目 tsc --noEmit 均通过）

## 修改文件清单（6 个文件 + 1 个依赖）

| # | 文件 | 任务 | 说明 |
|---|------|------|------|
| 0 | `services/api/package.json` (+node_modules) | 1 | 新增 `cookie-parser` + `@types/cookie-parser` 依赖 |
| 1 | `services/api/src/main.ts` | 1 | 注册 cookieParser 中间件 |
| 2 | `services/api/src/auth/auth.dto.ts` | 1 | RefreshDto.refreshToken 改可选 |
| 3 | `services/api/src/auth/auth.service.ts` | 1 | 移除 refresh_token 出参；方法返回 AuthSessionPayload；toSnakeAuthResponse 改 public |
| 4 | `services/api/src/auth/auth.controller.ts` | 1 | cookie 设置/读取/清除；refresh 走 cookie；logout 清 cookie |
| 5 | `services/api/src/live/live-ws.bootstrap.ts` | 2,3 | 子协议鉴权 + 心跳 pong |
| 6 | `services/worker/src/main.ts` | 4 | manual-review 消费 worker |

## 设计说明

**为何让 service 方法返回 `AuthSessionPayload` 而非 `SnakeAuthResponse`**：controller 需要拿到 `refreshToken` 原值写入 cookie，而 `SnakeAuthResponse` 已移除该字段。故 `registerWithPassword`/`loginWithPassword`/`loginWithOtp`/`refresh` 统一返回 `AuthSessionPayload`（含 refreshToken），controller 设完 cookie 后调用 public 的 `toSnakeAuthResponse` 转换出参。`loginWithOtp`/`refresh` 原本就返回 `AuthSessionPayload`，无需改；仅 `registerWithPassword`/`loginWithPassword` 的返回类型与 `return` 语句调整。
