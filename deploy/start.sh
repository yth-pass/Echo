#!/bin/sh
# ============================================================================
# Echo Production Start — runs API + Worker in one container
# API: node dist/api/src/main (compiled NestJS)
# Worker: ./node_modules/.bin/tsx src/main.ts (local tsx, avoids global install issues)
# ============================================================================
set -e

echo "[start] Echo container starting..."

# --- Start Worker in background ---
echo "[start] Starting worker..."
cd /app/services/worker
mkdir -p /tmp/echo-memory
export ECHO_MEMORY_BASE_DIR=/tmp/echo-memory
./node_modules/.bin/tsx src/main.ts &
WORKER_PID=$!
echo "[start] Worker PID: $WORKER_PID"

# --- Start API (foreground) ---
echo "[start] Starting API on port ${PORT:-4000}..."
cd /app/services/api
node dist/api/src/main &
API_PID=$!
echo "[start] API PID: $API_PID"

# --- Trap SIGTERM to gracefully stop both ---
cleanup() {
  echo "[start] Shutting down..."
  kill $WORKER_PID $API_PID 2>/dev/null
  wait
}
trap cleanup SIGTERM SIGINT

# --- Wait for either process ---
wait
