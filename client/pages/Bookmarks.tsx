import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Article } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import ArticleCard from "@/components/ArticleCard";
import {
  BOOKMARKS_CHANGED,
  getBookmarks,
  removeBookmark,
} from "@/lib/share";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchArticles,
  selectArticles,
  selectListLoading,
  selectListError,
} from "@/store/slices/articlesSlice";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export default function Bookmarks() {
  const dispatch = useAppDispatch();
  const articles = useAppSelector(selectArticles);
  const loading = useAppSelector(selectListLoading);
  const error = useAppSelector(selectListError);
  const [slugs, setSlugs] = useState<string[]>(() => getBookmarks());
  const reduced = useReducedMotion();

  useEffect(() => {
    function refresh() {
      setSlugs(getBookmarks());
    }
    window.addEventListener("storage", refresh);
    window.addEventListener(BOOKMARKS_CHANGED, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BOOKMARKS_CHANGED, refresh);
    };
  }, []);

  useEffect(() => {
    if (!slugs.length) return;
    dispatch(fetchArticles({ slugs: slugs.join(",") }));
  }, [dispatch, slugs.join(",")]);

  const orderedArticles = useMemo(() => {
    const bySlug = new Map(articles.map((a) => [a.slug, a]));
    return slugs
      .map((slug) => bySlug.get(slug))
      .filter((a): a is Article => Boolean(a));
  }, [articles, slugs]);

  function handleRemove(slug: string) {
    removeBookmark(slug);
    setSlugs(getBookmarks());
  }

  return (
    <div className="pb-24">
      <MetaHead
        title="Favoritos"
        description="Artículos guardados en InteliNota."
        noIndex
        includeSiteOrganization={false}
      />

      <header className="container max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <p className="kicker flex items-center gap-1.5">
          <Bookmark className="h-3 w-3" /> Guardados
        </p>
        <h1 className="mt-2 border-b-2 border-rule pb-6 font-display text-display-xl font-bold">
          Tus favoritos
        </h1>
        <p className="mt-4 font-body text-lg text-muted-foreground">
          Artículos que guardaste en este dispositivo para leer después.
        </p>
      </header>

      <div className="container mt-8 max-w-3xl px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {slugs.length === 0 ? (
            <motion.div
              key="empty"
              initial={reduced ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="text-center py-20 space-y-4"
            >
              <motion.div
                animate={reduced ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/40" strokeWidth={1.25} />
              </motion.div>
              <p className="font-body text-lg text-muted-foreground">
                Aún no has guardado ningún artículo. Toca el ícono de guardar en cualquier historia.
              </p>
              <Button asChild variant="outline" className="h-11">
                <Link to="/">Explorar la portada</Link>
              </Button>
            </motion.div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading && orderedArticles.length === 0 ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : orderedArticles.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No se encontraron los artículos guardados. Puede que hayan sido
              retirados.
            </p>
          ) : (
            <motion.div key="list" className="divide-y">
              <AnimatePresence initial={false}>
                {orderedArticles.map((article) => (
                  <motion.div
                    key={article.slug}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reduced
                        ? undefined
                        : { opacity: 0, x: 24, height: 0, marginBottom: 0 }
                    }
                    transition={{ duration: 0.3 }}
                    className="relative group/item"
                  >
                    <ArticleCard article={article} variant="compact" className="pr-12" />
                    <button
                      type="button"
                      onClick={() => handleRemove(article.slug)}
                      className="absolute right-0 top-3 flex h-10 w-10 items-center justify-center rounded-full border bg-background text-muted-foreground transition-all hover:border-destructive/40 hover:text-destructive sm:opacity-0 sm:group-hover/item:opacity-100 focus-visible:opacity-100"
                      aria-label={`Quitar ${article.title} de favoritos`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
