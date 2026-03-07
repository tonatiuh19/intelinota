import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  MessageCircle,
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  Bookmark,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchArticle,
  fetchArticles,
  clearCurrent,
  selectCurrentArticle,
  selectDetailLoading,
  selectDetailError,
  selectArticles,
} from "@/store/slices/articlesSlice";
import MetaHead from "@/components/MetaHead";

export default function Article() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();

  const article = useAppSelector(selectCurrentArticle);
  const loading = useAppSelector(selectDetailLoading);
  const error = useAppSelector(selectDetailError);
  const allArticles = useAppSelector(selectArticles);
  const related = allArticles.filter((a) => a.slug !== slug).slice(0, 3);

  useEffect(() => {
    if (slug) dispatch(fetchArticle(slug));
    if (allArticles.length === 0) dispatch(fetchArticles());
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
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

              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter leading-[0.85] uppercase text-white drop-shadow-2xl">
                {article.title}
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed italic font-medium max-w-3xl">
                {article.excerpt}
              </p>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-8 border-t border-primary/10">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20 p-0.5 bg-muted">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${article.author_name}`}
                    />
                    <AvatarFallback>{article.author_name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-black italic tracking-tighter uppercase text-lg">
                      {article.author_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2">
                      {publishedDate}{" "}
                      <span className="w-1 h-1 bg-muted-foreground rounded-full opacity-30" />{" "}
                      {article.read_time_minutes} min
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary"
                  >
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary"
                  >
                    <Facebook className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 hover:text-primary"
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </div>
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
          <div className="prose prose-invert prose-lg max-w-none prose-headings:font-black prose-headings:italic prose-headings:tracking-tighter prose-headings:uppercase prose-p:text-muted-foreground prose-p:leading-relaxed">
            <p>
              En un panorama en rápida evolución donde la inteligencia
              artificial se ha convertido en la piedra angular del avance
              tecnológico, el discurso ha cambiado. Ya no solo nos preguntamos
              qué puede hacer la IA, sino cómo transformará el tejido mismo de
              nuestra sociedad, industria y procesos cognitivos.
            </p>
            <p>
              Los recientes avances en sistemas neuro-simbólicos han
              proporcionado un puente entre las capacidades intuitivas de
              reconocimiento de patrones del aprendizaje profundo y el
              razonamiento lógico estructurado de la IA simbólica tradicional.
              Este enfoque híbrido promete no solo modelos más potentes, sino
              también más explicables y fiables.
            </p>

            <blockquote className="border-l-4 border-primary pl-6 py-4 my-8 italic text-2xl font-black tracking-tighter uppercase leading-tight bg-muted/30 rounded-r-xl pr-6">
              "La próxima década no se tratará de escala, se tratará de la
              razón. Necesitamos máquinas que no solo predigan el próximo token,
              sino que comprendan los principios subyacentes del mundo."
            </blockquote>

            <h2 className="text-3xl mt-12 mb-6">
              Rompiendo la Meseta de los LLM
            </h2>
            <p>
              Muchos investigadores sostienen que hemos llegado a un punto de
              rendimientos decrecientes con las simples leyes de escala. Añadir
              más parámetros o más datos ya no produce las mejoras exponenciales
              que vimos entre GPT-2 y GPT-3. En cambio, el enfoque se está
              desplazando hacia la eficiencia, el razonamiento y la interacción
              con el mundo real.
            </p>
            <img
              src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=1000"
              alt="Visualización de IA"
              className="rounded-2xl my-12 border border-primary/10 shadow-2xl"
            />
            <h2 className="text-3xl mt-12 mb-6">El Factor Humano</h2>
            <p>
              A medida que integramos estos sistemas en nuestros flujos de
              trabajo creativos y profesionales, el énfasis en el diseño
              centrado en el ser humano nunca ha sido más crítico. Intelinota
              permanece a la vanguardia de la documentación de esta transición,
              asegurando que nuestros lectores no sean solo testigos del cambio,
              sino participantes informados en la revolución digital.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-8">
            {[
              "Artificial Intelligence",
              "Future Tech",
              "Research",
              "Neuro-symbolic",
              "Innovation",
            ].map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="px-4 py-2 text-sm rounded-full font-bold uppercase tracking-tight italic bg-muted hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                #{tag}
              </Badge>
            ))}
          </div>

          <Separator className="my-12" />

          {/* Comments Section (Placeholder) */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                <MessageCircle className="h-6 w-6" />
                Comentarios (24)
              </h3>
              <Button
                variant="link"
                className="font-bold uppercase tracking-widest text-xs"
              >
                Ver todos
              </Button>
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
        <aside className="lg:col-span-4 space-y-12">
          <div className="bg-muted/30 p-8 rounded-2xl border border-primary/5 space-y-6 sticky top-24">
            <div className="flex items-center gap-2 text-primary mb-2">
              <TrendingUp className="h-5 w-5" />
              <h3 className="text-xl font-black italic uppercase tracking-tighter">
                Recomendado para ti
              </h3>
            </div>
            <div className="space-y-8">
              {related.map((art) => (
                <Link
                  key={art.id}
                  to={`/article/${art.slug}`}
                  className="group block space-y-3"
                >
                  <div className="aspect-[16/9] rounded-lg overflow-hidden">
                    <img
                      src={art.image_url ?? "/placeholder.jpg"}
                      alt={art.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                      {art.category_name}
                    </span>
                    <h4 className="font-bold leading-tight group-hover:underline uppercase text-sm tracking-tight">
                      {art.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {art.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest italic opacity-50">
                Perfil del Autor
              </h4>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {article.author_name} es periodista de tecnología e innovación
                  en InteliNota.
                </p>
                <Link to={`/author/${article.author_slug}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full font-bold uppercase tracking-tighter italic border border-primary/10 hover:bg-primary/5"
                  >
                    Ver todas las historias{" "}
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
