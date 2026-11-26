#!/usr/bin/env bash
# Export data-only dump from the DB configured in .env (TiDB Cloud).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/database/export/data.sql}"

# shellcheck source=db-env.sh
source "$ROOT/database/scripts/db-env.sh"

mkdir -p "$(dirname "$OUT")"

TABLES=(
  authors categories subcategories users admin_login_codes
  articles article_blocks tags article_tags comments media
  newsletter_subscribers visitors system_settings
)

echo "Exporting data from $DB_HOST:$DB_PORT / $DB_NAME -> $OUT"
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  "${MYSQL_SSL_ARGS[@]}" \
  --no-create-info --skip-triggers --single-transaction \
  --complete-insert --no-tablespaces \
  --set-gtid-purged=OFF \
  "${TABLES[@]}" > "$OUT"

echo "Export complete ($(wc -l < "$OUT") lines)"
