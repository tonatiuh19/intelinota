import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  LayoutGrid,
  List,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Article } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import OverlayCard from "@/components/OverlayCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchBookmarkedArticles } from "@/store/slices/bookmarksSlice";
import { fetchHome, selectHomeMostRead } from "@/store/slices/homeSlice";
import {
  BOOKMARKS_CHANGED,
  type BookmarkMeta,
  clearBookmarks,
  getBookmarkMeta,
  getBookmarks,
  removeBookmark,
  restoreBookmark,
  setBookmarkRead,
  toggleBookmark,
} from "@/lib/share";
import { ARTICLE_PLACEHOLDER, articleImageSrcSet, articleImageUrl, IMAGE_SIZES } from "@/lib/images";
import { formatRelative } from "@/lib/format";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

type Tab = "all" | "unread" | "read";
type Sort = "newest" | "oldest" | "shortest" | "longest";
type View = "grid" | "list";

const VIEW_KEY = "intelinota_bookmarks_view";

function savedLabel(meta?: BookmarkMeta) {
  if (!meta?.savedAt) return "Guardado";
  return `Guardado ${formatRelative(new Date(meta.savedAt))}`;
}

function fallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.removeAttribute("srcset");
  img.src = ARTICLE_PLACEHOLDER;
}

function useBookmarkStore() {
  const [slugs, setSlugs] = useState<string[]>(() => getBookmarks());
  const [meta, setMeta] = useState<Record<string, BookmarkMeta>>(() => getBookmarkMeta());
  useEffect(() => {
    const refresh = () => {
      setSlugs(getBookmarks());
      setMeta(getBookmarkMeta());
    };
    window.addEventListener("storage", refresh);
    window.addEventListener(BOOKMARKS_CHANGED, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BOOKMARKS_CHANGED, refresh);
    };
  }, []);
  return { slugs, meta };
}

