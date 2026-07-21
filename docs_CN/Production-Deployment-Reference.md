# Echo 生产环境部署参考

> **用途**：本文档描述线上生产环境的完整情况，供任何 Agent 或开发者了解部署了什么、在哪里、如何安全修改。
>
> **最后更新**：2026-07-11
> **服务器**：腾讯云轻量应用服务器，上海四区

---

## 1. 服务器概览

| 属性 | 值 |
|------|-----|
| **IP 地址** | `124.223.73.232` |
| **实例 ID** | `lhins-97mnk1l8` |
| **操作系统** | Ubuntu Server 24.04 LTS |
| **配置** | 4 核 CPU, 4 GB 内存, 40 GB SSD, 3 Mbps 带宽 |
| **SSH 登录** | `ssh ubuntu@124.223.73.232`（密码认证） |
| **应用目录** | `/opt/echo` |
| **备份目录** | `/opt/backups/` — 每天凌晨 3:00 备份，保留 7 天 |
| **到期时间** | 2027-07-06 |

---

## 2. 架构

```
互联网
    │
    ├── :80  (HTTP)  ──┐
    ├── :443 (HTTPS) ──┤─ Nginx (echo-nginx)
    │                   │
    └── Docker 内部网络 (echo-net) ──┐
                                     │
    ┌────────────────────────────────┘
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Nginx   │────▶│   App    │────▶│PostgreSQL│     │  Redis   │
│ :80,:443 │     │  :4000   │     │  :5432   │     │  :6379   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
    │                  │
    │ 前端             │ API + Worker
    │ (Vite SPA)       │ (NestJS, 单进程)
    └──────────────────┘
```

**关键设计决策**：
- **Nginx 直接托管前端**（Vite 构建产物，路径 `/usr/share/nginx/html`）。API 请求（`/v1/*`）反向代理到 `app` 容器。
- **App 在同一进程中运行 API + Worker**（`deploy/start.sh` 用 `&` 同时启动两个进程，单个 Docker 容器）。
- **PostgreSQL 和 Redis 不暴露到公网** — 仅 Docker 内部网络 `echo-net` 可访问。
- **数据持久化**：PostgreSQL 和 Redis 使用 Docker 命名卷（`postgres_data`、`redis_data`）。Agent 记忆使用 `app_memory` 卷。

---

## 3. Docker Compose 服务

从 `/opt/echo` 运行：
```bash
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml <命令>
```

| 服务 | 镜像 | 容器名 | 端口 (宿主机) | 用途 |
|------|------|--------|--------------|------|
| `postgres` | `pgvector/pgvector:pg16` | `echo-postgres` | 无 (内部) | 数据库 + AI 向量 |
| `redis` | `redis:7-alpine` | `echo-redis` | 无 (内部) | 缓存 + BullMQ 队列 |
| `app` | 从根目录 `Dockerfile` 构建 | `echo-app` | 无 (内部) | NestJS API + Worker |
| `nginx` | 从 `deploy/nginx/Dockerfile` 构建 | `echo-nginx` | 80, 443 | 静态文件 + 反向代理 |

### 3.1 PostgreSQL (echo-postgres)
- **数据库名**：`echo_db`
- **用户名**：`echo_user`
- **扩展**：`pgvector`、`uuid-ossp`（通过 `deploy/postgres/init/01-extensions.sql` 自动创建）
- **Schema 管理**：Prisma（`npx prisma db push`）
- **卷**：`postgres_data`（Docker 命名卷）

### 3.2 Redis (echo-redis)
- **持久化**：AOF + RDB 快照（配置在 `deploy/redis/redis.conf`）
- **最大内存**：512 MB，淘汰策略 `allkeys-lru`
- **卷**：`redis_data`（Docker 命名卷）
- **认证**：通过 compose 命令中的 `--requirepass` 设置密码

