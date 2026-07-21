# 统一验证码机制 — 改动总结

## 问题根因

用户反馈"收到验证码但输入后验证不通过"。诊断发现两个叠加问题：

### 问题 1：两套验证机制不统一
- **dev 模式**：后端存明文码 → 后端自己比对 ✅
- **阿里云模式**：阿里云生成码（后端拿不到）→ 调 `CheckSmsVerifyCode` 回传校验 → 多一次网络调用、异常处理复杂
- 阿里云 `CheckSmsVerifyCode` 在验证码错误时**抛 HTTP 400 异常** `isv.ValidateFail`，而非返回 `verifyResult=UNKNOWN`，catch 逻辑容易出问题

### 问题 2：阿里云账户余额不足
```
Account suspended due to an insufficient balance.
```
余额不足导致发送和校验都受影响。

## 解决方案：统一为一套 Redis 明文比对

```
sendOtp(phone):
  ├─ OTP_DEV_CODE 有值（dev）：存固定码到 Redis
  └─ OTP_DEV_CODE 为空（prod）：
        └─ 调阿里云 SendSmsVerifyCode(returnVerifyCode: true)
            └─ 阿里云生成码 → 下发短信 + 回传明文码 → 后端存 Redis

loginWithOtp(phone, code):
  └─ 从 Redis 取明文码 → 本地比对（一套逻辑，无分支）
```

**关键改动**：`returnVerifyCode: true` 让阿里云在 `body.model.verifyCode` 回传明文码，后端拿到后存 Redis，校验时本地比对。不再调用 `CheckSmsVerifyCode`。

## 改动文件

| 文件 | 改动 |
|------|------|
| `sms.service.ts` | `sendVerifyCode` 改 `returnVerifyCode: true`，返回 `{code, bizId}`；`checkVerifyCode` 保留但不再被调用 |
| `auth.service.ts` | `sendOtp` prod 模式存阿里云回传明文码到 Redis；`loginWithOtp` 统一为 `stored === code` 本地比对，去掉阿里云校验分支 |

## 验证结果（dev 模式）

| 用例 | 预期 | 实际 |
|------|------|------|
| 发送验证码 | sent:true / 201 | ✅ |
| 正确码 123456 登录 | access_token / 201 | ✅ |
| 错误码 999999 登录 | 401 | ✅ |

## 启用真实短信的步骤

1. **阿里云账户充值**（当前余额不足）
2. `services/api/.env` 把 `OTP_DEV_CODE=123456` 改成 `OTP_DEV_CODE=`
3. 重启后端

充值后验证码流程：阿里云生成 6 位码 → 短信下发手机 → 回传明文码给后端 → 后端存 Redis → 用户输入码 → 后端本地比对 → 通过发 JWT。

## 架构对比

| 维度 | 旧方案（双分支） | 新方案（统一） |
|------|-----------------|---------------|
| dev 校验 | Redis 明文比对 | Redis 明文比对 |
| prod 校验 | 调阿里云 CheckSmsVerifyCode | Redis 明文比对 |
| 阿里云调用次数 | 2 次（发送+校验） | 1 次（仅发送） |
| 受余额影响 | 发送+校验都受影响 | 仅发送受影响 |
| 异常处理 | 需处理阿里云校验异常 | 无额外异常 |
| 代码复杂度 | if/else 双分支 | 单一逻辑 |
