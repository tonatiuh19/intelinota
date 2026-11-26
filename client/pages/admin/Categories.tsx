import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FolderTree,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { AdminCategory, AdminSubcategory } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  checkCategorySlug,
  createAdminCategory,
  createAdminSubcategory,
  deleteAdminCategory,
  deleteAdminSubcategory,
  fetchAdminCategories,
  reorderAdminCategories,
  reorderAdminSubcategories,
  selectAdminCategories,
  selectAdminCategoriesLoading,
  setLocalCategoryOrder,
  setLocalSubcategoryOrder,
  updateAdminCategory,
  updateAdminSubcategory,
} from "@/store/slices/adminCategoriesSlice";
import { categoryUrlPath } from "@/lib/categorySlugs";
import { moveItem, orderChanged, slugify } from "@/lib/taxonomy";
import { logger } from "@/utils/logger";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const slugRule = Yup.string()
  .trim()
  .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
  .max(100, "Máximo 100 caracteres")
  .required("Slug obligatorio");

const categorySchema = Yup.object({
  name: Yup.string().trim().min(2, "Mínimo 2 caracteres").max(100, "Máximo 100 caracteres").required("Nombre obligatorio"),
  slug: slugRule,
  description: Yup.string().trim().max(1000, "Máximo 1000 caracteres"),
  is_active: Yup.boolean(),
});

const subSchema = Yup.object({
  name: Yup.string().trim().min(2, "Mínimo 2 caracteres").max(100, "Máximo 100 caracteres").required("Nombre obligatorio"),
  slug: slugRule,
});

function FieldError({ msg }: { msg?: string | false }) {
  return msg ? <p role="alert" className="mt-1 text-xs text-destructive">{msg}</p> : null;
}

/* ------------------------------------------------------------------ */
/* Create / edit section                                               */
/* ------------------------------------------------------------------ */

