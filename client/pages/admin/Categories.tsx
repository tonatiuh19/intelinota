import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminCategories,
  updateAdminCategory,
  selectAdminCategories,
  selectAdminCategoriesLoading,
  selectAdminCategoriesSaving,
  selectAdminCategoriesSaveError,
} from "@/store/slices/adminCategoriesSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category } from "@shared/api";

export default function AdminCategories() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectAdminCategories);
  const loading = useAppSelector(selectAdminCategoriesLoading);
  const saving = useAppSelector(selectAdminCategoriesSaving);
  const saveError = useAppSelector(selectAdminCategoriesSaveError);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    dispatch(fetchAdminCategories());
  }, [dispatch]);

  if (user?.role !== "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      is_active: cat.is_active,
      sort_order: cat.sort_order ?? 0,
    });
  }

  async function handleSave() {
    if (!editing) return;
    await dispatch(
      updateAdminCategory({ id: editing.id, payload: form }),
    ).unwrap();
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">
          Categorías
        </h1>
        <p className="text-sm text-muted-foreground">
          Orden, visibilidad y metadatos de categorías.
        </p>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border divide-y">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-bold">{cat.name}</p>
                <p className="text-xs text-muted-foreground">
                  /{cat.slug} · orden {cat.sort_order}
                  {!cat.is_active && " · oculta"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(cat)}>
                Editar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Activa en el sitio</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