### 3.3 App (echo-app)
- **运行时**：Node.js 20（基于 `node:20-slim` 镜像）
- **端口**：4000（仅内部）
- **入口**：`deploy/start.sh` → 启动 Worker (PID 9) 然后 API (PID 10)
- **WebSocket**：`/v1/ws` 挂载在同一 HTTP 服务器上
- **构建**：多阶段 Docker 构建（见根目录 `Dockerfile`）
  - 构建阶段：npm install → Prisma generate → NestJS 编译
  - Worker 通过 `tsx` 直接运行 TypeScript 源码

### 3.4 Nginx (echo-nginx)
- **前端构建**：Node.js 22 → Vite 构建，`VITE_API_BASE_URL=/v1`
- **SSL**：证书位于 `/etc/nginx/ssl/`（从 `deploy/nginx/ssl/` 挂载）
- **配置文件**：
  - `deploy/nginx/nginx.conf` — 主配置、upstream、限流
  - `deploy/nginx/conf.d/echo.conf` — HTTP server block（当前启用）
  - `deploy/nginx/conf.d/echo-ssl.conf` — HTTPS server block（备案完成后启用）

---

## 4. 环境变量

生产环境变量文件位于 `/opt/echo/deploy/.env.production`（**已 gitignore，含真实密钥**）。
模板文件位于 `deploy/.env.production.example`（**已提交，可安全读取**）。

### 4.1 必需变量（生产环境已全部配置）

| 变量 | .env.production 中已配置? | 用途 |
|------|------------------------|------|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | ✅ | PostgreSQL 连接 |
| `REDIS_PASSWORD` | ✅ | Redis 认证 |
| `JWT_SECRET` | ✅ | JWT 令牌签名 |
| `DEEPSEEK_API_KEY` | ✅ | AI 文本/聊天 |
| `DASHSCOPE_API_KEY` | ✅ | AI 向量 + 图片/语音/3D 生成 |
| `COS_SECRET_ID`, `COS_SECRET_KEY` | ✅ | 腾讯云 COS 头像上传 |
| `COS_BUCKET` | `echo-prod-1375236416` | COS 存储桶名称 |
| `COS_REGION` | `ap-shanghai` | COS 地域（与服务器同地域，内网互通） |

### 4.2 短信变量（阿里云）

| 变量 | 用途 |
|------|------|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 短信 API 密钥 |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 短信 API 密钥密码 |
| `SMS_SIGN_NAME` | `速通互联验证码` |
| `SMS_TEMPLATE_CODE` | `100001` |
| `SMS_CODE_VALID_MINUTES` | `5` |

### 4.3 前端 URL

| 状态 | 值 |
|------|-----|
| 备案期间 | `http://124.223.73.232` |
| 备案完成后 + SSL | `https://echoecho.chat` |

---

## 5. 关键文件与目录

### 5.1 部署配置（修改前务必检查）

| 文件 | 用途 |
|------|------|
| `deploy/docker-compose.prod.yml` | Docker Compose 服务定义 |
| `deploy/.env.production.example` | 环境变量模板（安全，无密钥） |
| `deploy/.env.production` | **真实密钥**（已 gitignore，仅服务器上有） |
| `deploy/nginx/nginx.conf` | Nginx 主配置 |
| `deploy/nginx/conf.d/echo.conf` | HTTP server block（当前启用） |
| `deploy/nginx/conf.d/echo-ssl.conf` | HTTPS server block（备案完成后启用） |
| `deploy/nginx/ssl/echoecho.chat_bundle.crt` | SSL 证书 |
| `deploy/nginx/ssl/echoecho.chat.key` | SSL 私钥 |
| `deploy/nginx/Dockerfile` | Nginx + 前端构建 |
| `deploy/start.sh` | App 入口脚本（API + Worker 启动器） |
| `deploy/redis/redis.conf` | Redis 持久化 + 内存配置 |
| `deploy/postgres/init/01-extensions.sql` | PostgreSQL 初始化脚本 |

