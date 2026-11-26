/** Client helpers for the categories/settings admin (pure, unit-tested). */

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Returns a new array with the item at `from` moved to `to` (clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** True when two id orders differ. */
export function orderChanged(a: readonly number[], b: readonly number[]): boolean {
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

/** Splits comma-separated blocklist storage into unique trimmed chips. */
export function parseChips(value: string | null | undefined): string[] {
  const out: string[] = [];
  for (const p of (value ?? "").split(",")) {
    const t = p.trim().toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
