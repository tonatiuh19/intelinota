import { Link } from "react-router-dom";
import type { Article } from "@shared/api";
import { ARTICLE_PLACEHOLDER, articleImageSrcSet, articleImageUrl, IMAGE_SIZES } from "@/lib/images";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ArticleCardVariant =
  | "default"
  | "horizontal"
  | "featured"
  | "compact"
  | "grid"
  | "lead"
  | "headline";

interface ArticleCardProps {
  article: Article;
  variant?: ArticleCardVariant;
  className?: string;
  /** Load image eagerly with high priority (above-the-fold LCP) */
  priority?: boolean;
  showExcerpt?: boolean;
}

function Figure({
  article,
  sizes,
  priority,
  className,
  aspect = "aspect-[3/2]",
}: {
  article: Article;
  sizes: string;
  priority?: boolean;
  className?: string;
  aspect?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", aspect, className)}>
      <img
        src={articleImageUrl(article.image_url)}
        srcSet={articleImageSrcSet(article.image_url)}
        sizes={sizes}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        // @ts-expect-error — fetchpriority is valid HTML, not yet in React types
        fetchpriority={priority ? "high" : "auto"}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.dataset.fallback) return;
          img.dataset.fallback = "1";
          img.removeAttribute("srcset");
          img.src = ARTICLE_PLACEHOLDER;
        }}
        className="h-full w-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
      />
    </div>
  );
}

function Meta({ article, className }: { article: Article; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}>
      <span className="font-medium text-foreground/80">{article.author_name}</span>
      <span aria-hidden>·</span>
      <time dateTime={article.published_at ?? undefined}>{formatRelative(article.published_at)}</time>
      {article.read_time_minutes > 0 && (
        <>
          <span aria-hidden>·</span>
          <span>{article.read_time_minutes} min</span>
        </>
      )}
    </p>
  );
}

export default function ArticleCard({
  article,
  variant = "default",
  className,
  priority,
  showExcerpt,
}: ArticleCardProps) {
  const href = `/articulo/${article.slug}`;

  if (variant === "lead") {
    return (
      <Link to={href} className={cn("group block", className)}>
        <Figure article={article} sizes={IMAGE_SIZES.lead} priority={priority} aspect="aspect-[16/10]" />
        <div className="mt-4 space-y-3">
          <p className="kicker">{article.category_name}</p>
          <h2 className="font-display text-display-lg font-bold text-balance">
            <span className="headline-link">{article.title}</span>
          </h2>
          {article.excerpt && (
            <p className="max-w-measure font-body text-base leading-relaxed text-muted-foreground sm:text-lg">
              {article.excerpt}
            </p>
          )}
          <Meta article={article} />
        </div>
      </Link>
    );
  }

  if (variant === "headline") {
    return (
      <Link to={href} className={cn("group block space-y-1.5", className)}>
        <p className="kicker">{article.category_name}</p>
        <h3 className="font-display text-display-sm font-semibold text-balance">
          <span className="headline-link">{article.title}</span>
        </h3>
        {showExcerpt && article.excerpt && (
          <p className="line-clamp-2 font-body text-sm text-muted-foreground">{article.excerpt}</p>
        )}
        <Meta article={article} />
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link to={href} className={cn("group flex gap-4 py-4", className)}>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="kicker">{article.category_name}</p>
          <h3 className="line-clamp-3 font-display text-base font-semibold leading-snug">
            <span className="headline-link">{article.title}</span>
          </h3>
          <Meta article={article} />
        </div>
        <Figure
          article={article}
          sizes={IMAGE_SIZES.thumb}
          aspect="aspect-square"
          className="w-20 shrink-0 sm:w-24"
        />
      </Link>
    );
  }

  if (variant === "horizontal" || variant === "featured") {
    return (
      <Link
        to={href}
        className={cn("group grid grid-cols-1 gap-4 sm:grid-cols-5 sm:gap-6", className)}
      >
        <Figure article={article} sizes={IMAGE_SIZES.card} priority={priority} className="sm:col-span-2" />
        <div className="space-y-2 sm:col-span-3">
          <p className="kicker">{article.category_name}</p>
          <h3
            className={cn(
              "font-display font-semibold text-balance",
              variant === "featured" ? "text-display-md" : "text-display-sm",
            )}
          >
            <span className="headline-link">{article.title}</span>
          </h3>
          {article.excerpt && (
            <p className="line-clamp-3 font-body text-[15px] leading-relaxed text-muted-foreground">
              {article.excerpt}
            </p>
          )}
          <Meta article={article} />
        </div>
      </Link>
    );
  }

  // default + grid
  return (
    <Link to={href} className={cn("group block", className)}>
      <Figure article={article} sizes={IMAGE_SIZES.card} priority={priority} />
      <div className="mt-3 space-y-2">
        <p className="kicker">{article.category_name}</p>
        <h3 className="font-display text-display-sm font-semibold text-balance">
          <span className="headline-link">{article.title}</span>
        </h3>
        {(showExcerpt ?? variant === "default") && article.excerpt && (
          <p className="line-clamp-2 font-body text-[15px] leading-relaxed text-muted-foreground">
            {article.excerpt}
          </p>
        )}
        <Meta article={article} />
      </div>
    </Link>
  );
}
