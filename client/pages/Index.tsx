import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchHome,
  selectHomeFeatured,
  selectHomeArticles,
  selectHomeMostRead,
  selectHomeLoading,
  selectHomeMeta,
  selectHomeError,
  selectHomeCategories,
} from "@/store/slices/homeSlice";
import type { Article, Category } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import ArticleCard from "@/components/ArticleCard";
import HeroCarousel from "@/components/HeroCarousel";
import ScrollReveal from "@/components/motion/ScrollReveal";
import NewsletterForm from "@/components/NewsletterForm";
import { mergeJsonLd, buildWebSiteJsonLd, TWITTER_DOMAIN } from "@/lib/seo";
import { categoryUrlPath } from "@/lib/categorySlugs";
import { formatRelative } from "@/lib/format";

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="rule-top mb-5 flex items-baseline justify-between pt-3">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {to && (
        <Link
          to={to}
          className="group inline-flex h-10 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Ver todo
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function LatestRail({ articles }: { articles: Article[] }) {
  return (
    <section aria-labelledby="latest-h">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
        </span>
        <h2 id="latest-h" className="kicker">Lo último</h2>
      </div>
      <ol className="divide-y">
        {articles.map((a) => (
          <li key={a.id}>
            <Link to={`/articulo/${a.slug}`} className="group block py-3">
              <time
                dateTime={a.published_at ?? undefined}
                className="text-xs font-semibold tabular-nums text-brand"
              >
                {formatRelative(a.published_at)}
              </time>
              <p className="mt-0.5 font-display text-[15px] font-semibold leading-snug">
                <span className="headline-link">{a.title}</span>
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MostRead({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <section aria-labelledby="mostread-h" className="rule-top pt-3">
      <h2 id="mostread-h" className="mb-2 font-display text-xl font-bold">Más leídas</h2>
      <ol>
        {articles.map((a, i) => (
          <li key={a.id} className="border-b last:border-0">
            <Link to={`/articulo/${a.slug}`} className="group flex gap-4 py-3.5">
              <span
                aria-hidden
                className="w-7 shrink-0 font-display text-3xl font-bold leading-none text-brand/80 tabular-nums"
              >
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
  );
}

function SectionFront({ category, articles }: { category: Category; articles: Article[] }) {
  if (articles.length === 0) return null;
  const [main, ...rest] = articles;
  return (
    <ScrollReveal>
      <section aria-label={category.name}>
        <SectionHeader title={category.name} to={categoryUrlPath(category.slug)} />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <ArticleCard article={main} variant="horizontal" className="md:col-span-8" />
          <div className="divide-y md:col-span-4 md:border-l md:pl-6">
            {rest.slice(0, 3).map((a) => (
              <ArticleCard key={a.id} article={a} variant="headline" className="py-4 first:pt-0" />
            ))}
          </div>
        </div>
      </section>
    </ScrollReveal>
  );
}

function HomeSkeleton() {
  return (
    <div className="container grid grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:px-8">
      <div className="hidden space-y-4 lg:col-span-3 lg:block">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <div className="space-y-4 lg:col-span-6">
        <Skeleton className="aspect-[16/10] w-full" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="space-y-4 lg:col-span-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Index() {
  const dispatch = useAppDispatch();
  const featured = useAppSelector(selectHomeFeatured);
  const articles = useAppSelector(selectHomeArticles);
  const mostRead = useAppSelector(selectHomeMostRead);
  const categories = useAppSelector(selectHomeCategories);
  const loading = useAppSelector(selectHomeLoading);
  const meta = useAppSelector(selectHomeMeta);
  const error = useAppSelector(selectHomeError);

  useEffect(() => {
    dispatch(fetchHome());
  }, [dispatch]);

  const { heroSlides, lead, secondary, latest, byCategory } = useMemo(() => {
    // Hero: featured stories (top up with latest so there are always 5)
    const heroSlides = [...featured, ...articles.filter((a) => !featured.some((f) => f.id === a.id))].slice(0, 5);
    const used = new Set<number>(heroSlides.map((a) => a.id));
    const rest = articles.filter((a) => !used.has(a.id));
    const lead = heroSlides[0];
    const secondary = rest.slice(0, 3);
    secondary.forEach((a) => used.add(a.id));
    const latest = articles.slice(0, 8);
    const byCategory = new Map<number, Article[]>();
    for (const a of articles) {
      if (used.has(a.id)) continue;
      const list = byCategory.get(a.category_id) ?? [];
      list.push(a);
      byCategory.set(a.category_id, list);
    }
    return { heroSlides, lead, secondary, latest, byCategory };
  }, [featured, articles]);

  return (
    <div className="pb-20">
      <MetaHead
        title={null}
        description={meta?.description}
        keywords={meta?.keywords}
        ogTitle={meta?.og_title}
        ogDescription={meta?.og_description}
        ogImage={meta?.og_image}
        canonical={meta?.canonical_url}
        twitterDomain={TWITTER_DOMAIN}
        jsonLd={mergeJsonLd(buildWebSiteJsonLd())}
      />
      <h1 className="sr-only">INTELINOTA — Noticias de tecnología, deportes y cultura</h1>

      {error && !lead && (
        <div className="container px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="font-display text-2xl font-semibold">No pudimos cargar la portada.</p>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-6 h-11" onClick={() => dispatch(fetchHome())}>
            <RotateCw className="mr-2 h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}

      {loading && !lead && <HomeSkeleton />}

      {lead && (
        <>
          {/* ── Hero carousel ──────────────────────────────────── */}
          <div className="container px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
            <HeroCarousel articles={heroSlides} />
          </div>

          {/* ── Front page ─────────────────────────────────────── */}
          <section className="container mt-12 px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-0">
              {/* Secondary stories */}
              <div className="lg:order-2 lg:col-span-6 lg:px-8">
                <h2 className="kicker mb-4">Más historias</h2>
                {secondary[0] && <ArticleCard article={secondary[0]} variant="lead" />}
                {secondary.length > 1 && (
                  <div className="mt-8 grid grid-cols-1 gap-8 border-t pt-6 sm:grid-cols-2">
                    {secondary.slice(1).map((a) => (
                      <ArticleCard key={a.id} article={a} variant="grid" />
                    ))}
                  </div>
                )}
              </div>

              {/* Latest rail */}
              <aside className="lg:order-1 lg:col-span-3 lg:border-r lg:pr-8">
                <LatestRail articles={latest} />
              </aside>

              {/* Most read + newsletter */}
              <aside className="space-y-10 lg:order-3 lg:col-span-3 lg:border-l lg:pl-8">
                <MostRead articles={mostRead} />
                <div className="rounded-sm bg-foreground p-6 text-background">
                  <p className="kicker !text-background/70">Boletín diario</p>
                  <p className="mt-2 font-display text-xl font-bold leading-tight">
                    Lo esencial del día, en tu correo a las 7:00.
                  </p>
                  <NewsletterForm variant="inline" source="home_rail" className="mt-4" />
                </div>
              </aside>
            </div>
          </section>

          {/* ── Section fronts ─────────────────────────────────── */}
          <div className="container mt-16 space-y-16 px-4 sm:px-6 lg:px-8">
            {categories.map((cat) => (
              <SectionFront key={cat.id} category={cat} articles={byCategory.get(cat.id) ?? []} />
            ))}
          </div>

          {/* ── Newsletter band ────────────────────────────────── */}
          <ScrollReveal>
            <section
              id="newsletter"
              className="container mt-20 scroll-mt-24 px-4 sm:px-6 lg:px-8"
            >
              <div className="grid grid-cols-1 items-center gap-8 border-y-2 border-rule py-10 md:grid-cols-2 md:py-14">
                <div>
                  <p className="kicker">Suscríbete gratis</p>
                  <h2 className="mt-2 font-display text-display-lg font-bold text-balance">
                    Entiende las noticias, no solo las leas.
                  </h2>
                  <p className="mt-3 max-w-md font-body text-lg text-muted-foreground">
                    Un resumen curado cada mañana. Sin spam, cancela cuando quieras.
                  </p>
                </div>
                <NewsletterForm variant="footer" source="home_band" className="w-full max-w-md md:justify-self-end" />
              </div>
            </section>
          </ScrollReveal>
        </>
      )}
    </div>
  );
}
