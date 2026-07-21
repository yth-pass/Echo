# Echo Production Deployment Reference

> **Purpose**: This document describes the live production environment so that any agent or developer can understand what is deployed, where, and how to safely modify it.
>
> **Last updated**: 2026-07-21
> **Server**: Tencent Cloud Lighthouse, Shanghai Zone 4

---

## 1. Server Overview

| Property | Value |
|----------|-------|
| **IP Address** | `124.223.73.232` |
| **Instance ID** | `lhins-97mnk1l8` |
| **OS** | Ubuntu Server 24.04 LTS |
| **Specs** | 4 vCPU, 4 GB RAM, 40 GB SSD, 3 Mbps |
| **SSH Login** | `ssh ubuntu@124.223.73.232` (password auth) |
| **App Directory** | `/opt/echo` |
| **Backups** | `/opt/backups/` — daily at 03:00, kept 7 days |
| **Expiry** | 2027-07-06 |

---

## 2. Architecture

```
Internet
    │
    ├── :80  (HTTP)  ──┐
    ├── :443 (HTTPS) ──┤─ Nginx (echo-nginx)
    │                   │
    └── Internal Docker network (echo-net) ──┐
                                             │
    ┌────────────────────────────────────────┘
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Nginx   │────▶│   App    │────▶│PostgreSQL│     │  Redis   │
│ :80,:443 │     │  :4000   │     │  :5432   │     │  :6379   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
    │                  │
    │ Frontend         │ API + Worker
    │ (Vite SPA)       │ (NestJS, single process)
    └──────────────────┘
```

**Key Design Decisions**:
- **Nginx serves the frontend** (built by Vite, output in `/usr/share/nginx/html`). API requests (`/v1/*`) are reverse-proxied to the `app` container.
- **App runs API + Worker in one process** (`deploy/start.sh` launches both with `&`, single Docker container).
- **PostgreSQL and Redis are NOT exposed to the public internet** — only accessible within the `echo-net` Docker bridge network.
- **Data persistence**: PostgreSQL and Redis use Docker named volumes (`postgres_data`, `redis_data`). Agent memory uses `app_memory`.

---

## 3. Docker Compose Services

Run from `/opt/echo` with:
```bash
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml <command>
```

| Service | Image | Container Name | Ports (host) | Purpose |
|---------|-------|---------------|--------------|---------|
| `postgres` | `pgvector/pgvector:pg16` | `echo-postgres` | none (internal) | Database + AI embeddings |
| `redis` | `redis:7-alpine` | `echo-redis` | none (internal) | Cache + BullMQ queue |
| `app` | Built from root `Dockerfile` | `echo-app` | none (internal) | NestJS API + BullMQ Worker |
| `nginx` | Built from `deploy/nginx/Dockerfile` | `echo-nginx` | 80, 443 | Static files + reverse proxy |

### 3.1 PostgreSQL (echo-postgres)
- **Database**: `echo_db`
- **User**: `echo_user`
- **Extensions**: `pgvector`, `uuid-ossp` (auto-created via `deploy/postgres/init/01-extensions.sql`)
- **Schema**: Managed by Prisma (`npx prisma db push`)
- **Volume**: `postgres_data` (Docker named volume)

### 3.2 Redis (echo-redis)
- **Persistence**: AOF + RDB snapshots (configured in `deploy/redis/redis.conf`)
- **Max memory**: 512 MB, `allkeys-lru` eviction
- **Volume**: `redis_data` (Docker named volume)
- **Authentication**: Password set via `--requirepass` in compose command

### 3.3 App (echo-app)
- **Runtime**: Node.js 20 (from `node:20-slim` base image)
- **Port**: 4000 (internal only)
- **Entrypoint**: `deploy/start.sh` → starts Worker (PID 9) then API (PID 10)
- **WebSocket**: `/v1/ws` mounted on same HTTP server
- **Build**: Multi-stage Docker build (see root `Dockerfile`)
  - Builder stage: npm install → Prisma generate → NestJS build
  - Worker runs from TypeScript via `tsx`

