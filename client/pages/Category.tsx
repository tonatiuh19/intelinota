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
import { ARTICLE_PLACEHOLDER, articleImageSrcSet, articleImageUrl, IMAGE_SIZES } from "@/lib/images";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export default function Category() {
  const { category: urlSlug } = useParams();
  const dispatch = useAppDispatch();
  const labelFromUrl = urlSlug ? (URL_SLUG_LABELS[urlSlug] ?? urlSlug) : "";
  const dbSlug = urlSlug ? (URL_TO_DB_SLUG[urlSlug] ?? urlSlug) : "";

  const articles = useAppSelector(selectCategoryPageArticles);
  const loading = useAppSelector(selectCategoryPageLoading);
  const error = useAppSelector(selectCategoryPageError);
  const topArticles = useAppSelector(selectCategoryPageTrending);
  const pagination = useAppSelector(selectCategoryPagePagination);
  const categoryData = useAppSelector(selectCategoryPageCategory);
  // Real name from the API ("Deportes"), not the URL slug ("deportes")
  const categoryName =
    categoryData?.name ?? labelFromUrl.charAt(0).toUpperCase() + labelFromUrl.slice(1);
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
      {/* ── Compact section header: title, description and filters on one band ── */}
      <header className="container px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="inline-flex h-8 items-center hover:text-foreground">Portada</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="kicker">{categoryName}</span>
        </nav>
        <div className="mt-2 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <h1 className="font-display text-[2.25rem] font-bold leading-none tracking-[-0.02em] sm:text-5xl">
              {categoryName}
            </h1>
            <p className="mt-3 max-w-xl font-body text-base text-muted-foreground sm:text-lg">
              {categoryData?.description ||
                `Toda la actualidad, análisis y las últimas novedades de ${categoryName.toLowerCase()}.`}
            </p>
          </div>
          {subcategories.length > 0 && (
            <div
              role="tablist"
              aria-label="Subsecciones"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:shrink-0"
            >
              {[null, ...subcategories].map((sub) => {
                const active = activeSubcategory === sub;
                return (
                  <button
                    key={sub ?? "__all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleSubcategoryChange(sub as string | null)}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                      active
                        ? "border-brand bg-brand text-brand-foreground"
                        : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {sub ?? "Todo"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="container mt-6 px-4 sm:px-6 lg:px-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {loading && articles.length === 0 ? (
        <div className="container mt-6 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <Skeleton className="aspect-[16/10] w-full rounded-xl lg:col-span-8" />
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          </div>
        </div>
      ) : articles.length === 0 ? (
        <div className="container px-4 py-24 text-center sm:px-6 lg:px-8">
          <p className="font-display text-2xl font-semibold">Aún no hay historias aquí.</p>
          <Button asChild variant="outline" className="mt-6 h-11">
            <Link to="/">Ir a la portada</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* ── Section hero: lead (overlay) + 2 stacked secondaries ── */}
          <section className="container mt-6 px-4 sm:px-6 lg:px-8" aria-label="Destacadas">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
              {articles[0] && <OverlayCard article={articles[0]} size="lg" className="lg:col-span-8" priority />}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-5">
                {articles.slice(1, 3).map((a) => (
                  <OverlayCard key={a.id} article={a} size="sm" />
                ))}
              </div>
            </div>
          </section>

          {/* ── Feed + sidebar ─────────────────────────────────── */}
          <div className="container mt-12 grid grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <section className="lg:col-span-8" aria-labelledby="feed-h">
              <h2 id="feed-h" className="rule-top mb-2 pt-3 font-display text-xl font-bold">
                Lo último en {categoryName}
              </h2>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${page}-${activeSubcategory ?? "all"}`}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="divide-y"
                >
                  {articles.slice(3).map((a) => (
                    <ArticleCard key={a.id} article={a} variant="horizontal" className="py-6" />
                  ))}
                  {articles.length <= 3 && (
                    <p className="py-6 font-body text-muted-foreground">No hay más historias por ahora.</p>
                  )}
                </motion.div>
              </AnimatePresence>

              {pagination && pagination.totalPages > 1 && (
                <nav aria-label="Paginación" className="mt-8 flex items-center justify-between border-t pt-6">
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Anteriores
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Página {page} de {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={page >= pagination.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguientes →
                  </Button>
                </nav>
              )}
            </section>

            <aside className="lg:col-span-4">
              <div className="space-y-10 lg:sticky lg:top-24">
                {topArticles.length > 0 && (
                  <section aria-labelledby="top-h">
                    <h2 id="top-h" className="rule-top mb-1 flex items-center gap-2 pt-3 font-display text-xl font-bold">
                      <TrendingUp className="h-5 w-5 text-brand" /> Más leído
                    </h2>
                    <ol>
                      {topArticles.slice(0, 5).map((a, i) => (
                        <li key={a.id} className="border-b last:border-0">
                          <Link to={`/articulo/${a.slug}`} className="group flex gap-4 py-3.5">
                            <span aria-hidden className="w-6 shrink-0 font-display text-2xl font-bold leading-none text-brand tabular-nums">
                              {i + 1}
                            </span>
                            <span className="font-display text-[15px] font-semibold leading-snug">
                              <span className="headline-link">{a.title}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                <section className="rounded-xl bg-foreground p-6 text-background">
                  <p className="kicker !text-background/70">Boletín</p>
                  <p className="mt-2 font-display text-xl font-bold leading-tight">
                    Lo mejor de {categoryName.toLowerCase()}, cada semana.
                  </p>
                  <NewsletterForm variant="inline" source={`category_${dbSlug}`} className="mt-4" />
                </section>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function OverlayCard({
  article,
  size,
  className,
  priority,
}: {
  article: import("@shared/api").Article;
  size: "lg" | "sm";
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      to={`/articulo/${article.slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-xl bg-neutral-900",
        size === "lg" ? "aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[460px]" : "aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[220px]",
        className,
      )}
    >
      <img
        src={articleImageUrl(article.image_url)}
        srcSet={articleImageSrcSet(article.image_url)}
        sizes={size === "lg" ? IMAGE_SIZES.lead : IMAGE_SIZES.card}
        alt=""
        data-no-dim
        loading={priority ? "eager" : "lazy"}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.dataset.fallback) return;
          img.dataset.fallback = "1";
          img.removeAttribute("srcset");
          img.src = ARTICLE_PLACEHOLDER;
        }}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.04] motion-reduce:transform-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className={cn("absolute inset-x-0 bottom-0", size === "lg" ? "p-5 sm:p-8" : "p-4 sm:p-5")}>
        {article.subcategory_name && (
          <span className="inline-flex rounded-full bg-brand px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-foreground">
            {article.subcategory_name}
          </span>
        )}
        <h3
          className={cn(
            "mt-3 font-display font-bold leading-[1.08] tracking-tight text-white text-balance",
            size === "lg" ? "text-2xl sm:text-4xl" : "text-lg sm:text-xl",
          )}
        >
          {article.title}
        </h3>
        {size === "lg" && article.excerpt && (
          <p className="mt-3 hidden max-w-2xl font-body text-base text-white/80 sm:line-clamp-2">{article.excerpt}</p>
        )}
        <p className="mt-3 font-sans text-xs text-white/70">
          <span className="font-semibold text-white">{article.author_name}</span> · {article.read_time_minutes} min
        </p>
      </div>
    </Link>
  );
}
