import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  CornerDownRight,
  ExternalLink,
  Inbox,
  Keyboard,
  Loader2,
  MessageSquareReply,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { AdminComment, CommentBulkAction, CommentFlag } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminComments,
  moderateComments,
  replyToComment,
  setCommentsQuery,
} from "@/store/slices/adminCommentsSlice";
import type { AdminCommentsQuery } from "@/store/types";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const FLAG_LABEL: Record<CommentFlag, string> = {
  links: "Enlaces",
  blocked_word: "Palabra bloqueada",
  shouting: "Mayúsculas",
  repeated_chars: "Caracteres repetidos",
  duplicate: "Duplicado",
  burst: "Ráfaga",
  known_spammer: "Spam previo",
  too_short: "Muy corto",
  trusted: "Confiable",
  staff: "Redacción",
};

function riskTone(score: number) {
  if (score >= 60) return { label: "Riesgo alto", cls: "bg-red-500/10 text-red-600 ring-red-500/30 dark:text-red-400" };
  if (score >= 40) return { label: "Revisar", cls: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400" };
  return null;
}

const replySchema = Yup.object({
  content: Yup.string().trim().min(2, "Escribe una respuesta").max(5000, "Máximo 5000 caracteres").required("Escribe una respuesta"),
});

function ReplyBox({ comment, onDone }: { comment: AdminComment; onDone: () => void }) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const formik = useFormik({
    initialValues: { content: "" },
    validationSchema: replySchema,
    onSubmit: async (v) => {
      const r = await dispatch(replyToComment({ id: comment.id, content: v.content.trim() }));
      if (replyToComment.fulfilled.match(r)) {
        toast({ title: "Respuesta publicada", description: comment.status === "pending" ? "El comentario original también fue aprobado." : undefined });
        onDone();
      } else {
        toast({ title: "No se pudo responder", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });
  return (
    <form onSubmit={formik.handleSubmit} className="mt-3 space-y-2" noValidate>
      <label htmlFor={`reply-${comment.id}`} className="sr-only">Respuesta</label>
      <textarea
        id={`reply-${comment.id}`}
        autoFocus
        rows={3}
        placeholder={`Responder a ${comment.author_name ?? "lector"} como INTELINOTA…`}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        {...formik.getFieldProps("content")}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formik.handleSubmit();
          if (e.key === "Escape") onDone();
          e.stopPropagation();
        }}
      />
      {formik.touched.content && formik.errors.content && <p role="alert" className="text-xs text-destructive">{formik.errors.content}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" className="h-10" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="h-10" disabled={formik.isSubmitting}>
          {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publicar respuesta
        </Button>
      </div>
    </form>
  );
}

export default function AdminComments() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const user = useAppSelector(selectAdminUser);
  const { items, counts, query, loading, error, pagination, busyIds } = useAppSelector((s) => s.adminComments);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [replyId, setReplyId] = useState<number | null>(null);
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [showKeys, setShowKeys] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const p = dispatch(fetchAdminComments());
    return () => p.abort();
  }, [dispatch, query]);

  // Debounced search
  useEffect(() => {
    if (searchDraft === query.q) return;
    const t = setTimeout(() => dispatch(setCommentsQuery({ q: searchDraft.trim() })), 300);
    return () => clearTimeout(t);
  }, [searchDraft, query.q, dispatch]);

  useEffect(() => {
    setSelected(new Set());
    setFocusIdx(0);
  }, [query]);

  const act = useCallback(
    async (ids: number[], action: CommentBulkAction) => {
      if (!ids.length) return;
      const before = items.filter((c) => ids.includes(c.id));
      const r = await dispatch(moderateComments({ ids, action }));
      setSelected(new Set());
      if (moderateComments.rejected.match(r)) {
        toast({ title: "No se pudo completar", description: String(r.payload ?? ""), variant: "destructive" });
        return;
      }
      const verb = { approve: "aprobado", spam: "marcado como spam", pending: "devuelto a pendientes", delete: "eliminado" }[action];
      const prevStatus = before[0]?.status;
      toast({
        title: `${ids.length} ${ids.length === 1 ? "comentario" : "comentarios"} ${verb}${ids.length === 1 ? "" : "s"}`,
        action:
          action !== "delete" && prevStatus && before.every((c) => c.status === prevStatus) ? (
            <ToastAction
              altText="Deshacer"
              onClick={() =>
                dispatch(moderateComments({ ids, action: prevStatus === "approved" ? "approve" : (prevStatus as CommentBulkAction) }))
              }
            >
              Deshacer
            </ToastAction>
          ) : undefined,
      });
    },
    [dispatch, items, toast],
  );

  // Keyboard: j/k move, a approve, s spam, r reply, x select, ? help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = items[focusIdx];
      switch (e.key) {
        case "j":
          setFocusIdx((i) => Math.min(items.length - 1, i + 1));
          break;
        case "k":
          setFocusIdx((i) => Math.max(0, i - 1));
          break;
        case "a":
          if (c) void act([c.id], "approve");
          break;
        case "s":
          if (c) void act([c.id], "spam");
          break;
        case "r":
          if (c) {
            e.preventDefault();
            setReplyId(c.id);
          }
          break;
        case "x":
          if (c)
            setSelected((prev) => {
              const n = new Set(prev);
              n.has(c.id) ? n.delete(c.id) : n.add(c.id);
              return n;
            });
          break;
        case "?":
          setShowKeys((v) => !v);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, focusIdx, act]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${focusIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusIdx]);

  const tabs: Array<{ v: AdminCommentsQuery["status"]; label: string; n?: number; icon: typeof Inbox }> = [
    { v: "pending", label: "Pendientes", n: counts.pending, icon: Inbox },
    { v: "approved", label: "Aprobados", n: counts.approved, icon: ShieldCheck },
    { v: "spam", label: "Spam", n: counts.spam, icon: Ban },
    { v: "all", label: "Todos", icon: CheckCheck },
  ];

  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));
  const lowRiskPending = useMemo(
    () => (query.status === "pending" ? items.filter((c) => c.spam_score < 20) : []),
    [items, query.status],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28">
      <MetaHead title="Comentarios" noIndex includeSiteOrganization={false} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Comunidad</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Comentarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Modera la conversación de toda la redacción." : "Modera los comentarios de tus artículos."}
            {counts.flagged_pending > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> {counts.flagged_pending} marcados para revisar
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" className="hidden h-10 md:inline-flex" onClick={() => setShowKeys((v) => !v)}>
          <Keyboard className="mr-2 h-4 w-4" /> Atajos
        </Button>
      </header>

      {showKeys && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
          {[["j / k", "Siguiente / anterior"], ["a", "Aprobar"], ["s", "Spam"], ["r", "Responder"], ["x", "Seleccionar"], ["?", "Mostrar atajos"]].map(([k, d]) => (
            <p key={k}><kbd className="rounded border bg-muted px-1.5 font-mono text-xs">{k}</kbd> <span className="text-muted-foreground">{d}</span></p>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const active = query.status === t.v;
          return (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => dispatch(setCommentsQuery({ status: t.v }))}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.n != null && (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-background/20" : "bg-muted")}>{t.n}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="cm-q" className="sr-only">Buscar comentarios</label>
          <input
            id="cm-q"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar por texto, nombre, correo o artículo"
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={query.flagged}
            onClick={() => dispatch(setCommentsQuery({ flagged: !query.flagged }))}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium sm:flex-none",
              query.flagged ? "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldAlert className="h-4 w-4" /> Solo marcados
          </button>
          <label htmlFor="cm-sort" className="sr-only">Ordenar</label>
          <select
            id="cm-sort"
            value={query.sort}
            onChange={(e) => dispatch(setCommentsQuery({ sort: e.target.value as AdminCommentsQuery["sort"] }))}
            className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm sm:flex-none"
          >
            <option value="recent">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="risk">Mayor riesgo</option>
          </select>
        </div>
      </div>

      {/* Quick win */}
      {lowRiskPending.length >= 2 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <span className="flex-1">{lowRiskPending.length} comentarios sin señales de riesgo en esta página.</span>
          <Button size="sm" className="h-9" onClick={() => void act(lowRiskPending.map((c) => c.id), "approve")}>
            Aprobar todos
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {/* List */}
      {loading && !items.length ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Inbox className="mx-auto h-10 w-10 text-brand" strokeWidth={1.5} />
          <p className="mt-3 font-display text-xl font-semibold">
            {query.status === "pending" ? "¡Bandeja limpia!" : "Nada por aquí"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.q || query.flagged ? "Prueba quitando filtros." : query.status === "pending" ? "No hay comentarios esperando moderación." : "No hay comentarios en esta vista."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--brand))]"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((c) => c.id)))}
              />
              Seleccionar todo
            </label>
            {pagination && <span className="ml-auto tabular-nums">{pagination.total} en total</span>}
          </div>
          <ul ref={listRef} className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((c, idx) => {
                const risk = riskTone(c.spam_score);
                const busy = busyIds.includes(c.id);
                const focused = idx === focusIdx;
                const staff = c.flags.includes("staff");
                return (
                  <motion.li
                    key={c.id}
                    data-idx={idx}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: busy ? 0.5 : 1, y: 0 }}
                    exit={{ opacity: 0, x: -24, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setFocusIdx(idx)}
                    className={cn(
                      "rounded-xl border bg-card p-4 transition-shadow sm:p-5",
                      focused && "ring-2 ring-brand/40",
                      selected.has(c.id) && "border-brand/50 bg-brand/[0.03]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar comentario de ${c.author_name ?? "anónimo"}`}
                        className="mt-3 h-4 w-4 shrink-0 accent-[hsl(var(--brand))]"
                        checked={selected.has(c.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                            return n;
                          })
                        }
                      />
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold", staff ? "bg-brand text-brand-foreground" : "bg-muted")}>
                        {(c.author_name ?? "?")[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-semibold">{c.author_name ?? "Anónimo"}</span>
                          {c.author_email && <span className="truncate text-xs text-muted-foreground">{c.author_email}</span>}
                          <span className="text-xs text-muted-foreground">· {formatRelative(c.created_at)}</span>
                          {query.status === "all" && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                              {{ pending: "Pendiente", approved: "Aprobado", spam: "Spam" }[c.status]}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {risk && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", risk.cls)}>{risk.label} · {c.spam_score}</span>}
                          {c.flags.filter((f) => f !== "staff").map((f) => (
                            <span
                              key={f}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                f === "trusted" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {FLAG_LABEL[f] ?? f}
                            </span>
                          ))}
                          {(c.author_approved > 0 || c.author_spam > 0) && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              Historial: {c.author_approved} aprobados{c.author_spam ? ` · ${c.author_spam} spam` : ""}
                            </span>
                          )}
                        </div>

                        {c.parent_id && (
                          <p className="mt-3 flex gap-1.5 border-l-2 pl-3 text-xs text-muted-foreground">
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">En respuesta a <strong>{c.parent_author ?? "un comentario"}</strong>: {c.parent_excerpt}</span>
                          </p>
                        )}
                        <p className="mt-3 whitespace-pre-wrap break-words font-body text-[15px] leading-relaxed">{c.content}</p>

                        <Link
                          to={`/articulo/${c.article_slug}#comentarios`}
                          target="_blank"
                          className="mt-3 inline-flex max-w-full items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          <span className="truncate">{c.article_title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>

                        {replyId === c.id ? (
                          <ReplyBox comment={c} onDone={() => setReplyId(null)} />
                        ) : (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {c.status !== "spam" && !staff && c.spam_score >= 60 && (
                              <Button size="sm" className="h-10 bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={() => void act([c.id], "spam")}>
                                <Ban className="mr-1.5 h-4 w-4" /> Marcar spam
                              </Button>
                            )}
                            {c.status !== "approved" && (
                              <Button
                                size="sm"
                                variant={c.spam_score >= 60 ? "outline" : "default"}
                                className={cn("h-10", c.spam_score < 60 && "bg-emerald-600 text-white hover:bg-emerald-700")}
                                disabled={busy}
                                onClick={() => void act([c.id], "approve")}
                              >
                                <Check className="mr-1.5 h-4 w-4" /> Aprobar
                              </Button>
                            )}
                            {!staff && (
                              <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={() => setReplyId(c.id)}>
                                <MessageSquareReply className="mr-1.5 h-4 w-4" /> Responder
                              </Button>
                            )}
                            {c.status !== "spam" && !staff && c.spam_score < 60 && (
                              <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={() => void act([c.id], "spam")}>
                                <Ban className="mr-1.5 h-4 w-4" /> Spam
                              </Button>
                            )}
                            {c.status !== "pending" && (
                              <Button size="sm" variant="ghost" className="h-10" disabled={busy} onClick={() => void act([c.id], "pending")}>
                                <RotateCcw className="mr-1.5 h-4 w-4" /> A pendientes
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-10 text-muted-foreground hover:text-destructive"
                                disabled={busy}
                                onClick={() => window.confirm("¿Eliminar este comentario de forma permanente?") && void act([c.id], "delete")}
                              >
                                <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {pagination && pagination.totalPages > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-between pt-2">
              <Button variant="outline" className="h-10" disabled={query.page <= 1 || loading} onClick={() => dispatch(setCommentsQuery({ page: query.page - 1 }))}>
                ← Anterior
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">Página {query.page} de {pagination.totalPages}</span>
              <Button variant="outline" className="h-10" disabled={query.page >= pagination.totalPages || loading} onClick={() => dispatch(setCommentsQuery({ page: query.page + 1 }))}>
                Siguiente →
              </Button>
            </nav>
          )}
        </>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:left-64"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
              <span className="text-sm font-semibold">{selected.size} seleccionados</span>
              <button type="button" aria-label="Quitar selección" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" onClick={() => setSelected(new Set())}>
                <X className="h-4 w-4" />
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button className="h-10 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void act([...selected], "approve")}>
                  <Check className="mr-1.5 h-4 w-4" /> Aprobar
                </Button>
                <Button variant="outline" className="h-10" onClick={() => void act([...selected], "spam")}>
                  <Ban className="mr-1.5 h-4 w-4" /> Spam
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="h-10 text-destructive"
                    onClick={() => window.confirm(`¿Eliminar ${selected.size} comentarios de forma permanente?`) && void act([...selected], "delete")}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
