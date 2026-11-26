import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Inbox, Loader2, Mail, MailCheck, MailX, Search, Send, Sparkles, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import type { NewsletterSubscriber } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  actOnSubscriber,
  exportNewsletterCsv,
  fetchAdminNewsletter,
  fetchNewsletterStats,
  setNewsletterQuery,
  type SubscriberAction,
} from "@/store/slices/adminNewsletterSlice";
import type { AdminNewsletterQuery } from "@/store/types";
import { formatRelative } from "@/lib/format";
import { logger } from "@/utils/logger";
import { cn } from "@/lib/utils";

const STATUS_META: Record<NewsletterSubscriber["status"], { label: string; cls: string }> = {
  active: { label: "Activo", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  pending: { label: "Pendiente", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  unsubscribed: { label: "Baja", cls: "bg-muted text-muted-foreground" },
};

function Sparkbars({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 300;
  const h = 64;
  const gap = 2;
  const bw = (w - gap * (data.length - 1)) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label="Altas por día, últimos 30 días">
      {data.map((d, i) => {
        const bh = d.count ? Math.max(3, (d.count / max) * (h - 4)) : 1.5;
        return (
          <rect key={d.date} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={1.5} className={d.count ? "fill-brand" : "fill-muted-foreground/25"}>
            <title>{`${new Date(d.date + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}: ${d.count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function AdminNewsletter() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { items, pagination, loading, error, query, stats, statsLoading, busyIds, exporting } = useAppSelector((s) => s.adminNewsletter);
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchNewsletterStats());
  }, [dispatch]);

  useEffect(() => {
    const p = dispatch(fetchAdminNewsletter());
    return () => p.abort();
  }, [dispatch, query]);

  useEffect(() => {
    if (searchDraft === query.q) return;
    const t = setTimeout(() => dispatch(setNewsletterQuery({ q: searchDraft.trim() })), 300);
    return () => clearTimeout(t);
  }, [searchDraft, query.q, dispatch]);

  const signups30 = useMemo(() => stats?.daily.reduce((n, d) => n + d.count, 0) ?? 0, [stats]);
  const sourceTotal = useMemo(() => stats?.sources.reduce((n, s) => n + s.count, 0) ?? 0, [stats]);

  if (user?.role !== "admin") return <Navigate to="/admin/dashboard" replace />;

  async function act(s: NewsletterSubscriber, action: SubscriberAction) {
    const r = await dispatch(actOnSubscriber({ id: s.id, action }));
    setConfirmDelete(null);
    if (actOnSubscriber.fulfilled.match(r)) {
      toast({
        title: { resend: "Confirmación reenviada", unsubscribe: "Suscriptor dado de baja", delete: "Suscriptor eliminado" }[action],
        description: s.email,
      });
    } else {
      logger.warn("newsletter action failed", action, r.payload);
      toast({ title: "No se pudo completar", description: String(r.payload ?? ""), variant: "destructive" });
    }
  }

  async function onExport() {
    const r = await dispatch(exportNewsletterCsv());
    if (exportNewsletterCsv.fulfilled.match(r)) toast({ title: "Exportación lista", description: r.payload });
    else toast({ title: "No se pudo exportar", description: String(r.payload ?? ""), variant: "destructive" });
  }

  const c = stats?.counts;
  const statCards = [
    { label: "Activos", value: c?.active, icon: MailCheck, tone: "text-emerald-600" },
    { label: "Pendientes de confirmar", value: c?.pending, icon: Mail, tone: "text-amber-600" },
    { label: "Bajas", value: c?.unsubscribed, icon: MailX, tone: "text-muted-foreground" },
    { label: "Nuevos 7 días", value: c?.new_7d, icon: UserPlus, tone: "text-brand" },
  ];
  const tabs: Array<{ v: AdminNewsletterQuery["status"]; label: string; n?: number }> = [
    { v: "all", label: "Todos", n: c?.total },
    { v: "active", label: "Activos", n: c?.active },
    { v: "pending", label: "Pendientes", n: c?.pending },
    { v: "unsubscribed", label: "Bajas", n: c?.unsubscribed },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28 lg:pb-10">
      <MetaHead title="Newsletter" noIndex includeSiteOrganization={false} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Audiencia</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Newsletter</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suscriptores con doble confirmación desde los formularios del sitio.</p>
        </div>
        <Button variant="outline" className="hidden h-10 sm:inline-flex" onClick={() => void onExport()} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar activos (CSV)
        </Button>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p>
          <span className="font-semibold">Próximamente:</span> redacción y envío de ediciones del boletín desde aquí. Por ahora puedes gestionar la lista y exportarla.
        </p>
      </div>

      {/* Stats band */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <s.icon className={cn("h-5 w-5", s.tone)} />
            {statsLoading && !stats ? (
              <Skeleton className="mt-3 h-8 w-16" />
            ) : (
              <p className="mt-2 font-display text-3xl font-bold tabular-nums">{(s.value ?? 0).toLocaleString("es-MX")}</p>
            )}
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 md:col-span-3">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Altas por día</p>
            <p className="text-xs text-muted-foreground">{signups30} en 30 días</p>
          </div>
          {stats ? <Sparkbars data={stats.daily} /> : <Skeleton className="h-16 w-full" />}
          {stats && (
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>hace 30 días</span>
              <span>hoy</span>
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4 md:col-span-2">
          <p className="mb-3 text-sm font-semibold">Por origen</p>
          {!stats ? (
            <Skeleton className="h-16 w-full" />
          ) : stats.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos aún.</p>
          ) : (
            <ul className="space-y-2">
              {stats.sources.map((s) => (
                <li key={s.source}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate font-medium">{s.source}</span>
                    <span className="tabular-nums text-muted-foreground">{s.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${(s.count / Math.max(1, sourceTotal)) * 100}%` }} transition={{ duration: 0.5 }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Filters */}
      <div role="tablist" aria-label="Estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const active = query.status === t.v;
          return (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => dispatch(setNewsletterQuery({ status: t.v }))}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {t.label}
              {t.n != null && <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-background/20" : "bg-muted")}>{t.n}</span>}
            </button>
          );
        })}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="nl-q" className="sr-only">Buscar por correo</label>
        <input
          id="nl-q"
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Buscar por correo"
          className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {loading && !items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          {query.q || query.status !== "all" ? <Inbox className="mx-auto h-10 w-10 text-brand" strokeWidth={1.5} /> : <Users className="mx-auto h-10 w-10 text-brand" strokeWidth={1.5} />}
          <p className="mt-3 font-display text-xl font-semibold">{query.q || query.status !== "all" ? "Sin resultados" : "Aún no hay suscriptores"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{query.q || query.status !== "all" ? "Prueba con otro filtro o búsqueda." : "Aparecerán aquí cuando alguien se suscriba desde el sitio."}</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[1fr_8rem_7rem_8rem_auto] gap-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Correo</span>
            <span>Origen</span>
            <span>Estado</span>
            <span>Alta</span>
            <span className="w-[10.5rem] text-right">Acciones</span>
          </div>
          <ul className={cn("space-y-2 transition-opacity", loading && "opacity-60")}>
            <AnimatePresence initial={false}>
              {items.map((s) => {
                const busy = busyIds.includes(s.id);
                const meta = STATUS_META[s.status];
                return (
                  <motion.li
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: busy ? 0.5 : 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                    className="group grid grid-cols-1 gap-2 rounded-xl border bg-card p-4 md:grid-cols-[1fr_8rem_7rem_8rem_auto] md:items-center md:gap-3 md:py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.email}</p>
                      {s.name && <p className="truncate text-xs text-muted-foreground">{s.name}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:contents">
                      <span className="truncate">{s.source ?? "—"}</span>
                      <span className={cn("w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.cls)}>{meta.label}</span>
                      <span title={new Date(s.subscribed_at).toLocaleString("es-MX")}>{formatRelative(s.subscribed_at)}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 transition-opacity md:w-[10.5rem] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      {confirmDelete === s.id ? (
                        <>
                          <Button size="sm" variant="ghost" className="h-10" onClick={() => setConfirmDelete(null)}>No</Button>
                          <Button size="sm" variant="destructive" className="h-10" disabled={busy} onClick={() => void act(s, "delete")}>
                            Eliminar
                          </Button>
                        </>
                      ) : (
                        <>
                          {s.status === "pending" && (
                            <button type="button" title="Reenviar confirmación" aria-label={`Reenviar confirmación a ${s.email}`} disabled={busy} onClick={() => void act(s, "resend")} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted">
                              <Send className="h-4 w-4" />
                            </button>
                          )}
                          {s.status !== "unsubscribed" && (
                            <button type="button" title="Dar de baja" aria-label={`Dar de baja a ${s.email}`} disabled={busy} onClick={() => void act(s, "unsubscribe")} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted">
                              <UserMinus className="h-4 w-4" />
                            </button>
                          )}
                          <button type="button" title="Eliminar" aria-label={`Eliminar ${s.email}`} disabled={busy} onClick={() => setConfirmDelete(s.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {pagination && pagination.totalPages > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-between pt-2">
              <Button variant="outline" className="h-10" disabled={query.page <= 1 || loading} onClick={() => dispatch(setNewsletterQuery({ page: query.page - 1 }))}>
                ← Anterior
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Página {query.page} de {pagination.totalPages}
              </span>
              <Button variant="outline" className="h-10" disabled={query.page >= pagination.totalPages || loading} onClick={() => dispatch(setNewsletterQuery({ page: query.page + 1 }))}>
                Siguiente →
              </Button>
            </nav>
          )}
        </>
      )}

      {/* Mobile sticky export */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Button variant="outline" className="h-11 w-full" onClick={() => void onExport()} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar activos (CSV)
        </Button>
      </div>
    </div>
  );
}
