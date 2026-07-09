# Echo 生产环境部署指南

## 前置条件

| 项目 | 状态 | 说明 |
|------|------|------|
| 腾讯云服务器 | ✅ | 124.223.73.232, 4C4G, Ubuntu 24.04, Docker CE |
| 域名备案 | 🔄 进行中 | 备案完成前只能通过 IP 访问 |
| SSL 证书 | ✅ 已购买 | 备案完成后配置 |
| COS 对象存储 | ✅ 已购买 | 头像/文件上传（后续集成） |
| COS Bucket 名称 | ❓ 待确认 | |
| COS 地域 | ❓ 待确认 | |
| 域名 | ❓ 待确认 | |

---

## 第一步：服务器初始化

SSH 登录服务器后，运行初始化脚本：

```bash
ssh ubuntu@124.223.73.232

# 切换到 root
sudo -i

# 安装必要工具（Docker Compose、Git、防火墙）
apt-get update && apt-get install -y docker-compose-plugin git ufw

# 配置防火墙
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 创建应用目录
mkdir -p /opt/echo
```

---

## 第二步：上传项目代码

有两种方式：

### 方式 A：Git 推送（推荐）

在本地将代码推送到 GitHub/GitLab，然后在服务器上 clone：

```bash
# 服务器上
cd /opt
git clone <你的仓库地址> echo
```

### 方式 B：SCP 上传

```bash
# 本地终端
scp -r C:/Users/Administrator/Desktop/Echo/* ubuntu@124.223.73.232:/opt/echo/
```

---

## 第三步：配置环境变量

```bash
cd /opt/echo
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
```

**需要填写的值（对照你本地的 `services/api/.env`）：**

| 变量 | 来源 | 说明 |
|------|------|------|
| `DB_PASSWORD` | **新生成** | 生成一个强密码，不要和 Neon 密码一样 |
| `REDIS_PASSWORD` | **新生成** | 生成一个强密码 |
| `JWT_SECRET` | 可用本地值 | 复制 `services/api/.env` 中的 `JWT_SECRET` |
| `DEEPSEEK_API_KEY` | 本地值 | `sk-4ffe15f1cbfb4ad79089e89246556ff7` |
| `DASHSCOPE_API_KEY` | 本地值 | `sk-d8c088af83444d4698ab87069687b72d` |
| `ALIBABA_ACCESS_KEY_ID` | 本地值 | `LTAI5t7qakkNWJNsBsWaQoAq` |
| `ALIBABA_ACCESS_KEY_SECRET` | 本地值 | 从本地 `.env` 复制 |
| `ALIBABA_SMS_SIGN_NAME` | 本地值 | `速通互联验证码` |
| `ALIBABA_SMS_TEMPLATE_CODE` | 本地值 | `100001` |
| `FRONTEND_URL` | 公网地址 | `http://124.223.73.232`（备案完成后改域名） |

**生成随机密码：**
```bash
# DB 密码
openssl rand -base64 32

# Redis 密码
openssl rand -base64 32
```

---

## 第四步：部署

```bash
cd /opt/echo

# 首次部署（构建镜像 + 启动服务 + 数据库迁移）
docker compose -f deploy/docker-compose.prod.yml up -d --build

# 等待几秒让应用启动
sleep 10

# 运行数据库迁移
docker compose -f deploy/docker-compose.prod.yml exec app sh -c \
  "cd /app/services/api && npx prisma migrate deploy"

# 查看日志确认一切正常
docker compose -f deploy/docker-compose.prod.yml logs -f --tail=50
```

---

## 第五步：验证

1. **浏览器访问** `http://124.223.73.232` — 应该看到 Echo 前端页面
2. **API 健康检查** `http://124.223.73.232/v1/` — 应该返回 API 响应
3. **检查容器状态：**
   ```bash
   docker compose -f deploy/docker-compose.prod.yml ps
   ```
   所有四个容器（postgres, redis, app, nginx）应该都是 `Up` 状态

---

## 常用运维命令

