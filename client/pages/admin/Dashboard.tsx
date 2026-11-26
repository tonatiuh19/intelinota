import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminDashboard,
  selectDashboardStats,
  selectDashboardLoading,
  selectDashboardError,
  fetchWriterOverview,
  selectWriterOverview,
  selectWriterLoading,
  selectWriterError,
} from "@/store/slices/adminDashboardSlice";
import { STATUS_META, relativeTime, shortDateTime } from "./articleMeta";
import { cn } from "@/lib/utils";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Eye,
  Users,
  Radio,
  TrendingUp,
  PenSquare,
  ArrowRight,
  BookOpen,
  Archive,
  Layers,
  CalendarClock,
  Clock,
  Send,
  Sparkles,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3 hover:bg-card/80 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="text-2xl sm:text-3xl font-bold text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectDashboardStats);
  const loading = useAppSelector(selectDashboardLoading);
  const error = useAppSelector(selectDashboardError);
  const user = useAppSelector(selectAdminUser);
  const writer = useAppSelector(selectWriterOverview);
  const writerLoading = useAppSelector(selectWriterLoading);
  const writerError = useAppSelector(selectWriterError);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    dispatch(fetchWriterOverview());
    if (isAdmin) dispatch(fetchAdminDashboard());
  }, [dispatch, isAdmin]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.name?.split(" ")[0] ?? "";
  const wLoading = writerLoading && !writer;

  const statCards = [
    {
      label: "Total artículos",
      value: stats?.total_articles ?? 0,
      icon: FileText,
      accent: "bg-blue-500/10 border border-blue-500/20 text-blue-400",
    },
    {
      label: "Publicados",
      value: stats?.published_articles ?? 0,
      icon: BookOpen,
      accent: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
    },
    {
      label: "Borradores",
      value: stats?.draft_articles ?? 0,
      icon: Layers,
      accent: "bg-amber-500/10 border border-amber-500/20 text-amber-400",
    },
    {
      label: "Total vistas",
      value: stats?.total_views ?? 0,
      icon: Eye,
      accent: "bg-purple-500/10 border border-purple-500/20 text-purple-400",
    },
    ...(isAdmin
      ? [
          {
            label: "Autores",
            value: stats?.total_authors ?? 0,
            icon: Users,
            accent: "bg-pink-500/10 border border-pink-500/20 text-pink-400",
          },
          {
            label: "Visitas (30d)",
            value: stats?.total_visitors_30d ?? 0,
            icon: Radio,
            accent: "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400",
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* Greeting + CTA */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
        <div className="flex-1 min-w-0">
          <p className="kicker">
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="font-display text-2xl sm:text-4xl font-semibold text-foreground mt-2 leading-tight">
            {greeting}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-2">
            ¿Qué historia vamos a contar hoy?
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="h-12 sm:h-14 px-6 text-base bg-brand hover:bg-brand/90 text-brand-foreground shadow-lg shadow-brand/20 w-full sm:w-auto"
        >
          <Link to="/admin/articles/new">
            <PenSquare className="w-5 h-5 mr-2" />
            Escribir nuevo
          </Link>
        </Button>
      </section>

      {writerError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
            <span>{writerError}</span>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => dispatch(fetchWriterOverview())}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Mis números */}
      <section className="space-y-3">
        <h2 className="kicker">Mis números</h2>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-3">
          {[
            {
              label: "Publicados",
              value: writer?.publishedCount ?? 0,
              icon: BookOpen,
              tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
              to: "/admin/articles?status=published&mine=1",
            },
            {
              label: "Vistas totales",
              value: writer?.totalViews ?? 0,
              icon: Eye,
              tone: "text-brand bg-brand/10",
              to: "/admin/articles?status=published&mine=1",
            },
            {
              label: "En revisión",
              value: writer?.inReviewCount ?? 0,
              icon: Send,
              tone: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
              to: "/admin/articles?status=in_review&mine=1",
            },
          ].map(({ label, value, icon: Icon, tone, to }) => (
            <Link
              key={label}
              to={to}
              className="rounded-xl border border-border bg-card p-4 flex min-[400px]:flex-col items-center min-[400px]:items-start gap-3 hover:border-brand/40 transition-colors"
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  tone,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                {wLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="font-display text-2xl sm:text-3xl font-semibold text-foreground tabular-nums">
                    {value.toLocaleString("es-MX")}
                    {writer && !writer.exact && "+"}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">
                  {label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Continuar escribiendo */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 h-14 border-b border-border">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              Continuar escribiendo
            </h2>
            <Button
              asChild
              variant="ghost"
              className="h-10 text-xs text-muted-foreground"
            >
              <Link to="/admin/articles?status=draft&mine=1">
                Borradores <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
          {wLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              ))}
            </div>
          ) : writer?.recentDrafts.length ? (
            <ul className="divide-y divide-border">
              {writer.recentDrafts.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/admin/articles/${a.id}/edit`}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-14 hover:bg-accent/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-brand transition-colors">
                        {a.title || "Sin título"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Editado {relativeTime(a.updated_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center space-y-2">
              <Sparkles className="h-6 w-6 text-brand mx-auto" />
              <p className="text-sm text-muted-foreground">
                No tienes borradores pendientes. ¡Empieza uno nuevo!
              </p>
            </div>
          )}
        </section>

        {/* Programados */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 h-14 border-b border-border">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-brand" />
              Programados
            </h2>
            <Button
              asChild
              variant="ghost"
              className="h-10 text-xs text-muted-foreground"
            >
              <Link to="/admin/articles?status=scheduled">
                Ver todos <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
          {wLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : writer?.scheduled.length ? (
            <ul className="divide-y divide-border">
              {writer.scheduled.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/admin/articles/${a.id}/edit`}
                    className="flex items-start gap-3 px-4 sm:px-5 py-3 min-h-14 hover:bg-accent/40 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-14 text-center rounded-lg bg-brand/10 py-1.5">
                      <div className="text-[10px] uppercase font-semibold text-brand leading-none">
                        {a.published_at
                          ? new Date(a.published_at).toLocaleDateString("es-MX", { month: "short" })
                          : "—"}
                      </div>
                      <div className="font-display text-lg font-semibold text-foreground leading-tight">
                        {a.published_at ? new Date(a.published_at).getDate() : "?"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-brand transition-colors">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className={STATUS_META.scheduled.text}>
                          {shortDateTime(a.published_at)}
                        </span>
                        {a.published_at && ` · ${relativeTime(a.published_at)}`}
                        {isAdmin && a.author_name && ` · ${a.author_name}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nada programado por ahora.
            </div>
          )}
        </section>
      </div>

      {isAdmin && (
        <div className="pt-4 border-t border-border space-y-6">
          <div>
            <p className="kicker">Toda la redacción</p>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground mt-1">
              Resumen del sitio
            </h2>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
                <span>{error}</span>
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => dispatch(fetchAdminDashboard())}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} loading={loading} />
            ))}
          </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top articles */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Artículos más vistos
              </h2>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-10"
            >
              <Link to="/admin/articles">
                Ver todos <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-12 ml-auto" />
                </div>
              ))
            ) : stats?.top_articles?.length ? (
              stats.top_articles.map((article, i) => (
                <Link
                  key={article.id}
                  to={`/admin/articles/${article.id}/edit`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors group"
                >
                  <span className="text-xs font-mono text-muted-foreground/50 w-5 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate group-hover:text-brand transition-colors">
                      {article.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {article.category_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Eye className="w-3 h-3" />
                    {article.view_count.toLocaleString()}
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                No hay datos aún
              </div>
            )}
          </div>
        </div>

        {/* Quick status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Estado de contenido
            </h2>
            <div className="space-y-3">
              {[
                {
                  label: "Publicados",
                  value: stats?.published_articles ?? 0,
                  total: stats?.total_articles ?? 1,
                  color: "bg-emerald-500",
                  badge:
                    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                },
                {
                  label: "Borradores",
                  value: stats?.draft_articles ?? 0,
                  total: stats?.total_articles ?? 1,
                  color: "bg-amber-500",
                  badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                },
                {
                  label: "Archivados",
                  value: stats?.archived_articles ?? 0,
                  total: stats?.total_articles ?? 1,
                  color: "bg-zinc-500",
                  badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                },
              ].map(({ label, value, total, color, badge }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono ${badge}`}
                    >
                      {loading ? "…" : value}
                    </Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${color}`}
                      style={{
                        width: loading
                          ? "0%"
                          : `${Math.round((value / Math.max(total, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {stats?.views_by_day?.length ? (
            <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Visitas (30 días)
              </h2>
              <div className="flex items-end gap-1 h-24">
                {stats.views_by_day.slice(-14).map((day) => {
                  const max = Math.max(
                    ...stats.views_by_day.slice(-14).map((d) => d.count),
                    1,
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex-1 bg-blue-500/40 rounded-t-sm min-w-[4px]"
                      style={{ height: `${Math.max(8, (day.count / max) * 100)}%` }}
                      title={`${day.date}: ${day.count}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Quick actions */}
          <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Acciones rápidas
            </h2>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-10 text-sm"
            >
              <Link to="/admin/articles/new">
                <PenSquare className="w-4 h-4 mr-2 text-blue-400" />
                Escribir nuevo artículo
              </Link>
            </Button>
            {isAdmin && (
              <Button
                asChild
                variant="outline"
                className="w-full justify-start h-10 text-sm"
              >
                <Link to="/admin/authors">
                  <Users className="w-4 h-4 mr-2 text-pink-400" />
                  Gestionar autores
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-10 text-sm"
            >
              <Link to="/admin/articles?status=draft">
                <Archive className="w-4 h-4 mr-2 text-amber-400" />
                Ver borradores
              </Link>
            </Button>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
}