### 3.4 Nginx (echo-nginx)
- **Frontend build**: Node.js 22 → Vite build with `VITE_API_BASE_URL=/v1`
- **SSL**: Certificates at `/etc/nginx/ssl/` (mounted from `deploy/nginx/ssl/`)
- **Config files**:
  - `deploy/nginx/nginx.conf` — main config, upstream, rate limiting
  - `deploy/nginx/conf.d/echo.conf` — HTTP server block (active)
  - `deploy/nginx/conf.d/echo-ssl.conf` — HTTPS server block (activate after ICP filing)

---

## 4. Environment Variables

The production env file is at `/opt/echo/deploy/.env.production` (**gitignored, contains real secrets**).
A template is at `deploy/.env.production.example` (**committed, safe to read**).

### 4.1 Required Variables (all set in production)

| Variable | Set in .env.production? | Usage |
|----------|------------------------|-------|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | ✅ | PostgreSQL connection |
| `REDIS_PASSWORD` | ✅ | Redis auth (raw password, used by `--requirepass`) |
| `JWT_SECRET` | ✅ | JWT token signing |
| `DEEPSEEK_API_KEY` | ✅ | AI text/chat |
| `DASHSCOPE_API_KEY` | ✅ | AI embeddings + image/speech/3D generation |
| `COS_SECRET_ID`, `COS_SECRET_KEY` | ✅ | Tencent COS avatar uploads |
| `COS_BUCKET` | `echo-prod-1375236416` | COS bucket name |
| `COS_REGION` | `ap-shanghai` | COS region (same as server for internal networking) |
| `DATABASE_URL` | ⚠️ Required if `DB_PASSWORD` contains `/` or `+` | Full PostgreSQL connection string (overrides compose interpolation) |
| `REDIS_URL` | ⚠️ Required if `REDIS_PASSWORD` contains `/` or `+` | Full Redis connection string with URL-encoded password (overrides compose interpolation) |

> **When to add `DATABASE_URL` / `REDIS_URL` to `.env.production`**: If passwords contain `/`, `+`, `@`, `#`, or other URL-reserved characters, the compose file's `${DB_PASSWORD}` interpolation produces malformed URLs. Add explicit `DATABASE_URL` and `REDIS_URL` lines with properly URL-encoded passwords. See §10.2 for details.

### 4.2 SMS Variables (Alibaba Cloud)

| Variable | Usage |
|----------|-------|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | SMS API access key |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | SMS API secret |
| `SMS_SIGN_NAME` | `速通互联验证码` |
| `SMS_TEMPLATE_CODE` | `100001` |
| `SMS_CODE_VALID_MINUTES` | `5` |

### 4.3 Frontend URL

| State | Value |
|-------|-------|
| During ICP filing | `http://124.223.73.232` |
| After ICP filing + SSL | `https://echoecho.chat` |

---

## 5. Key Files & Directories

### 5.1 Deployment Config (ALWAYS check these before modifying)

| File | Purpose |
|------|---------|
| `deploy/docker-compose.prod.yml` | Docker Compose service definitions |
| `deploy/.env.production.example` | Env template (safe to read, no secrets) |
| `deploy/.env.production` | **Actual secrets** (gitignored, on server only) |
| `deploy/nginx/nginx.conf` | Nginx main config |
| `deploy/nginx/conf.d/echo.conf` | HTTP server block (active) |
| `deploy/nginx/conf.d/echo-ssl.conf` | HTTPS server block (for ICP filing completion) |
| `deploy/nginx/ssl/echoecho.chat_bundle.crt` | SSL certificate |
| `deploy/nginx/ssl/echoecho.chat.key` | SSL private key |
| `deploy/nginx/Dockerfile` | Nginx + frontend build |
| `deploy/start.sh` | App entrypoint (API + Worker launcher) |
| `deploy/redis/redis.conf` | Redis persistence + memory config |
| `deploy/postgres/init/01-extensions.sql` | PostgreSQL init script |

