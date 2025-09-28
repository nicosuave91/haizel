#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIR/infra/docker-compose.test.yml"}
PROJECT_NAME=${PROJECT_NAME:-blp_core_api_tests}
export DATABASE_URL=${DATABASE_URL:-postgresql://blp:blp@127.0.0.1:${CORE_API_TEST_DB_PORT:-55432}/blp}

cd "$ROOT_DIR"

cleanup() {
  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d postgres

ATTEMPTS=0
until docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U blp >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 60 ]; then
    echo "PostgreSQL did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done

docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" exec -T postgres psql -U blp -d blp -c 'SELECT 1;' >/dev/null

pnpm --filter db exec prisma migrate deploy
pnpm --filter core-api test
