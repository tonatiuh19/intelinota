import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Loader2,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Article, SearchParams, SearchRead, SearchSince, SearchSort } from "@shared/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { runSearch } from "@/store/slices/searchPageSlice";
import { addRecent, clearRecent } from "@/store/slices/searchSlice";
import { selectCategories } from "@/store/slices/categoriesSlice";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ARTICLE_PLACEHOLDER, articleImageSrcSet, articleImageUrl, IMAGE_SIZES } from "@/lib/images";
import { formatRelative } from "@/lib/format";
import { categoryUrlPath } from "@/lib/categorySlugs";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const searchSchema = Yup.object({
  q: Yup.string().trim().max(100, "Máximo 100 caracteres"),
});

const SORTS: Array<{ v: SearchSort; label: string }> = [
  { v: "relevance", label: "Relevancia" },
  { v: "recent", label: "Recientes" },
  { v: "popular", label: "Populares" },
  { v: "oldest", label: "Antiguas" },
];
const SINCE: Array<{ v: SearchSince | undefined; label: string }> = [
  { v: undefined, label: "Cualquier fecha" },
  { v: "24h", label: "Últimas 24 h" },
  { v: "7d", label: "Última semana" },
  { v: "30d", label: "Último mes" },
  { v: "1y", label: "Último año" },
];
const READ: Array<{ v: SearchRead | undefined; label: string; hint: string }> = [
  { v: undefined, label: "Cualquiera", hint: "" },
  { v: "short", label: "Rápida", hint: "≤ 4 min" },
  { v: "medium", label: "Media", hint: "5–9 min" },
  { v: "long", label: "A fondo", hint: "10+ min" },
];

function readParams(sp: URLSearchParams): SearchParams {
  const pick = <T extends string>(k: string, allowed: readonly T[]) => {
    const v = sp.get(k);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
  };
  return {
    q: (sp.get("q") ?? "").slice(0, 100),
    category: sp.get("seccion") || undefined,
    author: sp.get("autor") || undefined,
    since: pick("fecha", ["24h", "7d", "30d", "1y"] as const),
    read: pick("lectura", ["short", "medium", "long"] as const),
    sort: pick("orden", ["relevance", "recent", "popular", "oldest"] as const),
    page: Math.max(1, Number(sp.get("pagina")) || 1),
  };
}

/** Highlights every occurrence of the query terms (accent-insensitive). */
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  if (!terms.length) return <>{text}</>;
  // NFD can change length; build index map over original characters
  const map: number[] = [];
  let acc = "";
  for (let i = 0; i < text.length; i++) {
    const n = text[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (let j = 0; j < n.length; j++) map.push(i);
    acc += n;
  }
  const marks = new Array(text.length).fill(false);
  for (const term of terms) {
    let from = 0;
    while ((from = acc.indexOf(term, from)) !== -1) {
      // Only highlight at word starts ("la" in "La IA", not inside "Atlas")
      const prev = from > 0 ? acc[from - 1] : " ";
      if (!/[a-z0-9ñ]/.test(prev)) {
        for (let k = from; k < from + term.length; k++) marks[map[k]] = true;
      }
      from += term.length;
    }
  }
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const on = marks[i];
    let j = i;
    while (j < text.length && marks[j] === on) j++;
    const chunk = text.slice(i, j);
    out.push(
      on ? (
        <mark key={i} className="rounded-sm bg-brand/15 px-0.5 text-inherit ring-1 ring-brand/20">
          {chunk}
        </mark>
      ) : (
        chunk
      ),
    );
    i = j;
  }
  return <>{out}</>;
}

