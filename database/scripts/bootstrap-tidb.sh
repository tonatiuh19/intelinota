#!/usr/bin/env bash
# Apply fresh schema to TiDB Cloud (or any MySQL-compatible DB configured in .env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=db-env.sh
source "$ROOT/database/scripts/db-env.sh"

echo "Bootstrapping schema on $DB_HOST:$DB_PORT / $DB_NAME ..."

mysql_admin_cmd -e \
  "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

mysql_cmd < "$ROOT/database/tidb_bootstrap.sql"
echo "Done. Verify with: npm run db:tables"