function CategoryForm({ category, onDone }: { category: AdminCategory | null; onDone: () => void }) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "ok" | "taken">("idle");

  const formik = useFormik({
    initialValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      is_active: category?.is_active ?? true,
    },
    validationSchema: categorySchema,
    onSubmit: async (v) => {
      if (slugState === "taken") return;
      const payload = { name: v.name.trim(), slug: v.slug.trim(), description: v.description.trim() || null, is_active: v.is_active };
      const r = category
        ? await dispatch(updateAdminCategory({ id: category.id, payload }))
        : await dispatch(createAdminCategory(payload));
      if (r.meta.requestStatus === "fulfilled") {
        toast({ title: category ? "Sección actualizada" : "Sección creada", description: payload.name });
        onDone();
      } else {
        logger.warn("category save failed", r.payload);
        toast({ title: "No se pudo guardar", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  // Auto-slug from name until the slug is edited by hand.
  useEffect(() => {
    if (!slugTouched) void formik.setFieldValue("slug", slugify(formik.values.name), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.name, slugTouched]);

  // Debounced availability check.
  const slug = formik.values.slug.trim();
  useEffect(() => {
    if (!slug || (category && slug === category.slug)) {
      setSlugState("idle");
      return;
    }
    setSlugState("checking");
    const t = setTimeout(async () => {
      const r = await dispatch(checkCategorySlug({ slug, excludeId: category?.id }));
      if (checkCategorySlug.fulfilled.match(r)) setSlugState(r.payload.available ? "ok" : "taken");
      else setSlugState("idle");
    }, 350);
    return () => clearTimeout(t);
  }, [slug, category, dispatch]);

  const slugChanged = !!category && slug !== category.slug;

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <div>
          <label htmlFor="cat-name" className="text-sm font-semibold">Nombre</label>
          <input id="cat-name" autoFocus className={cn(inputCls, "mt-1.5")} placeholder="Ej. Economía" {...formik.getFieldProps("name")} />
          <FieldError msg={formik.touched.name && formik.errors.name} />
        </div>
        <div>
          <label htmlFor="cat-slug" className="text-sm font-semibold">Slug</label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/categoria/</span>
            <input
              id="cat-slug"
              className={cn(inputCls, "pl-[5.6rem] pr-9 font-mono", slugState === "taken" && "border-destructive")}
              {...formik.getFieldProps("slug")}
              onChange={(e) => {
                setSlugTouched(true);
                void formik.setFieldValue("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {slugState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {slugState === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
              {slugState === "taken" && <X className="h-4 w-4 text-destructive" />}
            </span>
          </div>
          <FieldError msg={(formik.touched.slug && formik.errors.slug) || (slugState === "taken" && "Ese slug ya está en uso")} />
          {slugChanged && (
            <p className="mt-2 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Cambiar el slug cambia la URL pública de la sección ({categoryUrlPath(category!.slug)} → /categoria/{slug}). Los enlaces y
              posiciones en buscadores de la URL anterior dejarán de funcionar.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="cat-desc" className="text-sm font-semibold">Descripción</label>
          <textarea id="cat-desc" rows={4} className={cn(inputCls, "mt-1.5 h-auto py-2")} placeholder="Se muestra en la página de la sección y como descripción SEO." {...formik.getFieldProps("description")} />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <FieldError msg={formik.touched.description && formik.errors.description} />
            <span className={cn("ml-auto tabular-nums", formik.values.description.length > 160 && "text-amber-600")}>
              {formik.values.description.length}/160 recomendado
            </span>
          </div>
        </div>
        <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3">
          <span>
            <span className="block text-sm font-semibold">Visible en el sitio</span>
            <span className="text-xs text-muted-foreground">Las secciones ocultas no aparecen en la navegación.</span>
          </span>
          <Switch checked={formik.values.is_active} onCheckedChange={(v) => void formik.setFieldValue("is_active", v)} />
        </label>
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t bg-background pt-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <Button type="button" variant="ghost" className="h-10 flex-1 sm:flex-none" onClick={onDone}>Cancelar</Button>
        <Button type="submit" className="ml-auto h-10 flex-1 bg-brand text-brand-foreground hover:bg-brand/90 sm:flex-none" disabled={formik.isSubmitting || slugState === "taken" || slugState === "checking"}>
          {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {category ? "Guardar cambios" : "Crear sección"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Delete with article relocation                                      */
/* ------------------------------------------------------------------ */

type DeleteTarget =
  | { kind: "category"; item: AdminCategory }
  | { kind: "subcategory"; item: AdminSubcategory; parent: AdminCategory };

function DeleteDialog({ target, categories, onClose }: { target: DeleteTarget | null; categories: AdminCategory[]; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const count = target ? target.item.article_count : 0;
  const options = useMemo(() => {
    if (!target) return [];
    return target.kind === "category"
      ? categories.filter((c) => c.id !== target.item.id).map((c) => ({ value: String(c.id), label: c.name }))
      : [
          { value: "none", label: `Sin subsección (quedan en ${target.parent.name})` },
          ...target.parent.subcategories.filter((s) => s.id !== target.item.id).map((s) => ({ value: String(s.id), label: s.name })),
        ];
  }, [target, categories]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { move_to: "" },
    validationSchema: Yup.object({
      move_to: count > 0 ? Yup.string().required("Elige a dónde mover los artículos") : Yup.string(),
    }),
    onSubmit: async ({ move_to }) => {
      if (!target) return;
      const r =
        target.kind === "category"
          ? await dispatch(deleteAdminCategory({ id: target.item.id, moveTo: move_to ? Number(move_to) : undefined }))
          : await dispatch(
              deleteAdminSubcategory({ id: target.item.id, moveTo: move_to === "none" ? "none" : move_to ? Number(move_to) : undefined }),
            );
      if (r.meta.requestStatus === "fulfilled") {
        toast({ title: `${target.kind === "category" ? "Sección" : "Subsección"} eliminada`, description: count ? `${count} artículos reasignados.` : undefined });
        onClose();
      } else {
        toast({ title: "No se pudo eliminar", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  const blocked = target?.kind === "category" && count > 0 && options.length === 0;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-xl sm:w-full">
        <form onSubmit={formik.handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Eliminar «{target?.item.name}»</DialogTitle>
            <DialogDescription>
              {count > 0
                ? `Tiene ${count} ${count === 1 ? "artículo" : "artículos"}. Elige a dónde moverlos; ningún artículo quedará huérfano.`
                : "No tiene artículos. Esta acción no se puede deshacer."}
              {target?.kind === "category" && target.item.subcategories.length > 0 && " Sus subsecciones también se eliminarán."}
            </DialogDescription>
          </DialogHeader>
          {count > 0 && !blocked && (
            <div className="mt-4">
              <label htmlFor="move-to" className="text-sm font-semibold">Mover artículos a</label>
              <select id="move-to" className={cn(inputCls, "mt-1.5")} {...formik.getFieldProps("move_to")}>
                <option value="">Selecciona…</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <FieldError msg={formik.touched.move_to && formik.errors.move_to} />
            </div>
          )}
          {blocked && <p className="mt-4 text-sm text-destructive">Crea otra sección antes de eliminar la única que tiene artículos.</p>}
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="ghost" className="h-10" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="destructive" className="h-10" disabled={formik.isSubmitting || blocked}>
              {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Eliminar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Subsections                                                         */
/* ------------------------------------------------------------------ */

function SubForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; slug: string };
  submitLabel: string;
  onSubmit: (v: { name: string; slug: string }) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const formik = useFormik({
    initialValues: initial,
    validationSchema: subSchema,
    onSubmit: async (v, helpers) => {
      const ok = await onSubmit({ name: v.name.trim(), slug: v.slug.trim() });
      if (ok && !onCancel) {
        helpers.resetForm();
        setSlugTouched(false);
      }
    },
  });
  useEffect(() => {
    if (!slugTouched) void formik.setFieldValue("slug", slugify(formik.values.name), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.name, slugTouched]);
  return (
    <form onSubmit={formik.handleSubmit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label className="sr-only" htmlFor={`sub-name-${submitLabel}-${initial.slug}`}>Nombre</label>
        <input id={`sub-name-${submitLabel}-${initial.slug}`} className={inputCls} placeholder="Nombre de la subsección" {...formik.getFieldProps("name")} autoFocus={!!onCancel} />
        <FieldError msg={formik.touched.name && formik.errors.name} />
      </div>
      <div className="sm:w-40">
        <label className="sr-only" htmlFor={`sub-slug-${submitLabel}-${initial.slug}`}>Slug</label>
        <input
          id={`sub-slug-${submitLabel}-${initial.slug}`}
          className={cn(inputCls, "font-mono")}
          placeholder="slug"
          {...formik.getFieldProps("slug")}
          onChange={(e) => {
            setSlugTouched(true);
            void formik.setFieldValue("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
          }}
        />
        <FieldError msg={formik.touched.slug && formik.errors.slug} />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" className="h-10 flex-1 sm:flex-none" onClick={onCancel}>Cancelar</Button>
        )}
        <Button type="submit" variant={onCancel ? "default" : "outline"} className="h-10 flex-1 sm:flex-none" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : !onCancel && <Plus className="mr-1.5 h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Subsections({ category, onDelete }: { category: AdminCategory; onDelete: (s: AdminSubcategory) => void }) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const subs = category.subcategories;

  async function move(from: number, to: number) {
    const prev = subs.map((s) => s.id);
    const ids = moveItem(prev, from, to);
    if (!orderChanged(prev, ids)) return;
    dispatch(setLocalSubcategoryOrder({ categoryId: category.id, ids }));
    const r = await dispatch(reorderAdminSubcategories({ categoryId: category.id, ids }));
    if (r.meta.requestStatus !== "fulfilled") {
      dispatch(setLocalSubcategoryOrder({ categoryId: category.id, ids: prev }));
      toast({ title: "No se pudo reordenar", description: String(r.payload ?? ""), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3 border-t bg-muted/30 px-4 py-4 sm:px-5">
      <p className="kicker">Subsecciones</p>
      {subs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay subsecciones.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {subs.map((s, i) => (
            <li key={s.id} className="group px-3 py-2">
              {editingId === s.id ? (
                <SubForm
                  initial={{ name: s.name, slug: s.slug }}
                  submitLabel="Guardar"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (v) => {
                    const r = await dispatch(updateAdminSubcategory({ id: s.id, ...v }));
                    if (r.meta.requestStatus === "fulfilled") {
                      setEditingId(null);
                      toast({ title: "Subsección actualizada" });
                      return true;
                    }
                    toast({ title: "No se pudo guardar", description: String(r.payload ?? ""), variant: "destructive" });
                    return false;
                  }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{s.slug} · {s.article_count} artículos</p>
                  </div>
                  <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => void move(i, i - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="Bajar" disabled={i === subs.length - 1} onClick={() => void move(i, i + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label={`Renombrar ${s.name}`} onClick={() => setEditingId(s.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label={`Eliminar ${s.name}`} onClick={() => onDelete(s)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <SubForm
        initial={{ name: "", slug: "" }}
        submitLabel="Añadir"
        onSubmit={async (v) => {
          const r = await dispatch(createAdminSubcategory({ categoryId: category.id, ...v }));
          if (r.meta.requestStatus === "fulfilled") {
            toast({ title: "Subsección creada", description: v.name });
            return true;
          }
          toast({ title: "No se pudo crear", description: String(r.payload ?? ""), variant: "destructive" });
          return false;
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section row                                                         */
/* ------------------------------------------------------------------ */

function SectionRow({
  cat,
  index,
  total,
  expanded,
  onToggleExpand,
  onMove,
  onDragEnd,
  onEdit,
  onDelete,
  onDeleteSub,
  onToggleActive,
}: {
  cat: AdminCategory;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onMove: (from: number, to: number) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteSub: (s: AdminSubcategory) => void;
  onToggleActive: (v: boolean) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={cat.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      layout="position"
      className={cn("overflow-hidden rounded-xl border bg-card", !cat.is_active && "opacity-70")}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 30px -12px rgba(0,0,0,.35)" }}
    >
      <div className="group flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
        <button
          type="button"
          aria-label={`Arrastrar ${cat.name}`}
          onPointerDown={(e) => controls.start(e)}
          className="hidden h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing sm:inline-flex"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex flex-col sm:hidden">
          <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Bajar" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30">
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        <span className="hidden w-6 shrink-0 text-center font-display text-lg font-bold tabular-nums text-muted-foreground sm:block">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-display text-lg font-semibold">{cat.name}</p>
            {!cat.is_active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <EyeOff className="h-3 w-3" /> Oculta
              </span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{categoryUrlPath(cat.slug)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">{cat.published_count} publicados</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{cat.draft_count} en otros estados</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{cat.subcategories.length} subsecciones</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
          <label className="inline-flex h-10 items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden md:inline">{cat.is_active ? "Visible" : "Oculta"}</span>
            <Switch checked={cat.is_active} onCheckedChange={onToggleActive} aria-label={`Visibilidad de ${cat.name}`} />
          </label>
          <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button type="button" aria-label={`Editar ${cat.name}`} onClick={onEdit} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" aria-label={`Eliminar ${cat.name}`} onClick={onDelete} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Ocultar subsecciones" : "Ver subsecciones"}
          onClick={onToggleExpand}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Subsections category={cat} onDelete={onDeleteSub} />
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminCategories() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const categories = useAppSelector(selectAdminCategories);
  const loading = useAppSelector(selectAdminCategoriesLoading);
  const error = useAppSelector((s) => s.adminCategories.error);
  const [panel, setPanel] = useState<{ open: boolean; category: AdminCategory | null }>({ open: false, category: null });
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const orderAtDragStart = useRef<number[] | null>(null);

  useEffect(() => {
    const p = dispatch(fetchAdminCategories());
    return () => p.abort();
  }, [dispatch]);

  const ids = categories.map((c) => c.id);
  const totals = useMemo(
    () => ({
      sections: categories.length,
      visible: categories.filter((c) => c.is_active).length,
      published: categories.reduce((n, c) => n + c.published_count, 0),
    }),
    [categories],
  );

  if (user?.role !== "admin") return <Navigate to="/admin/dashboard" replace />;

  async function saveOrder(prev: number[], next: number[]) {
    if (!orderChanged(prev, next)) return;
    const r = await dispatch(reorderAdminCategories(next));
    if (r.meta.requestStatus !== "fulfilled") {
      dispatch(setLocalCategoryOrder(prev));
      toast({ title: "No se pudo guardar el orden", description: String(r.payload ?? ""), variant: "destructive" });
      return;
    }
    toast({
      title: "Orden de navegación actualizado",
      action: (
        <ToastAction
          altText="Deshacer"
          onClick={() => {
            dispatch(setLocalCategoryOrder(prev));
            void dispatch(reorderAdminCategories(prev));
          }}
        >
          Deshacer
        </ToastAction>
      ),
    });
  }

  function moveBy(from: number, to: number) {
    const next = moveItem(ids, from, to);
    dispatch(setLocalCategoryOrder(next));
    void saveOrder(ids, next);
  }

  async function toggleActive(cat: AdminCategory, value: boolean) {
    const r = await dispatch(updateAdminCategory({ id: cat.id, payload: { is_active: value } }));
    if (r.meta.requestStatus !== "fulfilled") {
      toast({ title: "No se pudo cambiar la visibilidad", description: String(r.payload ?? ""), variant: "destructive" });
      return;
    }
    toast({
      title: value ? `«${cat.name}» visible en el sitio` : `«${cat.name}» oculta`,
      action: (
        <ToastAction altText="Deshacer" onClick={() => void dispatch(updateAdminCategory({ id: cat.id, payload: { is_active: !value } }))}>
          Deshacer
        </ToastAction>
      ),
    });
  }

  const visibleNav = categories.filter((c) => c.is_active);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-28 lg:pb-10">
      <MetaHead title="Secciones" noIndex includeSiteOrganization={false} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Estructura</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Secciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totals.sections} secciones · {totals.visible} visibles · {totals.published} artículos publicados
          </p>
        </div>
        <Button className="hidden h-10 bg-brand text-brand-foreground hover:bg-brand/90 sm:inline-flex" onClick={() => setPanel({ open: true, category: null })}>
          <Plus className="mr-2 h-4 w-4" /> Nueva sección
        </Button>
      </header>

      {/* Live nav preview */}
      <section aria-label="Vista previa de la navegación" className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-brand" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Así se ve el menú</p>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <motion.ul layout className="flex gap-1.5">
            {visibleNav.length === 0 && <li className="text-sm text-muted-foreground">No hay secciones visibles.</li>}
            {visibleNav.map((c) => (
              <motion.li layout key={c.id} className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold">
                {c.name}
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {loading && !categories.length ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <FolderTree className="mx-auto h-10 w-10 text-brand" strokeWidth={1.5} />
          <p className="mt-3 font-display text-xl font-semibold">Aún no hay secciones</p>
          <p className="mt-1 text-sm text-muted-foreground">Crea la primera para organizar tus artículos.</p>
          <Button className="mt-5 h-10" onClick={() => setPanel({ open: true, category: null })}>
            <Plus className="mr-2 h-4 w-4" /> Nueva sección
          </Button>
        </div>
      ) : (
        <>
          <p className="hidden text-xs text-muted-foreground sm:block">Arrastra desde el asa para cambiar el orden del menú.</p>
          <Reorder.Group
            axis="y"
            values={ids}
            onReorder={(next: number[]) => {
              if (!orderAtDragStart.current) orderAtDragStart.current = ids;
              dispatch(setLocalCategoryOrder(next));
            }}
            className="space-y-3"
          >
            {categories.map((cat, i) => (
              <SectionRow
                key={cat.id}
                cat={cat}
                index={i}
                total={categories.length}
                expanded={expanded.has(cat.id)}
                onToggleExpand={() =>
                  setExpanded((prev) => {
                    const n = new Set(prev);
                    n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id);
                    return n;
                  })
                }
                onMove={moveBy}
                onDragEnd={() => {
                  const prev = orderAtDragStart.current;
                  orderAtDragStart.current = null;
                  if (prev) void saveOrder(prev, ids);
                }}
                onEdit={() => setPanel({ open: true, category: cat })}
                onDelete={() => setDeleting({ kind: "category", item: cat })}
                onDeleteSub={(s) => setDeleting({ kind: "subcategory", item: s, parent: cat })}
                onToggleActive={(v) => void toggleActive(cat, v)}
              />
            ))}
          </Reorder.Group>
        </>
      )}

      {/* Mobile sticky create bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Button className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90" onClick={() => setPanel({ open: true, category: null })}>
          <Plus className="mr-2 h-4 w-4" /> Nueva sección
        </Button>
      </div>

      <Sheet open={panel.open} onOpenChange={(o) => !o && setPanel({ open: false, category: null })}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("flex flex-col", isMobile ? "max-h-[92vh] rounded-t-2xl" : "w-full sm:max-w-md")}>
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">{panel.category ? "Editar sección" : "Nueva sección"}</SheetTitle>
            <SheetDescription>Nombre, URL y descripción de la sección.</SheetDescription>
          </SheetHeader>
          {panel.open && (
            <div className="mt-4 min-h-0 flex-1">
              <CategoryForm key={panel.category?.id ?? "new"} category={panel.category} onDone={() => setPanel({ open: false, category: null })} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <DeleteDialog target={deleting} categories={categories} onClose={() => setDeleting(null)} />
    </div>
  );
}