### 5.2 Backend Source (run on the server inside the `app` container)

| Path | Purpose |
|------|---------|
| `services/api/src/main.ts` | API entry point |
| `services/api/src/app.module.ts` | NestJS root module |
| `services/api/src/cos/cos.service.ts` | Tencent COS upload service |
| `services/api/src/avatar/avatar.service.ts` | Avatar upload (COS or Base64 fallback) |
| `services/api/src/auth/sms.service.ts` | Alibaba Cloud SMS OTP |
| `services/api/src/llm/llm.service.ts` | DeepSeek + DashScope LLM integration |
| `services/api/prisma/schema.prisma` | Database schema (source of truth) |
| `services/worker/src/main.ts` | Background worker entry point |
| `services/worker/src/clone-runtime/` | Clone runtime (match bridging, scheduler) |

### 5.3 Frontend Source (built into Nginx image)

| Path | Purpose |
|------|---------|
| `echo/package.json` | Frontend dependencies |
| `echo/vite.config.ts` | Vite build config |
| `echo/src/api/client.ts` | API client + `VITE_API_BASE_URL` handling |
| `echo/src/App.tsx` | Main application entry |

---

## 6. How to Update the Deployment

> ⚠️ **CRITICAL — Git execution environment for local Windows commands**
>
> The local machine is **Windows**. Running `git` in a plain CMD/PowerShell window will fail with `'git' 不是内部或外部命令` because Git is NOT on the system PATH. **All local `git` / `tar` / `scp` / `ssh` commands shown in this section MUST be executed in one of the following environments:**
>
> 1. **Git Bash** — installed with Git for Windows, typically at `C:\Program Files\Git\bin\bash.exe`. Open it and `cd /c/Users/Administrator/Desktop/Echo` first.
> 2. **The agent's Bash tool** (if running inside WorkBuddy/CodeBuddy) — this environment wraps Git Bash and has `git` available at `/usr/bin/git`.
> 3. **Using full path** — `"C:\Program Files\Git\bin\git.exe" add -A` etc. (cumbersome, not recommended).
>
> **The GitHub Personal Access Token** for HTTPS pushes is stored in the user's password manager (classic token, `repo` scope). If expired, generate a new one at https://github.com/settings/tokens. Replace `<GH_TOKEN>` in the push commands below with the actual token.
>
> **Repository URL**: `https://github.com/yth-pass/Echo.git`

There are two code deployment methods. **Method A (GitHub) is preferred.**

### Method A: Git Push + Pull (when GitHub is reachable)