### 5.2 后端源码（在服务器的 `app` 容器内运行）

| 路径 | 用途 |
|------|------|
| `services/api/src/main.ts` | API 入口 |
| `services/api/src/app.module.ts` | NestJS 根模块 |
| `services/api/src/cos/cos.service.ts` | 腾讯云 COS 上传服务 |
| `services/api/src/avatar/avatar.service.ts` | 头像上传（COS 优先，Base64 回退） |
| `services/api/src/auth/sms.service.ts` | 阿里云短信验证码 |
| `services/api/src/llm/llm.service.ts` | DeepSeek + DashScope LLM 集成 |
| `services/api/prisma/schema.prisma` | 数据库 Schema（唯一数据源） |
| `services/worker/src/main.ts` | 后台 Worker 入口 |
| `services/worker/src/clone-runtime/` | 分身运行时（匹配桥接、调度器） |

### 5.3 前端源码（构建进 Nginx 镜像）

| 路径 | 用途 |
|------|------|
| `echo/package.json` | 前端依赖 |
| `echo/vite.config.ts` | Vite 构建配置 |
| `echo/src/api/client.ts` | API 客户端 + `VITE_API_BASE_URL` 处理 |
| `echo/src/App.tsx` | 主应用入口 |

---

## 6. 如何更新部署

有两种部署方式。**推荐方式 A（GitHub）。**

> ⚠️ **重要 — 本地 Windows 命令的 Git 执行环境**
>
> 本地机器是 **Windows**。在普通 CMD/PowerShell 中运行 `git` 会报 `'git' 不是内部或外部命令`，因为 Git 不在系统 PATH 中。**本节中所有本地 `git` / `tar` / `scp` / `ssh` 命令必须在以下环境之一执行：**
>
> 1. **Git Bash** — 安装 Git for Windows 时自带，通常在 `C:\Program Files\Git\bin\bash.exe`。打开后先 `cd /c/Users/Administrator/Desktop/Echo`。
> 2. **Agent 的 Bash 工具**（如在 WorkBuddy/CodeBuddy 中运行时）— 该环境封装了 Git Bash，`git` 在 `/usr/bin/git` 可用。
> 3. **使用完整路径** — `"C:\Program Files\Git\bin\git.exe" add -A` 等（繁琐，不推荐）。
>
> **GitHub Personal Access Token**（HTTPS 推送用）存储在用户密码管理器中（classic token，`repo` 权限）。如已过期，在 https://github.com/settings/tokens 生成新的。将下方推送命令中的 `<GH_TOKEN>` 替换为实际 token。
>
> **仓库地址**：`https://github.com/yth-pass/Echo.git`

### 方式 A：Git Push + Pull（GitHub 可达时）

**本地 Windows 机器上（在 Git Bash 或 Agent 的 Bash 工具中）：**
```bash
cd /c/Users/Administrator/Desktop/Echo
git add -A
git commit -m "你的提交信息"
git push https://<GH_TOKEN>@github.com/yth-pass/Echo.git main
```

**服务器上（SSH）：**
```bash
ssh ubuntu@124.223.73.232
sudo -i
cd /opt/echo
git pull
# 注意：git pull 会重置 deploy/docker-compose.prod.yml 中的 context 路径。修复它：
sed -i 's|context: \.\./\.\.|context: ..|g' deploy/docker-compose.prod.yml
# 重建 app + nginx（postgres 和 redis 不受影响）
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app nginx
# 如果新增了 Prisma model/迁移：
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec app sh -c "cd /app/services/api && npx prisma db push"
```

### 方式 B：SCP（GitHub 从国内不可达时）

