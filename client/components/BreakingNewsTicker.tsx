import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import type { Article } from "@shared/api";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface BreakingNewsTickerProps {
  articles: Article[];
  className?: string;
}

export default function BreakingNewsTicker({
  articles,
  className,
}: BreakingNewsTickerProps) {
  const reduced = useReducedMotion();
  const items = articles.slice(0, 8);

  if (items.length === 0) return null;

  const track = [...items, ...items];

  return (
    <div
      className={cn(
        "overflow-hidden border-b bg-background",
        className,
      )}
    >
      <div className="container flex items-center gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <span className="kicker flex shrink-0 items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Última hora
        </span>
        <div className="relative flex-1 overflow-hidden mask-fade-x">
          <div
            className={cn(
              "flex w-max gap-8 whitespace-nowrap",
              !reduced && "animate-ticker",
            )}
          >
            {track.map((article, i) => (
              <Link
                key={`${article.id}-${i}`}
                to={`/articulo/${article.slug}`}
                className="font-display text-sm font-semibold text-foreground/80 transition-colors hover:text-brand"
              >
                {article.title}
                <span className="mx-4 opacity-30">·</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
