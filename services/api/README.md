# Echo Platform API (`services/api`)

NestJS + Prisma REST API for Phase 1 full-function demo. Base URL: `http://localhost:4000/v1`.

## Prerequisites

- Node.js 20+
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml) running (Postgres, Redis, MinIO)

## Setup

```bash
cd services/api
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

## Verify

```bash
curl http://localhost:4000/v1/health
```

Auth (MVP OTP logged to console; dev code `123456` if set in `.env`):

```bash
curl -X POST http://localhost:4000/v1/auth/otp -H "Content-Type: application/json" -d "{\"phone\":\"13800000099\"}"
curl -X POST http://localhost:4000/v1/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"13800000099\",\"code\":\"123456\"}"
```

## Worker

Async jobs (post draft, moderation, match cron, agent turns) are processed by [`../worker`](../worker). Start after Redis is up:

```bash
cd ../worker && npm install && npm run start:dev
```

## Notes

- `profile_embeddings.embedding` is stored as JSON for MVP; pgvector extension is enabled in Compose for future native vectors.
- OTP is **not** production-safe — see `OTP_DEV_CODE` in `.env.example`.
