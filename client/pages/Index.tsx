import { Link } from "react-router-dom";
import {
  ArrowRight,
  TrendingUp,
  Clock,
  ChevronRight,
  Play,
  Hash,
  MessageSquare,
  Twitter,
  Instagram,
  Linkedin,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchHome,
  selectHomeFeatured,
  selectHomeArticles,
  selectHomeTrending,
  selectHomeLoading,
  selectHomeMeta,
} from "@/store/slices/homeSlice";
import type { Article } from "@shared/api";
import MetaHead from "@/components/MetaHead";

export default function Index() {
  const dispatch = useAppDispatch();

  const featured = useAppSelector(selectHomeFeatured);
  const articles = useAppSelector(selectHomeArticles);
  const trending = useAppSelector(selectHomeTrending);
  const loading = useAppSelector(selectHomeLoading);
  const meta = useAppSelector(selectHomeMeta);

  const heroArticles = featured.length > 0 ? featured : articles.slice(0, 6);

  const techArticles = articles.filter((a) => a.category_name === "Tecnología");
  const gamingArticles = articles.filter(
    (a) => a.category_name === "Videojuegos",
  );
  const cinemaArticles = articles.filter((a) => a.category_name === "Cine");
  const mundoArticles = articles.filter((a) => a.category_name === "Mundo");

  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const autoRotateTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    dispatch(fetchHome());
  }, [dispatch]);

  useEffect(() => {
    if (!isHovering) {
      autoRotateTimer.current = setInterval(() => {
        setActiveHeroIndex(
          (prev) => (prev + 1) % Math.max(heroArticles.length, 1),
        );
      }, 5000);
    }
    return () => {
      if (autoRotateTimer.current) clearInterval(autoRotateTimer.current);
    };
  }, [isHovering, heroArticles.length]);

  useEffect(() => {
    if (heroArticles.length > 0 && activeHeroIndex >= heroArticles.length) {
      setActiveHeroIndex(0);
    }
  }, [heroArticles.length, activeHeroIndex]);

  return (
    <div className="space-y-12 pb-16">
      <MetaHead
        title={null}
        description={meta?.description}
        keywords={meta?.keywords}
        ogTitle={meta?.og_title}
        ogDescription={meta?.og_description}
        ogImage={meta?.og_image}
        canonical={meta?.canonical_url}
      />
      {/* Feature Slate Hero */}
      <section
        className="container px-4 sm:px-6 lg:px-8 mt-6"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {loading && heroArticles.length === 0 ? (
          <Skeleton className="h-[650px] w-full rounded-[2rem]" />
        ) : heroArticles.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-1 h-[800px] md:h-[600px] lg:h-[650px] overflow-hidden rounded-[2rem] border border-primary/10 shadow-2xl shadow-black/50 bg-black">
            {/* Main Stage (Left) */}
            <div className="lg:col-span-8 relative overflow-hidden group bg-black">
              {heroArticles.map((article, idx) => (
                <div
                  key={article.id}
                  className={cn(
                    "absolute inset-0 transition-all duration-1000 ease-in-out",
                    activeHeroIndex === idx
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-105 pointer-events-none",
                  )}
                >
                  <img
                    src={article.image_url ?? "/placeholder.jpg"}
                    alt={article.title}
                    className="h-full w-full object-cover grayscale-[20%]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

                  {/* Content Overlay */}
                  <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end">
                    <div
                      className={cn(
                        "max-w-2xl space-y-4 transition-all duration-700 delay-300 transform",
                        activeHeroIndex === idx
                          ? "translate-y-0 opacity-100"
                          : "translate-y-10 opacity-0",
                      )}
                    >
                      <Badge className="bg-primary/90 hover:bg-primary text-xs font-black uppercase tracking-[0.2em] italic px-4 py-1 rounded-full mb-2">
                        {article.category_name}
                      </Badge>
                      <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter leading-[0.85] text-white uppercase drop-shadow-2xl">
                        {article.title}
                      </h1>
                      <p className="text-white/80 text-lg line-clamp-2 font-medium leading-relaxed max-w-xl">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center gap-6 pt-4">
                        <Link to={`/article/${article.slug}`}>
                          <Button
                            size="lg"
                            className="rounded-full px-8 font-black italic uppercase tracking-tighter group h-14 text-lg"
                          >
                            Leer más
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                        <div className="flex items-center gap-2 text-white/50 text-sm font-bold uppercase tracking-widest">
                          <Clock className="h-4 w-4" />
                          {article.read_time_minutes} min
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Index (Right) */}
            <div className="lg:col-span-4 bg-muted/30 flex flex-col divide-y divide-primary/5">
              {heroArticles.map((article, idx) => (
                <button
                  key={article.id}
                  onClick={() => setActiveHeroIndex(idx)}
                  onMouseEnter={() => setActiveHeroIndex(idx)}
                  className={cn(
                    "flex-1 flex items-center gap-4 px-6 text-left transition-all relative group overflow-hidden",
                    activeHeroIndex === idx
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-primary/5 text-muted-foreground",
                  )}
                >
                  {/* Progress Bar Background */}
                  {activeHeroIndex === idx && !isHovering && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 origin-left"
                      style={{
                        animation: "progress 5s linear forwards",
                      }}
                    />
                  )}

                  <span
                    className={cn(
                      "text-2xl font-black italic tracking-tighter transition-colors",
                      activeHeroIndex === idx
                        ? "text-primary-foreground/20"
                        : "text-muted-foreground/10",
                    )}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>

                  <div className="flex-1 min-w-0 py-4">
                    <div
                      className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] mb-1 italic",
                        activeHeroIndex === idx
                          ? "text-primary-foreground/70"
                          : "text-primary",
                      )}
                    >
                      {article.subcategory_name}
                    </div>
                    <h3
                      className={cn(
                        "font-bold uppercase tracking-tighter leading-none text-sm md:text-base line-clamp-2 transition-transform duration-300",
                        activeHeroIndex === idx
                          ? "translate-x-1"
                          : "group-hover:translate-x-1",
                      )}
                    >
                      {article.title}
                    </h3>
                  </div>

                  {activeHeroIndex === idx && (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="container grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-12">
          {/* Breaking News Tick / Carousel (Simulated) */}
          <div className="bg-primary/5 rounded-3xl p-4 border border-primary/20 flex items-center gap-4 shadow-xl shadow-black/10">
            <Badge
              variant="outline"
              className="bg-primary text-primary-foreground border-none font-black italic uppercase shrink-0 px-4 py-1 rounded-full animate-pulse"
            >
              ÚLTIMA HORA
            </Badge>
            <p className="text-sm font-black italic uppercase tracking-tight text-primary/80 animate-in fade-in slide-in-from-right-4 duration-1000">
              Nuevos avances en la regulación de la IA propuestos por la
              coalición tecnológica global.
            </p>
          </div>

          {/* More Stories Grid */}
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">
                Más Historias
              </h2>
              <Button variant="ghost" className="group">
                Ver todo{" "}
                <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            {loading && articles.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>

          {/* Section: Tecnología */}
          {techArticles.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">
                  Tecnología
                </h2>
                <Link to="/category/technology">
                  <Button variant="ghost" className="group">
                    Explorar{" "}
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {techArticles.map((article) => (
                  <ArticleHorizontalCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          )}

          {/* Section: Videojuegos & Esports */}
          {gamingArticles.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">
                  Videojuegos
                </h2>
                <Link to="/category/video-games">
                  <Button variant="ghost" className="group">
                    Entrar al Lobby{" "}
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gamingArticles.slice(0, 2).map((article) => (
                  <Link
                    key={article.id}
                    to={`/article/${article.slug}`}
                    className="group relative overflow-hidden rounded-3xl aspect-[16/10] bg-black"
                  >
                    <img
                      src={article.image_url ?? "/placeholder.jpg"}
                      alt={article.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute inset-0 p-6 flex flex-col justify-end">
                      <Badge className="bg-primary/90 text-[10px] font-black uppercase tracking-widest italic w-fit mb-2">
                        {article.subcategory_name}
                      </Badge>
                      <h3 className="text-xl font-black italic tracking-tighter leading-none text-white uppercase group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Section: Cine & Series */}
          {cinemaArticles.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">
                  Cine & Series
                </h2>
                <Link to="/category/cinema">
                  <Button variant="ghost" className="group">
                    Ver cartelera{" "}
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="relative rounded-[2rem] overflow-hidden group aspect-[21/9] min-h-[300px]">
                {cinemaArticles.slice(0, 1).map((article) => (
                  <Link
                    key={article.id}
                    to={`/article/${article.slug}`}
                    className="block h-full"
                  >
                    <img
                      src={article.image_url ?? "/placeholder.jpg"}
                      alt={article.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform [transition-duration:2000ms] group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4">
                      <Badge className="bg-primary hover:bg-primary font-black italic uppercase tracking-[0.3em] px-6 py-1.5 rounded-full shadow-2xl animate-pulse">
                        Estreno Destacado
                      </Badge>
                      <h3 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase text-white drop-shadow-2xl">
                        {article.title}
                      </h3>
                      <Button
                        variant="secondary"
                        className="rounded-full px-10 font-black italic uppercase tracking-tighter h-12 shadow-2xl"
                      >
                        Ver análisis <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Section: Mundo & Ciencia */}
          {mundoArticles.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">
                  Mundo & Ciencia
                </h2>
                <Link to="/category/world-news">
                  <Button variant="ghost" className="group">
                    Global News{" "}
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {mundoArticles.slice(0, 3).map((article) => (
                  <Link
                    key={article.id}
                    to={`/article/${article.slug}`}
                    className="group space-y-3"
                  >
                    <div className="aspect-square rounded-2xl overflow-hidden bg-muted border border-primary/5 shadow-lg shadow-black/20">
                      <img
                        src={article.image_url ?? "/placeholder.jpg"}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                    <h4 className="font-black italic tracking-tighter uppercase leading-tight text-sm md:text-base group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-12">
          {/* Trending Section */}
          <div className="bg-muted/30 rounded-2xl p-6 border border-primary/5 space-y-6">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              <h3 className="text-xl font-black italic uppercase tracking-tighter">
                Tendencias
              </h3>
            </div>
            <div className="space-y-6">
              {trending.map((article, idx) => (
                <Link
                  key={article.id}
                  to={`/article/${article.slug}`}
                  className="group block"
                >
                  <div className="flex gap-4">
                    <span className="text-4xl font-black text-muted-foreground/20 italic group-hover:text-primary/40 transition-colors">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {article.category_name}
                      </span>
                      <h4 className="font-bold leading-tight group-hover:underline group-hover:underline-offset-2 uppercase text-sm">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {article.read_time_minutes} min
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Newsletter / CTA */}
          <div className="bg-primary p-8 rounded-[2.5rem] text-primary-foreground space-y-4 shadow-2xl shadow-primary/20">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
              Recibe Intelinota <br /> en tu correo
            </h3>
            <p className="text-sm opacity-90 leading-relaxed font-medium">
              El resumen de noticias más inteligente. Únete a más de 50,000
              mentes curiosas.
            </p>
            <div className="space-y-3 pt-2">
              <input
                placeholder="Dirección de correo"
                className="w-full bg-white/10 border-white/20 rounded-2xl px-5 py-3 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
              />
              <Button
                variant="secondary"
                className="w-full font-black italic uppercase tracking-tighter h-12 rounded-2xl shadow-xl"
              >
                Suscríbete ahora
              </Button>
            </div>
          </div>

          {/* New Section: Popular Tags */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-primary border-b pb-4">
              <Hash className="h-5 w-5" />
              <h3 className="text-xl font-black italic uppercase tracking-tighter">
                Temas Calientes
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Inteligencia Artificial",
                "Champions League",
                "Cyberpunk 2077",
                "Web3",
                "Sostenibilidad",
                "Metaverso",
                "Espacio",
                "Gadgets",
                "Esports",
                "Cine de Autor",
              ].map((tag) => (
                <Link
                  key={tag}
                  to={`/search?q=${tag}`}
                  className="px-4 py-2 bg-muted/50 rounded-full text-xs font-bold uppercase tracking-widest italic hover:bg-primary hover:text-primary-foreground transition-all border border-primary/5 shadow-sm"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>

          {/* New Section: Community / Recent Comments */}
          <div className="bg-muted/30 rounded-[2.5rem] p-8 border border-primary/5 space-y-6">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquare className="h-5 w-5" />
              <h3 className="text-xl font-black italic uppercase tracking-tighter">
                Comunidad
              </h3>
            </div>
            <div className="space-y-6">
              {[
                {
                  user: "Carlos G.",
                  text: "La IA neuro-simbólica realmente es el camino a seguir. Gran artículo.",
                  article: "El Futuro de la IA",
                },
                {
                  user: "Marina R.",
                  text: "Espero que la nueva generación de tenistas mantenga el nivel del Big Three.",
                  article: "Revolución en el Tenis",
                },
                {
                  user: "Santi V.",
                  text: "Nebula es increíble, los indies siempre sorprenden.",
                  article: "Juego Indie del Año",
                },
              ].map((comment, i) => (
                <div key={i} className="space-y-2 group cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 ring-1 ring-primary/20">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user}`}
                      />
                      <AvatarFallback>{comment.user[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] font-black uppercase italic tracking-widest text-primary">
                      {comment.user}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic group-hover:text-foreground transition-colors">
                    "{comment.text}"
                  </p>
                  <div className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">
                    En: {comment.article}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Section: Social Media */}
          <div className="space-y-6 pb-6">
            <h3 className="text-sm font-black italic uppercase tracking-[0.3em] text-center opacity-30">
              Síguenos en las redes
            </h3>
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="rounded-2xl h-12 w-12 border-primary/10 bg-muted/20 hover:bg-primary hover:text-primary-foreground transition-all shadow-lg hover:-translate-y-1"
              >
                <Twitter className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-2xl h-12 w-12 border-primary/10 bg-muted/20 hover:bg-primary hover:text-primary-foreground transition-all shadow-lg hover:-translate-y-1"
              >
                <Instagram className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-2xl h-12 w-12 border-primary/10 bg-muted/20 hover:bg-primary hover:text-primary-foreground transition-all shadow-lg hover:-translate-y-1"
              >
                <Linkedin className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-2xl h-12 w-12 border-primary/10 bg-muted/20 hover:bg-primary hover:text-primary-foreground transition-all shadow-lg hover:-translate-y-1"
              >
                <Zap className="h-5 w-5 fill-current" />
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const dateStr = article.published_at
    ? new Date(article.published_at).toLocaleDateString("es-MX")
    : "";
  return (
    <Link to={`/article/${article.slug}`} className="group block space-y-4">
      <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-muted relative border border-primary/5">
        <img
          src={article.image_url ?? "/placeholder.jpg"}
          alt={article.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[10%] group-hover:grayscale-0"
        />
        <div className="absolute top-4 left-4">
          <Badge className="bg-black/80 text-white border-none backdrop-blur-md font-black italic uppercase text-[10px] tracking-widest px-3 py-1 rounded-full">
            {article.subcategory_name}
          </Badge>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="space-y-2 px-1">
        <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">
          {article.category_name}
          <span className="w-1 h-1 rounded-full bg-muted-foreground opacity-30" />
          {dateStr}
        </div>
        <h3 className="text-xl font-black italic tracking-tighter leading-none uppercase group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 font-medium leading-relaxed">
          {article.excerpt}
        </p>
      </div>
    </Link>
  );
}

function ArticleHorizontalCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/article/${article.slug}`}
      className="group flex flex-col md:flex-row gap-6 p-4 rounded-3xl hover:bg-muted transition-all border border-transparent hover:border-primary/10"
    >
      <div className="md:w-1/3 aspect-[16/9] overflow-hidden rounded-2xl shrink-0 border border-primary/5 shadow-xl shadow-black/20">
        <img
          src={article.image_url ?? "/placeholder.jpg"}
          alt={article.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      </div>
      <div className="flex flex-col justify-center space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">
          {article.subcategory_name}
        </div>
        <h3 className="text-xl md:text-2xl font-black italic tracking-tighter leading-none uppercase group-hover:text-primary transition-colors">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 font-medium leading-relaxed">
          {article.excerpt}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest pt-1">
          <span className="text-foreground">Por {article.author_name}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground opacity-30" />
          <span>{article.read_time_minutes} min</span>
        </div>
      </div>
    </Link>
  );
}
