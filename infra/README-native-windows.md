# Echo — Windows 本地开发（无 Docker / 云端数据面）

在 **Windows** 上无法使用 Docker Desktop 时，可用 **Neon（PostgreSQL）+ Upstash（Redis）** 免费层承载 Phase 1 数据面；本机只运行 Node 进程（`services/api`、`services/worker`、`echo`）。

若仍可使用 Docker，见 [README.md](./README.md) 中的 Compose 方式。

**Phase 1 实际依赖：** Postgres + Redis。MinIO 当前未在 API/Worker 中使用，可跳过。

---

## 架构

```text
Windows 本机                    云端（免费层）
─────────────                    ─────────────
echo :3000  ──REST──►  api :4000 ──► Neon Postgres
                      worker      ──► Upstash Redis (rediss://, TLS)
```

---

## 1. 前置条件

- Node.js 20+
- 本仓库已安装依赖：

```powershell
cd services\api
npm install
cd ..\worker
npm install
cd ..\..\echo
npm install
```

- 注册账号（免费）：
  - [Neon](https://neon.tech) — PostgreSQL
  - [Upstash](https://upstash.com) — Redis

---

## 2. Neon（PostgreSQL）

1. 登录 Neon → **New Project**。
2. 记下连接信息（Host、User、Password、Database）。库名可为默认 `neondb`，不必改名为 `echo`。
3. 在 Project → **Connection details** 复制连接串，选择 **URI** 或 **Pooled connection**（Prisma 迁移可用 Direct；运行时 Pooled 亦可）。
4. 拼成 Prisma 使用的 `DATABASE_URL`（**必须**含 `sslmode=require`）：

```text
postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require&schema=public
```

示例（占位符请替换）：

```text
postgresql://neondb_owner:xxxxxxxx@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public
```

> MVP 向量存在 JSON 字段，Neon 默认 Postgres 即可，无需 pgvector 扩展。

---

## 3. Upstash（Redis）

1. 登录 Upstash → **Create database**（Regional，选离你近的区域）。
2. 打开该库 → **Connect** → 复制 **Redis URL**（以 `rediss://` 开头，**不是** REST URL）。
3. 写入环境变量 `REDIS_URL`，例如：

```text
rediss://default:AXxxxxx...@us1-xxx-12345.upstash.io:6379
```

代码已对 `rediss://` 启用 TLS，并与 BullMQ 对齐（`maxRetriesPerRequest: null`）。

---

## 4. 配置 `.env`（与项目键名对齐）

### `services/api/.env`

```powershell
cd services\api
copy .env.example .env
notepad .env
```

在 `.env` 中设置（云开发时注释掉 localhost 两行，启用下面两行）：

```text
PORT=4000
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require&schema=public
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379
JWT_SECRET=<随机长字符串，勿提交 Git>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
OTP_DEV_CODE=123456
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### `services/worker/.env`

```powershell
cd ..\worker
copy .env.example .env
notepad .env
```

**`DATABASE_URL` 与 `REDIS_URL` 必须与 `services/api/.env` 完全相同**（同一 Neon 库、同一 Upstash 库）。

---

## 5. 初始化云端数据库

在 **`services/api`** 目录执行（对空库使用 `migrate deploy`，不要用交互式 `migrate dev`）：

```powershell
cd services\api
npx prisma migrate deploy
npm run prisma:seed
```

成功后会创建演示用户（手机 `13800000001`～`03`）、广场种子帖与一条匹配推送。

---

## 6. 启动服务

**终端 1 — API**

```powershell
cd services\api
npm run start:dev
```

**终端 2 — Worker**

```powershell
cd services\worker
npm run start:dev
```

**终端 3 — 演示客户端**

```powershell
cd echo
```

确认 `echo/.env.local` 含：

```text
VITE_API_BASE_URL=http://localhost:4000/v1
```

不要把 Neon/Upstash 连接串写进 `VITE_*`（会打进浏览器包）。

```powershell
npm run dev
```

浏览器打开 `http://localhost:3000`。

**演示分身账号（seed）：** `13800000001` / `13800000002`（林溪的分身、陈默的分身）— 已完成问卷，登录后**跳过**入驻向导。新手机号走注册 + 完整问卷。

**分身后台运行：** 需同时运行 Worker，并配置 `DEEPSEEK_API_KEY`（发帖/对话 LLM）。触发规则见 [`docs/Clone-Runtime-and-Triggers-Echo.md`](../docs/Clone-Runtime-and-Triggers-Echo.md)。

---

## 7. 验收

```powershell
curl.exe http://localhost:4000/v1/health
```

应返回 JSON，`status` 为 `ok`。

PowerShell 中请用 `curl.exe` 或 `Invoke-RestMethod`，避免 `curl` 别名破坏 JSON。

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/v1/auth/otp" -Method Post -ContentType "application/json" -Body '{"phone":"13800000001"}'
Invoke-RestMethod -Uri "http://localhost:4000/v1/auth/login" -Method Post -ContentType "application/json" -Body '{"phone":"13800000001","code":"123456"}'
```

老用户 `13800000001` 登录响应应含 `"onboardingComplete":true`，客户端直接进入广场。

开发环境可用 `.env` 中的 `OTP_DEV_CODE=123456` 登录；真实 OTP 会打在 API 控制台日志中。

---

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| Prisma 连不上 Neon | 检查 `sslmode=require`；密码含特殊字符需 URL 编码 |
| Redis 连接超时 / TLS 错误 | 确认使用 **Redis URL**（`rediss://`），不是 REST API URL |
| `prisma migrate` 失败 | 对全新 Neon 库用 `npx prisma migrate deploy` |
| 首次请求很慢 | Neon/Upstash 免费层休眠，唤醒后恢复正常 |
| Worker 无任务 | 需 API + Worker 同时运行且 `REDIS_URL` 一致 |
| 只想测同步 API | 可只起 API；OTP 仍要 Redis；队列功能需 Worker |

---

## 9. 安全提醒

- 勿将 Neon / Upstash 连接串提交到 Git。
- `JWT_SECRET` 使用足够长的随机值。
- `echo` 仅配置 `VITE_API_BASE_URL` 指向本机 API，密钥放在服务端 `.env`。

---

## 10. 其他无 Docker 方式（简述）

| 方式 | 说明 |
|------|------|
| WSL2 内 `apt install` Postgres + Redis | 连接串用 `localhost`，与 `.env.example` 默认一致 |
| Windows 本机安装 Postgres + Memurai | 同上 |
| Podman Desktop | 可替代 Docker Desktop 运行 `infra/docker-compose.yml` |

云端方案（本文）适合本机环境最简、仅需浏览器注册云服务的场景。
