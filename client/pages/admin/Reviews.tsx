import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  Loader2,
  Pencil,
  Send,
  Undo2,
  XCircle,
  ArrowRight,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MetaHead from "@/components/MetaHead";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  approveArticle,
  approveRevision,
  fetchReviewQueue,
  rejectRevision,
  returnArticle,
  selectReviewActingKey,
  selectReviewQueue,
  selectReviewsError,
  selectReviewsLoading,
} from "@/store/slices/adminReviewsSlice";
import { formatDate, formatRelative } from "@/lib/format";
import { wordDiffSummary } from "@/lib/wordDiff";
import { logger } from "@/utils/logger";
import { cn } from "@/lib/utils";
import type { ReviewPendingEdit, ReviewQueueArticle } from "@shared/api";

const noteSchema = Yup.object({
  note: Yup.string()
    .trim()
    .min(3, "Escribe al menos 3 caracteres")
    .max(5000, "Máximo 5000 caracteres")
    .required("Explica qué hay que cambiar"),
});

type NoteTarget =
  | { kind: "article"; id: number; title: string }
  | { kind: "revision"; id: number; title: string };

function NoteDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: NoteTarget | null;
  onClose: () => void;
  onSubmit: (target: NoteTarget, note: string) => Promise<boolean>;
}) {
  const formik = useFormik({
    initialValues: { note: "" },
    validationSchema: noteSchema,
    enableReinitialize: true,
    onSubmit: async (values, helpers) => {
      if (!target) return;
      const ok = await onSubmit(target, values.note.trim());
      if (ok) {
        helpers.resetForm();
        onClose();
      }
    },
  });

  const isRevision = target?.kind === "revision";

  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg">
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isRevision ? "Rechazar cambios" : "Devolver al autor"}</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {target?.title}
              {isRevision
                ? " — la versión publicada se mantiene sin cambios."
                : " — el artículo volverá a borrador."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-note">Nota para el autor</Label>
            <Textarea
              id="review-note"
              name="note"
              rows={5}
              autoFocus
              placeholder="Ej. Falta citar la fuente del dato de inflación en el segundo párrafo."
              value={formik.values.note}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.touched.note && formik.errors.note)}
            />
            {formik.touched.note && formik.errors.note && (
              <p className="text-xs text-destructive">{formik.errors.note}</p>
            )}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" className="h-10 gap-2" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRevision ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              {isRevision ? "Rechazar" : "Devolver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = before !== after;
  return (
    <div className="space-y-1.5">
      <p className="kicker text-muted-foreground">
        {label} {changed ? <Badge variant="secondary" className="ml-1 text-[10px]">cambió</Badge> : null}
      </p>
      {changed ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground line-through decoration-destructive/40">
            {before || <em>(vacío)</em>}
          </p>
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
            {after || <em>(vacío)</em>}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{after || <em>(vacío)</em>}</p>
      )}
    </div>
  );
}

