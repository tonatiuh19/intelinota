import type { ArticleStatus } from "@shared/api";

/** Status presentation shared by the admin Articles list and Dashboard. */
export const STATUS_META: Record<
  ArticleStatus,
  { label: string; plural: string; dot: string; text: string }
> = {
  draft: {
    label: "Borrador",
    plural: "Borradores",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  in_review: {
    label: "En revisión",
    plural: "En revisión",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
  },
  scheduled: {
    label: "Programado",
    plural: "Programados",
    dot: "bg-brand",
    text: "text-brand",
  },
  published: {
    label: "Publicado",
    plural: "Publicados",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  archived: {
    label: "Archivado",
    plural: "Archivados",
    dot: "bg-zinc-400",
    text: "text-muted-foreground",
  },
};

const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "hace 5 minutos", "ayer", "en 2 días"… */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.round((t - Date.now()) / 1000);
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "justo ahora";
}

/** "jue 28 nov, 09:30" */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
