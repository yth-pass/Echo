# Echo 部署指南 — 1 小时上线

> 方案：**Railway**（API + Worker）+ **Vercel**（前端）+ 现有 Neon DB + Upstash Redis
> 预估时间：注册到上线 ~40 分钟

---

## 第 0 步：推送代码到 GitHub

在你平时开发用的终端（CMD）中执行：

```cmd
cd C:\Users\Administrator\Desktop\Echo
git push origin main
```

代码已经 commit 好了（`9d15fc5`），只需要 push。

---

## 第 1 步：Railway 部署 API + Worker（~15 分钟）

### 1.1 注册 Railway

1. 打开 https://railway.app
2. 点 **Sign Up** → 用 **GitHub 账号**登录（最快）
3. 进入 Dashboard 后点 **New Project**

### 1.2 创建服务

1. 选 **Deploy from GitHub repo**
2. 授权 Railway 访问 `yth-pass/Echo` 仓库（选 Only selected repositories → Echo）
3. 选中 `Echo` 仓库

### 1.3 配置 Root Directory

Railway 会自动检测 Dockerfile。你需要设置 root directory：

1. 点击刚创建的服务 → **Settings**
2. **Source** → **Root Directory** 留空（Dockerfile 在仓库根目录，不需要设）
3. 确认 **Deploy** 页显示 Docker 构建

### 1.4 设置环境变量

点服务 → **Variables** → **New Variable**，逐个添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `PORT` | `4000` | API 端口 |
| `NODE_ENV` | `production` | 生产模式 |
| `DATABASE_URL` | 从你现有 `.env` 复制 | Neon PostgreSQL 连接串 |
| `REDIS_URL` | 从你现有 `.env` 复制 | Upstash Redis 连接串（`rediss://`） |
| `JWT_SECRET` | **生成新的 32+ 字符随机串** | 生产必须换新的！ |
| `JWT_ACCESS_TTL` | `15m` | |
| `JWT_REFRESH_TTL` | `7d` | |
| `DEEPSEEK_API_KEY` | 从你现有 `.env` 复制 | |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | |
| `DEEPSEEK_MODEL` | `deepseek-chat` | |
| `DASHSCOPE_API_KEY` | 从你现有 `.env` 复制 | 阿里云 DashScope embedding |
| `DASHSCOPE_BASE_URL` | 从你现有 `.env` 复制 | |
| `DASHSCOPE_EMBED_MODEL` | 从你现有 `.env` 复制 | |
| `BYPASS_REDIS` | `false` | **生产必须 false**，用真实 Redis |
| `OTP_DEV_CODE` | **留空** | 生产不能填，否则安全漏洞 |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 从你现有 `.env` 复制 | |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 从你现有 `.env` 复制 | |
| `SMS_SIGN_NAME` | 从你现有 `.env` 复制 | |
| `SMS_TEMPLATE_CODE` | 从你现有 `.env` 复制 | |
| `SMS_CODE_VALID_MINUTES` | `5` | |
| `ECHO_MEMORY_BASE_DIR` | `/tmp/echo-memory` | Worker 内存目录 |
| `DEV_SKIP_BOOTSTRAP` | `true` | 首次部署跳过 bootstrap |
| `COOKIE_SAME_SITE` | `none` | 跨域 cookie 必须 none |
| `FINALIZE_TIMEOUT_MS` | `120000` | finalize 超时 |

> **CORS_ORIGINS** 先不填——等 Vercel 部署完拿到前端 URL 后再回来填。

### 1.5 生成 JWT_SECRET

在终端运行：

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

把输出的 96 字符 hex 字符串填入 Railway 的 `JWT_SECRET`。

### 1.6 配置网络

1. Settings → **Networking** → **Generate Domain**
2. Railway 会给你一个公网域名，类似 `echo-api-production-xxxx.up.railway.app`
3. 记下这个域名（后面要用）

### 1.7 等待构建完成

1. 切到 **Deployments** 页
2. 看 Docker 构建日志，等 Status 变 **Active**（~5-8 分钟）
3. 如果失败，看 **Deploy Logs** 里的错误信息

---

## 第 2 步：Vercel 部署前端（~10 分钟）

### 2.1 注册 Vercel

1. 打开 https://vercel.com
2. 点 **Sign Up** → 用 **GitHub 账号**登录
3. 授权 Vercel 访问 `yth-pass/Echo` 仓库

### 2.2 Import 项目

1. Dashboard → **Add New…** → **Project**
2. 找到 `yth-pass/Echo` 仓库 → **Import**
3. **关键配置：**
   - **Root Directory** 设为 `Echo`（大写 E）—— 这是前端 package.json 所在目录
   - Vercel 会自动检测 Vite 框架
   - **Build Command**: `npm run build`（自动检测）
   - **Output Directory**: `dist`（自动检测）

### 2.3 设置环境变量

在 Import 页面的 **Environment Variables** 区域添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_BASE_URL` | `https://你的Railway域名/v1` | 例: `https://echo-api-production-xxxx.up.railway.app/v1` |

### 2.4 部署

