# Echo 客户端鉴权与会话安全修复清单

> 验收命令：`cd Echo && npx tsc --noEmit` → **EXIT 0（零错误）**
> 修复范围：9 项安全缺陷 + 3 项验证阶段补漏
> 约束：不引入新依赖；每处修改附中文注释；httpOnly cookie 需后端配合处标注 TODO

---

## 一、9 项缺陷修复

### 缺陷1 — AuthShell 默认 OTP（`src/features/auth/AuthShell.tsx`）
**问题**：`loginWithOtp(phone, code || '123456')`，空验证码会用默认值 `123456` 登录。
**修复**：
- 移除 `|| '123456'`，改为 `const trimmedCode = code.trim(); if (!trimmedCode) return;`（code 为空直接 return，不发请求）
- 登录按钮 `disabled` 增加 `(hasApi && otpSent && !code.trim())`，code 为空时按钮禁用

### 缺陷2 — WS token 不刷新 + 写入 URL（`src/api/ws.ts`）
**问题**：token 在入口读一次写入 WS URL（泄露到 access log）；过期后 onclose 无条件重连永远用过期 token。
**修复**：
- token 不再写入 URL，改用 WebSocket 子协议传递：`new WebSocket(wsUrl, ['bearer', token])`（后端从 `Sec-WebSocket-Protocol` 校验，TODO 标注）
- 连接前解析 JWT `exp`，过期则先调 `refreshAccessToken()`，成功后再连
- onclose 时检查 code：`1008`（policy violation，鉴权失败）不自动重连，触发 idle
- 重连 `connect()` 重新 `getAccessToken()`，不复用缓存的过期 token

### 缺陷3 — 401 仅 match 处理（`src/api/client.ts` + `src/api/match.ts`）
**问题**：仅 `match.ts` 调 refreshSession，其他 api/*.ts 的 401 全部静默返回 null。
**修复**：
- `client.ts` 新增 `refreshOnce()` 单例 Promise，并发 401 共享同一次 refresh
- `request()` 内统一 401 拦截：refresh 成功 → 重试原请求一次（`_isRetry` 防递归）；refresh 失败 → `handleAuthFailure()` 清 token + 触发 `authFailureHandler` 跳登录页
- `App.tsx` 通过 `setAuthFailureHandler` 注册跳转回调
- `match.ts` 移除独立的 refreshSession 逻辑（由 client 统一处理）

### 缺陷4 — Splash 竞态（`src/App.tsx`）
**问题**：Splash `setTimeout(onFinish, 2000)` 与 fetchMe 并行，fetchMe > 2s 时 cleanup 把 `cancelled=true`，已登录用户被踢回登录页。
**修复**：
- 用 `AbortController` 取消 fetchMe（取代 cancelled 标志）
- fetchMe 完成或失败前不触发 state 切换（`settled` 标志保证）
- 5s 超时：fetchMe 未返回则 `controller.abort()` + 进 `auth`
- 状态机：`splash`（含 fetchMe 进行中）→ `auth`(失败/超时) | `main`(成功) | `no-api`(无 base)

### 缺陷5 — client.ts 三态混淆（`src/api/client.ts` + 全部 `api/*.ts`）
**问题**：null 同时表示"无基址/网络错/非2xx"，无法区分。
**修复**：
- 定义 `ApiResult<T>` 联合类型：`{ok:true;data}` | `{ok:false;status;message}` | `{ok:false;status:0;message:'network'}` | `{ok:false;status:-1;message:'no-base'}`
- `request()` 返回 `ApiResult`，401 由内部拦截（缺陷3），不暴露给调用方
- 新增 `unwrap()` 辅助函数兼容旧调用方（`T | null`）
- 全部 `api/*.ts`（feed/match/session/handoff/clone/activity/audit/posts/report）用 `unwrap()` 适配新返回类型

### 缺陷6 — 无 API base 跳过校验（`src/App.tsx` + `src/types.ts`）
**问题**：无 `VITE_API_BASE_URL` 时 `onComplete(null)` → onboarding → main，看 mock 数据。
**修复**：
- 新增 `no-api` 状态；Splash 阶段检测无 base → `setState('no-api')`
- `no-api` 渲染明确错误页："未配置 API 地址，请联系管理员"，不进登录/主界面
- `handleAuthComplete` 无 base 时也拦截到 `no-api`

### 缺陷7 — localStorage 存 token（`src/api/auth.ts` + `src/api/client.ts`）
**问题**：access/refresh token 明文存 localStorage，XSS 可读。
**修复**：
- access token 改存内存（`client.ts` 模块级变量 `accessToken` + `setAccessToken/getAccessToken`）
- refresh token 不再存 localStorage，依赖 httpOnly cookie（`refreshAccessToken` 用 `credentials:'include'`，后端 TODO：登录接口 Set-Cookie）
- 启动时无内存 access token → 直接进登录页（不再依赖 localStorage 持久化登录态，靠 refresh cookie 静默续期）
- `saveTokens`/`clearTokens` 仅操作内存 token + localStorage 的非敏感 userId

### 缺陷8 — audit.ts Mock 回退（`src/api/audit.ts`）
**问题**：API 失败/空列表都回退 mock，掩盖真实故障。
**修复**：
- `if (raw == null) return []`（空数组，非 mock）
- `return mapped`（直接返回，空就是空）

### 缺陷9 — 无主动刷新（`src/api/auth.ts`）
**问题**：refreshSession 无定时调度，token 静默过期。
**修复**：
- 新增 `parseJwtExp()` 解析 JWT payload 的 `exp` 字段
- 新增 `scheduleProactiveRefresh()`：access token 剩余 5 分钟时主动调 `refreshSession()`，refresh 成功后重新调度
- 登录成功 / fetchMe 成功 / refresh 成功后均调用 `scheduleProactiveRefresh()`
- `clearProactiveRefresh()` 供登出时清理定时器

---

## 二、验证阶段补漏（tsc --noEmit 发现）

`npx tsc --noEmit` 首次运行报 2 处判别联合（discriminated union）窄化错误，系缺陷5改造后调用方未完全适配，已修复：

| 文件 | 行 | 问题 | 修复 |
|------|-----|------|------|
| `src/features/clone/CloneView.tsx` | 166 | `if(!result.ok)` 分支访问 `result.reason` 报"属性不存在"（跨文件判别联合在 await 后窄化未生效） | 改用 `in` 操作符守卫：`'reason' in result ? result.reason : 'request_failed'` |
| `src/features/report/ReportSheet.tsx` | 66 | `if(!res.ok)` 分支访问 `res.error` 同类窄化失败 | 改用 `in` 操作符守卫：`'error' in res ? res.error : 'request_failed'` |
| `src/types.ts` | 7 | `AppState` 定义了 `'checking'` 但 `App.tsx` 从未使用（死代码） | 删除 `'checking'`，状态机由 `splash` 内 AbortController 承载 fetchMe 进行中阶段 |

---

## 三、最终验收

```
cd Echo && npx tsc --noEmit
→ EXIT 0（零错误，零警告）
```

## 四、后端 TODO（前端已预留，待后端配合）

1. **httpOnly cookie**：登录接口 `Set-Cookie` 存 refresh token；`/auth/refresh` 接口从 Cookie 读取（前端已用 `credentials:'include'`）
2. **WebSocket 子协议鉴权**：后端从 `Sec-WebSocket-Protocol` 头读取 `['bearer', token]` 并校验
3. **logout 黑名单**：后端阶段1已完成，前端 `clearProactiveRefresh()` + 清内存 token 适配
