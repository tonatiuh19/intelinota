import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminArticles,
  fetchAdminArticleCounts,
  deleteAdminArticle,
  duplicateAdminArticle,
  bulkArchiveAdminArticles,
  selectAdminArticles,
  selectAdminArticlesPagination,
  selectAdminArticlesLoading,
  selectAdminArticlesError,
  selectAdminArticlesDeleteError,
  selectAdminArticleStatusCounts,
  selectAdminArticlesBulkWorking,
  selectAdminArticlesDuplicatingId,
} from "@/store/slices/adminArticlesSlice";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import { fetchHome, selectHomeCategories } from "@/store/slices/homeSlice";
import type { AdminArticle, ArticleStatus } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Plus,
  PenSquare,
  Search,
  MoreHorizontal,
  Edit,
  Archive,
  Copy,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  UserRound,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { STATUS_META, relativeTime } from "./articleMeta";

type StatusFilter = ArticleStatus | "all";

const STATUS_CHIPS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borradores" },
  { value: "in_review", label: "En revisión" },
  { value: "scheduled", label: "Programados" },
  { value: "published", label: "Publicados" },
  { value: "archived", label: "Archivados" },
];

function StatusPill({ status }: { status: ArticleStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
        meta.text,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <div className="relative h-14 w-20 sm:h-12 sm:w-16 flex-shrink-0 overflow-hidden rounded-lg bg-accent/50 border border-border">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

export default function AdminArticles() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const user = useAppSelector(selectAdminUser);
  const articles = useAppSelector(selectAdminArticles);
  const pagination = useAppSelector(selectAdminArticlesPagination);
  const loading = useAppSelector(selectAdminArticlesLoading);
  const listError = useAppSelector(selectAdminArticlesError);
  const deleteError = useAppSelector(selectAdminArticlesDeleteError);
  const counts = useAppSelector(selectAdminArticleStatusCounts);
  const bulkWorking = useAppSelector(selectAdminArticlesBulkWorking);
  const duplicatingId = useAppSelector(selectAdminArticlesDuplicatingId);
  const categories = useAppSelector(selectHomeCategories);

  const isAdmin = user?.role === "admin";
  const myAuthorId = user?.author_id ?? null;

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [status, setStatus] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "all",
  );
  const [category, setCategory] = useState(
    searchParams.get("category") ?? "all",
  );
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [mine, setMine] = useState(() => {
    const p = searchParams.get("mine");
    if (p != null) return p === "1";
    return user?.role === "author";
  });
  const [archiveIds, setArchiveIds] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // Only meaningful when we know who "me" is.
  const authorFilter = mine && myAuthorId != null ? myAuthorId : undefined;

  const load = useCallback(() => {
    const base = {
      search: debouncedSearch || undefined,
      category: category !== "all" ? category : undefined,
      author_id: authorFilter,
    };
    dispatch(
      fetchAdminArticles({
        ...base,
        page,
        // Admin "Mis artículos" is filtered client-side; fetch a bigger page.
        limit: authorFilter != null && isAdmin ? 100 : 20,
        status: status !== "all" ? status : undefined,
      }),
    );
    dispatch(fetchAdminArticleCounts(base));
  }, [dispatch, page, debouncedSearch, status, category, authorFilter, isAdmin]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    dispatch(fetchHome());
  }, [dispatch]);

  useEffect(() => {
    load();
    setSelected(new Set());
    const sp: Record<string, string> = {};
    if (page > 1) sp.page = String(page);
    if (debouncedSearch) sp.search = debouncedSearch;
    if (status !== "all") sp.status = status;
    if (category !== "all") sp.category = category;
    if (mine !== (user?.role === "author")) sp.mine = mine ? "1" : "0";
    setSearchParams(sp, { replace: true });
  }, [load, page, debouncedSearch, status, category, mine, user?.role, setSearchParams]);

  const editPath = (id: number) => `/admin/articles/${id}/edit`;

  const handleArchive = async () => {
    if (!archiveIds?.length) return;
    try {
      if (archiveIds.length === 1) {
        await dispatch(deleteAdminArticle(archiveIds[0])).unwrap();
      } else {
        await dispatch(bulkArchiveAdminArticles(archiveIds)).unwrap();
      }
    } catch (err) {
      logger.warn("Archive failed", err);
    } finally {
      setArchiveIds(null);
      setSelected(new Set());
      load();
    }
  };

  const handleDuplicate = async (id: number) => {
    setActionError(null);
    try {
      const newId = await dispatch(duplicateAdminArticle(id)).unwrap();
      navigate(editPath(newId));
    } catch (err) {
      logger.error("Duplicate failed", err);
      setActionError(
        typeof err === "string" ? err : "No se pudo duplicar el artículo",
      );
    }
  };

  const toggleSelected = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const selectable = useMemo(
    () => articles.filter((a) => a.status !== "archived"),
    [articles],
  );
  const allSelected =
    selectable.length > 0 && selectable.every((a) => selected.has(a.id));

  const hasFilters =
    !!debouncedSearch || status !== "all" || category !== "all";

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setPage(1);
  };

  const renderActions = (article: AdminArticle) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 flex-shrink-0 text-muted-foreground"
          aria-label={`Acciones para ${article.title}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {duplicatingId === article.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem asChild className="min-h-10">
          <Link to={editPath(article.id)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </DropdownMenuItem>
        {article.status === "published" && (
          <DropdownMenuItem asChild className="min-h-10">
            <a
              href={`/articulo/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver en sitio
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="min-h-10"
          disabled={duplicatingId != null}
          onSelect={() => handleDuplicate(article.id)}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicar como borrador
        </DropdownMenuItem>
        {article.status !== "archived" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-10 text-destructive focus:text-destructive"
              onSelect={() => setArchiveIds([article.id])}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archivar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-24 md:pb-0">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="kicker">Redacción</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground mt-1">
            Artículos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pagination
              ? `${(counts?.all ?? pagination.total).toLocaleString("es-MX")} ${mine ? "tuyos" : "en total"}`
              : " "}
          </p>
        </div>
        <Button
          asChild
          className="hidden md:inline-flex h-10 bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm"
        >
          <Link to="/admin/articles/new">
            <PenSquare className="w-4 h-4 mr-2" />
            Nuevo artículo
          </Link>
        </Button>
      </div>

      {listError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
            <span>{listError}</span>
            <Button variant="outline" className="h-10" onClick={load}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {(deleteError || actionError) && (
        <Alert variant="destructive">
          <AlertDescription>{actionError ?? deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Buscar por título o resumen…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-10 h-10 bg-card border-border"
              aria-label="Buscar artículos"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {myAuthorId != null && (
              <Button
                type="button"
                variant="outline"
                aria-pressed={mine}
                onClick={() => {
                  setMine((m) => !m);
                  setPage(1);
                }}
                className={cn(
                  "h-10 gap-2 flex-1 sm:flex-none",
                  mine &&
                    "border-brand/40 bg-brand/10 text-brand hover:bg-brand/15 hover:text-brand",
                )}
              >
                <UserRound className="h-4 w-4" />
                Mis artículos
              </Button>
            )}
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="h-10 flex-1 sm:w-44 sm:flex-none bg-card border-border"
                aria-label="Categoría"
              >
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status chips (deliberate horizontal scroll strip on mobile) */}
        <div
          role="tablist"
          aria-label="Filtrar por estado"
          className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STATUS_CHIPS.map((chip) => {
            const active = status === chip.value;
            const count = counts?.[chip.value];
            return (
              <button
                key={chip.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatus(chip.value);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 h-10 px-3.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
                )}
              >
                {chip.value !== "all" && (
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      STATUS_META[chip.value].dot,
                    )}
                    aria-hidden
                  />
                )}
                {chip.label}
                {count != null && (
                  <span
                    className={cn(
                      "tabular-nums text-xs",
                      active ? "text-background/70" : "text-muted-foreground/70",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk bar (desktop) */}
      {selected.size > 0 && (
        <div className="hidden md:flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2 animate-in fade-in-0 slide-in-from-top-1">
          <span className="text-sm font-medium text-foreground">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            className="h-10"
            onClick={() => setSelected(new Set())}
          >
            Deseleccionar
          </Button>
          <Button
            variant="outline"
            className="ml-auto h-10 gap-2 text-destructive hover:text-destructive"
            disabled={bulkWorking}
            onClick={() => setArchiveIds(Array.from(selected))}
          >
            {bulkWorking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archivar
          </Button>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:flex items-center gap-4 px-4 h-11 border-b border-border bg-accent/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="flex h-10 w-6 items-center justify-center">
            <Checkbox
              checked={allSelected}
              disabled={selectable.length === 0}
              onCheckedChange={(v) =>
                setSelected(
                  v ? new Set(selectable.map((a) => a.id)) : new Set(),
                )
              }
              aria-label="Seleccionar todos"
            />
          </div>
          <span className="w-16" />
          <span className="flex-1">Artículo</span>
          <span className="w-32">Estado</span>
          <span className="hidden lg:block w-20 text-right">Vistas</span>
          <span className="w-10" />
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 md:gap-4 px-4 py-3 border-b border-border last:border-0"
            >
              <Skeleton className="hidden md:block h-4 w-4 mx-1" />
              <Skeleton className="h-14 w-20 sm:h-12 sm:w-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="hidden md:block h-4 w-24" />
            </div>
          ))
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-brand/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-brand" />
            </div>
            {hasFilters ? (
              <>
                <p className="font-display text-lg text-foreground">
                  Nada coincide con estos filtros
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Prueba otra búsqueda o limpia los filtros.
                </p>
                <Button variant="outline" className="h-10" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              </>
            ) : (
              <>
                <p className="font-display text-lg text-foreground">
                  {mine ? "Aún no has escrito nada" : "Aún no hay artículos"}
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Tu próxima historia empieza con un título.
                </p>
                <Button
                  asChild
                  className="h-10 bg-brand hover:bg-brand/90 text-brand-foreground"
                >
                  <Link to="/admin/articles/new">
                    <PenSquare className="w-4 h-4 mr-2" />
                    Escribir el primero
                  </Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {articles.map((article) => {
              const isSelected = selected.has(article.id);
              return (
                <li
                  key={article.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(editPath(article.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(editPath(article.id));
                  }}
                  className={cn(
                    "group flex items-center gap-3 md:gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:bg-accent/40",
                    isSelected && "bg-brand/5",
                  )}
                >
                  <div
                    className="hidden md:flex h-10 w-6 items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={article.status === "archived"}
                      onCheckedChange={(v) => toggleSelected(article.id, !!v)}
                      aria-label={`Seleccionar ${article.title}`}
                    />
                  </div>

                  <Thumb src={article.image_url} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-[15px] font-medium leading-snug text-foreground line-clamp-2 break-words group-hover:text-brand transition-colors">
                      {article.title || "Sin título"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="md:hidden">
                        <StatusPill status={article.status} />
                      </span>
                      <span className="md:hidden" aria-hidden>
                        ·
                      </span>
                      <span title={new Date(article.updated_at).toLocaleString("es-MX")}>
                        {relativeTime(article.updated_at)}
                      </span>
                      {article.category_name && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate max-w-[10rem]">
                            {article.category_name}
                          </span>
                        </>
                      )}
                      {!mine && article.author_name && (
                        <>
                          <span aria-hidden className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline truncate max-w-[10rem]">
                            {article.author_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:block w-32">
                    <StatusPill status={article.status} />
                  </div>

                  <div className="hidden lg:flex w-20 items-center justify-end gap-1 text-xs text-muted-foreground tabular-nums">
                    <Eye className="w-3 h-3" />
                    {article.view_count.toLocaleString("es-MX")}
                  </div>

                  {renderActions(article)}
                </li>
              );
            })}
          </ul>
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
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="h-10 w-10"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={pagination.page === pagination.totalPages}
              className="h-10 w-10"
              aria-label="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        to="/admin/articles/new"
        aria-label="Nuevo artículo"
        className="md:hidden fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-brand-foreground shadow-lg shadow-brand/30 active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5" />
        <span className="text-sm font-semibold">Nuevo</span>
      </Link>

      {/* Archive confirm */}
      <AlertDialog
        open={archiveIds != null}
        onOpenChange={(open) => !open && setArchiveIds(null)}
      >
        <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveIds && archiveIds.length > 1
                ? `¿Archivar ${archiveIds.length} artículos?`
                : "¿Archivar este artículo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de ser visible en el sitio. Puedes volver a publicarlo
              editándolo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="h-10 bg-destructive hover:bg-destructive/90"
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