function ResultRow({ a, q, index }: { a: Article; q: string; index: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.035, duration: 0.35 }}
    >
      <Link
        to={`/articulo/${a.slug}`}
        className="group grid grid-cols-[1fr_96px] items-start gap-4 rounded-xl p-3 transition-colors hover:bg-muted/60 sm:grid-cols-[180px_1fr] sm:gap-6 sm:p-4"
      >
        <div className="order-2 aspect-square overflow-hidden rounded-lg bg-muted sm:order-1 sm:aspect-[3/2]">
          <img
            src={articleImageUrl(a.image_url)}
            srcSet={articleImageSrcSet(a.image_url)}
            sizes={IMAGE_SIZES.thumb}
            alt=""
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallback) return;
              img.dataset.fallback = "1";
              img.removeAttribute("srcset");
              img.src = ARTICLE_PLACEHOLDER;
            }}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="order-1 min-w-0 sm:order-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="kicker">{a.category_name}</span>
            {a.subcategory_name && (
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                · {a.subcategory_name}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 font-display text-lg font-semibold leading-snug text-balance sm:text-xl">
            <Highlight text={a.title} query={q} />
          </h2>
          {a.excerpt && (
            <p className="mt-1.5 line-clamp-2 font-body text-[15px] leading-relaxed text-muted-foreground">
              <Highlight text={a.excerpt} query={q} />
            </p>
          )}
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 font-sans text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">
              <Highlight text={a.author_name} query={q} />
            </span>
            <span aria-hidden>·</span>
            <time dateTime={a.published_at ?? undefined}>{formatRelative(a.published_at)}</time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {a.read_time_minutes} min
            </span>
          </p>
        </div>
      </Link>
    </motion.li>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="kicker !text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

function OptionButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors",
        active ? "bg-brand/10 font-semibold text-foreground ring-1 ring-brand/30" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border-2 transition",
            active ? "border-brand bg-brand shadow-[inset_0_0_0_2px_hsl(var(--background))]" : "border-muted-foreground/40",
          )}
        />
        <span className="truncate">{children}</span>
      </span>
      {count != null && <span className="shrink-0 font-sans text-xs tabular-nums text-muted-foreground">{count}</span>}
    </button>
  );
}

