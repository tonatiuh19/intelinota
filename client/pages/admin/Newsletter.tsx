import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminNewsletter,
  selectAdminNewsletter,
  selectAdminNewsletterLoading,
  selectAdminNewsletterPagination,
} from "@/store/slices/adminNewsletterSlice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminNewsletter() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminNewsletter);
  const loading = useAppSelector(selectAdminNewsletterLoading);
  const pagination = useAppSelector(selectAdminNewsletterPagination);

  useEffect(() => {
    dispatch(fetchAdminNewsletter({ page: 1 }));
  }, [dispatch]);

  if (user?.role !== "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Newsletter
        </h1>
        <p className="text-sm text-muted-foreground">
          Suscriptores registrados vía formularios del sitio.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Total: {pagination?.total ?? items.length} suscriptores
          </p>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3 hidden sm:table-cell">Origen</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3 hidden md:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="p-3">{s.email}</td>
                    <td className="p-3 hidden sm:table-cell text-muted-foreground">
                      {s.source ?? "—"}
                    </td>
                    <td className="p-3 capitalize">{s.status}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {new Date(s.subscribed_at).toLocaleDateString("es-ES")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() =>
                  dispatch(fetchAdminNewsletter({ page: pagination.page - 1 }))
                }
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  dispatch(fetchAdminNewsletter({ page: pagination.page + 1 }))
                }
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