**本地 Windows 机器上：**
```cmd
cd C:\Users\Administrator\Desktop
tar czf echo-update.tar.gz --exclude="node_modules" --exclude=".git" --exclude="dist" Echo
scp echo-update.tar.gz ubuntu@124.223.73.232:/tmp/
ssh ubuntu@124.223.73.232 "sudo rm -rf /opt/echo-sync && sudo mkdir -p /opt/echo-sync && sudo tar xzf /tmp/echo-update.tar.gz -C /opt/echo-sync && sudo rsync -av --delete /opt/echo-sync/Echo/ /opt/echo/"
```
然后服务器上重建：
```bash
sudo -i
cd /opt/echo
sed -i 's|context: \.\./\.\.|context: ..|g' deploy/docker-compose.prod.yml
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app nginx
```

### 更新时的注意事项

1. **仓库中的 `context: ../..` 在服务器上不对。** 在服务器上，`../..` 从 `deploy/` 解析为 `/opt`（仓库的父目录），而不是 `/opt/echo`。修复命令 `sed -i 's|context: \.\./\.\.|context: ..|g'` 必须在每次 `git pull` 后执行。这是已知问题，待永久修复。

2. **目录大小写**：Git 中追踪的是 `echo/`（小写）。Windows 上由于不区分大小写的文件系统，显示为 `Echo/`。Linux 服务器上是 `echo/`。Nginx Dockerfile 使用 `echo/`（小写），在 Linux 上是正确的。

3. **绝对不要提交 SSL 证书或 .env.production。** 它们已被 gitignore。

---

## 7. 当前集成

### 7.1 COS（腾讯云对象存储）

| 属性 | 值 |
|------|-----|
| **存储桶** | `echo-prod-1375236416` |
| **地域** | `ap-shanghai` |
| **访问权限** | 私有存储桶，单个对象设置 `public-read` ACL |

**工作原理**：当 `COS_SECRET_ID` 已配置时，头像上传到 COS 路径 `avatars/{userId}/{timestamp}.{ext}`，公开 URL 存入 `Profile.avatarUrl`。如果 COS 环境变量缺失，服务回退为数据库中 Base64 Data URI。

### 7.2 短信（阿里云）

- 服务：阿里云号码认证（Dypnsapi）
- 签名：`速通互联验证码`
- 模板：`100001`
- 验证码有效期：5 分钟

### 7.3 SSL（echoecho.chat）

| 属性 | 值 |
|------|-----|
| **证书 ID** | `YzyKUkQz` |
| **域名** | `echoecho.chat`、`www.echoecho.chat` |
| **过期时间** | 2027-01-24 |
| **状态** | 证书已就绪，等待 ICP 备案完成后启用 HTTPS |

**备案完成后启用 HTTPS**：
```bash
cd /opt/echo
cp deploy/nginx/conf.d/echo-ssl.conf deploy/nginx/conf.d/echo.conf
# 编辑 deploy/.env.production，将 FRONTEND_URL 改为 https://echoecho.chat
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build nginx
```

### 7.4 域名与备案

| 属性 | 值 |
|------|-----|
| **域名** | `echoecho.chat` |
| **注册商** | 腾讯云 / DNSPod |
| **注册人** | 杨天昊 |
| **到期时间** | 2027-07-06 |
| **ICP 备案** | 进行中（备案中） |
| **备案期间访问** | 仅 IP：`http://124.223.73.232` |

---

## 8. 数据库管理

### 8.1 Schema 更新
```bash
# 服务器上，代码更新后：
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec app sh -c \
  "cd /app/services/api && npx prisma db push"
```

### 8.2 备份
```bash
# 手动备份：
mkdir -p /opt/backups
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec -T postgres \
  pg_dump -U echo_user echo_db | gzip > /opt/backups/echo_$(date +%Y%m%d_%H%M).sql.gz
```

### 8.3 恢复
```bash
gunzip -c /opt/backups/echo_20260710.sql.gz | \
  docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec -T postgres \
  psql -U echo_user echo_db
```

