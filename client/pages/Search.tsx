import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Search } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchArticles,
  selectArticles,
  selectListLoading,
  selectListError,
  selectPagination,
} from "@/store/slices/articlesSlice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MetaHead from "@/components/MetaHead";
import ArticleCard from "@/components/ArticleCard";
import StaggerGrid, { StaggerItem } from "@/components/motion/StaggerGrid";

const searchSchema = Yup.object({
  q: Yup.string().trim().min(2, "Escribe al menos 2 caracteres").max(100).required("Escribe un término"),
});

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const dispatch = useAppDispatch();
  const articles = useAppSelector(selectArticles);
  const loading = useAppSelector(selectListLoading);
  const error = useAppSelector(selectListError);
  const pagination = useAppSelector(selectPagination);

  const formik = useFormik({
    initialValues: { q: query },
    enableReinitialize: true,
    validationSchema: searchSchema,
    onSubmit: (values) => setSearchParams({ q: values.q.trim(), page: "1" }),
  });

  useEffect(() => {
    if (query.trim()) {
      dispatch(fetchArticles({ search: query.trim(), page, limit: 20 }));
    }
  }, [dispatch, query, page]);

  return (
    <div className="pb-24">
      <MetaHead
        title={query ? `Buscar: ${query}` : "Buscar"}
        description="Busca artículos en Intelinota"
        noIndex
        includeSiteOrganization={false}
      />

      <header className="container max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <p className="kicker">Búsqueda</p>
        <h1 className="mt-2 font-display text-display-lg font-bold">Encuentra historias</h1>
        <form onSubmit={formik.handleSubmit} noValidate role="search" className="mt-6">
          <label htmlFor="search-q" className="sr-only">Buscar</label>
          <div className="flex items-center gap-3 border-b-2 border-rule pb-2">
            <Search className="h-6 w-6 shrink-0 text-muted-foreground" />
            <input
              id="search-q"
              type="search"
              {...formik.getFieldProps("q")}
              placeholder="Temas, personas, lugares…"
              aria-invalid={Boolean(formik.touched.q && formik.errors.q)}
              className="h-12 w-full min-w-0 bg-transparent font-display text-xl outline-none placeholder:text-muted-foreground/60 sm:text-2xl"
            />
            <Button type="submit" className="h-11 shrink-0 rounded-sm px-5">
              Buscar
            </Button>
          </div>
          {formik.touched.q && formik.errors.q && (
            <p role="alert" className="mt-2 text-sm text-brand">{formik.errors.q}</p>
          )}
        </form>
      </header>

      <div className="container mt-10 max-w-3xl px-4 sm:px-6 lg:px-8">
        {!query.trim() ? (
          <p className="py-16 text-center font-body text-muted-foreground">
            Escribe un término para buscar artículos.
          </p>
        ) : loading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="my-4 h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-4">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" onClick={() => dispatch(fetchArticles({ search: query, page }))}>
              Reintentar
            </Button>
          </div>
        ) : articles.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <h2 className="font-display text-2xl font-semibold">
              Sin resultados
            </h2>
            <p className="text-muted-foreground">
              No encontramos artículos para &ldquo;{query}&rdquo;.
            </p>
            <Button asChild variant="outline" className="h-11">
              <Link to="/">Volver a la portada</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-2 border-b pb-3 text-sm text-muted-foreground">
              {pagination?.total ?? articles.length} resultado
              {(pagination?.total ?? articles.length) !== 1 ? "s" : ""} para
              &ldquo;{query}&rdquo;
            </p>
            <StaggerGrid className="divide-y">
              {articles.map((article) => (
                <StaggerItem key={article.id}>
                  <ArticleCard article={article} variant="compact" />
                </StaggerItem>
              ))}
            </StaggerGrid>

            {pagination && pagination.totalPages > 1 && (
              <nav aria-label="Paginación" className="mt-10 flex items-center justify-between border-t pt-6">
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={page <= 1}
                  onClick={() =>
                    setSearchParams({ q: query, page: String(page - 1) })
                  }
                >
                  Anterior
                </Button>
                <span className="flex items-center text-sm text-muted-foreground">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={page >= pagination.totalPages}
                  onClick={() =>
                    setSearchParams({ q: query, page: String(page + 1) })
                  }
                >
                  Siguiente
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
