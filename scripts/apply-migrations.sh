#!/usr/bin/env bash
# Apply pending database migrations to TiDB Cloud (reads credentials from .env).
# Tracks applied files in `schema_migrations` so re-runs skip history.
# Legacy files that predate tracking: duplicate-schema errors are treated as
# already-applied (recorded + continue). Real SQL errors still abort.
#
#   npm run db:migrate                          # apply pending files in database/migrations/
#   npm run db:migrate -- --baseline            # ONE-TIME: record every current file as applied, run nothing
#   npm run db:migrate -- --baseline=<file.sql> # record files up to and including <file.sql>, run nothing
#   npm run db:migrate -- --all                 # empty ledger: apply every file anyway (fresh database)
#
# Intelinota predates the ledger: everything up to 20261125_130000_backfill_unsubscribe_tokens.sql
# is already live. Run `--baseline=20261125_130000_backfill_unsubscribe_tokens.sql` once before the
# first `db:migrate`. As a guard, an EMPTY ledger refuses to run until you baseline (or pass --all),
# so history (including data backfills) is never re-executed by accident.
#
# TiDB note: TiDB rejects an ALTER TABLE that references a column it adds in the same statement
# (e.g. ADD COLUMN x + ADD INDEX (x)). Split those into separate ALTER statements in the migration.
set -euo pipefail

BASELINE=""
ALLOW_ALL=0
for arg in "$@"; do
  case "$arg" in
    --baseline) BASELINE="__all__" ;;
    --baseline=*) BASELINE="${arg#--baseline=}" ;;
    --all) ALLOW_ALL=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "❌ Unknown argument: $arg"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "❌ .env not found at $ROOT/.env"
  exit 1
fi

DB_PASS=$(grep "^DB_PASSWORD" .env | cut -d'=' -f2-)
DB_HOST=$(grep "^DB_HOST" .env | cut -d'=' -f2-)
DB_PORT=$(grep "^DB_PORT" .env | cut -d'=' -f2-)
DB_USER=$(grep "^DB_USER" .env | cut -d'=' -f2-)
DB_NAME=$(grep "^DB_NAME" .env | cut -d'=' -f2-)

MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
  --ssl-mode=REQUIRED --protocol=TCP)

echo "🔍 Connecting to TiDB ($DB_HOST / $DB_NAME) ..."
"${MYSQL[@]}" -e "SELECT DATABASE() AS db, NOW() AS now;"

echo "📦 Ensuring schema_migrations ledger ..."
"${MYSQL[@]}" -e "
CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
  \`filename\` VARCHAR(255) NOT NULL,
  \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`filename\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

is_applied() {
  local f="$1"
  local n
  n=$("${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$f'")
  [[ "$n" -gt 0 ]]
}

mark_applied() {
  local f="$1"
  "${MYSQL[@]}" -e "INSERT IGNORE INTO schema_migrations (filename) VALUES ('$f')"
}

is_already_applied_error() {
  local out="$1"
  # MySQL / TiDB duplicate schema objects on re-apply of legacy migrations.
  # NOT "Unknown column": on TiDB that is how a same-statement ALTER fails, and
  # treating it as applied would silently skip a migration that never ran.
  grep -Eiq \
    "Duplicate column name|Duplicate key name|Duplicate entry|already exists|Can't DROP|check that column/key exists" \
    <<<"$out"
}

shopt -s nullglob
files=(database/migrations/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "⚠️  No migration files in database/migrations/"
  exit 0
fi

if [[ -n "$BASELINE" ]]; then
  if [[ "$BASELINE" != "__all__" && ! -f "database/migrations/$BASELINE" ]]; then
    echo "❌ --baseline target not found: database/migrations/$BASELINE"
    exit 1
  fi
  echo "📌 Baseline: recording migrations as applied WITHOUT running them ..."
  for file in "${files[@]}"; do
    base="$(basename "$file")"
    mark_applied "$base"
    echo "   ✔ $base"
    [[ "$base" == "$BASELINE" ]] && break
  done
  echo "🎉 Baseline recorded. Later files will run on the next db:migrate."
  exit 0
fi

ledger_count=$("${MYSQL[@]}" -N -e "SELECT COUNT(*) FROM schema_migrations")
if [[ "$ledger_count" -eq 0 && $ALLOW_ALL -ne 1 ]]; then
  echo "❌ schema_migrations is empty. This database already has migrations applied, so nothing was run."
  echo "   Record them first (one time):"
  echo "     npm run db:migrate -- --baseline=20261125_130000_backfill_unsubscribe_tokens.sql"
  echo "   Or, for a brand-new empty database: npm run db:migrate -- --all"
  exit 1
fi

for file in "${files[@]}"; do
  base="$(basename "$file")"
  echo ""
  if is_applied "$base"; then
    echo "⏭  Skipping $base (already in schema_migrations)"
    continue
  fi
  echo "▶ Applying $base ..."
  set +e
  out=$("${MYSQL[@]}" < "$file" 2>&1)
  status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    echo "$out" | grep -v 'Using a password' || true
    mark_applied "$base"
    echo "✅ $base"
  elif is_already_applied_error "$out"; then
    echo "$out" | grep -v 'Using a password' | tail -5 || true
    mark_applied "$base"
    echo "⚠️  $base already reflected in schema — recorded and continuing"
  else
    echo "$out" | grep -v 'Using a password' || true
    echo "❌ $base failed — aborting to avoid schema drift."
    exit 1
  fi
done

echo ""
echo "🔍 Verifying core tables ..."
"${MYSQL[@]}" -e "SHOW TABLES; SELECT id, email, name, role FROM users WHERE role IN ('admin','editor') ORDER BY id;"

echo ""
echo "🎉 Done."
