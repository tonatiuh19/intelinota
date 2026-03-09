import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminArticles,
  deleteAdminArticle,
  selectAdminArticles,
  selectAdminArticlesPagination,
  selectAdminArticlesLoading,
} from "@/store/slices/adminArticlesSlice";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PenSquare,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_MAP = {
  published: {
    label: "Publicado",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  draft: {
    label: "Borrador",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  archived: {
    label: "Archivado",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
} as const;

export default function AdminArticles() {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const articles = useAppSelector(selectAdminArticles);
  const pagination = useAppSelector(selectAdminArticlesPagination);
  const loading = useAppSelector(selectAdminArticlesLoading);
  const user = useAppSelector(selectAdminUser);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(() => {
    const params: Record<string, string | number> = { page, limit: 20 };
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    dispatch(fetchAdminArticles(params));
  }, [dispatch, page, search, status]);

  useEffect(() => {
    load();
    // Sync URL
    const sp: Record<string, string> = { page: String(page) };
    if (search) sp.search = search;
    if (status !== "all") sp.status = status;
    setSearchParams(sp, { replace: true });
  }, [load, page, search, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    await dispatch(deleteAdminArticle(deleteId));
    setDeleteId(null);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Artículos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {pagination
              ? `${pagination.total.toLocaleString()} artículos en total`
              : ""}
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 min-w-56 max-w-sm relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar artículos…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-accent/40 border-border h-9"
          />
        </form>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36 bg-accent/40 border-border h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
            <SelectItem value="archived">Archivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border bg-accent/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Artículo</span>
          <span className="hidden md:block">Categoría</span>
          <span className="hidden sm:block">Estado</span>
          <span className="hidden lg:block">Vistas</span>
          <span></span>
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="hidden md:block h-5 w-20" />
              <Skeleton className="hidden sm:block h-5 w-16" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <FileText className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm">No se encontraron artículos</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/articles/new">Crear el primero</Link>
            </Button>
          </div>
        ) : (
          articles.map((article) => {
            const statusInfo = STATUS_MAP[article.status] ?? STATUS_MAP.draft;
            return (
              <div
                key={article.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-border last:border-0 hover:bg-accent/20 transition-colors group"
              >
                {/* Title + author */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">
                    {article.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {article.author_name}
                    {article.published_at &&
                      ` · ${new Date(article.published_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                </div>

                {/* Category */}
                <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                  {article.category_name}
                </span>

                {/* Status */}
                <Badge
                  variant="outline"
                  className={cn("hidden sm:flex text-xs", statusInfo.className)}
                >
                  {statusInfo.label}
                </Badge>

                {/* Views */}
                <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <Eye className="w-3 h-3" />
                  {article.view_count.toLocaleString()}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link to={`/admin/articles/${article.id}/edit`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    {article.status === "published" && (
                      <DropdownMenuItem asChild>
                        <a
                          href={`/articulo/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ver en sitio
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteId(article.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Archivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={pagination.page === pagination.totalPages}
              className="h-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar este artículo?</AlertDialogTitle>
            <AlertDialogDescription>
              El artículo cambiará a estado "archivado" y dejará de ser visible
              en el sitio. Puedes volver a publicarlo editándolo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
