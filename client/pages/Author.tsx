import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import OverlayCard from "@/components/OverlayCard";
import NewsletterForm from "@/components/NewsletterForm";
import { formatRelative } from "@/lib/format";
import { categoryUrlPath } from "@/lib/categorySlugs";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { useParams } from "react-router-dom";
import {
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Globe,
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAuthor,
  clearAuthor,
  selectAuthor,
  selectAuthorLoading,
  selectAuthorError,
} from "@/store/slices/authorsSlice";
import { parseSocialLinks } from "@/lib/socialLinks";
import MetaHead from "@/components/MetaHead";
import ArticleCard from "@/components/ArticleCard";
import {
  buildBreadcrumbJsonLd,
  buildPersonJsonLd,
  canonicalUrl,
  mergeJsonLd,
  twitterHandle,
} from "@/lib/seo";

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();
  const author = useAppSelector(selectAuthor);
  const loading = useAppSelector(selectAuthorLoading);
  const error = useAppSelector(selectAuthorError);

  useEffect(() => {
    if (slug) dispatch(fetchAuthor(slug));
    return () => {
      dispatch(clearAuthor());
    };
  }, [dispatch, slug]);

  const [section, setSection] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const stats = useMemo(() => {
    const list = author?.articles ?? [];
    const map = new Map<string, { name: string; slug: string; count: number }>();
    for (const a of list) {
      const cur = map.get(a.category_slug) ?? { name: a.category_name, slug: a.category_slug, count: 0 };
      cur.count += 1;
      map.set(a.category_slug, cur);
    }
    return {
      count: list.length,
      minutes: list.reduce((n, a) => n + (a.read_time_minutes || 0), 0),
      sections: Array.from(map.values()).sort((x, y) => y.count - x.count),
      latest: list[0]?.published_at ?? null,
    };
  }, [author]);

  const visible = (author?.articles ?? [])
    .slice(1)
    .filter((a) => !section || a.category_name === section);

  if (loading) {
    return (
      <div className="container max-w-4xl space-y-6 px-4 py-14 sm:px-6 lg:px-8">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="container px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="kicker">Autor</p>
        <h1 className="mt-3 font-display text-display-lg font-bold">
          {error ?? "Autor no encontrado"}
        </h1>
        <Button asChild variant="outline" className="mt-8 h-11">
          <Link to="/autores">Ver todos los autores</Link>
        </Button>
      </div>
    );
  }

  const social = parseSocialLinks(author.social_links);
  const socialLinks = [
    author.twitter_handle && {
      href: `https://twitter.com/${author.twitter_handle.replace(/^@/, "")}`,
      icon: Twitter,
      label: "X",
    },
    social.facebook && { href: social.facebook, icon: Facebook, label: "Facebook" },
    social.instagram && {
      href: social.instagram,
      icon: Instagram,
      label: "Instagram",
    },
    social.linkedin && {
      href: social.linkedin,
      icon: Linkedin,
      label: "LinkedIn",
    },
    social.youtube && { href: social.youtube, icon: Youtube, label: "YouTube" },
    social.tiktok && { href: social.tiktok, icon: FaTiktok, label: "TikTok" },
    social.website && { href: social.website, icon: Globe, label: "Web" },
  ].filter(Boolean) as Array<{
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }>;

  return (
    <div className="pb-24">
      <MetaHead
        title={author.name}
        description={author.bio ?? `Artículos de ${author.name} en Intelinota`}
        ogType="profile"
        ogImage={author.avatar_url ?? undefined}
        canonical={canonicalUrl(`/autor/${author.slug}`)}
        author={author.name}
        twitterCreator={twitterHandle(author.twitter_handle)}
        jsonLd={mergeJsonLd(
          buildPersonJsonLd({
            name: author.name,
            description: author.bio ?? `Autor en Intelinota`,
            url: `/autor/${author.slug}`,
            imageUrl: author.avatar_url,
          }),
          buildBreadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Autores", path: "/autores" },
            { name: author.name, path: `/autor/${author.slug}` },
          ]),
        )}
      />

      {/* ── Profile band: identity + stats (left), latest story (right) ── */}
      <header className="container px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="inline-flex h-8 items-center hover:text-foreground">Portada</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/autores" className="inline-flex h-8 items-center hover:text-foreground">Autores</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="kicker">{author.name}</span>
        </nav>

        <div className="mt-3 grid grid-cols-1 gap-8 border-b pb-10 lg:grid-cols-12 lg:items-stretch lg:gap-10">
          <div className="flex flex-col lg:col-span-7">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 ring-4 ring-background sm:h-24 sm:w-24">
                  <AvatarImage src={author.avatar_url ?? undefined} alt={author.name} />
                  <AvatarFallback className="bg-foreground font-display text-3xl font-bold text-background">
                    {author.name[0]}
                  </AvatarFallback>
                </Avatar>
                <span aria-hidden className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-4 border-background bg-brand" />
              </div>
              <div className="min-w-0">
                <p className="kicker">Autor · INTELINOTA</p>
                <h1 className="mt-1 font-display text-[2.25rem] font-bold leading-none tracking-[-0.02em] sm:text-5xl">
                  {author.name}
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
              {author.bio || `${author.name} escribe para INTELINOTA.`}
            </p>

            <dl className="mt-6 grid grid-cols-3 divide-x rounded-xl border bg-card">
              {[
                { k: "Historias", v: String(stats.count) },
                { k: "Minutos", v: String(stats.minutes) },
                { k: "Secciones", v: String(stats.sections.length) },
              ].map((x) => (
                <div key={x.k} className="px-4 py-3 sm:px-5 sm:py-4">
                  <dt className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{x.k}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">{x.v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-2 lg:mt-auto lg:pt-6">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
              {stats.latest && (
                <span className="ml-auto font-sans text-xs text-muted-foreground">
                  Última publicación: {formatRelative(stats.latest)}
                </span>
              )}
            </div>
          </div>

          {author.articles[0] && (
            <div className="lg:col-span-5">
              <OverlayCard article={author.articles[0]} size="lg" label="Lo más reciente" priority className="lg:min-h-[420px]" />
            </div>
          )}
        </div>
      </header>

      {/* ── Stories + sidebar ─────────────────────────────────── */}
      <div className="container mt-10 grid grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <section className="lg:col-span-8" aria-labelledby="author-stories">
          <div className="rule-top flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="author-stories" className="font-display text-xl font-bold">
              Historias de {author.name.split(" ")[0]}
            </h2>
            {stats.sections.length > 1 && (
              <div role="tablist" aria-label="Filtrar por sección" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
                {[null, ...stats.sections.map((x) => x.name)].map((name) => {
                  const active = section === name;
                  return (
                    <button
                      key={name ?? "__all"}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSection(name)}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                        active ? "border-brand bg-brand text-brand-foreground" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                      )}
                    >
                      {name ?? "Todas"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="py-12 text-center font-body text-muted-foreground">
              {stats.count === 0
                ? "Este autor aún no tiene artículos publicados."
                : section
                  ? `No hay más historias en ${section}.`
                  : "Por ahora, su historia más reciente es la de arriba. Pronto habrá más."}
            </p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={section ?? "all"}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="divide-y"
              >
                {visible.map((article) => (
                  <ArticleCard key={article.id} article={article} variant="horizontal" className="py-6" />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        <aside className="lg:col-span-4">
          <div className="space-y-10 lg:sticky lg:top-24">
            {stats.sections.length > 0 && (
              <section aria-labelledby="covers-h">
                <h2 id="covers-h" className="rule-top mb-4 pt-3 font-display text-xl font-bold">Escribe sobre</h2>
                <ul className="space-y-3">
                  {stats.sections.map((x) => (
                    <li key={x.slug}>
                      <Link to={categoryUrlPath(x.slug)} className="group block">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-semibold group-hover:text-brand">{x.name}</span>
                          <span className="tabular-nums text-muted-foreground">{x.count}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${(x.count / stats.count) * 100}%` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-xl bg-foreground p-6 text-background">
              <p className="kicker !text-background/70">Boletín</p>
              <p className="mt-2 font-display text-xl font-bold leading-tight">
                Recibe lo nuevo de {author.name.split(" ")[0]} y del equipo.
              </p>
              <NewsletterForm variant="inline" source={`author_${author.slug}`} className="mt-4" />
            </section>
            <Link to="/autores" className="inline-flex h-10 items-center text-sm font-semibold text-brand hover:underline">
              Ver todo el equipo →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
