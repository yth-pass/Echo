# 修复：注册「获取验证码」功能无法运行

> 时间：2026-06-27　范围：`services/api`（NestJS 后端）

## 现象
注册页点「获取验证码」无反应 / 提示「验证码发送失败，请检查手机号后重试」。

## 根因（两层）

### 1. 后端 API 服务从未启动（直接原因）
- 前端 `echo/.env.local` 配置 `VITE_API_BASE_URL=http://localhost:4000/v1`，`hasApi=true`，会真实请求后端。
- `netstat` 确认 4000 端口无任何进程监听 → 前端 `fetch` 连接失败 → `request()` 返回 `{ok:false,status:0,message:'network'}` → `requestOtp()` 返回 `false` → 显示「验证码发送失败」。

### 2. `nest start` 启动即崩（服务起不来的原因）
- `services/api/src` 的代码 import 了上级目录 `services/shared/observability.ts`。
- `tsconfig.json` 未显式设 `rootDir`，TypeScript 自动推断 `rootDir = services/`（api 的上级），导致编译产物落到 `dist/api/src/main.js`，而非 `dist/main.js`。
- `nest start` 默认运行 `dist/main` → `Cannot find module '...\dist\main'` → 后端根本起不来。

## 修复

| 文件 | 改动 | 说明 |
|------|------|------|
| `services/api/nest-cli.json` | 新增 `"entryFile": "api/src/main"` | 让 `nest start` 运行实际产物 `dist/api/src/main.js`，而非找不到的 `dist/main` |
| `services/api/package.json` | `start:prod`: `node dist/main` → `node dist/api/src/main` | 与产物路径保持一致 |
| `services/api/tsconfig.json` | 保持原状（不设 `rootDir`） | 因 `shared/` 在 `src` 外，强行设 `rootDir:"./src"` 会触发 `TS6059`；自动推断 `services/` 是容纳 shared 的唯一可行值 |

> 未采用「设 `rootDir:"./src"`」方案：会因 `services/shared/observability.ts` 不在 rootDir 下而 `TS6059` 编译失败。

## 验证

```bash
# 1. 构建（产物归位）
cd services/api && npm run build
# → dist/api/src/main.js 存在，build exit 0

# 2. 启动
node dist/api/src/main
# → Echo API listening on http://localhost:4000/v1
# → 路由 Mapped {/v1/auth/otp, POST}

# 3. 测试 OTP 接口
curl -X POST http://localhost:4000/v1/auth/otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'
# → {"sent":true,"phone":"13800138000"}  HTTP 201

# 4. 后端日志打印验证码（OTP_DEV_CODE 为空 → 随机码）
# [AuthService] OTP for 13800138000: 882028 (MVP — not for production)
```

前端 `requestOtp()` 收到 `sent:true` → `setOtpSent(true)` → 显示验证码输入框，功能恢复。

## 日常启动方式
- 一键启动：`start-echo-demo.cmd`（会拉起 API + Worker + Web 三个窗口）
- 单独起后端：`cd services/api && npm run start:dev`（watch 模式，已能正确运行）

## 开发期取验证码
`.env` 中 `OTP_DEV_CODE=` 为空，每次生成随机 6 位码并**打印到 API 控制台日志**（`[AuthService] OTP for <手机号>: <码>`）。如需固定后门码，在 `services/api/.env` 设 `OTP_DEV_CODE=123456`（仅非生产生效）。

## 附带发现（未本次修复，建议后续处理）
**前端 `registerPhone` 与后端 `RegisterDto` 契约不一致**：
- `echo/src/api/auth.ts` 的 `registerPhone(phone)` 只传 `{ phone }`。
- `services/api/src/auth/auth.dto.ts` 的 `RegisterDto.password` 是**必填**（`@IsString() @MinLength(8)`，无 `@IsOptional`）。
- 后果：注册模式下 `sendOtp` 先调 `/auth/register` 必返回 **400**（被前端忽略，不影响后续 `/auth/otp` 成功），但 Network 面板会出现 400 噪音，且 `/auth/register` 接口实际永远失败。
- Echo 注册走「手机号 + OTP」无密码流程，`/auth/otp` 内部的 `ensureUserByPhone` 已会创建用户，故 `registerPhone` 调用冗余。建议三选一：① 前端移除 `sendOtp` 中的 `registerPhone` 调用；② 后端 `RegisterDto.password` 改 `@IsOptional` 支持无密码注册；③ 重新设计 register 与 OTP 的关系。需产品决策，未擅自改动。
