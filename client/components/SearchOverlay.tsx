import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSearchOpen } from "@/store/slices/uiSlice";
import { addRecent, clearRecent, instantSearch, setQuery } from "@/store/slices/searchSlice";
import { selectCategories } from "@/store/slices/categoriesSlice";
import { categoryUrlPath } from "@/lib/categorySlugs";
import { articleImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 220;

export default function SearchOverlay() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((s) => s.ui.searchOpen);
  const { query, results, loading, recent } = useAppSelector((s) => s.search);
  const categories = useAppSelector(selectCategories);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut: ⌘K / Ctrl+K and "/"
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, [contenteditable=true]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch(setSearchOpen(true));
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        dispatch(setSearchOpen(true));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  // Debounced instant search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let pending: { abort: () => void } | null = null;
    const t = setTimeout(() => {
      pending = dispatch(instantSearch(q));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      pending?.abort();
    };
  }, [query, dispatch]);

  useEffect(() => setActive(0), [results]);

  const close = () => dispatch(setSearchOpen(false));

  const goArticle = (slug: string) => {
    if (query.trim()) dispatch(addRecent(query));
    close();
    navigate(`/articulo/${slug}`);
  };

  const goFullSearch = (q = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    dispatch(addRecent(trimmed));
    close();
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (results[active]) goArticle(results[active].slug);
    else goFullSearch();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    }
  };

  const showResults = query.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={(o) => dispatch(setSearchOpen(o))}>
      <DialogContent
        className="top-[8vh] w-[calc(100vw-1rem)] max-w-2xl translate-y-0 gap-0 overflow-hidden rounded-xl border p-0 shadow-2xl sm:w-full [&>button]:hidden"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Buscar en INTELINOTA</DialogTitle>
        <form onSubmit={onSubmit} className="flex items-center gap-3 border-b px-4 sm:px-5">
          {loading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
            onKeyDown={onKeyDown}
            placeholder="Buscar noticias, temas, autores…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded={showResults}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
            className="h-16 w-full bg-transparent font-display text-lg outline-none placeholder:text-muted-foreground/70 sm:text-xl"
          />
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Cerrar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        </form>

        <div className="max-h-[65vh] overflow-y-auto">
          {!showResults && (
            <div className="space-y-6 p-4 sm:p-5">
              {recent.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="kicker !text-muted-foreground">Búsquedas recientes</h3>
                    <button
                      type="button"
                      onClick={() => dispatch(clearRecent())}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Borrar
                    </button>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => dispatch(setQuery(r))}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm hover:border-foreground"
                        >
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="kicker mb-2 !text-muted-foreground">Secciones</h3>
                <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          navigate(categoryUrlPath(c.slug));
                        }}
                        className="flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-medium hover:bg-muted"
                      >
                        {c.name}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {showResults && (
            <ul id="search-results" role="listbox" className="p-2">
              <AnimatePresence initial={false}>
                {results.map((a, i) => (
                  <motion.li
                    key={a.id}
                    id={`sr-${a.id}`}
                    role="option"
                    aria-selected={i === active}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => goArticle(a.slug)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-lg p-2.5 text-left transition-colors",
                        i === active ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <img
                        src={articleImageUrl(a.image_url)}
                        alt=""
                        loading="lazy"
                        className="h-14 w-20 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="kicker block">{a.category_name}</span>
                        <span className="line-clamp-2 font-display text-base font-semibold leading-snug">
                          {a.title}
                        </span>
                      </span>
                      {i === active && (
                        <CornerDownLeft className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                      )}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
              {!loading && results.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Sin resultados para “{query.trim()}”.
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => goFullSearch()}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-brand hover:bg-muted"
                >
                  Ver todos los resultados <ArrowRight className="h-4 w-4" />
                </button>
              </li>
            </ul>
          )}
        </div>

        <div className="hidden items-center gap-4 border-t px-5 py-2.5 text-[11px] text-muted-foreground sm:flex">
          <span><kbd className="rounded border px-1.5 font-sans">↑↓</kbd> navegar</span>
          <span><kbd className="rounded border px-1.5 font-sans">↵</kbd> abrir</span>
          <span><kbd className="rounded border px-1.5 font-sans">esc</kbd> cerrar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
