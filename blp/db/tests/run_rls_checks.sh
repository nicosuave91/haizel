#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL must be set to run RLS checks" >&2
  exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/rls_policies.sql"
