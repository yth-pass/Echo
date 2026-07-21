# 阿里云短信验证码接入 — 改动总结

> 用户申请了阿里云号码认证服务（Dypnsapi），将 MVP 阶段「只打印日志」的假验证码升级为真实短信下发。

## 关键架构决策

用户申请的是阿里云**号码认证服务（Dypnsapi）**的 `SendSmsVerifyCode` 接口，而非普通短信 API。两者有本质区别：

| 维度 | 普通 SendSms | Dypnsapi SendSmsVerifyCode（本项目用） |
|------|-------------|--------------------------------------|
| 验证码生成 | 后端生成 | **阿里云生成**（模板参数 `##code##` 占位符） |
| 验证码下发 | 后端传明文码给阿里云转发 | 阿里云直接下发，后端拿不到明文 |
| 验证码校验 | 后端自己比对 | **回调阿里云 `CheckSmsVerifyCode`** |
| Redis 存储 | 存验证码明文 | 存 `aliyun:pending` 状态标记 |

因此 `loginWithOtp()` 也必须改造——不能再从 Redis 取码比对，改为调阿里云校验接口（`verifyResult === 'PASS'` 表示通过）。

## 改动文件清单（4 个文件 + 1 个新文件 + 1 依赖）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `services/api/src/auth/sms.service.ts` | **新增** — 封装阿里云 Dypnsapi client，`sendVerifyCode()` / `checkVerifyCode()` |
| 2 | `services/api/src/auth/auth.service.ts` | `sendOtp` 生产走阿里云+60s频率限制；`loginWithOtp` 生产走 CheckSmsVerifyCode；dev 走旧逻辑兜底 |
| 3 | `services/api/src/auth/auth.module.ts` | providers 注入 `SmsService` |
| 4 | `services/api/.env` | 加阿里云配置项（AK 留空待填，签名/模板已填） |
| 5 | `services/api/.env.example` | 同步配置项 + 注释说明 |
| 6 | `package.json` | 新增 `@alicloud/dypnsapi20170525@^2`（自动带 `@alicloud/openapi-core`） |

## 双模式分流逻辑

```
sendOtp(phone):
  ├─ Redis SETNX otp:throttle:{phone} 60s  →  失败则 429
  ├─ OTP_DEV_CODE 有值（本地开发）：
  │     └─ 后端存固定码到 Redis → 打日志 → 不调阿里云（省钱）
  └─ OTP_DEV_CODE 为空（生产）：
        └─ 调阿里云 SendSmsVerifyCode → Redis 存 'aliyun:pending' 标记

loginWithOtp(phone, code):
  ├─ Redis 存的是明文码（dev）→ 本地比对
  └─ Redis 存的是 'aliyun:pending'（prod）→ 调阿里云 CheckSmsVerifyCode
       └─ verifyResult === 'PASS' → 通过，发 JWT
```

## 验证结果（dev 模式回归）

| 用例 | 预期 | 实际 |
|------|------|------|
| 发送验证码 | sent:true / 201 | ✅ `{"sent":true}` HTTP 201 |
| 60s 内重发 | 429 频率限制 | ✅ HTTP 429「操作过于频繁」 |
| 123456 登录 | access_token / 201 | ✅ 返回 token |
| 错误码登录 | 401 | ✅ HTTP 401 Invalid OTP |

后端日志确认走 dev 兜底：`OTP(dev) for 13800138000: 123456 — 走本地兜底，未调用短信网关`

## 启用真实短信的最后一步（待用户填凭证）

`services/api/.env` 当前状态：
```
OTP_DEV_CODE=123456                              ← 本地兜底，填着就走假验证码
ALIBABA_CLOUD_ACCESS_KEY_ID=                     ← 待填
ALIBABA_CLOUD_ACCESS_KEY_SECRET=                 ← 待填
SMS_SIGN_NAME=速通互联验证码                      ← 已填（用户申请的签名）
SMS_TEMPLATE_CODE=100001                         ← 已填（用户申请的模板）
SMS_CODE_VALID_MINUTES=5                         ← 已填
```

**切换到真实短信的两步操作**：
1. 在阿里云 RAM 访问控制 → AccessKey 管理，创建 AccessKey，把 ID/Secret 填入 `.env` 的两个空位
2. 把 `OTP_DEV_CODE=123456` 改成 `OTP_DEV_CODE=`（留空）

重启后端即生效：`OTP_DEV_CODE` 为空 → 自动走阿里云发送+校验，手机真实收到短信。

## 安全设计要点

- `OTP_DEV_CODE` 在 `NODE_ENV === 'production'` 时**代码层面强制忽略**，生产环境无法用固定码绕过
- `returnVerifyCode: false` — 不让阿里云回传明文码，后端全程不持有验证码
- 60 秒发送频率限制（Redis SETNX + 阿里云侧 `interval:60` 双保险）
- 阿里云调用失败审计 + 友好错误提示，不暴露内部细节
- `SmsService` 凭证缺失时降级为未启用，dev 兜底仍可用，不会崩