### 8.4 自动备份（Cron）
```
0 3 * * * cd /opt/echo && docker compose --env-file /opt/echo/deploy/.env.production -f /opt/echo/deploy/docker-compose.prod.yml exec -T postgres pg_dump -U echo_user echo_db | gzip > /opt/backups/echo_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "*.sql.gz" -mtime +7 -delete
```

---

## 9. 健康检查与监控

```bash
# 查看所有容器状态
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml ps

# 查看最近日志
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs app --tail=50

# 查看特定服务日志
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs -f postgres

# 查看资源使用
docker stats --no-stream

# 测试 API 健康
curl http://localhost:4000/v1/health
```

---

## 10. 常见问题

### 10.1 git pull 后 "context: ../.." 路径错误
**症状**：Docker 构建失败，提示 `lstat /opt/deploy: no such file or directory`
**修复**：`sed -i 's|context: \.\./\.\.|context: ..|g' deploy/docker-compose.prod.yml`

### 10.2 首次部署后 Redis/DB 连接被拒
**症状**：应用日志中出现 `ECONNREFUSED 127.0.0.1:6379`
**原因**：密码中包含 `/` 字符，破坏了连接字符串。
**修复**：用 `openssl rand -base64 18 | tr -d '/+=' | head -c 24` 重新生成密码，更新 `.env.production`，然后运行 `docker compose up -d app`。

### 10.3 服务器无法访问 GitHub
**症状**：`git pull` 失败，提示 `Failed to connect to github.com port 443`
**解决方案**：使用 SCP（第 6 节的方式 B）。

### 10.4 前端构建失败 "Could not resolve ..."
**症状**：Vite 在 nginx Dockerfile 的 `npm run build` 中找不到模块
**原因**：文件在 Windows 上存在但从未提交到 Git。
**修复**：`git add` 所有缺失的源文件，提交，推送，然后重新部署。

### 10.5 Docker 构建失败 "/echo: not found"
**症状**：Nginx Dockerfile 中 `COPY echo/ ./` 失败，提示 `failed to calculate checksum ... "/echo": not found`
**原因**：Windows tar 保留了目录名为 `Echo/`（大写）。Linux 区分大小写，Docker 找不到 `echo/`（小写）。
**修复**：在 `/opt/echo` 中运行 `mv Echo echo`，然后重新 `docker compose up -d --build`。

### 10.6 rsync --delete 删除了 .env.production
**症状**：SCP 部署后应用因缺少环境变量启动失败
**原因**：`rsync --delete` 删除目标上不存在于源中的文件。`.env.production` 已 gitignore，不在 tar 包中，rsync 将其删除。
**修复**：在 rsync 命令中添加 `--exclude='deploy/.env.production'`（已在更新后的方式 B 中预置）。

### 10.7 Windows CMD 中 'git' 不是内部或外部命令
**症状**：在 Windows CMD 或 PowerShell 中运行 `git add` / `git commit` / `git push` 报错 `'git' 不是内部或外部命令，也不是可运行的程序`
**原因**：Git 不在 Windows 系统 PATH 中。这是正常的 —— Git for Windows 安装到 `C:\Program Files\Git\` 但不一定会添加到 PATH。
**修复**：见 §6 方式 A 顶部的警告框。使用 Git Bash（`C:\Program Files\Git\bin\bash.exe`）或 Agent 的 Bash 工具。在 Git Bash 中使用 Unix 风格路径：`cd /c/Users/Administrator/Desktop/Echo`。

---

## 11. 常用命令速查

```bash
# --- 服务器上，root 用户 ---

# 重启所有服务
cd /opt/echo
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml restart

# 代码修改后重建
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app nginx

# 运行数据库同步
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec app sh -c "cd /app/services/api && npx prisma db push"

# 查看所有日志
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs -f --tail=100

# 停止所有服务
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml down

# 启动所有服务
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d

# 检查磁盘使用
df -h /
docker system df
```
