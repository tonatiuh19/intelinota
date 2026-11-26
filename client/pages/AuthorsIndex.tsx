import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MetaHead from "@/components/MetaHead";
import { formatRelative } from "@/lib/format";
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
  canonicalUrl,
  mergeJsonLd,
} from "@/lib/seo";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAuthorsList,
  selectAuthorsList,
  selectAuthorsListLoading,
  selectAuthorsListError,
} from "@/store/slices/authorsSlice";

export default function AuthorsIndex() {
  const dispatch = useAppDispatch();
  const authors = useAppSelector(selectAuthorsList);
  const loading = useAppSelector(selectAuthorsListLoading);
  const error = useAppSelector(selectAuthorsListError);

  useEffect(() => {
    dispatch(fetchAuthorsList());
  }, [dispatch]);

  return (
    <div className="pb-24">
      <MetaHead
        title="Autores"
        description="Conoce al equipo editorial de InteliNota."
        canonical={canonicalUrl("/autores")}
        jsonLd={mergeJsonLd(
          buildWebPageJsonLd({
            name: "Autores",
            description: "Equipo editorial de InteliNota.",
            url: "/autores",
          }),
          buildBreadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Autores", path: "/autores" },
          ]),
        )}
      />

      <header className="container px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="inline-flex h-8 items-center hover:text-foreground">Portada</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="kicker">Autores</span>
        </nav>
        <div className="mt-2 flex flex-col gap-3 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-[2.25rem] font-bold leading-none tracking-[-0.02em] sm:text-5xl">
              El equipo
            </h1>
            <p className="mt-3 max-w-xl font-body text-lg text-muted-foreground">
              Las voces detrás de INTELINOTA: periodistas, analistas y especialistas.
            </p>
          </div>
          {authors.length > 0 && (
            <p className="font-sans text-sm text-muted-foreground">
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">{authors.length}</span> autores ·{" "}
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                {authors.reduce((n, a) => n + Number(a.article_count ?? 0), 0)}
              </span>{" "}
              historias
            </p>
          )}
        </div>
      </header>

      <section className="container mt-8 px-4 sm:px-6 lg:px-8" aria-label="Autores">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" className="h-10" onClick={() => dispatch(fetchAuthorsList())}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading && authors.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => {
              const count = Number(author.article_count ?? 0);
              return (
                <li key={author.id}>
                  <Link
                    to={`/autor/${author.slug}`}
                    className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_12px_32px_-16px_hsl(var(--brand)/0.45)]"
                  >
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-brand transition-transform duration-300 group-hover:scale-x-100" />
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 shrink-0 ring-2 ring-border transition group-hover:ring-brand">
                        <AvatarImage src={author.avatar_url ?? undefined} alt="" />
                        <AvatarFallback className="bg-foreground font-display text-2xl font-bold text-background">
                          {author.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-xl font-bold group-hover:text-brand">{author.name}</h2>
                        {author.twitter_handle && (
                          <p className="truncate font-sans text-sm text-muted-foreground">
                            @{author.twitter_handle.replace(/^@/, "")}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-3 flex-1 font-body text-[15px] leading-relaxed text-muted-foreground">
                      {author.bio || `${author.name} escribe para INTELINOTA.`}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t pt-4 font-sans text-xs text-muted-foreground">
                      <span>
                        <span className="font-semibold text-foreground tabular-nums">{count}</span>{" "}
                        {count === 1 ? "historia" : "historias"}
                        {author.latest_published_at && <> · {formatRelative(author.latest_published_at)}</>}
                      </span>
                      <span className="font-semibold text-brand transition-transform group-hover:translate-x-0.5">
                        Ver perfil →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
