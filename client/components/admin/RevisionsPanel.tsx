import { useEffect } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchRevisions, restoreRevision } from "@/store/slices/revisionsSlice";
import { useToast } from "@/hooks/use-toast";
import { formatRelative, formatDate } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicado",
  scheduled: "Programado",
  archived: "Archivado",
};

/** Version history for an article with one-click restore. */
export default function RevisionsPanel({
  articleId,
  onRestored,
}: {
  articleId: number;
  onRestored: () => void;
}) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { items, loading, restoringId, error } = useAppSelector((s) => s.revisions);

  useEffect(() => {
    dispatch(fetchRevisions(articleId));
  }, [dispatch, articleId]);

  const restore = async (revisionId: number) => {
    const result = await dispatch(restoreRevision({ articleId, revisionId }));
    if (restoreRevision.fulfilled.match(result)) {
      toast({ title: "Versión restaurada" });
      onRestored();
    } else {
      toast({ title: "No se pudo restaurar", description: String(result.payload ?? ""), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4" /> Historial de versiones
      </h3>
      {loading && !items.length && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!loading && !items.length && !error && (
        <p className="text-xs text-muted-foreground">Aún no hay versiones guardadas.</p>
      )}
      <ol className="max-h-72 space-y-1 overflow-y-auto">
        {items.map((rev, i) => (
          <li key={rev.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" title={rev.title}>
                {i === 0 ? "Actual · " : ""}
                {STATUS_LABEL[rev.status] ?? rev.status}
              </p>
              <p className="truncate text-[11px] text-muted-foreground" title={formatDate(rev.created_at, { dateStyle: "medium", timeStyle: "short" })}>
                {formatRelative(rev.created_at)} · {rev.user_name ?? rev.user_email ?? "Sistema"}
              </p>
            </div>
            {i > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label="Restaurar esta versión"
                    disabled={restoringId != null}
                  >
                    {restoringId === rev.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Restaurar esta versión?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se reemplazará el contenido actual con la versión del{" "}
                      {formatDate(rev.created_at, { dateStyle: "medium", timeStyle: "short" })}. La versión
                      actual quedará guardada en el historial.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => restore(rev.id)}>Restaurar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
