import { useParams, Link } from "react-router-dom";
import {
  Share2,
  Bookmark,
  Link2,
  MessageCircle,
} from "lucide-react";
import { FaXTwitter, FaFacebookF, FaWhatsapp, FaLinkedinIn } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ArticleCard from "@/components/ArticleCard";
import ArticleToc, { useArticleToc } from "@/components/ArticleToc";
import NewsletterForm from "@/components/NewsletterForm";
import { formatDate, formatRelative } from "@/lib/format";
import { articleImageSrcSet, IMAGE_SIZES } from "@/lib/images";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import CommentForm from "@/components/CommentForm";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchArticleFull,
  trackArticleView,
  clearCurrent,
  selectCurrentArticle,
  selectDetailLoading,
  selectDetailError,
  selectCurrentBlocks,
  selectCurrentRelated,
  selectCurrentTags,
} from "@/store/slices/articlesSlice";
import {
  fetchAuthor,
  clearAuthor,
  selectAuthor,
} from "@/store/slices/authorsSlice";
import {
  fetchComments,
  clearComments,
  selectComments,
  selectCommentsLoading,
  selectCommentsError,
  selectCommentsPostMessage,
} from "@/store/slices/commentsSlice";
import { selectHomeTrending, fetchHome } from "@/store/slices/homeSlice";
import MetaHead from "@/components/MetaHead";
import {
  buildNewsArticleJsonLd,
  buildBreadcrumbJsonLd,
  canonicalUrl,
  mergeJsonLd,
} from "@/lib/seo";
import { categoryUrlPath } from "@/lib/categorySlugs";
import ArticleBlock from "@/components/ArticleBlock";
import ReadingProgress from "@/components/ReadingProgress";
import { articleImageUrl } from "@/lib/images";
import { sharePage, toggleBookmark, isBookmarked } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

