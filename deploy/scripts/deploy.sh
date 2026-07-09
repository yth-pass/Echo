#!/bin/bash
# ==============================================================================
# Echo Deploy Script
# Run this on the server to deploy or update the application.
#
# Usage:
#   ./deploy.sh          # Deploy / update all services
#   ./deploy.sh build    # Rebuild images (after code changes)
#   ./deploy.sh down     # Stop all services
#   ./deploy.sh logs     # View logs
#   ./deploy.sh status   # Check service status
# ==============================================================================

set -e

COMPOSE_FILE="deploy/docker-compose.prod.yml"
PROJECT_NAME="echo"

cd /opt/echo

case "${1:-up}" in
  up)
    echo "[deploy] Starting Echo services..."
    
    # Check .env.production exists
    if [ ! -f "deploy/.env.production" ]; then
      echo ""
      echo "ERROR: deploy/.env.production not found!"
      echo "  cp deploy/.env.production.example deploy/.env.production"
      echo "  nano deploy/.env.production"
      echo ""
      exit 1
    fi

    # Pull base images (faster startup)
    docker compose -f "$COMPOSE_FILE" pull postgres redis 2>/dev/null || true

    # Build and start
    docker compose -f "$COMPOSE_FILE" up -d --build

    # Run Prisma migrations
    echo "[deploy] Running database migrations..."
    sleep 5  # Wait for app to be ready
    docker compose -f "$COMPOSE_FILE" exec -T app sh -c \
      "cd /app/services/api && npx prisma migrate deploy" || {
      echo ""
      echo "WARNING: Migration failed. This might be OK if DB was already migrated."
      echo "Check logs: docker compose -f $COMPOSE_FILE logs app"
    }

    echo ""
    echo "[deploy] Done! Services are running."
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  build)
    echo "[deploy] Rebuilding images..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    docker compose -f "$COMPOSE_FILE" up -d
    echo "[deploy] Rebuild complete."
    ;;

  down)
    echo "[deploy] Stopping all services..."
    docker compose -f "$COMPOSE_FILE" down
    echo "[deploy] All services stopped."
    ;;

  restart)
    echo "[deploy] Restarting app and nginx..."
    docker compose -f "$COMPOSE_FILE" restart app nginx
    echo "[deploy] Restarted."
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
    ;;

  status)
    echo "=== Service Status ==="
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "=== Resource Usage ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
      $(docker compose -f "$COMPOSE_FILE" ps -q)
    ;;

  *)
    echo "Usage: $0 {up|build|down|restart|logs|status}"
    echo ""
    echo "  up       Deploy / update all services (default)"
    echo "  build    Rebuild Docker images"
    echo "  down     Stop all services"
    echo "  restart  Restart app + nginx"
    echo "  logs     View all logs"
    echo "  status   Check service status and resource usage"
    exit 1
    ;;
esac
