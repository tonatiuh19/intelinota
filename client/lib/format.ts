/** Locale helpers — single place to change when adding languages. */
export const LOCALE = "es-MX";

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(LOCALE, opts).format(d);
}

/** "hace 5 min", "hace 3 h", "ayer", then a short date. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "ahora";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 6) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(d, { day: "numeric", month: "short" });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact" }).format(n);
}
