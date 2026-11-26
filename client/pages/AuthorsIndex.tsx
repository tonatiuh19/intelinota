import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MetaHead from "@/components/MetaHead";
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

      <header className="container px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <p className="kicker">Redacción</p>
        <h1 className="mt-2 border-b-2 border-rule pb-6 font-display text-display-xl font-bold">
          Nuestros autores
        </h1>
        <p className="mt-4 max-w-2xl font-body text-lg text-muted-foreground">
          Periodistas y especialistas que cubren tecnología, deportes, videojuegos, cine y actualidad global.
        </p>
      </header>

      <div className="container mt-10 px-4 sm:px-6 lg:px-8">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : authors.length === 0 ? (
          <p className="py-16 text-center font-body text-muted-foreground">
            No hay autores publicados todavía.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => (
              <li key={author.id} className="border-t">
                <Link to={`/autor/${author.slug}`} className="group flex items-start gap-4 py-6">
                  <Avatar className="h-14 w-14 shrink-0">
                    <AvatarImage src={author.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="font-display font-bold">
                      {author.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <h2 className="font-display text-lg font-bold">
                      <span className="headline-link">{author.name}</span>
                    </h2>
                    {author.bio && (
                      <p className="line-clamp-2 font-body text-sm text-muted-foreground">{author.bio}</p>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                      Ver perfil <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-14 text-center">
          <Button asChild variant="outline" className="h-11">
            <Link to="/team">Sobre el equipo editorial</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
