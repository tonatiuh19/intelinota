import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronRight, TrendingUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCategoryPage,
  selectCategoryPageArticles,
  selectCategoryPageTrending,
  selectCategoryPageLoading,
  selectCategoryPageError,
  selectCategoryPagePagination,
  selectCategoryPageCategory,
} from "@/store/slices/articlesSlice";
import { URL_TO_DB_SLUG, URL_SLUG_LABELS } from "@/lib/categorySlugs";
import MetaHead from "@/components/MetaHead";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  canonicalUrl,
  mergeJsonLd,
} from "@/lib/seo";
import NewsletterForm from "@/components/NewsletterForm";
import ArticleCard from "@/components/ArticleCard";
import StaggerGrid, { StaggerItem } from "@/components/motion/StaggerGrid";
import { fadeIn } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export default function Category() {
  const { category: urlSlug } = useParams();
  const dispatch = useAppDispatch();
  const categoryName = urlSlug ? (URL_SLUG_LABELS[urlSlug] ?? urlSlug) : "";
  const dbSlug = urlSlug ? (URL_TO_DB_SLUG[urlSlug] ?? urlSlug) : "";

  const articles = useAppSelector(selectCategoryPageArticles);
  const loading = useAppSelector(selectCategoryPageLoading);
  const error = useAppSelector(selectCategoryPageError);
  const topArticles = useAppSelector(selectCategoryPageTrending);
  const pagination = useAppSelector(selectCategoryPagePagination);
  const categoryData = useAppSelector(selectCategoryPageCategory);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const reduced = useReducedMotion();

  const subcategories =
    categoryData?.subcategories?.map((s) => s.name) ??
    Array.from(
      new Set(articles.map((a) => a.subcategory_name).filter(Boolean)),
    );

  useEffect(() => {
    if (!dbSlug) return;
    dispatch(
      fetchCategoryPage({
        slug: dbSlug,
        page,
        subcategory: activeSubcategory ?? undefined,
      }),
    );
  }, [dispatch, dbSlug, page, activeSubcategory]);

  function handleSubcategoryChange(sub: string | null) {
    setActiveSubcategory(sub);
    setPage(1);
  }

  const categoryPath = urlSlug ? `/categoria/${urlSlug}` : "/";
  const categoryDescription = `Últimas noticias de ${categoryName} en InteliNota. Mantente informado con los mejores artículos.`;

  return (
    <div className="pb-24">
      <MetaHead
        title={categoryName}
        description={categoryDescription}
        canonical={canonicalUrl(categoryPath)}
        articleSection={categoryName}
        jsonLd={mergeJsonLd(
          buildCollectionPageJsonLd({
            name: categoryName,
            description: categoryDescription,
            url: categoryPath,
          }),
          buildBreadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: categoryName, path: categoryPath },
          ]),
        )}
      />
      {/* Section header */}
      <header className="container px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Portada</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="kicker">{categoryName}</span>
        </nav>
        <h1 className="mt-3 border-b-2 border-rule pb-5 font-display text-display-xl font-bold">
          {categoryName}
        </h1>
        <p className="mt-4 max-w-2xl font-body text-lg text-muted-foreground">
          {categoryData?.description ||
            `Toda la actualidad, análisis y las últimas novedades de ${categoryName.toLowerCase()}.`}
        </p>
      </header>

      <div className="container mt-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-8">
            {/* Subsection filter */}
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div role="tablist" aria-label="Subsecciones" className="flex min-w-max items-center gap-2 border-b pb-4">
                {[null, ...subcategories].map((sub) => {
                  const active = activeSubcategory === sub;
                  return (
                    <button
                      key={sub ?? "all"}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleSubcategoryChange(sub as string | null)}
                      className={cn(
                        "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "text-muted-foreground hover:border-foreground/50 hover:text-foreground",
                      )}
                    >
                      {sub ?? "Todo"}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : loading ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[3/2] w-full" />
                    <Skeleton className="h-6 w-4/5" />
                  </div>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="py-20 text-center">
                <h2 className="font-display text-2xl font-semibold">Aún no hay artículos aquí</h2>
                <p className="mt-2 font-body text-muted-foreground">
                  Estamos preparando las mejores historias de esta sección.
                </p>
                <Button asChild variant="outline" className="mt-6 h-11">
                  <Link to="/">Volver a la portada</Link>
                </Button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeSubcategory ?? "all"}-${page}`}
                  initial={reduced ? false : "hidden"}
                  animate="visible"
                  exit={reduced ? undefined : { opacity: 0, y: -8 }}
                  variants={fadeIn}
                  transition={{ duration: 0.25 }}
                >
                  <StaggerGrid className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
                    {articles.map((article, idx) => (
                      <StaggerItem
                        key={article.id}
                        className={idx === 0 ? "border-b pb-10 md:col-span-2" : undefined}
                      >
                        <ArticleCard
                          article={article}
                          variant={idx === 0 ? "featured" : "default"}
                          priority={idx === 0 && page === 1}
                        />
                      </StaggerItem>
                    ))}
                  </StaggerGrid>
                </motion.div>
              </AnimatePresence>
            )}

            {pagination && pagination.totalPages > 1 && (
              <nav aria-label="Paginación" className="flex items-center justify-between border-t pt-6">
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente →
                </Button>
              </nav>
            )}
          </div>

          <aside className="lg:col-span-4 lg:border-l lg:pl-8">
            <div className="sticky top-24 space-y-10">
              {topArticles.length > 0 && (
                <section aria-labelledby="cat-top-h" className="rule-top pt-3">
                  <h2 id="cat-top-h" className="mb-2 flex items-center gap-2 font-display text-xl font-bold">
                    <TrendingUp className="h-5 w-5 text-brand" /> Más leído
                  </h2>
                  <ol>
                    {topArticles.slice(0, 5).map((art, i) => (
                      <li key={art.id} className="border-b last:border-0">
                        <Link to={`/articulo/${art.slug}`} className="group flex gap-4 py-3.5">
                          <span aria-hidden className="w-7 shrink-0 font-display text-3xl font-bold leading-none text-brand/80 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="font-display text-[15px] font-semibold leading-snug">
                            <span className="headline-link">{art.title}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <section className="bg-foreground p-6 text-background">
                <p className="kicker !text-background/70">Boletín</p>
                <p className="mt-2 font-display text-xl font-bold leading-tight">
                  Lo mejor de {categoryName}, cada semana.
                </p>
                <NewsletterForm variant="inline" source={`category_${dbSlug}`} className="mt-4" />
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
