# Echo — Local infrastructure (P1-00)

## No Docker (Windows / cloud free tier)

If Docker Desktop is unavailable, use **Neon (Postgres) + Upstash (Redis)** and run only Node services on your machine. Step-by-step (Chinese, PowerShell, `.env` keys aligned with this repo): **[README-native-windows.md](./README-native-windows.md)**.

---

Docker Compose stack for Phase 1 demo: **PostgreSQL (pgvector)**, **Redis**, **MinIO**.

## Start

```bash
cd infra
cp .env.example .env   # optional overrides
docker compose up -d
```

## Verify

```bash
docker compose ps
docker exec -it echo-postgres psql -U echo -d echo -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker exec -it echo-redis redis-cli ping
```

MinIO: API `http://localhost:9000`, console `http://localhost:9001`.

## Connection strings (for services/api)

```text
DATABASE_URL=postgresql://echo:echo_dev@localhost:5432/echo?schema=public
REDIS_URL=redis://localhost:6379
```

## Stop

```bash
docker compose down
docker compose down -v   # removes volumes
```
