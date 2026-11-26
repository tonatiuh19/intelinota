#!/usr/bin/env bash
# Import data-only dump into TiDB (run bootstrap-tidb.sh first).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=db-env.sh
source "$ROOT/database/scripts/db-env.sh"

FILE="${1:-$ROOT/database/export/data.sql}"

if [[ ! -f "$FILE" ]]; then
  echo "Missing dump file: $FILE" >&2
  echo "Run: ./database/scripts/export-data.sh" >&2
  exit 1
fi

echo "Importing data into $DB_HOST:$DB_PORT / $DB_NAME ..."
mysql_cmd < "$FILE"
echo "Import complete."