**On your local Windows machine (in Git Bash or agent's Bash tool):**
```bash
cd /c/Users/Administrator/Desktop/Echo
git add -A
git commit -m "your message"
git push https://<GH_TOKEN>@github.com/yth-pass/Echo.git main
```

**On the server (SSH):**
```bash
ssh ubuntu@124.223.73.232
sudo -i
cd /opt/echo
git pull
# NOTE: git pull resets deploy/docker-compose.prod.yml context path. Fix it:
sed -i 's|context: \.\./\.\.|context: ..|g' deploy/docker-compose.prod.yml
# Rebuild app + nginx (postgres and redis are not affected)
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app nginx
# If you added new Prisma models/migrations:
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec app sh -c "cd /app/services/api && npx prisma db push"
```

### Method B: SCP (when GitHub is unreachable from China)

**On your local Windows machine:**
```cmd
cd C:\Users\Administrator\Desktop
tar czf Echo\tmp\echo-update.tar.gz --exclude="node_modules" --exclude=".git" --exclude="dist" --exclude="Echo\tmp" Echo
scp Echo\tmp\echo-update.tar.gz ubuntu@124.223.73.232:/tmp/
ssh ubuntu@124.223.73.232 "sudo rm -rf /opt/echo-sync && sudo mkdir -p /opt/echo-sync && sudo tar xzf /tmp/echo-update.tar.gz -C /opt/echo-sync && sudo rsync -av --delete --exclude='deploy/.env.production' /opt/echo-sync/Echo/ /opt/echo/"
```

> **Why `--exclude='deploy/.env.production'` on rsync**: The `--delete` flag removes files on the destination that don't exist in the source. Since `.env.production` is gitignored and not in the tar, rsync would delete it. The `--exclude` prevents this.

Then rebuild on server:
```bash
sudo -i
cd /opt/echo
# Fix directory casing: Windows tar preserves "Echo" (uppercase), but Dockerfile expects "echo/" (lowercase)
mv Echo echo 2>/dev/null
# Fix compose context path
sed -i 's|context: \.\./\.\.|context: ..|g' deploy/docker-compose.prod.yml
# Rebuild
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app nginx
```

### Important Caveats When Updating

1. **The compose file `context: ../..` in the repo is WRONG for server deployment.** On the server, `../..` from `deploy/` resolves to `/opt` (parent of the repo), not `/opt/echo`. The fix `sed -i 's|context: \.\./\.\.|context: ..|g'` must be applied after every `git pull`. This is a known issue tracked for a permanent fix.

2. **Directory casing**: Git tracks `echo/` (lowercase). On Windows, the directory appears as `Echo/` due to case-insensitive filesystem. On the Linux server, it is `echo/`. The Nginx Dockerfile uses `echo/` (lowercase) which is correct for Linux.

3. **Never commit SSL certificates or .env.production.** They are gitignored.

---

## 7. Current Integrations

### 7.1 COS (Tencent Cloud Object Storage)

| Property | Value |
|----------|-------|
| **Bucket** | `echo-prod-1375236416` |
| **Region** | `ap-shanghai` |
| **Access** | Private bucket, individual objects set to `public-read` ACL |

**How it works**: When `COS_SECRET_ID` is set, avatar uploads go to COS at `avatars/{userId}/{timestamp}.{ext}` and the public URL is stored in `Profile.avatarUrl`. If COS env vars are missing, the service falls back to Base64 Data URIs in the database.

### 7.2 SMS (Alibaba Cloud)

- Service: Alibaba Cloud Dypnsapi (phone number verification)
- Sign name: `速通互联验证码`
- Template: `100001`
- OTP validity: 5 minutes

### 7.3 SSL (echoecho.chat)

| Property | Value |
|----------|-------|
| **Certificate ID** | `YzyKUkQz` |
| **Domain** | `echoecho.chat`, `www.echoecho.chat` |
| **Expiry** | 2027-01-24 |
| **Status** | Certificates ready, waiting for ICP filing completion to activate HTTPS |

**To activate HTTPS after ICP filing**:
```bash
cd /opt/echo
cp deploy/nginx/conf.d/echo-ssl.conf deploy/nginx/conf.d/echo.conf
# Update FRONTEND_URL in deploy/.env.production to https://echoecho.chat
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build nginx
```

### 7.4 Domain & ICP Filing

| Property | Value |
|----------|-------|
| **Domain** | `echoecho.chat` |
| **Registrar** | Tencent Cloud / DNSPod |
| **Registrant** | 杨天昊 |
| **Expiry** | 2027-07-06 |
| **ICP Filing** | In progress (备案中) |
| **Access during filing** | IP only: `http://124.223.73.232` |

---

## 8. Database Management

### 8.1 Schema Updates
```bash
# On the server, after code update:
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec app sh -c \
  "cd /app/services/api && npx prisma db push"
```

### 8.2 Backup
```bash
# Manual backup:
mkdir -p /opt/backups
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec -T postgres \
  pg_dump -U echo_user echo_db | gzip > /opt/backups/echo_$(date +%Y%m%d_%H%M).sql.gz
```

### 8.3 Restore
```bash
gunzip -c /opt/backups/echo_20260710.sql.gz | \
  docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec -T postgres \
  psql -U echo_user echo_db
```

### 8.4 Automated Backups (Cron)
```
0 3 * * * cd /opt/echo && docker compose --env-file /opt/echo/deploy/.env.production -f /opt/echo/deploy/docker-compose.prod.yml exec -T postgres pg_dump -U echo_user echo_db | gzip > /opt/backups/echo_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "*.sql.gz" -mtime +7 -delete
```

---

## 9. Health Checks & Monitoring

```bash
# Check all container statuses
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml ps

# View recent logs
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs app --tail=50

# View specific service logs
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs -f postgres

# Check resource usage
docker stats --no-stream

# Test API health
curl http://localhost:4000/v1/health
```

---

## 10. Common Issues

### 10.1 "context: ../.." path error after git pull
**Symptom**: Docker build fails with `lstat /opt/deploy: no such file or directory`
**Fix**: `sed -i 's|context: \.\./\.\.|context: ..|g' deploy/docker-compose.prod.yml`

### 10.2 Redis/DB connection refused or authentication failed
**Symptom**: `ECONNREFUSED 127.0.0.1:6379` in app logs, or `P1000 Authentication failed` from Prisma
**Root Cause**: Passwords containing `/` or `+` characters break URL parsing. The `/` terminates the authority component in URLs like `redis://:pass/word@redis:6379`, causing ioredis to parse the host as empty (defaulting to `127.0.0.1`). Prisma may also fail to parse the host correctly.

**This is a multi-layered issue** — there are three separate password contexts that must all be consistent:

| Context | Password format | Where it's used |
|---------|----------------|-----------------|
| `REDIS_PASSWORD` in `.env.production` | Raw (with `/`) | Docker Compose substitutes into `--requirepass ${REDIS_PASSWORD}` for Redis container startup |
| `REDIS_URL` in `.env.production` | URL-encoded (`/` → `%2F`) | Passed to app container; ioredis parses this URL |
| `DB_PASSWORD` in `.env.production` | Raw | Docker Compose substitutes into `DATABASE_URL` and `POSTGRES_PASSWORD` |
| PostgreSQL internal user password | Raw (set during first init) | Stored inside the database volume; `POSTGRES_PASSWORD` only works on first initialization |

**Fix Option A — URL-encode the `/` in connection strings (recommended, no data loss)**:

1. Add explicit `DATABASE_URL` and `REDIS_URL` lines to `.env.production` (these override the compose file's `${...}` interpolation):
```bash
# DB: Prisma tolerates raw / in password, so use it directly
echo 'DATABASE_URL=postgresql://echo_user:RAW_PASSWORD@postgres:5432/echo_db?sslmode=disable' >> deploy/.env.production

# Redis: ioredis needs URL-encoded / (%2F) and + (%2B)
echo 'REDIS_URL=redis://:ENCODED_PASSWORD@redis:6379' >> deploy/.env.production
```

2. Change the compose file to reference these variables instead of building URLs from `${REDIS_PASSWORD}`:
```bash
sed -i 's|REDIS_URL:.*|REDIS_URL: ${REDIS_URL}|' deploy/docker-compose.prod.yml
sed -i 's|DATABASE_URL:.*|DATABASE_URL: ${DATABASE_URL}|' deploy/docker-compose.prod.yml
```

3. If the PostgreSQL password was changed in `.env.production` but the database volume still has the old password, reset it:
```bash
# Connect with the OLD password, set the NEW password
docker compose exec -e PGPASSWORD='OLD_PASSWORD' postgres psql -U echo_user -d echo_db -c "ALTER USER echo_user WITH PASSWORD 'NEW_PASSWORD';"
```

4. If Redis `WRONGPASS` persists after changing `REDIS_PASSWORD`, delete the Redis volume and recreate:
```bash
docker compose stop redis && docker compose rm -f redis
docker volume rm deploy_redis_data
docker compose up -d redis
```

**Fix Option B — Regenerate passwords without special characters**:
```bash
NEW_PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
# Update REDIS_PASSWORD and DB_PASSWORD in .env.production
# For DB: also run ALTER USER (see step 3 above)
# For Redis: delete volume and recreate (see step 4 above)
```

#### 10.2.1 Actual incident log — 2026-07-20 deployment

During the 2026-07-20 onboarding bug fix deployment, this issue was hit in full. Below is the exact sequence of what happened and how it was resolved, as a reference for future deployments.

**Initial state** (`.env.production` before deployment):
```ini
DB_PASSWORD=/YQ+h/D9EYPL56v6UWV0GyxJoOmk7XI5      # contains / and +
REDIS_PASSWORD=gBLMA7pD2OWxNq6EHls1E8gAYv/G08WD    # contains /
```

**Symptoms after `docker compose up -d --build app`**:
1. `Error: connect ECONNREFUSED 127.0.0.1:6379` — ioredis parsed `redis://:gBLMA7pD2OWxNq6EHls1E8gAYv/G08WD@redis:6379` and the `/` in the password terminated the authority component, making the host empty (defaulted to `127.0.0.1`)
2. `PrismaClientInitializationError: Authentication failed (P1000)` — `DATABASE_URL` built from `${DB_PASSWORD}` was also malformed

**Resolution steps applied**:

```bash
cd /opt/echo

# Step 1: Change DB_PASSWORD to a clean password (no special chars)
sed -i 's|^DB_PASSWORD=.*|DB_PASSWORD=MqxbAd4nughVkEdNt0pRsBGq|' deploy/.env.production

# Step 2: Add explicit DATABASE_URL and REDIS_URL to .env.production
# - DB: clean password, no encoding needed
# - Redis: keep old password but URL-encode / as %2F (so --requirepass still uses the raw password)
sed -i '/^DATABASE_URL=/d' deploy/.env.production
sed -i '/^REDIS_URL=/d' deploy/.env.production
cat >> deploy/.env.production << 'EOF'
DATABASE_URL=postgresql://echo_user:MqxbAd4nughVkEdNt0pRsBGq@postgres:5432/echo_db?sslmode=disable
REDIS_URL=redis://:gBLMA7pD2OWxNq6EHls1E8gAYv%2FG08WD@redis:6379
EOF

# Step 3: Change compose file to use ${DATABASE_URL} / ${REDIS_URL} from .env.production
# (instead of building URLs from ${DB_PASSWORD} / ${REDIS_PASSWORD})
sed -i 's|REDIS_URL:.*|REDIS_URL: ${REDIS_URL}|' deploy/docker-compose.prod.yml
sed -i 's|DATABASE_URL:.*|DATABASE_URL: ${DATABASE_URL}|' deploy/docker-compose.prod.yml

# Step 4: Update PostgreSQL internal password (volume was initialized with old password)
# Connect with OLD password, set NEW password
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec \
  -e PGPASSWORD='/YQ+h/D9EYPL56v6UWV0GyxJoOmk7XI5' \
  postgres psql -U echo_user -d echo_db -c "ALTER USER echo_user WITH PASSWORD 'MqxbAd4nughVkEdNt0pRsBGq';"

# Step 5: Delete Redis volume (old volume had no password issue, but container needed restart with correct --requirepass)
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml stop redis
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml rm -f redis
docker volume rm deploy_redis_data
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d redis

# Step 6: Rebuild app
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app
sleep 30 && docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs app --tail=10
# Expected: "Nest application successfully started" + "Echo API listening on http://localhost:4000/v1"
```

**Final `.env.production` password-related lines**:
```ini
DB_PASSWORD=MqxbAd4nughVkEdNt0pRsBGq
REDIS_PASSWORD=gBLMA7pD2OWxNq6EHls1E8gAYv/G08WD
DATABASE_URL=postgresql://echo_user:MqxbAd4nughVkEdNt0pRsBGq@postgres:5432/echo_db?sslmode=disable
REDIS_URL=redis://:gBLMA7pD2OWxNq6EHls1E8gAYv%2FG08WD@redis:6379
```

**Key learnings**:
1. Docker Compose `--env-file` only provides variables for `${...}` substitution in the compose file — it does NOT automatically inject env vars into containers. Only the `environment:` section injects vars.
2. `REDIS_PASSWORD` (raw, for `--requirepass`) and `REDIS_URL` (URL-encoded, for ioredis) can use different representations of the same password.
3. `POSTGRES_PASSWORD` only sets the password during first volume initialization. To change it later, use `ALTER USER`.
4. Prisma tolerates raw `/` in `DATABASE_URL` passwords, but ioredis does NOT — always URL-encode special characters in Redis URLs.

### 10.3 GitHub unreachable from server
**Symptom**: `git pull` fails with `Failed to connect to github.com port 443`
**Workaround**: Use SCP (Method B in Section 6).

### 10.4 Frontend build fails with "Could not resolve ..."
**Symptom**: Vite can't find modules during `npm run build` in the nginx Dockerfile
**Cause**: Files exist on Windows but were never committed to Git.
**Fix**: `git add` all missing source files, commit, push, then redeploy.

### 10.5 Docker build fails with "/echo: not found"
**Symptom**: `COPY echo/ ./` fails in Nginx Dockerfile with `failed to calculate checksum of ref ... "/echo": not found`
**Cause**: Windows tar preserves the directory name as `Echo/` (uppercase). Linux is case-sensitive, so Docker can't find `echo/` (lowercase).
**Fix**: Run `mv Echo echo` in `/opt/echo` before `docker compose up -d --build`.

### 10.6 rsync --delete removes .env.production
**Symptom**: After SCP deployment, app fails to start with missing env vars
**Cause**: `rsync --delete` removes files on the destination that don't exist in the source. Since `.env.production` is gitignored and not in the tar, rsync deletes it.
**Fix**: Add `--exclude='deploy/.env.production'` to the rsync command (already included in the updated Method B steps).

### 10.7 'git' is not recognized on Windows CMD
**Symptom**: Running `git add` / `git commit` / `git push` in Windows CMD or PowerShell gives `'git' 不是内部或外部命令，也不是可运行的程序`
**Cause**: Git is not on the Windows system PATH. This is normal — Git for Windows installs to `C:\Program Files\Git\` but doesn't always add itself to PATH.
**Fix**: See §6 warning box at the top of this section. Use Git Bash (`C:\Program Files\Git\bin\bash.exe`) or the agent's Bash tool. In Git Bash, use Unix-style paths: `cd /c/Users/Administrator/Desktop/Echo`.

### 10.8 Git push fails silently or through local proxy
**Symptom**: `git push` returns exit code 1 with no clear error message, or takes very long. `GIT_CURL_VERBOSE=1` shows connections going through `127.0.0.1:7897` (a local proxy).
**Cause**: A local HTTP proxy (VPN, Clash, V2Ray, etc.) is intercepting git's HTTPS traffic. The proxy may throttle or drop large uploads.
**Fix**:
1. Push bypassing the proxy: `git -c http.proxy= push https://<GH_TOKEN>@github.com/yth-pass/Echo.git main`
2. If successful, verify with `git ls-remote origin main` and `git rev-parse HEAD` — if they match, the push worked.
3. If the proxy is required for internet access, accept that exit code 1 from the proxy cleanup may be a false negative — verify with step 2.

---

## 11. Quick Reference Commands

```bash
# --- On the server, as root ---

# Restart everything
cd /opt/echo
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml restart

# Rebuild after code change
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app nginx

# Run database migration/sync
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec app sh -c "cd /app/services/api && npx prisma db push"

# View all logs
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml logs -f --tail=100

# Stop everything
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml down

# Start everything
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d

# Check disk usage
df -h /
docker system df
```
