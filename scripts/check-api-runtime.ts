/**
 * Loads api/index.ts the way Vercel's Node runtime does: compiled to
 * CommonJS, node_modules left external, and require(esm) DISABLED.
 *
 * Catches crashes at module load time (e.g. a dependency that became ESM-only,
 * like htmlparser2 v12 under sanitize-html 2.18, which took the API down with
 * ERR_REQUIRE_ESM / FUNCTION_INVOCATION_FAILED in production on 2026-11-26).
 */
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const outDir = mkdtempSync(path.join(tmpdir(), "api-runtime-"));
const outFile = path.join(outDir, "index.cjs");

try {
  await build({
    entryPoints: ["api/index.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    packages: "external",
    outfile: outFile,
    logLevel: "silent",
  });

  const probe = `
    process.env.DB_HOST ||= "127.0.0.1";
    process.env.DB_USER ||= "x";
    process.env.DB_PASSWORD ||= "x";
    process.env.DB_NAME ||= "x";
    const mod = require(${JSON.stringify(outFile)});
    const handler = mod.default ?? mod;
    if (typeof handler !== "function") {
      console.error("api/index.ts default export is not a function");
      process.exit(1);
    }
  `;
  const r = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", probe], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_PATH: path.resolve("node_modules") },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error("❌ api/index.ts crashes when loaded like Vercel's runtime:\n");
    console.error((r.stderr || r.stdout).split("\n").slice(0, 12).join("\n"));
    process.exit(1);
  }
  console.log("✅ api/index.ts loads under CommonJS with require(esm) disabled (Vercel-safe).");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