1. 点 **Deploy**
2. 等待构建完成（~2-3 分钟）
3. 部署成功后 Vercel 会给你一个 URL，类似 `echo-xxxx.vercel.app`
4. **记下这个前端 URL**

---

## 第 3 步：互相配置域名（~2 分钟）

### 3.1 回到 Railway 添加 CORS_ORIGINS

1. Railway → 你的服务 → **Variables**
2. 添加 `CORS_ORIGINS` = `https://你的Vercel域名`
   - 例: `https://echo-xxxx.vercel.app`
3. Railway 会自动重新部署（~2 分钟）

### 3.2 验证 Vercel 配置

确认 `VITE_API_BASE_URL` 指向 Railway 的 API 域名。

---

## 第 4 步：验证上线（~5 分钟）

### 4.1 检查 API 健康

浏览器打开 `https://你的Railway域名/v1/health`，应该返回 JSON。

### 4.2 检查前端

打开 Vercel 给的 URL，应该看到 Echo 登录页。

### 4.3 测试注册/登录流程

1. 输入手机号 → 发验证码
2. 如果你阿里云短信配置正确，会收到验证码
3. 如果想先测试不走短信：临时在 Railway 设 `BYPASS_REDIS=true` + `OTP_DEV_CODE=8888`（**测完立即改回来**）

### 4.4 检查 WebSocket

登录后打开浏览器 DevTools → Network → WS，应该看到 WebSocket 连接成功。

---

## 常见问题速查

### Docker 构建失败：Prisma generate 报错
检查 `DATABASE_URL` 格式是否包含 `sslmode=require&schema=public`。

### 前端白屏 / API 404
检查 `VITE_API_BASE_URL` 是否以 `/v1` 结尾（不含尾部斜杠）。

### Cookie 不生效 / 登录后立即掉线
- 确认 `COOKIE_SAME_SITE=none`
- 确认 Railway 域名是 HTTPS（Railway 默认 HTTPS）
- 检查浏览器 DevTools → Application → Cookies

### CORS 报错
- 确认 `CORS_ORIGINS` 包含 Vercel 的完整 URL（`https://xxx.vercel.app`）
- 不要包含尾部斜杠

### WebSocket 连接失败
- 前端 WS 地址是自动从 `VITE_API_BASE_URL` 推导的（http→ws 转换）
- Railway 原生支持 WebSocket，无需额外配置

---

## 环境变量速查表

### Railway（API + Worker）需要的所有变量：
```
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://...（从现有 .env 复制）
REDIS_URL=rediss://...（从现有 .env 复制）
JWT_SECRET=<新生成的 96 字符 hex>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
DEEPSEEK_API_KEY=...（从现有 .env 复制）
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DASHSCOPE_API_KEY=...（从现有 .env 复制）
DASHSCOPE_BASE_URL=...（从现有 .env 复制）
DASHSCOPE_EMBED_MODEL=...（从现有 .env 复制）
BYPASS_REDIS=false
OTP_DEV_CODE=
ALIBABA_CLOUD_ACCESS_KEY_ID=...（从现有 .env 复制）
ALIBABA_CLOUD_ACCESS_KEY_SECRET=...（从现有 .env 复制）
SMS_SIGN_NAME=...（从现有 .env 复制）
SMS_TEMPLATE_CODE=...（从现有 .env 复制）
SMS_CODE_VALID_MINUTES=5
ECHO_MEMORY_BASE_DIR=/tmp/echo-memory
DEV_SKIP_BOOTSTRAP=true
COOKIE_SAME_SITE=none
CORS_ORIGINS=https://你的Vercel域名
FINALIZE_TIMEOUT_MS=120000
```

### Vercel（前端）需要的变量：
```
VITE_API_BASE_URL=https://你的Railway域名/v1
```

---

## 费用估算

| 服务 | 方案 | 月费 |
|------|------|------|
| Railway | Hobby plan（$5 额度） | ~$0-5 |
| Vercel | Hobby（免费） | $0 |
| Neon DB | 已有（免费层） | $0 |
| Upstash Redis | 已有（免费层） | $0 |
| DeepSeek API | 按用量 | ~$1-5 |
| 阿里云短信 | 按用量 | ~¥0.04/条 |
| **合计** | | **~$5-10/月** |

---

## 我做了哪些代码改动

1. **CORS 环境变量化**（`services/api/src/main.ts`）
   - `CORS_ORIGINS` 逗号分隔多个域名，本地默认 localhost:3000

2. **Cookie 跨域支持**（`services/api/src/auth/auth.controller.ts`）
   - `COOKIE_SAME_SITE` 环境变量，生产默认 `none`（配合 Secure）

3. **Dockerfile**（`Dockerfile`）
   - 多阶段构建，API 用 nest build 编译，Worker 用 tsx 从源码运行
   - API + Worker 单镜像，`deploy/start.sh` 并行启动

4. **Vercel 配置**（`Echo/vercel.json`）
   - SPA 路由重写规则 + 静态资源长期缓存

5. **.dockerignore**
   - 排除前端、文档、Android 等无关目录，加速 Docker 构建