```bash
cd /opt/echo

# 查看所有服务状态
docker compose -f deploy/docker-compose.prod.yml ps

# 查看日志
docker compose -f deploy/docker-compose.prod.yml logs -f --tail=100 app

# 查看特定服务日志
docker compose -f deploy/docker-compose.prod.yml logs -f postgres
docker compose -f deploy/docker-compose.prod.yml logs -f redis

# 重启服务
docker compose -f deploy/docker-compose.prod.yml restart app nginx

# 停止所有服务
docker compose -f deploy/docker-compose.prod.yml down

# 更新代码后重新部署
git pull
docker compose -f deploy/docker-compose.prod.yml up -d --build app nginx
docker compose -f deploy/docker-compose.prod.yml exec app sh -c \
  "cd /app/services/api && npx prisma migrate deploy"

# 备份数据库
docker compose -f deploy/docker-compose.prod.yml exec postgres \
  pg_dump -U echo_user echo_db > /opt/backups/echo_$(date +%Y%m%d).sql

# 查看资源使用
docker stats --no-stream
```

---

## 架构说明

```
Internet
    │
    ├── :80 (HTTP)
    ├── :443 (HTTPS, 备案完成后)
    │
    ▼
┌─────────────────────────────┐
│  Nginx (:80, :443)          │
│  - 静态文件 (前端 Vite SPA)  │
│  - /v1/* → 反向代理到 app   │
│  - /v1/ws → WebSocket 代理  │
│  - SSL 终止 (备案完成后)     │
└──────────┬──────────────────┘
           │ Docker 内部网络 (echo-net)
           ▼
┌─────────────────────────────┐
│  App (:4000)                │
│  - NestJS API               │
│  - BullMQ Worker (内联)      │
│  - WebSocket (/v1/ws)       │
└────┬──────────────┬─────────┘
     │              │
     ▼              ▼
┌──────────┐  ┌──────────┐
│PostgreSQL│  │  Redis   │
│ :5432    │  │  :6379   │
│ +pgvector│  │ 缓存+队列 │
└──────────┘  └──────────┘
```

**关键设计决策：**
- **数据库和 Redis 不暴露到公网**，只有 Docker 内部网络可访问
- **数据持久化**：PostgreSQL 和 Redis 使用 Docker volumes，重启不丢数据
- **前后端分离构建**：前端构建到 Nginx 镜像，后端构建到 App 镜像
- **Worker 内联运行**：与 API 在同一进程，无需额外容器
- **自托管替代第三方**：PostgreSQL 替代 Neon，Redis 替代 Upstash

---

## 后续事项

### 1. 备案完成后配置 SSL

```bash
# 1. 上传证书文件到服务器
scp your-domain.crt ubuntu@124.223.73.232:/opt/echo/deploy/nginx/ssl/
scp your-domain.key ubuntu@124.223.73.232:/opt/echo/deploy/nginx/ssl/

# 2. 编辑 SSL 配置
nano deploy/nginx/conf.d/echo-ssl.conf
# 修改 YOUR_DOMAIN 为实际域名

# 3. 启用 SSL
mv deploy/nginx/conf.d/echo.conf deploy/nginx/conf.d/echo.conf.bak
cp deploy/nginx/conf.d/echo-ssl.conf deploy/nginx/conf.d/echo.conf

# 4. 在 docker-compose.prod.yml 中取消 SSL 卷挂载的注释
# 编辑 deploy/docker-compose.prod.yml，取消注释:
#   - ./nginx/ssl:/etc/nginx/ssl:ro

# 5. 更新 FRONTEND_URL
# 编辑 deploy/.env.production，改为 https://your-domain.com

# 6. 重建 Nginx
docker compose -f deploy/docker-compose.prod.yml up -d --build nginx
```

### 2. COS 头像上传集成

当前头像以 Base64 存储在数据库 `Profile.avatarUrl` 字段中。后续需要：

1. 在 `services/api/src/avatar/` 中集成 `cos-nodejs-sdk-v5`
2. 上传时先将图片存到 COS，再将 URL 写入数据库
3. 添加 COS 环境变量到 `.env.production`（模板已预留）

### 3. 自动备份

添加 cron 定时备份数据库：

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 3 点备份
0 3 * * * cd /opt/echo && docker compose -f deploy/docker-compose.prod.yml exec -T postgres pg_dump -U echo_user echo_db > /opt/backups/echo_$(date +\%Y\%m\%d).sql

# 保留最近 7 天
0 4 * * * find /opt/backups -name 'echo_*.sql' -mtime +7 -delete
```
