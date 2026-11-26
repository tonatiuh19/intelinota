import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  Archive,
  Bot,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FilePen,
  FilePlus2,
  History,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Settings,
  ShieldX,
  Undo2,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AuditEntry, AuditTypeFilter } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAuditLog, resetAuditFilters, setAuditFilters } from "@/store/slices/adminAuditSlice";
import { formatDate, LOCALE } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "article.create": "creó el artículo",
  "article.update": "editó el artículo",
  "article.archive": "archivó el artículo",
  "article.restore": "restauró una versión de",
  "article.status.published": "publicó",
  "article.status.in_review": "envió a revisión",
  "article.status.draft": "guardó como borrador",
  "article.status.scheduled": "programó",
  "article.status.archived": "archivó",
  "article.pending_edit": "propuso cambios a",
  "article.review.published": "aprobó y publicó",
  "article.review.approved": "aprobó y programó",
  "article.review.returned": "devolvió al autor",
  "article.revision.approved": "aplicó cambios propuestos a",
  "article.revision.rejected": "rechazó cambios propuestos a",
  "author.create": "creó el perfil de",
  "author.update": "editó el perfil de",
  "author.delete": "eliminó el perfil de",
  "author.role.update": "cambió el rol de",
  "author.access.grant": "dio acceso al panel a",
  "author.access.update": "actualizó el acceso de",
  "author.access.revoke": "quitó el acceso al panel a",
  "author.can_publish.grant": "dio permiso de publicar a",
  "author.can_publish.revoke": "quitó el permiso de publicar a",
  "comment.approved": "aprobó un comentario",
  "comment.spam": "marcó como spam un comentario",
  "comment.bulk.approve": "aprobó comentarios",
  "comment.bulk.spam": "marcó comentarios como spam",
  "comment.bulk.pending": "devolvió comentarios a pendientes",
  "comment.bulk.delete": "eliminó comentarios",
  "comment.reply": "respondió un comentario",
  "comment.pending": "devolvió a pendiente un comentario",
  "mcp.authorize": "conectó un asistente de IA",
  "mcp.revoke": "desconectó un asistente de IA",
};

/** MCP tool names (mcp_audit_logs.tool_name) → human verbs. */
const MCP_TOOL_LABELS: Record<string, string> = {
  create_draft: "creó un borrador",
  update_article: "editó un artículo",
  submit_for_review: "envió a revisión un artículo",
  publish_article: "publicó un artículo",
  archive_article: "archivó un artículo",
  restore_revision: "restauró una versión",
  upload_image_from_url: "subió una imagen",
  set_featured: "cambió los destacados",
  approve_article: "aprobó un artículo",
  return_article: "devolvió un artículo",
  approve_pending_edit: "aplicó cambios propuestos",
  reject_pending_edit: "rechazó cambios propuestos",
  moderate_comments: "moderó comentarios",
  reply_to_comment: "respondió un comentario",
  mark_notifications_read: "marcó notificaciones como leídas",
};

const TYPES: Array<{ v: AuditTypeFilter | null; label: string; icon: LucideIcon }> = [
  { v: null, label: "Todo", icon: ActivityIcon },
  { v: "articles", label: "Artículos", icon: FilePen },
  { v: "review", label: "Revisión", icon: ClipboardCheck },
  { v: "comments", label: "Comentarios", icon: MessageSquare },
  { v: "authors", label: "Autores", icon: Users },
  { v: "mcp", label: "Vía IA", icon: Bot },
  { v: "settings", label: "Configuración", icon: Settings },
];