export default function Article() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();

  const article = useAppSelector(selectCurrentArticle);
  const loading = useAppSelector(selectDetailLoading);
  const error = useAppSelector(selectDetailError);
  const blocks = useAppSelector(selectCurrentBlocks);
  const related = useAppSelector(selectCurrentRelated);
  const tags = useAppSelector(selectCurrentTags);
  const trending = useAppSelector(selectHomeTrending);
  const authorProfile = useAppSelector(selectAuthor);
  const comments = useAppSelector(selectComments);
  const commentsLoading = useAppSelector(selectCommentsLoading);
  const commentsError = useAppSelector(selectCommentsError);
  const commentsPostMessage = useAppSelector(selectCommentsPostMessage);
  const { toast } = useToast();
  const [bookmarked, setBookmarked] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const toc = useArticleToc(".article-body", [blocks]);

  // Reading progress through the article body (drives TOC + time left)
  useEffect(() => {
    const onScroll = () => {
      const el = document.querySelector<HTMLElement>(".article-body");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const read = Math.min(Math.max(-rect.top + window.innerHeight * 0.3, 0), Math.max(total, 1));
      setReadProgress(total > 0 ? read / total : 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [blocks]);

  useEffect(() => {
    if (slug) {
      dispatch(fetchArticleFull(slug));
      dispatch(trackArticleView(slug));
    }
    return () => {
      dispatch(clearCurrent());
      dispatch(clearAuthor());
      dispatch(clearComments());
    };
  }, [dispatch, slug]);

  useEffect(() => {
    if (slug) dispatch(fetchComments(slug));
  }, [dispatch, slug]);

  useEffect(() => {
    if (article?.author_slug) {
      dispatch(fetchAuthor(article.author_slug));
    }
  }, [dispatch, article?.author_slug]);

  useEffect(() => {
    if (slug) setBookmarked(isBookmarked(slug));
  }, [slug]);

  useEffect(() => {
    if (trending.length === 0) {
      dispatch(fetchHome());
    }
  }, [dispatch, trending.length]);

  async function handleShare() {
    if (!article) return;
    const url = window.location.href;
    try {
      const result = await sharePage(article.title, url);
      toast({
        title: result === "shared" ? "Compartido" : "Enlace copiado",
        description:
          result === "shared"
            ? "Gracias por compartir esta historia."
            : "El enlace se copió al portapapeles.",
      });
    } catch {
      toast({
        title: "No se pudo compartir",
        variant: "destructive",
      });
    }
  }

  function handleBookmark() {
    if (!slug) return;
    const next = toggleBookmark(slug);
    setBookmarked(next);
    toast({
      title: next ? "Guardado" : "Eliminado",
      description: next
        ? "Artículo añadido a tus favoritos."
        : "Artículo eliminado de favoritos.",
    });
  }

  function shareTo(network: "x" | "facebook" | "whatsapp" | "linkedin") {
    if (!article) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(article.title);
    const targets = {
      x: `https://x.com/intent/post?url=${url}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
    window.open(targets[network], "_blank", "noopener,noreferrer,width=640,height=560");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Enlace copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <article className="container px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-6 w-full" />
        </div>
        <Skeleton className="mx-auto mt-10 aspect-[16/9] w-full max-w-5xl" />
      </article>
    );
  }

  if (error || !article) {
    return (
      <article className="container px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="kicker">Error 404</p>
        <h1 className="mt-3 font-display text-display-lg font-bold">
          {error ?? "Artículo no encontrado"}
        </h1>
        <Button asChild variant="outline" className="mt-8 h-11">
          <Link to="/">Volver a la portada</Link>
        </Button>
      </article>
    );
  }

  const articleTags = [
    article.category_name,
    article.subcategory_name,
    ...tags.map((t) => t.name),
  ].filter(Boolean) as string[];
  const moreFromSection = related.slice(0, 3);
  const moreIds = new Set(moreFromSection.map((a) => a.id));
  const recommended = [...trending, ...related]
    .filter((a, i, arr) => a.id !== article.id && !moreIds.has(a.id) && arr.findIndex((x) => x.id === a.id) === i)
    .slice(0, 4);

  const shareButtons = [
    { key: "x" as const, label: "Compartir en X", icon: FaXTwitter },
    { key: "facebook" as const, label: "Compartir en Facebook", icon: FaFacebookF },
    { key: "whatsapp" as const, label: "Compartir en WhatsApp", icon: FaWhatsapp },
    { key: "linkedin" as const, label: "Compartir en LinkedIn", icon: FaLinkedinIn },
  ];

  const minutesLeft = Math.max(1, Math.ceil(article.read_time_minutes * (1 - readProgress)));

  const railButton =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground";

  return (
    <article className="pb-24 lg:pb-28">
      <ReadingProgress />
      <MetaHead
        title={article.title}
        description={article.excerpt ?? undefined}
        keywords={articleTags.join(", ")}
        ogType="article"
        ogImage={article.image_url ?? undefined}
        canonical={canonicalUrl(`/articulo/${article.slug}`)}
        author={article.author_name}
        articlePublishedTime={article.published_at ?? undefined}
        articleModifiedTime={article.published_at ?? undefined}
        articleAuthor={article.author_name}
        articleSection={article.category_name}
        articleTags={articleTags}
        jsonLd={mergeJsonLd(
          buildNewsArticleJsonLd({
            headline: article.title,
            description: article.excerpt ?? article.title,
            url: `/articulo/${article.slug}`,
            imageUrl: article.image_url,
            datePublished: article.published_at,
            authorName: article.author_name,
            authorUrl: `/autor/${article.author_slug}`,
            section: article.category_name,
            keywords: articleTags,
          }),
          buildBreadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: article.category_name, path: categoryUrlPath(article.category_slug) },
            { name: article.title, path: `/articulo/${article.slug}` },
          ]),
        )}
      />

      {/*
        Layout: one centered reading column (max 720px). On xl screens a
        share rail sits to its left and the TOC to its right, both sticky.
        Header, hero and body all share the same center axis.
      */}
      <div className="container px-4 sm:px-6 lg:px-8">
        {/* ── Header + hero: stacked on mobile, side-by-side on lg so the
            article text is reachable without a long scroll ── */}
        <div className="mx-auto max-w-[1200px] pt-6 sm:pt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12 lg:pt-10">
        <header className="mx-auto max-w-[720px] lg:mx-0 lg:max-w-none">
          <nav aria-label="Ruta" className="flex flex-wrap items-center gap-2 text-xs">
            <Link to={categoryUrlPath(article.category_slug)} className="kicker hover:underline">
              {article.category_name}
            </Link>
            {article.subcategory_name && (
              <>
                <span aria-hidden className="text-muted-foreground">/</span>
                <span className="kicker !text-muted-foreground">{article.subcategory_name}</span>
              </>
            )}
          </nav>
          <h1 className="mt-4 font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[2.75rem] lg:text-[2.6rem] xl:text-[2.9rem]">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="mt-5 font-body text-lg leading-relaxed text-muted-foreground text-pretty sm:text-[1.3rem] sm:leading-[1.55] lg:line-clamp-4 lg:text-lg">
              {article.excerpt}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-y py-4 lg:mt-6">
            <Link to={`/autor/${article.author_slug}`} className="group flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11 ring-2 ring-background">
                <AvatarImage src={authorProfile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="font-display font-bold">{article.author_name[0]}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold group-hover:underline">{article.author_name}</span>
                <span className="text-muted-foreground">
                  <time dateTime={article.published_at ?? undefined}>{formatDate(article.published_at)}</time>
                  {" · "}
                  {article.read_time_minutes} min de lectura
                </span>
              </span>
            </Link>
            <div className="ml-auto hidden items-center gap-1 sm:flex">
              <button type="button" onClick={handleShare} aria-label="Compartir" className={railButton}>
                <Share2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={copyLink} aria-label="Copiar enlace" className={cn(railButton, "hidden sm:inline-flex")}>
                <Link2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleBookmark}
                aria-label={bookmarked ? "Quitar de favoritos" : "Guardar"}
                aria-pressed={bookmarked}
                className={cn(railButton, bookmarked && "border-brand bg-brand text-brand-foreground hover:text-brand-foreground")}
              >
                <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
              </button>
            </div>
          </div>
        </header>

        {article.image_url && (
          <figure className="mx-auto mt-8 max-w-[1080px] sm:mt-10 lg:mt-0 lg:max-w-none">
            <div className="-mx-4 aspect-[16/9] overflow-hidden bg-muted sm:mx-0 sm:rounded-xl lg:aspect-[4/3]">
              <img
                src={articleImageUrl(article.image_url)}
                srcSet={articleImageSrcSet(article.image_url)}
                sizes="(min-width: 1024px) 640px, 100vw"
                alt={article.excerpt ?? article.title}
                // @ts-expect-error — valid HTML attribute
                fetchpriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          </figure>
        )}
        </div>

        {/* ── Body with rails ─────────────────────────────────── */}
        <div className="relative mx-auto mt-10 grid max-w-[1200px] grid-cols-1 sm:mt-12 xl:grid-cols-[200px_minmax(0,720px)_200px] xl:justify-center xl:gap-x-10">
          {/* Left rail: share (xl) */}
          <aside className="hidden xl:block" aria-label="Compartir">
            <div className="sticky top-28 flex flex-col items-end gap-2">
              <p className="kicker mb-1 !text-muted-foreground">Compartir</p>
              <div className="flex flex-col gap-2">
                {shareButtons.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => shareTo(key)} aria-label={label} className={railButton}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
                <button type="button" onClick={copyLink} aria-label="Copiar enlace" className={railButton}>
                  <Link2 className="h-4 w-4" />
                </button>
                <a href="#comentarios" aria-label="Ir a comentarios" className={railButton}>
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            </div>
          </aside>

          {/* Reading column */}
          <div className="article-body min-w-0">
            {toc.items.length > 2 && (
              <details className="group mb-10 rounded-xl border bg-card xl:hidden">
                <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 font-sans text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <span>En este artículo · {toc.items.length} secciones</span>
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <div className="border-t px-4 pb-4 pt-3">
                  <ArticleToc items={toc.items} activeId={toc.activeId} progress={readProgress} minutesLeft={minutesLeft} />
                </div>
              </details>
            )}
            <div className="space-y-8">
              {blocks.map((block, i) => (
                <ArticleBlock key={block.id} block={block} dropCap={i === 0} />
              ))}
            </div>

            {tags.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2" aria-label="Temas">
                {tags.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/tema/${t.slug}`}
                      className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
                    >
                      #{t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Author box */}
            <section className="mt-12 flex flex-col gap-5 rounded-xl border bg-card p-6 sm:flex-row" aria-label="Sobre el autor">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={authorProfile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="font-display text-xl font-bold">{article.author_name[0]}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <p className="kicker !text-muted-foreground">Sobre el autor</p>
                <Link to={`/autor/${article.author_slug}`} className="font-display text-xl font-bold hover:underline">
                  {article.author_name}
                </Link>
                <p className="font-body text-[15px] leading-relaxed text-muted-foreground">
                  {authorProfile?.bio ?? `${article.author_name} escribe para INTELINOTA.`}
                </p>
                <Link
                  to={`/autor/${article.author_slug}`}
                  className="inline-flex h-10 items-center text-sm font-semibold text-brand hover:underline"
                >
                  Más historias de {article.author_name.split(" ")[0]} →
                </Link>
              </div>
            </section>

            {/* End-of-article newsletter */}
            <section className="mt-10 overflow-hidden rounded-xl bg-foreground p-6 text-background sm:p-8">
              <p className="kicker !text-background/70">Boletín diario</p>
              <p className="mt-2 font-display text-2xl font-bold leading-tight">
                ¿Te gustó esta historia? Recibe las mejores cada mañana.
              </p>
              <NewsletterForm variant="inline" source="article_end" className="mt-5 max-w-md" />
            </section>

            {/* Comments */}
            <section id="comentarios" className="mt-14 scroll-mt-28 space-y-6" aria-labelledby="comments-h">
              <h2 id="comments-h" className="rule-top pt-3 font-display text-2xl font-bold">
                Comentarios
                {!commentsLoading && comments.length > 0 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">({comments.length})</span>
                )}
              </h2>
              {commentsPostMessage && (
                <Alert>
                  <AlertDescription>{commentsPostMessage}</AlertDescription>
                </Alert>
              )}
              {commentsError && (
                <Alert variant="destructive">
                  <AlertDescription>{commentsError}</AlertDescription>
                </Alert>
              )}
              {commentsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : comments.length === 0 ? (
                <p className="font-body text-muted-foreground">Sé el primero en comentar esta historia.</p>
              ) : (
                <ul className="divide-y">
                  {comments.map((comment) => (
                    <li key={comment.id} className={cn("py-5", comment.parent_id && "ml-6 border-l pl-5")}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-display text-sm font-bold">
                          {comment.author_name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                        <span className="text-sm font-semibold">{comment.author_name}</span>
                        <time dateTime={comment.created_at} className="text-xs text-muted-foreground">
                          {formatRelative(comment.created_at)}
                        </time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap pl-11 font-body text-[15px] leading-relaxed">{comment.content}</p>
                    </li>
                  ))}
                </ul>
              )}
              {slug && <CommentForm slug={slug} />}
            </section>
          </div>

          {/* Right rail: table of contents + reading progress (xl) */}
          <aside className="hidden xl:block">
            <div className="sticky top-28">
              <ArticleToc items={toc.items} activeId={toc.activeId} progress={readProgress} minutesLeft={minutesLeft} />
            </div>
          </aside>
        </div>
      </div>

      {/* ── Keep reading ─────────────────────────────────────── */}
      {recommended.length > 0 && (
        <section className="container mt-20 px-4 sm:px-6 lg:px-8" aria-labelledby="rec-h">
          <div className="mx-auto max-w-[1180px]">
            <div className="rule-top mb-6 flex items-baseline justify-between pt-3">
              <h2 id="rec-h" className="font-display text-2xl font-bold">Sigue leyendo</h2>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {recommended.slice(0, 4).map((a) => (
                <ArticleCard key={a.id} article={a} variant="grid" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* More from section */}
      {moreFromSection.length > 0 && (
        <section className="container mx-auto mt-16 max-w-[1180px] px-4 sm:px-6 lg:px-8" aria-labelledby="more-h">
          <div className="rule-top mb-6 flex items-baseline justify-between pt-3">
            <h2 id="more-h" className="font-display text-2xl font-bold">
              Más de {article.category_name}
            </h2>
            <Link to={categoryUrlPath(article.category_slug)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Ver todo →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {moreFromSection.map((a) => (
              <ArticleCard key={a.id} article={a} variant="grid" />
            ))}
          </div>
        </section>
      )}

      {/* Mobile share bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex h-14 items-center justify-around px-2">
          <button type="button" onClick={() => shareTo("whatsapp")} aria-label="Compartir en WhatsApp" className="inline-flex h-11 w-11 items-center justify-center">
            <FaWhatsapp className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => shareTo("x")} aria-label="Compartir en X" className="inline-flex h-11 w-11 items-center justify-center">
            <FaXTwitter className="h-5 w-5" />
          </button>
          <button type="button" onClick={handleShare} aria-label="Más opciones para compartir" className="inline-flex h-11 w-11 items-center justify-center">
            <Share2 className="h-5 w-5" />
          </button>
          <a href="#comentarios" aria-label="Comentarios" className="inline-flex h-11 w-11 items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={handleBookmark}
            aria-label={bookmarked ? "Quitar de favoritos" : "Guardar"}
            aria-pressed={bookmarked}
            className="inline-flex h-11 w-11 items-center justify-center"
          >
            <Bookmark className={cn("h-5 w-5", bookmarked && "fill-current text-brand")} />
          </button>
        </div>
      </div>
    </article>
  );
}
