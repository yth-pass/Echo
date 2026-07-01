# ==============================================================================
# Echo Production Dockerfile — API + Worker (single image, two processes)
# Deploy to Railway / Fly.io / any container platform.
# Build context MUST be the repository root (where this file lives).
# ==============================================================================

# ---------- Stage 1: Build ----------
FROM node:20-slim AS builder

# Prisma needs openssl for the query engine
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- API dependencies ---
COPY services/api/package.json services/api/package-lock.json ./services/api/
RUN cd services/api && npm ci --ignore-scripts

# --- Worker dependencies ---
COPY services/worker/package.json services/worker/package-lock.json ./services/worker/
RUN cd services/worker && npm ci --ignore-scripts

# --- Shared source (needed for prisma generate + worker imports) ---
COPY services/shared/ ./services/shared/

# --- Prisma schema (needed for prisma generate) ---
COPY services/api/prisma/ ./services/api/prisma/

# Generate Prisma client (both API + worker generators)
RUN cd services/api && npx prisma generate

# --- API source + build ---
COPY services/api/src/ ./services/api/src/
COPY services/api/nest-cli.json services/api/tsconfig.json services/api/tsconfig.build.json ./services/api/
RUN cd services/api && npx nest build

# --- Worker: use tsx at runtime to avoid tsc cross-dir path issues ---
# Worker imports from ../../api/src and ../../shared — tsx handles this
# without needing a separate tsc build step.
COPY services/worker/src/ ./services/worker/src/
COPY services/worker/tsconfig.json ./services/worker/

# Install tsx globally for running worker from TypeScript source
RUN npm install -g tsx

# ---------- Stage 2: Production ----------
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything from builder
COPY --from=builder /app ./
COPY --from=builder /usr/local/lib/node_modules/tsx /usr/local/lib/node_modules/tsx
COPY --from=builder /usr/local/bin/tsx /usr/local/bin/tsx

# Copy start script
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Default env
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Health check — lightweight, no auth needed
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/v1/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["/app/start.sh"]
