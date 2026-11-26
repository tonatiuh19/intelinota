#!/usr/bin/env bash
# Load DB_* from .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

export DB_HOST="$(grep '^DB_HOST=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
export DB_PORT="$(grep '^DB_PORT=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
export DB_USER="$(grep '^DB_USER=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
export DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
export DB_NAME="$(grep '^DB_NAME=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)"
export DB_SSL="$(grep '^DB_SSL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- || true)"

MYSQL_SSL_ARGS=()
if [[ "${DB_SSL:-}" == "true" ]]; then
  MYSQL_SSL_ARGS=(--ssl-mode=REQUIRED --protocol=TCP)
fi

mysql_cmd() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
    "${MYSQL_SSL_ARGS[@]}" "$@"
}

mysql_admin_cmd() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
    "${MYSQL_SSL_ARGS[@]}" "$@"
}
