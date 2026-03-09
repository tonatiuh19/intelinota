import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Share2,
  Twitter,
  Facebook,
  Bookmark,
  TrendingUp,
  ExternalLink,
  Flame,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchArticleFull,
  clearCurrent,
  selectCurrentArticle,
  selectDetailLoading,
  selectDetailError,
  selectCurrentBlocks,
  selectCurrentRelated,
} from "@/store/slices/articlesSlice";
import { selectHomeTrending } from "@/store/slices/homeSlice";
import MetaHead from "@/components/MetaHead";
import type { ContentBlock } from "@shared/api";

export default function Article() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();

  const article = useAppSelector(selectCurrentArticle);
  const loading = useAppSelector(selectDetailLoading);
  const error = useAppSelector(selectDetailError);
  const blocks = useAppSelector(selectCurrentBlocks);
  const related = useAppSelector(selectCurrentRelated);
  const trending = useAppSelector(selectHomeTrending);

  useEffect(() => {
    if (slug) dispatch(fetchArticleFull(slug));
    return () => {
      dispatch(clearCurrent());
    };
  }, [dispatch, slug]);

  if (loading) {
    return (
      <article className="pb-24">
        <div className="container px-4 sm:px-6 lg:px-8 py-12 space-y-6 max-w-3xl">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-8 w-3/4 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-[2.5rem]" />
        </div>
      </article>
    );
  }

  if (error || !article) {
    return (
      <article className="pb-24">
        <div className="container px-4 sm:px-6 lg:px-8 py-24 text-center space-y-4">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter opacity-30">
            {error ?? "Artículo no encontrado"}
          </h1>
          <Link to="/">
            <Button variant="outline" className="rounded-full mt-4">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </article>
    );
  }

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <article className="pb-24">
      <MetaHead
        title={article.title}
        description={article.excerpt ?? undefined}
        ogType="article"
        ogImage={article.image_url ?? undefined}
        articlePublishedTime={article.published_at ?? undefined}
        articleAuthor={article.author_name}
        articleSection={article.category_name}
      />
      <div className="container px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-8 space-y-8">
            <Link
              to="/"
              className="inline-flex items-center text-xs font-black text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] mb-4 group italic"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Volver al Inicio
            </Link>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge className="bg-white text-black hover:bg-white font-black tracking-[0.3em] uppercase text-[10px] rounded-full px-4 py-1 italic shadow-lg">
                  {article.category_name}
                </Badge>
                <span className="text-muted-foreground text-sm font-medium opacity-30">
                  /
                </span>
                <span className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] italic">
                  {article.subcategory_name}
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black italic tracking-tighter leading-[0.85] uppercase text-white drop-shadow-2xl">
                {article.title}
              </h1>

              <p className="text-base sm:text-xl md:text-2xl text-muted-foreground leading-relaxed italic font-medium max-w-3xl">
                {article.excerpt}
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-primary/10 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                <span>{publishedDate}</span>
                <span className="w-1 h-1 bg-muted-foreground rounded-full opacity-30" />
                <Clock className="h-3 w-3" />
                <span>{article.read_time_minutes} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 mb-16">
        <div className="relative aspect-video max-h-[700px] overflow-hidden rounded-[2.5rem] bg-muted border border-primary/5 shadow-2xl shadow-black/50 group">
          <img
            src={article.image_url ?? "/placeholder.jpg"}
            alt={article.title}
            className="w-full h-full object-cover transition-transform [transition-duration:3000ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8 space-y-10">
          {/* Dynamic content blocks */}
          <div className="space-y-8">
            {blocks.map((block) => (
              <ArticleBlock key={block.id} block={block} />
            ))}
          </div>

          <Separator className="my-12" />

          {/* Author Card */}
          <div className="flex flex-col sm:flex-row gap-6 items-start bg-muted/30 border border-primary/10 rounded-2xl p-6">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20 p-0.5 bg-muted flex-shrink-0">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${article.author_name}`}
              />
              <AvatarFallback>{article.author_name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest italic opacity-50">
                    Escrito por
                  </p>
                  <h4 className="font-black italic tracking-tighter uppercase text-xl leading-none">
                    {article.author_name}
                  </h4>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary h-8 w-8"
                  >
                    <Twitter className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary h-8 w-8"
                  >
                    <Facebook className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary h-8 w-8"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary h-8 w-8"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {article.author_name} es periodista de tecnología e innovación
                en INTELINOTA.
              </p>{" "}
              <Link to={`/autor/${article.author_slug}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 px-0 font-bold uppercase tracking-tighter italic text-xs hover:text-primary hover:bg-transparent"
                >
                  Ver todas las historias{" "}
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          <Separator className="my-12" />

          {/* Comments Section (Placeholder) */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                Comentarios
              </h3>
            </div>

            <div className="bg-muted/50 p-6 rounded-2xl border border-primary/5">
              <div className="flex gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user1" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <textarea
                    placeholder="Comparte tu opinión sobre esta historia..."
                    className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none min-h-[100px] placeholder:text-muted-foreground/50"
                  />
                  <div className="flex justify-end pt-2 border-t border-primary/10">
                    <Button
                      size="sm"
                      className="font-bold uppercase tracking-tighter italic"
                    >
                      Publicar comentario
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Article Sidebar */}
        <aside className="lg:col-span-4 space-y-10">
          {/* Recommended */}
          <div className="sticky top-24 space-y-10">
            <div className="bg-muted/30 rounded-2xl border border-primary/5 overflow-hidden">
              <div className="flex items-center gap-2 text-primary px-6 pt-6 pb-4 border-b border-primary/5">
                <TrendingUp className="h-4 w-4" />
                <h3 className="text-sm font-black italic uppercase tracking-widest">
                  Recomendado para ti
                </h3>
              </div>
              <div className="divide-y divide-primary/5">
                {related.slice(0, 6).map((art, idx) => (
                  <Link
                    key={art.id}
                    to={`/articulo/${art.slug}`}
                    className="group flex gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-muted">
                      {art.image_url ? (
                        <img
                          src={art.image_url}
                          alt={art.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <span className="text-2xl font-black text-primary/30">
                            {idx + 1}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1 py-1">
                      <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                        {art.category_name}
                      </span>
                      <h4 className="text-xs font-bold leading-snug uppercase tracking-tight line-clamp-3 group-hover:text-primary transition-colors">
                        {art.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        {art.read_time_minutes} min de lectura
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending */}
            {trending.length > 0 && (
              <div className="bg-muted/30 rounded-2xl border border-primary/5 overflow-hidden">
                <div className="flex items-center gap-2 text-orange-400 px-6 pt-6 pb-4 border-b border-primary/5">
                  <Flame className="h-4 w-4" />
                  <h3 className="text-sm font-black italic uppercase tracking-widest">
                    Lo más leído
                  </h3>
                </div>
                <div className="divide-y divide-primary/5">
                  {trending
                    .filter((a) => a.slug !== slug)
                    .slice(0, 5)
                    .map((art, idx) => (
                      <Link
                        key={art.id}
                        to={`/articulo/${art.slug}`}
                        className="group flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <span className="shrink-0 text-3xl font-black italic text-muted-foreground/20 leading-none pt-0.5 w-7 text-right">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                            {art.category_name}
                          </span>
                          <h4 className="text-xs font-bold leading-snug uppercase tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {art.title}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {art.read_time_minutes} min
                            {art.view_count > 0 && (
                              <>
                                <span className="opacity-30">·</span>
                                <span>
                                  {art.view_count.toLocaleString()} vistas
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="shrink-0 h-3.5 w-3.5 text-muted-foreground/30 mt-1 group-hover:text-primary transition-colors" />
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}

// ── Article block renderer ────────────────────────────────────
function ArticleBlock({ block }: { block: ContentBlock }) {
  const data = block.data as Record<string, string>;
  switch (block.type) {
    case "html":
      return (
        <div
          className="article-content max-w-none"
          dangerouslySetInnerHTML={{ __html: data.html ?? "" }}
        />
      );
    case "image":
      return data.url ? (
        <figure className="space-y-3">
          <img
            src={data.url}
            alt={data.alt ?? ""}
            className="rounded-2xl w-full object-cover border border-primary/10 shadow-2xl"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          {(data.caption || data.credit) && (
            <figcaption className="text-xs text-muted-foreground text-center italic">
              {data.caption}
              {data.credit && (
                <span className="ml-2 opacity-60">— {data.credit}</span>
              )}
            </figcaption>
          )}
        </figure>
      ) : null;
    case "youtube":
      return data.video_id ? (
        <figure className="space-y-3">
          <div className="aspect-video rounded-2xl overflow-hidden bg-black/40 border border-primary/10">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${data.video_id}`}
              className="w-full h-full"
              allowFullScreen
              title={data.caption ?? "Video"}
            />
          </div>
          {data.caption && (
            <figcaption className="text-xs text-muted-foreground text-center italic">
              {data.caption}
            </figcaption>
          )}
        </figure>
      ) : null;
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary pl-6 py-4 my-4 bg-muted/30 rounded-r-xl pr-6">
          <p className="italic text-xl font-black tracking-tighter uppercase leading-tight text-foreground">
            &ldquo;{data.text}&rdquo;
          </p>
          {data.attribution && (
            <footer className="text-xs text-muted-foreground mt-3 font-bold uppercase tracking-widest">
              — {data.attribution}
            </footer>
          )}
        </blockquote>
      );
    case "divider":
      return <hr className="border-primary/10 my-4" />;
    default:
      return null;
  }
}