export default function SearchPage() {
  const dispatch = useAppDispatch();
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => readParams(sp), [sp]);
  const state = useAppSelector((s) => s.searchPage);
  const recent = useAppSelector((s) => s.search.recent);
  const categories = useAppSelector(selectCategories);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  const hasQuery = params.q.trim().length >= 2;
  const effectiveSort: SearchSort = params.sort ?? (hasQuery ? "relevance" : "recent");
  const activeFilters =
    Number(Boolean(params.category)) + Number(Boolean(params.author)) + Number(Boolean(params.since)) + Number(Boolean(params.read));
  const browsing = hasQuery || activeFilters > 0;

  /** Updates URL params (source of truth); resets page unless paging. */
  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!keepPage) next.delete("pagina");
    setSp(next, { replace: !("pagina" in patch) });
  };

  const formik = useFormik({
    initialValues: { q: params.q },
    validationSchema: searchSchema,
    enableReinitialize: true,
    onSubmit: (v) => {
      const q = v.q.trim();
      if (q.length >= 2) dispatch(addRecent(q));
      update({ q: q || undefined });
      inputRef.current?.blur();
    },
  });

  // Live search: debounce typing into the URL
  useEffect(() => {
    const q = formik.values.q.trim();
    if (q === params.q.trim()) return;
    if (q.length === 1) return;
    const t = setTimeout(() => update({ q: q || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.q]);

  // Fetch whenever URL params change
  useEffect(() => {
    if (!browsing) return;
    const p = dispatch(runSearch({ ...params, q: hasQuery ? params.q : "" }));
    return () => p.abort();
  }, [dispatch, params, browsing, hasQuery]);

  // "/" focuses the field on this page
  useEffect(() => {
    if (!params.q) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chips: Array<{ key: string; label: string }> = [];
  if (params.category)
    chips.push({ key: "seccion", label: state.facets.categories.find((c) => c.slug === params.category)?.name ?? params.category });
  if (params.author)
    chips.push({ key: "autor", label: state.facets.authors.find((c) => c.slug === params.author)?.name ?? params.author });
  if (params.since) chips.push({ key: "fecha", label: SINCE.find((x) => x.v === params.since)!.label });
  if (params.read) chips.push({ key: "lectura", label: READ.find((x) => x.v === params.read)!.label });

  const clearAll = () => update({ seccion: undefined, autor: undefined, fecha: undefined, lectura: undefined });

  const filtersPanel = (
    <div className="space-y-7">
      <FilterGroup title="Ordenar por">
        <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
          {SORTS.filter((s) => hasQuery || s.v !== "relevance").map((s) => (
            <button
              key={s.v}
              type="button"
              role="radio"
              aria-checked={effectiveSort === s.v}
              onClick={() => update({ orden: s.v })}
              className={cn(
                "h-10 rounded-lg border text-sm font-medium transition-colors",
                effectiveSort === s.v ? "border-foreground bg-foreground text-background" : "hover:border-foreground/40",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Sección">
        <div role="radiogroup" className="space-y-1">
          <OptionButton active={!params.category} onClick={() => update({ seccion: undefined })} count={state.facets.categories.reduce((n, c) => n + c.count, 0) || undefined}>
            Todas
          </OptionButton>
          {(state.facets.categories.length ? state.facets.categories : categories.map((c) => ({ slug: c.slug, name: c.name, count: undefined as unknown as number })))
            .map((c) => (
              <OptionButton key={c.slug} active={params.category === c.slug} onClick={() => update({ seccion: c.slug })} count={c.count}>
                {c.name}
              </OptionButton>
            ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Fecha">
        <div role="radiogroup" className="space-y-1">
          {SINCE.map((x) => (
            <OptionButton key={x.label} active={params.since === x.v} onClick={() => update({ fecha: x.v })}>
              {x.label}
            </OptionButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Tiempo de lectura">
        <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
          {READ.map((x) => (
            <button
              key={x.label}
              type="button"
              role="radio"
              aria-checked={params.read === x.v}
              onClick={() => update({ lectura: x.v })}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                params.read === x.v ? "border-brand bg-brand/10 font-semibold ring-1 ring-brand/30" : "hover:border-foreground/40",
              )}
            >
              {x.label}
              {x.hint && <span className="font-sans text-[11px] text-muted-foreground">{x.hint}</span>}
            </button>
          ))}
        </div>
      </FilterGroup>

      {state.facets.authors.length > 0 && (
        <FilterGroup title="Autor">
          <div role="radiogroup" className="max-h-64 space-y-1 overflow-y-auto pr-1">
            <OptionButton active={!params.author} onClick={() => update({ autor: undefined })}>
              Todos
            </OptionButton>
            {state.facets.authors.map((a) => (
              <OptionButton key={a.slug} active={params.author === a.slug} onClick={() => update({ autor: a.slug })} count={a.count}>
                {a.name}
              </OptionButton>
            ))}
          </div>
        </FilterGroup>
      )}

      {activeFilters > 0 && (
        <Button variant="outline" className="h-10 w-full" onClick={clearAll}>
          Limpiar filtros ({activeFilters})
        </Button>
      )}
    </div>
  );

  return (
    <div className="pb-24">
      <MetaHead
        title={params.q ? `“${params.q}” — Búsqueda` : "Buscar"}
        description="Busca noticias, análisis y autores en INTELINOTA."
        noIndex
      />

      {/* ── Search hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b bg-muted/30">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[60rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="container relative px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="kicker">Buscar en INTELINOTA</p>
            <form onSubmit={formik.handleSubmit} role="search" className="relative mt-3">
              <label htmlFor="search-q" className="sr-only">Buscar</label>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground sm:left-5" />
              <input
                ref={inputRef}
                id="search-q"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                value={formik.values.q}
                onChange={formik.handleChange}
                placeholder="Noticias, temas o autores…"
                className="h-16 w-full rounded-2xl border bg-background pl-12 pr-28 font-display text-xl shadow-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-brand focus:ring-4 focus:ring-brand/15 sm:h-[72px] sm:pl-14 sm:text-2xl [&::-webkit-search-cancel-button]:hidden"
              />
              <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {state.loading && <Loader2 className="h-5 w-5 animate-spin text-brand" aria-label="Buscando" />}
                {formik.values.q && (
                  <button
                    type="button"
                    onClick={() => {
                      formik.setFieldValue("q", "");
                      update({ q: undefined });
                      inputRef.current?.focus();
                    }}
                    aria-label="Borrar búsqueda"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background transition hover:bg-brand"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </form>
            {formik.errors.q && <p role="alert" className="mt-2 text-sm text-destructive">{formik.errors.q}</p>}

            {/* Quick picks */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {recent.slice(0, 4).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update({ q: r })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-3 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                >
                  <Clock className="h-3.5 w-3.5" /> {r}
                </button>
              ))}
              {recent.length > 0 && (
                <button type="button" onClick={() => dispatch(clearRecent())} className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground">
                  Borrar historial
                </button>
              )}
              {!recent.length &&
                categories.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ seccion: c.slug })}
                    className="inline-flex h-9 items-center rounded-full border bg-background px-3 text-sm text-muted-foreground hover:border-brand hover:text-brand"
                  >
                    #{c.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </section>

      {!browsing ? (
        /* ── Discover (no query) ─────────────────────────────── */
        <section className="container px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="rule-top mb-6 pt-3 font-display text-2xl font-bold">Explora por sección</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => update({ seccion: c.slug })}
                  className="group flex h-full w-full items-center justify-between rounded-xl border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-brand/40"
                >
                  <span>
                    <span className="block font-display text-xl font-bold group-hover:text-brand">{c.name}</span>
                    {c.description && <span className="mt-1 line-clamp-1 block font-body text-sm text-muted-foreground">{c.description}</span>}
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center font-sans text-sm text-muted-foreground">
            Consejo: pulsa <kbd className="rounded border bg-muted px-1.5 font-sans text-xs">⌘K</kbd> en cualquier página para buscar al instante.
          </p>
        </section>
      ) : (
        /* ── Results + filters ───────────────────────────────── */
        <div className="container grid grid-cols-1 gap-10 px-4 pt-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
          <aside className="hidden lg:block" aria-label="Filtros">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-1">{filtersPanel}</div>
          </aside>

          <section aria-live="polite" aria-busy={state.loading}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <p className="font-sans text-sm text-muted-foreground">
                {state.loading && !state.results.length ? (
                  "Buscando…"
                ) : (
                  <>
                    <span className="font-display text-2xl font-bold text-foreground tabular-nums">{state.total}</span>{" "}
                    {state.total === 1 ? "resultado" : "resultados"}
                    {hasQuery && (
                      <>
                        {" "}para <span className="font-semibold text-foreground">“{params.q}”</span>
                      </>
                    )}
                    {state.tookMs != null && <span className="ml-2 text-xs">· {state.tookMs} ms</span>}
                  </>
                )}
              </p>
              <Button variant="outline" className="h-10 lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filtros{activeFilters ? ` (${activeFilters})` : ""}
              </Button>
            </div>

            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => update({ [c.key]: undefined })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand/10 px-3 text-sm font-medium text-foreground ring-1 ring-brand/30 hover:bg-brand/15"
                    aria-label={`Quitar filtro ${c.label}`}
                  >
                    {c.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
                <button type="button" onClick={clearAll} className="h-9 px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Limpiar todo
                </button>
              </div>
            )}

            {state.error && <p role="alert" className="mt-6 text-sm text-destructive">{state.error}</p>}

            {state.loading && !state.results.length ? (
              <ul className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="grid grid-cols-[1fr_96px] gap-4 p-3 sm:grid-cols-[180px_1fr] sm:p-4">
                    <Skeleton className="order-2 aspect-square w-full rounded-lg sm:order-1 sm:aspect-[3/2]" />
                    <div className="order-1 space-y-2 sm:order-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-6 w-4/5" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : state.results.length === 0 && !state.loading ? (
              <div className="py-16 text-center">
                <p className="font-display text-2xl font-semibold">Sin resultados</p>
                <p className="mx-auto mt-2 max-w-md font-body text-muted-foreground">
                  Prueba con otras palabras{activeFilters ? " o quita algunos filtros" : ""}.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {activeFilters > 0 && (
                    <Button variant="outline" className="h-10" onClick={clearAll}>
                      Quitar filtros
                    </Button>
                  )}
                  {categories.slice(0, 4).map((c) => (
                    <Button key={c.id} asChild variant="ghost" className="h-10">
                      <Link to={categoryUrlPath(c.slug)}>{c.name} →</Link>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.ul
                  key={sp.toString()}
                  initial={reduced ? false : { opacity: 0.4 }}
                  animate={{ opacity: state.loading ? 0.5 : 1 }}
                  className="mt-2 divide-y"
                >
                  {state.results.map((a, i) => (
                    <ResultRow key={a.id} a={a} q={hasQuery ? params.q : ""} index={i} />
                  ))}
                </motion.ul>
              </AnimatePresence>
            )}

            {state.totalPages > 1 && (
              <nav aria-label="Paginación" className="mt-8 flex items-center justify-between border-t pt-6">
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={(params.page ?? 1) <= 1 || state.loading}
                  onClick={() => {
                    update({ pagina: String((params.page ?? 1) - 1) }, true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  ← Anterior
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Página {params.page ?? 1} de {state.totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={(params.page ?? 1) >= state.totalPages || state.loading}
                  onClick={() => {
                    update({ pagina: String((params.page ?? 1) + 1) }, true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Siguiente →
                </Button>
              </nav>
            )}
          </section>
        </div>
      )}

      {/* Mobile filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left font-display">Filtros</SheetTitle>
          </SheetHeader>
          <div className="mt-6">{filtersPanel}</div>
          <Button className="mt-6 h-12 w-full" onClick={() => setFiltersOpen(false)}>
            Ver {state.total} {state.total === 1 ? "resultado" : "resultados"}
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
