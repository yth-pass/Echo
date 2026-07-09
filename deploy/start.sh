#!/bin/sh
set -e
echo "[start] Echo container starting..."

# --- Start Worker in background ---
echo "[start] Starting worker..."
cd /app/services/worker
export ECHO_MEMORY_BASE_DIR="${ECHO_MEMORY_BASE_DIR:-/tmp/echo-memory}"
mkdir -p "$ECHO_MEMORY_BASE_DIR"
echo "[start] Memory dir: $ECHO_MEMORY_BASE_DIR"
./node_modules/.bin/tsx src/main.ts &
WORKER_PID=$!
echo "[start] Worker PID: $WORKER_PID"

# --- Start API ---
echo "[start] Starting API on port ${PORT:-4000}..."
cd /app/services/api
node dist/api/src/main &
API_PID=$!
echo "[start] API PID: $API_PID"

# --- Trap signals (use numbers for max compatibility) ---
trap "kill $WORKER_PID $API_PID 2>/dev/null; wait" 15 2

# --- Wait ---
wait
