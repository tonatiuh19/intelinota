import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, TrendingUp, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCategoryPage,
  selectCategoryPageArticles,
  selectCategoryPageTrending,
  selectCategoryPageLoading,
} from "@/store/slices/articlesSlice";
import MetaHead from "@/components/MetaHead";

const SLUG_MAP: Record<string, string> = {
  sports: "Deportes",
  technology: "Tecnología",
  "video-games": "Videojuegos",
  cinema: "Cine",
  "world-news": "Mundo",
};

const URL_TO_DB_SLUG: Record<string, string> = {
  sports: "deportes",
  technology: "tecnologia",
  "video-games": "videojuegos",
  cinema: "cine",
  "world-news": "mundo",
};

export default function Category() {
  const { category: urlSlug } = useParams();
  const dispatch = useAppDispatch();
  const categoryName = urlSlug ? (SLUG_MAP[urlSlug] ?? urlSlug) : "";
  const dbSlug = urlSlug ? (URL_TO_DB_SLUG[urlSlug] ?? urlSlug) : "";

  const filteredArticles = useAppSelector(selectCategoryPageArticles);
  const loading = useAppSelector(selectCategoryPageLoading);
  const topArticles = useAppSelector(selectCategoryPageTrending);

  const subcategories = Array.from(
    new Set(filteredArticles.map((a) => a.subcategory_name).filter(Boolean)),
  ) as string[];

  useEffect(() => {
    if (dbSlug) dispatch(fetchCategoryPage({ slug: dbSlug }));
  }, [dispatch, dbSlug]);

  return (
    <div className="pb-24">
      <MetaHead
        title={categoryName}
        description={`Últimas noticias de ${categoryName} en InteliNota. Mantente informado con los mejores artículos.`}
        articleSection={categoryName}
      />
      {/* Category Header */}
      <div className="bg-muted/30 border-b border-primary/5 mb-12">
        <div className="container px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">
              Sección <ChevronRight className="h-3 w-3" /> {categoryName}
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-[0.8] text-white">
              {categoryName}
            </h1>
            <p className="text-xl text-muted-foreground font-medium max-w-2xl leading-relaxed italic">
              Toda la actualidad, análisis profundos y las últimas novedades de{" "}
              {categoryName.toLowerCase()} en un solo lugar.
            </p>
          </div>
        </div>
      </div>

      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-12">
            {/* Filter Bar (Simplified) */}
            <div className="flex flex-wrap items-center gap-3 border-b border-primary/5 pb-6">
              <Button
                variant="outline"
                className="rounded-full px-6 font-black italic uppercase text-[10px] tracking-widest border-primary/20 bg-primary/5"
              >
                Todos
              </Button>
              {subcategories.map((sub) => (
                <Button
                  key={sub}
                  variant="ghost"
                  className="rounded-full px-6 font-black italic uppercase text-[10px] tracking-widest hover:bg-muted"
                >
                  {sub}
                </Button>
              ))}
              <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40">
                <Filter className="h-3 w-3" /> Ordenar por fecha
              </div>
            </div>

            {/* Articles Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-[2.5rem]" />
                ))}
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="py-24 text-center space-y-4">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase opacity-30">
                  No se encontraron artículos
                </h2>
                <p className="text-muted-foreground">
                  Estamos trabajando para traerte las mejores noticias de esta
                  categoría.
                </p>
                <Link to="/">
                  <Button variant="outline" className="rounded-full mt-4">
                    Volver al inicio
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                {filteredArticles.map((article, idx) => (
                  <Link
                    key={article.id}
                    to={`/articulo/${article.slug}`}
                    className={cn(
                      "group block space-y-4",
                      idx === 0 &&
                        "md:col-span-2 flex flex-col md:flex-row gap-8 space-y-0",
                    )}
                  >
                    <div
                      className={cn(
                        "aspect-[16/10] overflow-hidden rounded-[2.5rem] bg-muted relative border border-primary/5 shadow-2xl shadow-black/20 shrink-0",
                        idx === 0 && "md:w-3/5",
                      )}
                    >
                      <img
                        src={article.image_url ?? "/placeholder.jpg"}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute top-6 left-6">
                        <Badge className="bg-black/80 text-white border-none backdrop-blur-md font-black italic uppercase text-[10px] tracking-[0.2em] px-4 py-1.5 rounded-full">
                          {article.subcategory_name}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">
                        {article.published_at
                          ? new Date(article.published_at).toLocaleDateString(
                              "es-MX",
                            )
                          : ""}
                        <span className="w-1 h-1 rounded-full bg-muted-foreground opacity-30" />
                        {article.read_time_minutes} min
                      </div>
                      <h3
                        className={cn(
                          "font-black italic tracking-tighter leading-none uppercase group-hover:text-primary transition-colors",
                          idx === 0 ? "text-3xl md:text-5xl" : "text-2xl",
                        )}
                      >
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 font-medium leading-relaxed">
                        {article.excerpt}
                      </p>
                      {idx === 0 && (
                        <div className="pt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                          Por{" "}
                          <span className="text-foreground">
                            {article.author_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-12">
            <div className="bg-muted/30 p-8 rounded-[2.5rem] border border-primary/5 space-y-8 sticky top-24">
              <div className="flex items-center gap-2 text-primary border-b border-primary/5 pb-4">
                <TrendingUp className="h-5 w-5" />
                <h3 className="text-xl font-black italic uppercase tracking-tighter">
                  Más Leído
                </h3>
              </div>
              <div className="space-y-8">
                {topArticles.slice(0, 4).map((art, i) => (
                  <Link
                    key={art.id}
                    to={`/articulo/${art.slug}`}
                    className="group flex gap-4"
                  >
                    <span className="text-3xl font-black text-primary/10 italic shrink-0 group-hover:text-primary/30 transition-colors">
                      0{i + 1}
                    </span>
                    <div className="space-y-1">
                      <h4 className="font-bold uppercase tracking-tighter leading-tight text-sm group-hover:underline">
                        {art.title}
                      </h4>
                      <div className="text-[10px] font-black uppercase tracking-widest text-primary italic opacity-60">
                        {art.subcategory_name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="pt-8 border-t border-primary/5">
                <div className="bg-primary p-6 rounded-3xl text-primary-foreground space-y-4 shadow-xl shadow-primary/20 overflow-hidden relative group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                  <h4 className="text-lg font-black italic uppercase tracking-tighter leading-none relative z-10">
                    Suscríbete a {categoryName}
                  </h4>
                  <p className="text-[10px] opacity-80 leading-relaxed font-medium relative z-10">
                    Recibe alertas semanales con lo más relevante de este
                    sector.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full font-black italic uppercase tracking-tighter h-10 rounded-xl relative z-10 shadow-lg"
                  >
                    Únete ahora
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
