/** Pure helpers for categories/subcategories, settings and newsletter admin. */
import { slugify } from "./newsroom.js";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalizes a requested slug (falls back to the name); returns null when unusable. */
export function normalizeTaxonomySlug(slug: unknown, name: unknown): string | null {
  const raw = typeof slug === "string" && slug.trim() ? slug : typeof name === "string" ? name : "";
  const s = slugify(raw);
  return s && SLUG_RE.test(s) ? s : null;
}

/**
 * A reorder request must be a permutation of the existing ids: same length,
 * no duplicates, no unknown ids. Returns an error string or null when valid.
 */
export function validateReorder(ids: unknown, existing: number[]): string | null {
  if (!Array.isArray(ids) || !ids.length) return "ids array required";
  const nums = ids.map((v) => (typeof v === "number" ? v : Number.NaN));
  if (nums.some((n) => !Number.isInteger(n) || n <= 0)) return "ids must be positive integers";
  if (new Set(nums).size !== nums.length) return "duplicate ids";
  if (nums.length !== existing.length) return "ids must include every item exactly once";
  const known = new Set(existing);
  if (nums.some((n) => !known.has(n))) return "unknown id";
  return null;
}

/** Writable system_settings keys (server-side whitelist). */
export const WRITABLE_SETTINGS = ["newsroom_timezone", "comment_blocklist", "app_version"] as const;
export type WritableSettingKey = (typeof WRITABLE_SETTINGS)[number];

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Lowercases, trims, dedupes and caps blocklist terms; returns comma-separated storage. */
export function normalizeBlocklist(value: string): string {
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const t = part.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60);
    if (t) seen.add(t);
    if (seen.size >= 500) break;
  }
  return [...seen].join(",");
}

/** Validates/normalizes one setting write. */
export function validateSetting(
  key: string,
  value: unknown,
): { key: WritableSettingKey; value: string } | { error: string } {
  if (!(WRITABLE_SETTINGS as readonly string[]).includes(key)) return { error: `Setting not writable: ${key}` };
  const v = typeof value === "string" ? value.trim() : "";
  switch (key as WritableSettingKey) {
    case "newsroom_timezone":
      return isValidTimeZone(v) ? { key: "newsroom_timezone", value: v } : { error: "Zona horaria inválida" };
    case "comment_blocklist":
      return { key: "comment_blocklist", value: normalizeBlocklist(typeof value === "string" ? value : "") };
    case "app_version":
      return /^[\w.+-]{1,40}$/.test(v) ? { key: "app_version", value: v } : { error: "Versión inválida" };
  }
}

/** RFC 4180 CSV field; neutralizes spreadsheet formula injection. */
export function csvField(value: unknown): string {
  let s = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",") + "\r\n";
}

/** Fills a per-day series (UTC dates) for the last `days` days ending today. */
export function fillDailySeries(
  rows: Array<{ day: string | Date; n: number | string }>,
  days: number,
  now = new Date(),
): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
    map.set(key, Number(r.n) || 0);
  }
  const out: Array<{ date: string; count: number }> = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end - i * 86400000).toISOString().slice(0, 10);
    out.push({ date, count: map.get(date) ?? 0 });
  }
  return out;
}
