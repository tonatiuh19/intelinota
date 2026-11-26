import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import MetaHead from "@/components/MetaHead";
import ArticleCard from "@/components/ArticleCard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearTag, fetchTag } from "@/store/slices/tagsSlice";
import { canonicalUrl } from "@/lib/seo";

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();
  const { current, loading, error } = useAppSelector((s) => s.tags);

  useEffect(() => {
    if (slug) dispatch(fetchTag(slug));
    return () => {
      dispatch(clearTag());
    };
  }, [dispatch, slug]);

  if (error) {
    return (
      <div className="container px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="kicker">Tema</p>
        <h1 className="mt-3 font-display text-display-lg font-bold">{error}</h1>
        <Button asChild variant="outline" className="mt-8 h-11">
          <Link to="/">Ir a la portada</Link>
        </Button>
      </div>
    );
  }

  const [lead, ...rest] = current?.articles ?? [];

  return (
    <div className="container px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      {current && (
        <MetaHead
          title={`${current.tag.name} — Noticias`}
          description={`Todas las noticias sobre ${current.tag.name} en INTELINOTA.`}
          canonical={canonicalUrl(`/tema/${current.tag.slug}`)}
        />
      )}
      <header className="rule-top mb-10 pt-4">
        <p className="kicker">Tema</p>
        {loading || !current ? (
          <Skeleton className="mt-2 h-12 w-64" />
        ) : (
          <h1 className="mt-1 font-display text-display-xl font-bold">{current.tag.name}</h1>
        )}
        {current && (
          <p className="mt-2 text-sm text-muted-foreground">
            {current.articles.length} {current.articles.length === 1 ? "historia" : "historias"}
          </p>
        )}
      </header>

      {loading && !current && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/2] w-full" />
          ))}
        </div>
      )}

      {lead && <ArticleCard article={lead} variant="featured" priority className="mb-12" />}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 border-t pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