function iconFor(e: AuditEntry): { icon: LucideIcon; cls: string } {
  const a = e.action;
  if (e.source === "mcp" || a.startsWith("mcp.")) return { icon: Bot, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  if (a === "article.create") return { icon: FilePlus2, cls: "bg-brand/10 text-brand" };
  if (a.endsWith(".published") || a === "article.review.approved" || a === "article.revision.approved")
    return { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (a.includes("returned") || a.includes("rejected")) return { icon: Undo2, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  if (a === "article.status.in_review" || a === "article.pending_edit") return { icon: Send, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  if (a.includes("archive")) return { icon: Archive, cls: "bg-muted text-muted-foreground" };
  if (a === "article.restore") return { icon: History, cls: "bg-brand/10 text-brand" };
  if (e.entity_type === "comment") {
    if (a.includes("spam") || a.includes("delete")) return { icon: ShieldX, cls: "bg-red-500/10 text-red-600 dark:text-red-400" };
    if (a.includes("pending")) return { icon: RotateCcw, cls: "bg-muted text-muted-foreground" };
    return { icon: MessageSquare, cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
  }
  if (e.entity_type === "author") return { icon: UserCog, cls: "bg-brand/10 text-brand" };
  if (e.entity_type === "article") return { icon: FilePen, cls: "bg-brand/10 text-brand" };
  return { icon: Settings, cls: "bg-muted text-muted-foreground" };
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d.toISOString()) === dayKey(today.toISOString())) return "Hoy";
  if (dayKey(d.toISOString()) === dayKey(yesterday.toISOString())) return "Ayer";
  const label = formatDate(d, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function EntryLine({ e }: { e: AuditEntry }) {
  const d = e.details ?? {};
  const actor = e.user_name ?? e.user_email ?? "Sistema";
  if (e.source === "mcp") {
    const tool = str(d.tool) ?? e.action;
    const ok = d.ok === 1 || d.ok === true;
    const executed = d.confirm === 1 || d.confirm === true;
    return (
      <>
        <span className="font-semibold">{actor}</span>{" "}
        <span className="text-muted-foreground">{MCP_TOOL_LABELS[tool] ?? (executed ? "ejecutó" : "consultó")}</span>{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{tool}</code>
        {!ok && <span className="ml-1.5 text-xs font-medium text-destructive">· falló{str(d.error) ? `: ${str(d.error)}` : ""}</span>}
        {ok && !executed && <span className="ml-1.5 text-xs text-muted-foreground">· solo lectura</span>}
      </>
    );
  }
  const title = str(d.title) ?? str(d.name);
  const verb = ACTION_LABELS[e.action] ?? e.action;
  let target: React.ReactNode = null;
  if (e.entity_type === "article" && e.entity_id) {
    target = (
      <Link to={`/admin/articles/${e.entity_id}/edit`} className="font-medium text-foreground hover:text-brand hover:underline">
        {title ?? `#${e.entity_id}`}
      </Link>
    );
  } else if (e.entity_type === "author") {
    target =
      e.action === "author.delete" ? (
        <span className="font-medium">{title ?? `#${e.entity_id}`}</span>
      ) : (
        <Link to="/admin/authors" className="font-medium text-foreground hover:text-brand hover:underline">
          {title ?? `#${e.entity_id}`}
        </Link>
      );
  } else if (e.entity_type === "comment") {
    const count = Array.isArray(d.ids) ? d.ids.length : typeof d.count === "number" ? d.count : null;
    target = (
      <Link to="/admin/comments" className="text-xs font-medium text-brand hover:underline">
        {count && count > 1 ? `(${count})` : "Ver comentarios"}
      </Link>
    );
  } else if (e.entity_id) {
    target = <span className="text-muted-foreground">#{e.entity_id}</span>;
  }
  return (
    <>
      <span className="font-semibold">{actor}</span> <span className="text-muted-foreground">{verb}</span> {target}
    </>
  );
}

export default function AdminActivity() {
  const dispatch = useAppDispatch();
  const { items, pagination, loading, loadingMore, error, filters, users } = useAppSelector((s) => s.adminAudit);
  const page = pagination?.page ?? 1;
  const hasMore = pagination ? page < pagination.totalPages : false;
  const filtered = Boolean(filters.type || filters.user_id || filters.from || filters.to);

  useEffect(() => {
    const p = dispatch(fetchAuditLog(1));
    return () => p.abort();
  }, [dispatch, filters]);

  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; items: AuditEntry[] }> = [];
    for (const e of items) {
      const k = dayKey(e.created_at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(e);
      else out.push({ key: k, label: dayLabel(e.created_at), items: [e] });
    }
    return out;
  }, [items]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <MetaHead title="Actividad" noIndex includeSiteOrganization={false} />

      <header>
        <p className="kicker">Redacción</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Actividad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todo lo que pasa en el panel: publicaciones, revisiones, moderación, equipo y acciones de asistentes de IA.
        </p>
      </header>

      {/* Type pills */}
      <div role="tablist" aria-label="Tipo de actividad" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {TYPES.map((t) => {
          const active = filters.type === t.v;
          return (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => dispatch(setAuditFilters({ type: t.v }))}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {active && pagination && (
                <span className="rounded-full bg-background/20 px-1.5 text-[11px] tabular-nums">{pagination.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
        <div>
          <label htmlFor="act-user" className="mb-1 block text-xs font-medium text-muted-foreground">Usuario</label>
          <select
            id="act-user"
            value={filters.user_id ?? ""}
            onChange={(e) => dispatch(setAuditFilters({ user_id: e.target.value ? Number(e.target.value) : null }))}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Todo el equipo</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <div>
            <label htmlFor="act-from" className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Desde
            </label>
            <input
              id="act-from"
              type="date"
              value={filters.from ?? ""}
              max={filters.to ?? undefined}
              onChange={(e) => dispatch(setAuditFilters({ from: e.target.value || null }))}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="act-to" className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
            <input
              id="act-to"
              type="date"
              value={filters.to ?? ""}
              min={filters.from ?? undefined}
              onChange={(e) => dispatch(setAuditFilters({ to: e.target.value || null }))}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            />
          </div>
        </div>
        {filtered && (
          <Button variant="ghost" className="h-10" onClick={() => dispatch(resetAuditFilters())}>
            <X className="mr-1.5 h-4 w-4" /> Limpiar
          </Button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {loading && !items.length ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <Skeleton className="h-9 flex-1 rounded-lg" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <ActivityIcon className="mx-auto h-10 w-10 text-brand" strokeWidth={1.5} />
          <p className="mt-3 font-display text-xl font-semibold">{filtered ? "Nada con estos filtros" : "Sin actividad todavía"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? "Prueba con otro tipo, usuario o rango de fechas." : "Aquí aparecerá cada acción del equipo."}
          </p>
          {filtered && (
            <Button variant="outline" className="mt-4 h-10" onClick={() => dispatch(resetAuditFilters())}>
              Quitar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("space-y-8 transition-opacity", loading && "opacity-60")}>
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`day-${g.key}`}>
              <h2 id={`day-${g.key}`} className="sticky top-14 z-10 -mx-4 mb-3 bg-background/90 px-4 py-1 font-display text-lg font-bold backdrop-blur sm:mx-0 sm:px-0">
                {g.label}
              </h2>
              <ol className="relative space-y-1 border-l border-border pl-0">
                <AnimatePresence initial={false}>
                  {g.items.map((e) => {
                    const { icon: Icon, cls } = iconFor(e);
                    const viaAi = e.source === "mcp";
                    return (
                      <motion.li
                        key={`${e.source ?? "audit"}-${e.id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="relative flex items-start gap-3 py-2 pl-5"
                      >
                        <span className={cn("absolute -left-[18px] flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-background", cls)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1 pl-3 text-sm leading-relaxed">
                          <p className="break-words">
                            <EntryLine e={e} />
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <time dateTime={e.created_at} title={formatDate(e.created_at, { dateStyle: "full", timeStyle: "short" })}>
                              {timeFmt.format(new Date(e.created_at))}
                            </time>
                            {viaAi && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                <Bot className="h-3 w-3" /> vía IA
                              </span>
                            )}
                          </p>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
            </section>
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" className="h-10 min-w-40" disabled={loadingMore} onClick={() => dispatch(fetchAuditLog(page + 1))}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cargar más
              </Button>
            </div>
          )}
          {pagination && !hasMore && items.length > 10 && (
            <p className="text-center text-xs text-muted-foreground">Llegaste al inicio del registro.</p>
          )}
        </div>
      )}
    </div>
  );
}
