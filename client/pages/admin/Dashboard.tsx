import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminDashboard,
  selectDashboardStats,
  selectDashboardLoading,
} from "@/store/slices/adminDashboardSlice";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const user = useAppSelector(selectAdminUser);

  useEffect(() => {
    dispatch(fetchAdminDashboard());
  }, [dispatch]);

  const isAdmin = user?.role === "admin";

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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hola, {user?.name?.split(" ")[0] ?? "Admin"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aquí tienes un resumen de InteliNota
          </p>
        </div>
        <Button
          asChild
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
        >
          <Link to="/admin/articles/new">
            <PenSquare className="w-4 h-4 mr-2" />
            Nuevo artículo
          </Link>
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      {/* Content area */}
      <div className="grid lg:grid-cols-5 gap-6">
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
              className="text-xs text-muted-foreground h-7"
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
                <div
                  key={article.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors group"
                >
                  <span className="text-xs font-mono text-muted-foreground/50 w-5 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate group-hover:text-blue-400 transition-colors">
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
                </div>
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

          {/* Quick actions */}
          <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Acciones rápidas
            </h2>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start h-9 text-sm"
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
                className="w-full justify-start h-9 text-sm"
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
              className="w-full justify-start h-9 text-sm"
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
  );
}
