import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MetaHead from "@/components/MetaHead";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAuditLog } from "@/store/slices/adminAuditSlice";
import { formatDate, formatRelative } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  "article.create": "creó el artículo",
  "article.update": "editó el artículo",
  "article.archive": "archivó el artículo",
  "article.restore": "restauró una versión de",
  "article.status.published": "publicó",
  "article.status.in_review": "envió a revisión",
  "article.status.draft": "guardó como borrador",
  "article.status.scheduled": "programó",
  "article.status.archived": "archivó",
  "article.pending_edit": "propuso cambios a",
  "article.review.published": "aprobó y publicó",
  "article.review.approved": "aprobó y programó",
  "article.review.returned": "devolvió al autor",
  "article.revision.approved": "aplicó cambios propuestos a",
  "article.revision.rejected": "rechazó cambios propuestos a",
  "author.can_publish.grant": "dio permiso de publicar al autor",
  "author.can_publish.revoke": "quitó permiso de publicar al autor",
  "comment.approved": "aprobó un comentario",
  "comment.spam": "marcó como spam un comentario",
  "comment.bulk.approve": "aprobó comentarios",
  "comment.bulk.spam": "marcó comentarios como spam",
  "comment.bulk.pending": "devolvió comentarios a pendientes",
  "comment.bulk.delete": "eliminó comentarios",
  "comment.reply": "respondió un comentario",
  "comment.pending": "devolvió a pendiente un comentario",
};

export default function AdminActivity() {
  const dispatch = useAppDispatch();
  const { items, pagination, loading, error } = useAppSelector((s) => s.adminAudit);
  const page = pagination?.page ?? 1;

  useEffect(() => {
    dispatch(fetchAuditLog(1));
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <MetaHead title="Actividad" noIndex includeSiteOrganization={false} />
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Actividad</h1>
        <p className="text-sm text-muted-foreground">
          Registro de acciones del equipo editorial.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading && !items.length ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Sin actividad registrada.</p>
        ) : (
          <ol className="divide-y">
            {items.map((e) => {
              const title = typeof e.details?.title === "string" ? e.details.title : null;
              return (
                <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">{e.user_name ?? e.user_email ?? "Sistema"}</span>{" "}
                    <span className="text-muted-foreground">{ACTION_LABELS[e.action] ?? e.action}</span>{" "}
                    {e.entity_type === "article" && e.entity_id ? (
                      <Link to={`/admin/articles/${e.entity_id}/edit`} className="font-medium hover:underline">
                        {title ?? `#${e.entity_id}`}
                      </Link>
                    ) : e.entity_id ? (
                      <span className="text-muted-foreground">#{e.entity_id}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{e.entity_type}</Badge>
                    <time
                      dateTime={e.created_at}
                      title={formatDate(e.created_at, { dateStyle: "medium", timeStyle: "short" })}
                      className="text-xs text-muted-foreground"
                    >
                      {formatRelative(e.created_at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            disabled={page <= 1 || loading}
            onClick={() => dispatch(fetchAuditLog(page - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => dispatch(fetchAuditLog(page + 1))}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
