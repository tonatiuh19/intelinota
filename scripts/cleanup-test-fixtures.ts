/**
 * Purge (or preview) integration-test leftovers in the shared TiDB, so editors never see test data.
 *
 *   npm run test:cleanup-fixtures               # delete
 *   npm run test:cleanup-fixtures -- --dry-run  # read-only scan
 *
 * Same CLI contract as groundwork's script, which `npm run deploy:prod` calls after the test step
 * (pass, fail or Ctrl+C). Exit 0 = DB is clean, non-zero = cleanup failed (deploy stops).
 *
 * Intelinota's test suite (vitest, api/_lib/*.spec.ts) is pure unit tests: nothing writes to the
 * live DB today, so there are no fixture rules and this script deletes nothing. It does not even
 * open a DB connection while FIXTURE_RULES is empty, so a TiDB blip can't fail a deploy for no reason.
 *
 * TODO(integration tests): when a test starts writing to the shared DB, give its rows an
 * identifiable marker (e.g. slugs / emails starting with "itest-" or an @example.test email) and
 * add a rule below. Rules run child tables first; verify every column against database/schema.sql.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

type FixtureRule = {
  /** Shown in the summary, e.g. "test subscribers". */
  label: string;
  /** SELECT COUNT(*) AS n … identifying only test rows. */
  countSql: string;
  /** DELETE … with the same WHERE as countSql. */
  deleteSql: string;
};

/** Empty on purpose: see the TODO above. Example (not enabled):
 *  { label: "test subscribers",
 *    countSql: "SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE email LIKE '%@example.test'",
 *    deleteSql: "DELETE FROM newsletter_subscribers WHERE email LIKE '%@example.test'" }
 */
const FIXTURE_RULES: FixtureRule[] = [];

async function countAll(conn: mysql.Connection): Promise<Array<{ label: string; n: number }>> {
  const out: Array<{ label: string; n: number }> = [];
  for (const rule of FIXTURE_RULES) {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(rule.countSql);
    out.push({ label: rule.label, n: Number(rows[0]?.n ?? 0) });
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (FIXTURE_RULES.length === 0) {
    console.log("✅ No test data in the shared DB (no integration-test fixture rules defined; nothing to clean).");
    return;
  }
  if (!process.env.DB_HOST) {
    console.error("DB_HOST required (.env)");
    process.exit(1);
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "false" ? undefined : { minVersion: "TLSv1.2" },
    connectTimeout: 20_000,
  });
  try {
    const found = await countAll(conn);
    const total = found.reduce((s, f) => s + f.n, 0);
    if (!dryRun && total) {
      for (const rule of FIXTURE_RULES) await conn.query(rule.deleteSql);
    }
    console.log(`${dryRun ? "Would remove" : "Removed"}: ${found.map((f) => `${f.n} ${f.label}`).join(", ")}`);
    if (!dryRun && total) {
      const remaining = (await countAll(conn)).filter((f) => f.n > 0);
      if (remaining.length) {
        console.error(`⚠️  Still present after purge: ${JSON.stringify(remaining)}`);
        process.exitCode = 1;
      }
    }
    if (!total) console.log("✅ No test data in the shared DB.");
  } finally {
    await conn.end().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
