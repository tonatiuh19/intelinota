/** Newsroom-timezone helpers: schedule in Mexico City time regardless of device. */
export const DEFAULT_NEWSROOM_TZ = "America/Mexico_City";

function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset (ms) of `tz` from UTC at instant `date`. */
function tzOffset(date: Date, tz: string): number {
  const p = partsIn(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-26T09:30" (wall time in tz) → ISO UTC string. */
export function zonedLocalToIso(local: string, tz = DEFAULT_NEWSROOM_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - tzOffset(new Date(guess), tz);
  ts = guess - tzOffset(new Date(ts), tz); // second pass handles DST edges
  return new Date(ts).toISOString();
}

/** ISO UTC → "YYYY-MM-DDTHH:mm" wall time in tz (for <input type=datetime-local>). */
export function isoToZonedLocal(iso: string | null | undefined, tz = DEFAULT_NEWSROOM_TZ): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = partsIn(d, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

export function formatInTz(iso: string | null | undefined, tz = DEFAULT_NEWSROOM_TZ): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-MX", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