function ItemActions({
  read,
  onToggleRead,
  onRemove,
  dark,
}: {
  read: boolean;
  onToggleRead: () => void;
  onRemove: () => void;
  dark?: boolean;
}) {
  const base = cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
    dark ? "bg-black/50 text-white backdrop-blur hover:bg-white hover:text-black" : "border bg-background text-muted-foreground hover:text-foreground",
  );
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggleRead();
        }}
        aria-label={read ? "Marcar como no leído" : "Marcar como leído"}
        aria-pressed={read}
        className={cn(base, read && !dark && "border-brand/40 text-brand")}
      >
        {read ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        aria-label="Quitar de guardados"
        className={cn(base, "hover:text-destructive")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Bookmarks() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((s) => s.bookmarks);
  const mostRead = useAppSelector(selectHomeMostRead);
  const { slugs, meta } = useBookmarkStore();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [section, setSection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || "grid";
    } catch {
      return "grid";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    if (slugs.length) dispatch(fetchBookmarkedArticles(slugs));
  }, [dispatch, slugs]);

  useEffect(() => {
    if (!slugs.length && !mostRead.length) dispatch(fetchHome());
  }, [dispatch, slugs.length, mostRead.length]);

  // Saved articles still present (removed ones disappear instantly)
  const saved = useMemo(() => {
    const set = new Set(slugs);
    return items.filter((a) => set.has(a.slug));
  }, [items, slugs]);

  const isRead = (a: Article) => Boolean(meta[a.slug]?.readAt);
  const unread = saved.filter((a) => !isRead(a));
  const stats = {
    total: saved.length,
    unread: unread.length,
    read: saved.length - unread.length,
    minutesLeft: unread.reduce((n, a) => n + (a.read_time_minutes || 0), 0),
  };

  const sections = useMemo(() => {
    const m = new Map<string, number>();
    saved.forEach((a) => m.set(a.category_name, (m.get(a.category_name) ?? 0) + 1));
    return Array.from(m.entries()).sort((x, y) => y[1] - x[1]);
  }, [saved]);

  // "Continue reading": most recently saved unread story
  const next = useMemo(
    () => [...unread].sort((a, b) => (meta[b.slug]?.savedAt ?? 0) - (meta[a.slug]?.savedAt ?? 0))[0],
    [unread, meta],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = saved.filter((a) => {
      if (tab === "unread" && isRead(a)) return false;
      if (tab === "read" && !isRead(a)) return false;
      if (section && a.category_name !== section) return false;
      if (q && !`${a.title} ${a.excerpt ?? ""} ${a.author_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const savedAt = (a: Article) => meta[a.slug]?.savedAt ?? 0;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return savedAt(a) - savedAt(b);
        case "shortest":
          return a.read_time_minutes - b.read_time_minutes;
        case "longest":
          return b.read_time_minutes - a.read_time_minutes;
        default:
          return savedAt(b) - savedAt(a);
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, meta, tab, section, query, sort]);

  const remove = (a: Article) => {
    const prev = meta[a.slug];
    removeBookmark(a.slug);
    toast({
      title: "Quitado de guardados",
      description: a.title,
      action: (
        <ToastAction altText="Deshacer" onClick={() => restoreBookmark(a.slug, prev)}>
          Deshacer
        </ToastAction>
      ),
    });
  };

  const toggleRead = (a: Article) => setBookmarkRead(a.slug, !isRead(a));

  const tabs: Array<{ v: Tab; label: string; n: number }> = [
    { v: "all", label: "Todos", n: stats.total },
    { v: "unread", label: "Por leer", n: stats.unread },
    { v: "read", label: "Leídos", n: stats.read },
  ];

  const empty = slugs.length === 0;

  return (
    <div className="pb-24">
      <MetaHead title="Guardados" description="Tus artículos guardados en INTELINOTA." noIndex includeSiteOrganization={false} />

      {/* ── Header band ───────────────────────────────────────── */}
      <header className="container px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="inline-flex h-8 items-center hover:text-foreground">Portada</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="kicker">Guardados</span>
        </nav>
        <div className="mt-2 flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 font-display text-[2.25rem] font-bold leading-none tracking-[-0.02em] sm:text-5xl">
              Tu lista de lectura
            </h1>
            <p className="mt-3 max-w-xl font-body text-lg text-muted-foreground">
              Historias que guardaste para leer después. Se guardan en este dispositivo.
            </p>
          </div>
          {!empty && (
            <dl className="grid grid-cols-3 divide-x rounded-xl border bg-card lg:min-w-[420px]">
              {[
                { k: "Guardados", v: stats.total },
                { k: "Por leer", v: stats.unread },
                { k: "Min. pendientes", v: stats.minutesLeft },
              ].map((x) => (
                <div key={x.k} className="px-4 py-3">
                  <dt className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{x.k}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{x.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>

      {empty ? (
        /* ── Empty state ─────────────────────────────────────── */
        <section className="container px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10">
              <Bookmark className="h-9 w-9 text-brand" strokeWidth={1.75} />
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                <BookmarkPlus className="h-4 w-4" />
              </span>
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">Aún no guardas nada</h2>
            <p className="mt-2 font-body text-muted-foreground">
              Toca el ícono <Bookmark className="inline h-4 w-4 align-[-2px]" /> en cualquier artículo para leerlo después.
              Marcamos como leídos los que terminas.
            </p>
          </div>
          {mostRead.length > 0 && (
            <div className="mx-auto mt-12 max-w-4xl">
              <h3 className="rule-top mb-2 pt-3 font-display text-xl font-bold">Para empezar: lo más leído</h3>
              <ul className="divide-y">
                {mostRead.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center gap-4 py-4">
                    <Link to={`/articulo/${a.slug}`} className="group flex min-w-0 flex-1 items-center gap-4">
                      <img
                        src={articleImageUrl(a.image_url)}
                        alt=""
                        loading="lazy"
                        onError={fallback}
                        className="h-16 w-24 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0">
                        <span className="kicker block">{a.category_name}</span>
                        <span className="line-clamp-2 font-display font-semibold leading-snug group-hover:underline">{a.title}</span>
                      </span>
                    </Link>
                    <Button
                      variant="outline"
                      className="h-10 shrink-0"
                      onClick={() => {
                        toggleBookmark(a.slug);
                        toast({ title: "Guardado", description: a.title });
                      }}
                    >
                      <BookmarkPlus className="mr-1.5 h-4 w-4" /> Guardar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ── Continue reading ───────────────────────────────── */}
          {next && tab !== "read" && !query && !section && (
            <section className="container mt-8 px-4 sm:px-6 lg:px-8" aria-label="Continúa leyendo">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <div className="relative lg:col-span-8">
                  <OverlayCard article={next} size="lg" label="Continúa leyendo" priority className="lg:min-h-[340px]" />
                  <div className="absolute right-4 top-4">
                    <ItemActions dark read={false} onToggleRead={() => toggleRead(next)} onRemove={() => remove(next)} />
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-6 lg:col-span-4">
                  <div>
                    <p className="kicker !text-muted-foreground">Tu progreso</p>
                    <p className="mt-2 font-display text-3xl font-bold tabular-nums">
                      {stats.read}
                      <span className="text-lg font-normal text-muted-foreground"> / {stats.total} leídos</span>
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-brand"
                        initial={reduced ? false : { width: 0 }}
                        animate={{ width: `${stats.total ? (stats.read / stats.total) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                  <p className="font-body text-[15px] text-muted-foreground">
                    {stats.unread === 0
                      ? "¡Lista al día! Guarda más historias para después."
                      : `Te quedan ${stats.unread} ${stats.unread === 1 ? "historia" : "historias"} · unos ${stats.minutesLeft} min de lectura.`}
                  </p>
                  {(() => {
                    const quick = [...unread].filter((a) => a.id !== next.id).sort((a, b) => a.read_time_minutes - b.read_time_minutes)[0];
                    return quick ? (
                      <Link to={`/articulo/${quick.slug}`} className="group rounded-lg bg-muted/60 p-3 transition-colors hover:bg-muted">
                        <span className="flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-brand">
                          <Clock className="h-3 w-3" /> Lectura rápida · {quick.read_time_minutes} min
                        </span>
                        <span className="mt-1 line-clamp-2 block font-display text-[15px] font-semibold leading-snug group-hover:underline">
                          {quick.title}
                        </span>
                      </Link>
                    ) : null;
                  })()}
                </div>
              </div>
            </section>
          )}

          {/* ── Toolbar ─────────────────────────────────────────── */}
          <section className="container mt-10 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div role="tablist" aria-label="Estado de lectura" className="inline-flex w-full rounded-xl border bg-muted/40 p-1 sm:w-auto">
                {tabs.map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.v}
                    onClick={() => setTab(t.v)}
                    className={cn(
                      "relative flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none",
                      tab === t.v ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab === t.v && (
                      <motion.span layoutId="bm-tab" className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border" transition={{ type: "spring", stiffness: 450, damping: 36 }} />
                    )}
                    <span className="relative">{t.label}</span>
                    <span className="relative rounded-full bg-muted px-1.5 font-sans text-[11px] tabular-nums">{t.n}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 basis-full sm:w-64 sm:basis-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <label htmlFor="bm-q" className="sr-only">Buscar en guardados</label>
                  <input
                    id="bm-q"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar en guardados"
                    className="h-10 w-full rounded-lg border bg-background pl-9 pr-8 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Borrar" className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <label htmlFor="bm-sort" className="sr-only">Ordenar</label>
                <select
                  id="bm-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand sm:flex-none"
                >
                  <option value="newest">Guardado reciente</option>
                  <option value="oldest">Guardado antiguo</option>
                  <option value="shortest">Más corto</option>
                  <option value="longest">Más largo</option>
                </select>
                <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Vista">
                  {([
                    ["grid", LayoutGrid, "Cuadrícula"],
                    ["list", List, "Lista"],
                  ] as const).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-label={label}
                      aria-pressed={view === v}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                        view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sections.length > 1 && (
              <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
                {[null, ...sections.map(([n]) => n)].map((n) => (
                  <button
                    key={n ?? "__all"}
                    type="button"
                    onClick={() => setSection(n)}
                    aria-pressed={section === n}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      section === n ? "border-brand bg-brand text-brand-foreground" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {n ?? "Todas las secciones"}
                    {n && <span className="tabular-nums opacity-70">{sections.find(([x]) => x === n)?.[1]}</span>}
                  </button>
                ))}
              </div>
            )}

            {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}

            {/* ── Items ─────────────────────────────────────────── */}
            {loading && !saved.length ? (
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: Math.min(slugs.length, 6) }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-display text-xl font-semibold">
                  {tab === "read" ? "Aún no terminas ninguna historia guardada." : tab === "unread" ? "¡Nada pendiente! Lista al día." : "Sin coincidencias."}
                </p>
                {(query || section) && (
                  <Button variant="outline" className="mt-4 h-10" onClick={() => { setQuery(""); setSection(null); }}>
                    Quitar filtros
                  </Button>
                )}
              </div>
            ) : view === "grid" ? (
              <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence initial={false}>
                  {visible.map((a) => {
                    const read = isRead(a);
                    return (
                      <motion.li
                        key={a.id}
                        layout={!reduced}
                        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className="group relative"
                      >
                        <Link to={`/articulo/${a.slug}`} className={cn("block overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg", read && "opacity-70")}>
                          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                            <img
                              src={articleImageUrl(a.image_url)}
                              srcSet={articleImageSrcSet(a.image_url)}
                              sizes={IMAGE_SIZES.card}
                              alt=""
                              loading="lazy"
                              onError={fallback}
                              className={cn("h-full w-full object-cover transition-transform duration-500 group-hover:scale-105", read && "grayscale")}
                            />
                            {read && (
                              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 font-sans text-[11px] font-semibold text-white">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Leído
                              </span>
                            )}
                          </div>
                          <div className="space-y-2 p-4">
                            <p className="kicker">{a.category_name}</p>
                            <h2 className="line-clamp-3 font-display text-lg font-semibold leading-snug">{a.title}</h2>
                            <p className="flex flex-wrap items-center gap-x-2 font-sans text-xs text-muted-foreground">
                              <span>{savedLabel(meta[a.slug])}</span>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{a.read_time_minutes} min</span>
                            </p>
                          </div>
                        </Link>
                        <div className="absolute right-3 top-3 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <ItemActions dark read={read} onToggleRead={() => toggleRead(a)} onRemove={() => remove(a)} />
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            ) : (
              <ul className="mt-2 divide-y">
                <AnimatePresence initial={false}>
                  {visible.map((a) => {
                    const read = isRead(a);
                    return (
                      <motion.li
                        key={a.id}
                        layout={!reduced}
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        className="group flex items-center gap-4 py-4"
                      >
                        <button
                          type="button"
                          onClick={() => toggleRead(a)}
                          aria-label={read ? "Marcar como no leído" : "Marcar como leído"}
                          aria-pressed={read}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-brand"
                        >
                          {read ? <CheckCircle2 className="h-6 w-6 text-brand" /> : <Circle className="h-6 w-6" />}
                        </button>
                        <Link to={`/articulo/${a.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                          <img src={articleImageUrl(a.image_url)} alt="" loading="lazy" onError={fallback} className={cn("hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block", read && "grayscale")} />
                          <span className="min-w-0">
                            <span className="kicker block">{a.category_name}</span>
                            <span className={cn("line-clamp-2 font-display text-base font-semibold leading-snug group-hover:underline sm:text-lg", read && "text-muted-foreground line-through decoration-1")}>
                              {a.title}
                            </span>
                            <span className="mt-1 block font-sans text-xs text-muted-foreground">
                              {savedLabel(meta[a.slug])} · {a.read_time_minutes} min · {a.author_name}
                            </span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(a)}
                          aria-label="Quitar de guardados"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}

            {/* Footer actions */}
            {saved.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                <Link to="/search" className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  Descubrir más historias <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="flex gap-2">
                  {stats.read > 0 && (
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => saved.filter(isRead).forEach((a) => removeBookmark(a.slug))}
                    >
                      Quitar leídos ({stats.read})
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="h-10 text-muted-foreground hover:text-destructive">
                        Vaciar lista
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Vaciar tu lista de lectura?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se quitarán {stats.total} historias guardadas en este dispositivo. No se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={clearBookmarks}>Vaciar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
