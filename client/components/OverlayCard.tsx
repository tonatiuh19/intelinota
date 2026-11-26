import { Link } from "react-router-dom";
import type { Article } from "@shared/api";
import { ARTICLE_PLACEHOLDER, articleImageSrcSet, articleImageUrl, IMAGE_SIZES } from "@/lib/images";
import { cn } from "@/lib/utils";

/** Image card with headline overlaid on a gradient (section heroes). */
export default function OverlayCard({
  article,
  size,
  className,
  priority,
  label,
}: {
  article: Article;
  size: "lg" | "sm";
  className?: string;
  priority?: boolean;
  /** Pill text; defaults to the subcategory */
  label?: string;
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
        {(label ?? article.subcategory_name) && (
          <span className="inline-flex rounded-full bg-brand px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-foreground">
            {label ?? article.subcategory_name}
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
