#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=db-env.sh
source "$ROOT/database/scripts/db-env.sh"

mysql_cmd -e "SHOW TABLES;"
