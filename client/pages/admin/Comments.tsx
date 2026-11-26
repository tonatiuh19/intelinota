import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminComments,
  patchAdminComment,
  setCommentsStatus,
  selectAdminComments,
  selectAdminCommentsLoading,
  selectAdminCommentsError,
  selectAdminCommentsStatus,
} from "@/store/slices/adminCommentsSlice";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUSES = ["pending", "approved", "spam"] as const;

export default function AdminComments() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminComments);
  const loading = useAppSelector(selectAdminCommentsLoading);
  const error = useAppSelector(selectAdminCommentsError);
  const status = useAppSelector(selectAdminCommentsStatus);

  useEffect(() => {
    dispatch(fetchAdminComments({ status }));
  }, [dispatch, status]);

  if (user?.role !== "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Comentarios
        </h1>
        <p className="text-sm text-muted-foreground">
          Modera comentarios de lectores antes de publicarlos.
        </p>
      </div>

      <Tabs
        value={status}
        onValueChange={(v) => dispatch(setCommentsStatus(v))}
      >
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobados" : "Spam"}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No hay comentarios en esta categoría.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-primary/10 bg-card p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold">{c.author_name ?? "Anónimo"}</span>
                <Link
                  to={`/articulo/${c.article_slug}`}
                  className="text-primary hover:underline text-xs"
                  target="_blank"
                >
                  {c.article_title}
                </Link>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {c.content}
              </p>
              {status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      dispatch(
                        patchAdminComment({ id: c.id, status: "approved" }),
                      )
                    }
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      dispatch(
                        patchAdminComment({ id: c.id, status: "spam" }),
                      )
                    }
                  >
                    Spam
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