function PendingEditCard({
  edit,
  acting,
  onApprove,
  onReject,
}: {
  edit: ReviewPendingEdit;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const diff = useMemo(
    () => wordDiffSummary(edit.current.text, edit.proposed.text),
    [edit.current.text, edit.proposed.text],
  );
  return (
    <li className="space-y-4 rounded-xl border bg-card p-4 sm:p-5 animate-in fade-in-0 slide-in-from-bottom-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{edit.current.title}</p>
          <p className="text-xs text-muted-foreground">
            Propuesto por {edit.user_name ?? edit.user_email ?? edit.author_name} ·{" "}
            <time dateTime={edit.submitted_at ?? undefined} title={formatDate(edit.submitted_at ?? "", { dateStyle: "medium", timeStyle: "short" })}>
              {formatRelative(edit.submitted_at)}
            </time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400">
            <Plus className="h-3 w-3" /> {diff.added} palabras
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 font-medium text-destructive">
            <Minus className="h-3 w-3" /> {diff.removed} palabras
          </span>
          <span className="text-muted-foreground">
            {diff.before} <ArrowRight className="inline h-3 w-3" /> {diff.after}
          </span>
        </div>
      </div>

      <BeforeAfter label="Título" before={edit.current.title} after={edit.proposed.title} />
      <BeforeAfter label="Resumen" before={edit.current.excerpt ?? ""} after={edit.proposed.excerpt ?? ""} />
      {edit.current.slug !== edit.proposed.slug && (
        <BeforeAfter label="URL" before={`/articulo/${edit.current.slug}`} after={`/articulo/${edit.proposed.slug}`} />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" className="h-10 gap-2">
          <Link to={`/admin/articles/${edit.article_id}/edit`}>
            <Pencil className="h-4 w-4" /> Abrir artículo
          </Link>
        </Button>
        <Button variant="outline" className="h-10 gap-2" disabled={acting} onClick={onReject}>
          <XCircle className="h-4 w-4" /> Rechazar
        </Button>
        <Button className="h-10 gap-2" disabled={acting} onClick={onApprove}>
          {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Aplicar cambios
        </Button>
      </div>
    </li>
  );
}

function InReviewRow({
  article,
  acting,
  onPublish,
  onReturn,
}: {
  article: ReviewQueueArticle;
  acting: boolean;
  onPublish: () => void;
  onReturn: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-4 animate-in fade-in-0 slide-in-from-bottom-1">
      {article.image_url && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted sm:w-28 sm:flex-shrink-0">
          <img src={article.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug line-clamp-2">{article.title}</p>
        {article.excerpt && (
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {article.author_name} · {article.category_name} · enviado{" "}
          <time dateTime={article.submitted_at ?? undefined}>{formatRelative(article.submitted_at)}</time>
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-shrink-0">
        <Button asChild variant="ghost" className="h-10 gap-2">
          <Link to={`/admin/articles/${article.id}/edit`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </Button>
        <Button variant="outline" className="h-10 gap-2" disabled={acting} onClick={onReturn}>
          <Undo2 className="h-4 w-4" /> Devolver
        </Button>
        <Button className="h-10 gap-2" disabled={acting} onClick={onPublish}>
          {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publicar
        </Button>
      </div>
    </li>
  );
}

export default function AdminReviews() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const user = useAppSelector(selectAdminUser);
  const queue = useAppSelector(selectReviewQueue);
  const loading = useAppSelector(selectReviewsLoading);
  const error = useAppSelector(selectReviewsError);
  const actingKey = useAppSelector(selectReviewActingKey);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) dispatch(fetchReviewQueue());
  }, [dispatch, isAdmin]);

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>Solo los administradores pueden revisar artículos.</AlertDescription>
      </Alert>
    );
  }

  const publish = async (a: ReviewQueueArticle) => {
    const result = await dispatch(approveArticle({ id: a.id }));
    if (approveArticle.fulfilled.match(result)) {
      toast({ title: "Publicado", description: a.title });
    } else {
      logger.error("approveArticle failed", result.payload);
      toast({ title: "No se pudo publicar", description: String(result.payload ?? ""), variant: "destructive" });
    }
  };

  const applyEdit = async (e: ReviewPendingEdit) => {
    const result = await dispatch(approveRevision({ revId: e.id }));
    if (approveRevision.fulfilled.match(result)) {
      toast({ title: "Cambios aplicados", description: e.proposed.title });
    } else {
      logger.error("approveRevision failed", result.payload);
      toast({ title: "No se pudieron aplicar", description: String(result.payload ?? ""), variant: "destructive" });
    }
  };

  const submitNote = async (target: NoteTarget, note: string): Promise<boolean> => {
    const result =
      target.kind === "article"
        ? await dispatch(returnArticle({ id: target.id, note }))
        : await dispatch(rejectRevision({ revId: target.id, note }));
    if (result.meta.requestStatus === "fulfilled") {
      toast({ title: target.kind === "article" ? "Devuelto al autor" : "Cambios rechazados" });
      return true;
    }
    logger.error("review note action failed", result.payload);
    toast({ title: "No se pudo enviar", description: String(result.payload ?? ""), variant: "destructive" });
    return false;
  };

  const inReview = queue?.in_review ?? [];
  const pendingEdits = queue?.pending_edits ?? [];
  const empty = queue != null && inReview.length === 0 && pendingEdits.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <MetaHead title="Revisión" noIndex includeSiteOrganization={false} />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Revisión</h1>
          <p className="text-sm text-muted-foreground">
            Artículos enviados por autores y ediciones pendientes de notas publicadas.
          </p>
        </div>
        {loading && queue && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Actualizando" />}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !queue ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center animate-in fade-in-0">
          <ClipboardCheck className="h-10 w-10 text-brand" />
          <p className="font-semibold">Todo al día</p>
          <p className="text-sm text-muted-foreground">No hay nada esperando revisión.</p>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className={cn("flex items-center gap-2 text-base font-semibold sm:text-lg")}>
              <Send className="h-4 w-4 text-brand" /> En revisión
              <Badge variant="secondary">{inReview.length}</Badge>
            </h2>
            {inReview.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin artículos nuevos por revisar.</p>
            ) : (
              <ul className="space-y-3">
                {inReview.map((a) => (
                  <InReviewRow
                    key={a.id}
                    article={a}
                    acting={actingKey === `article:${a.id}`}
                    onPublish={() => publish(a)}
                    onReturn={() => setNoteTarget({ kind: "article", id: a.id, title: a.title })}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <FilePenLine className="h-4 w-4 text-brand" /> Ediciones pendientes
              <Badge variant="secondary">{pendingEdits.length}</Badge>
            </h2>
            {pendingEdits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna edición de notas publicadas en espera.</p>
            ) : (
              <ul className="space-y-3">
                {pendingEdits.map((e) => (
                  <PendingEditCard
                    key={e.id}
                    edit={e}
                    acting={actingKey === `revision:${e.id}`}
                    onApprove={() => applyEdit(e)}
                    onReject={() => setNoteTarget({ kind: "revision", id: e.id, title: e.current.title })}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <NoteDialog target={noteTarget} onClose={() => setNoteTarget(null)} onSubmit={submitNote} />
    </div>
  );
}
