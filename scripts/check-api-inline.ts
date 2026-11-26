/**
 * Vercel serverless gate for intelinota's API layout.
 *
 * groundwork keeps everything inline in api/index.ts. Intelinota instead splits
 * helpers into api/_lib/*.ts: the leading underscore keeps Vercel from turning
 * them into separate functions, and @vercel/node's file tracing bundles every
 * relative module that api/index.ts statically imports. So relative imports are
 * fine ONLY when they stay inside api/_lib and resolve to a real file.
 *
 * Checked (api/index.ts and, transitively, every api/_lib module it reaches):
 *   - relative value imports must point into api/_lib/ and resolve to a .ts file
 *     (ESM ".js" specifiers map to the sibling .ts);
 *   - no imports of other api/*.ts files (each would be its own function) or of
 *     ../shared / client code (outside the function's directory);
 *   - no dynamic import() / require() of relative paths (not traceable).
 * Allowed everywhere: `import type` / `export type` (erased at compile).
 *
 * Usage: npx tsx scripts/check-api-inline.ts  (also run by scripts/deploy-prod.ts)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_API_INDEX = path.resolve(__dirname, "../api/index.ts");

/** Relative static imports may only land in this directory. */
const ALLOWED_LIB_DIR = "_lib";

export type InlineViolation = {
  line: number;
  kind: "import" | "export" | "dynamic_import" | "require";
  specifier: string;
  /** File the violation is in (relative label), set by checkApiIndexInline. */
  file?: string;
  reason?: string;
  snippet: string;
};

/** Strip // and /* *\/ comments without touching string contents (best-effort). */
export function stripTsComments(source: string): string {
  let out = "";
  let i = 0;
  let state: "code" | "sq" | "dq" | "tpl" | "line" | "block" = "code";
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    if (state === "code") {
      if (c === "/" && n === "/") {
        state = "line";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && n === "*") {
        state = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'") {
        state = "sq";
        out += c;
        i++;
        continue;
      }
      if (c === '"') {
        state = "dq";
        out += c;
        i++;
        continue;
      }
      if (c === "`") {
        state = "tpl";
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      } else {
        out += " ";
      }
      i++;
      continue;
    }
    if (state === "block") {
      if (c === "*" && n === "/") {
        state = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }
    // strings / template
    if (c === "\\" && i + 1 < source.length) {
      out += c + source[i + 1];
      i += 2;
      continue;
    }
    if (
      (state === "sq" && c === "'") ||
      (state === "dq" && c === '"') ||
      (state === "tpl" && c === "`")
    ) {
      state = "code";
    }
    out += c;
    i++;
  }
  return out;
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

function snippetAt(source: string, index: number): string {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  let end = source.indexOf("\n", index);
  if (end < 0) end = source.length;
  return source.slice(start, end).trim().slice(0, 160);
}

function isRelativeSpecifier(spec: string): boolean {
  return (
    spec.startsWith("./") ||
    spec.startsWith("../") ||
    spec === "." ||
    spec === ".."
  );
}

/**
 * Scan api/index.ts source for relative runtime module loads.
 * `import type` / `export type` are allowed (compile-time only).
 */
export function findApiInlineViolations(
  source: string,
  /** Returns null when a relative static import is acceptable, else the reason. */
  checkStatic: (specifier: string) => string | null = () => "relative runtime import",
): InlineViolation[] {
  const cleaned = stripTsComments(source);
  const violations: InlineViolation[] = [];

  const staticRe =
    /\b(import|export)(\s+type)?\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(cleaned)) !== null) {
    const kindRaw = m[1] as "import" | "export";
    const typeKeyword = Boolean(m[2]);
    const specifier = m[4];
    if (!isRelativeSpecifier(specifier)) continue;
    if (typeKeyword) continue;
    const reason = checkStatic(specifier);
    if (!reason) continue;
    violations.push({
      line: lineNumberAt(cleaned, m.index),
      kind: kindRaw,
      specifier,
      reason,
      snippet: snippetAt(source, m.index),
    });
  }

  const dynImportRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dynImportRe.exec(cleaned)) !== null) {
    const specifier = m[1];
    if (!isRelativeSpecifier(specifier)) continue;
    violations.push({
      line: lineNumberAt(cleaned, m.index),
      kind: "dynamic_import",
      specifier,
      reason: "dynamic import() of a relative path is not traced into the bundle",
      snippet: snippetAt(source, m.index),
    });
  }

  const requireRe = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = requireRe.exec(cleaned)) !== null) {
    const specifier = m[1];
    if (!isRelativeSpecifier(specifier)) continue;
    violations.push({
      line: lineNumberAt(cleaned, m.index),
      kind: "require",
      specifier,
      reason: "require() of a relative path is not traced into the bundle",
      snippet: snippetAt(source, m.index),
    });
  }

  return violations;
}

export function formatApiInlineReport(
  fileLabel: string,
  violations: InlineViolation[],
  checkedFiles = 1,
): string {
  if (violations.length === 0) {
    return `✅ ${fileLabel}: relative imports stay inside api/${ALLOWED_LIB_DIR}/ and resolve (${checkedFiles} file(s) checked, Vercel-safe).`;
  }
  const lines = [
    `❌ ${fileLabel}: API imports that break the Vercel serverless bundle (ERR_MODULE_NOT_FOUND / extra functions).`,
    `   Put shared API helpers in api/${ALLOWED_LIB_DIR}/*.ts and import them statically. Use \`import type\` only for shared/ types.`,
    "",
  ];
  for (const v of violations) {
    lines.push(
      `   ${v.file ? `${v.file}:` : ""}L${v.line} [${v.kind}] ${v.specifier}${v.reason ? ` — ${v.reason}` : ""}`,
      `      ${v.snippet}`,
    );
  }
  return lines.join("\n");
}

/** Resolve a relative specifier (".js" → ".ts", extensionless → ".ts" / index.ts). */
function resolveTs(fromFile: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base.replace(/\.(m?js)$/, ".ts"), base, `${base}.ts`, path.join(base, "index.ts")];
  return candidates.find((c) => c.endsWith(".ts") && fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

export function checkApiIndexInline(filePath = DEFAULT_API_INDEX): {
  ok: boolean;
  report: string;
  violations: InlineViolation[];
} {
  const libDir = path.join(path.dirname(filePath), ALLOWED_LIB_DIR);
  const rel = (f: string) => path.relative(process.cwd(), f) || f;
  const violations: InlineViolation[] = [];
  const seen = new Set<string>();
  const queue = [filePath];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, "utf8");
    const found = findApiInlineViolations(source, (specifier) => {
      const target = resolveTs(file, specifier);
      if (!target) return "does not resolve to a .ts file";
      if (path.relative(libDir, target).startsWith("..")) return `outside api/${ALLOWED_LIB_DIR}/`;
      if (/\.(spec|test)\.ts$/.test(target)) return "imports a test file";
      queue.push(target);
      return null;
    });
    for (const v of found) violations.push({ ...v, file: rel(file) });
  }
  return {
    ok: violations.length === 0,
    report: formatApiInlineReport(rel(filePath), violations, seen.size),
    violations,
  };
}

function main() {
  const result = checkApiIndexInline();
  console.log(`\n${result.report}\n`);
  if (!result.ok) process.exit(1);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
