import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Eye,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { AdminAuthor, AdminRole } from "@shared/api";
import MetaHead from "@/components/MetaHead";
import ImageUploadCrop from "@/components/ImageUploadCrop";
import SocialLinksFields, {
  emptySocialValues,
  fieldClass,
  normalizeTwitter,
  socialLinksFrom,
  socialSchemaFields,
  socialValuesFrom,
  type SocialFormValues,
} from "@/components/admin/SocialLinksFields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  checkAuthorSlug,
  clearSaveError,
  createAdminAuthor,
  deleteAdminAuthor,
  fetchAdminAuthors,
  grantAuthorAccess,
  resetSlugCheck,
  revokeAuthorAccess,
  selectAdminAuthors,
  selectAdminAuthorsError,
  selectAdminAuthorsLoading,
  setAuthorCanPublish,
  updateAdminAuthor,
} from "@/store/slices/adminAuthorsSlice";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";

// ── Helpers ───────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

function AuthorAvatar({ author, size = "md" }: { author: Pick<AdminAuthor, "name" | "avatar_url">; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm";
  return author.avatar_url ? (
    <img src={author.avatar_url} alt="" className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", cls)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand/10 font-display font-bold text-brand", cls)}>
      {initials(author.name)}
    </span>
  );
}

function RoleBadge({ author }: { author: AdminAuthor }) {
  if (!author.user_id) {
    return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Sin acceso</span>;
  }
  if (author.user_role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
        <Shield className="h-3 w-3" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
      <Pencil className="h-3 w-3" /> Autor
    </span>
  );
}

type Filter = "all" | "access" | "noaccess" | "publish";

// ── Form ──────────────────────────────────────────────────────

const BIO_MAX = 600;

interface AuthorFormValues extends SocialFormValues {
  name: string;
  slug: string;
  bio: string;
  avatar_url: string;
  email: string;
  invite_email: string;
  invite_role: AdminRole;
  invite_can_publish: boolean;
}

const authorSchema = Yup.object({
  name: Yup.string().trim().min(2, "Mínimo 2 caracteres").max(150, "Máximo 150 caracteres").required("El nombre es obligatorio"),
  slug: Yup.string()
    .trim()
    .max(150, "Máximo 150 caracteres")
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
    .required("El slug es obligatorio"),
  bio: Yup.string().max(BIO_MAX, `Máximo ${BIO_MAX} caracteres`),
  avatar_url: Yup.string(),
  email: Yup.string().trim().email("Correo inválido").max(255),
  invite_email: Yup.string().trim().email("Correo inválido").max(255),
  invite_role: Yup.mixed<AdminRole>().oneOf(["admin", "author"]),
  invite_can_publish: Yup.boolean(),
  ...socialSchemaFields,
});

const accessSchema = Yup.object({
  email: Yup.string().trim().email("Correo inválido").max(255).required("Escribe el correo de la cuenta"),
  role: Yup.mixed<AdminRole>().oneOf(["admin", "author"]).required(),
  can_publish: Yup.boolean(),
});

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | false;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RoleSelect({ id, value, onChange, disabled }: { id: string; value: AdminRole; onChange: (r: AdminRole) => void; disabled?: boolean }) {
  return (
    <div id={id} role="radiogroup" aria-label="Rol" className="grid grid-cols-2 gap-2">
      {(["author", "admin"] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          disabled={disabled}
          onClick={() => onChange(r)}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50",
            value === r ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r === "admin" ? <Shield className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {r === "admin" ? "Administrador" : "Autor"}
        </button>
      ))}
    </div>
  );
}

/** Panel access for an existing author: invite, change role, or unlink. */
function AccessSection({ author, isSelf }: { author: AdminAuthor; isSelf: boolean }) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const busy = useAppSelector((s) => s.adminAuthors.accessBusyId === author.id);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const hasAccess = Boolean(author.user_id);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      email: author.user_email ?? author.email ?? "",
      role: (author.user_role ?? "author") as AdminRole,
      can_publish: Boolean(author.can_publish),
    },
    validationSchema: accessSchema,
    onSubmit: async (v) => {
      const r = await dispatch(
        grantAuthorAccess({ id: author.id, payload: { email: v.email.trim(), role: v.role, can_publish: v.role === "admin" || v.can_publish } }),
      );
      if (grantAuthorAccess.fulfilled.match(r)) {
        toast({
          title: hasAccess ? "Acceso actualizado" : "Acceso concedido",
          description: hasAccess
            ? undefined
            : r.payload.invite_sent
              ? `Enviamos la invitación a ${v.email.trim()}.`
              : "La cuenta quedó lista, pero no se pudo enviar el correo. Avísale que entre en /admin/login.",
        });
      } else {
        toast({ title: "No se pudo guardar el acceso", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  const revoke = async () => {
    setConfirmRevoke(false);
    const r = await dispatch(revokeAuthorAccess(author.id));
    if (revokeAuthorAccess.fulfilled.match(r)) toast({ title: "Acceso retirado", description: "El perfil de autor y sus artículos se conservan." });
    else toast({ title: "No se pudo quitar el acceso", description: String(r.payload ?? ""), variant: "destructive" });
  };

  const err = (k: "email") => formik.touched[k] && formik.errors[k];

  return (
    <section className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Acceso al panel</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasAccess ? (
              <>Entra con <strong className="text-foreground">{author.user_email}</strong> mediante código por correo.</>
            ) : (
              "Invita a esta persona: recibirá un correo para entrar con un código de 6 dígitos."
            )}
          </p>
        </div>
        <KeyRound className="h-5 w-5 shrink-0 text-brand" />
      </div>

      {!hasAccess && (
        <Field id={`acc-email-${author.id}`} label="Correo de la cuenta" error={err("email")}>
          <input
            id={`acc-email-${author.id}`}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nombre@intelinota.com"
            className={cn(fieldClass, err("email") && "border-destructive")}
            {...formik.getFieldProps("email")}
          />
        </Field>
      )}

      <Field id={`acc-role-${author.id}`} label="Rol">
        <RoleSelect
          id={`acc-role-${author.id}`}
          value={formik.values.role}
          disabled={isSelf}
          onChange={(r) => void formik.setFieldValue("role", r)}
        />
      </Field>

      {formik.values.role === "author" && (
        <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
          <span>
            <span className="block text-sm font-medium">Puede publicar</span>
            <span className="block text-xs text-muted-foreground">Publica y programa sin pasar por revisión.</span>
          </span>
          <Switch checked={formik.values.can_publish} onCheckedChange={(c) => void formik.setFieldValue("can_publish", c)} />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="h-10" disabled={busy || (hasAccess && !formik.dirty)} onClick={() => formik.handleSubmit()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : hasAccess ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
          {hasAccess ? "Guardar acceso" : "Enviar invitación"}
        </Button>
        {hasAccess && !isSelf && (
          <Button type="button" variant="ghost" className="h-10 text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => setConfirmRevoke(true)}>
            <UserMinus className="mr-2 h-4 w-4" /> Quitar acceso
          </Button>
        )}
      </div>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">¿Quitar acceso a {author.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {author.user_email} ya no podrá entrar al panel. El perfil público y sus artículos se conservan; puedes volver a invitarle cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void revoke()}>
              Quitar acceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AuthorEditor({
  author,
  open,
  onOpenChange,
  selfUserId,
}: {
  author: AdminAuthor | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selfUserId: number | null;
}) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const slugCheck = useAppSelector((s) => s.adminAuthors.slugCheck);
  const saveError = useAppSelector((s) => s.adminAuthors.saveError);
  const slugTouchedByUser = useRef(false);
  const isNew = !author;

  const newUploadId = useRef(`author_new_${Date.now().toString(36)}`);
  // Re-seed only when a different author (or a fresh open) is shown, so access
  // changes saved from the nested section don't wipe unsaved profile edits.
  const initialValues = useMemo<AuthorFormValues>(
    () => ({
      name: author?.name ?? "",
      slug: author?.slug ?? "",
      bio: author?.bio ?? "",
      avatar_url: author?.avatar_url ?? "",
      email: author?.email ?? "",
      invite_email: "",
      invite_role: "author",
      invite_can_publish: false,
      ...(author ? socialValuesFrom(author.twitter_handle, author.social_links) : emptySocialValues),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [author?.id, open],
  );
  const formik = useFormik<AuthorFormValues>({
    enableReinitialize: true,
    initialValues,
    validationSchema: authorSchema,
    onSubmit: async (v) => {
      if (slugCheck.slug === v.slug && slugCheck.available === false) {
        formik.setFieldError("slug", "Ese slug ya está en uso");
        return;
      }
      const base = {
        name: v.name.trim(),
        slug: v.slug.trim(),
        bio: v.bio.trim() || null,
        avatar_url: v.avatar_url || null,
        email: v.email.trim() || null,
        twitter_handle: normalizeTwitter(v.twitter_handle),
        social_links: socialLinksFrom(v),
      };
      if (author) {
        const r = await dispatch(updateAdminAuthor({ id: author.id, payload: base }));
        if (updateAdminAuthor.fulfilled.match(r)) {
          toast({ title: "Autor actualizado", description: base.name });
          dispatch(fetchAdminAuthors());
          onOpenChange(false);
        } else {
          toast({ title: "No se pudo guardar", description: String(r.payload ?? ""), variant: "destructive" });
        }
        return;
      }
      const invite = v.invite_email.trim();
      const r = await dispatch(
        createAdminAuthor({
          ...base,
          access: invite
            ? { email: invite, role: v.invite_role, can_publish: v.invite_role === "admin" || v.invite_can_publish }
            : null,
        }),
      );
      if (createAdminAuthor.fulfilled.match(r)) {
        const { access, access_error } = r.payload;
        toast({
          title: "Autor creado",
          description: access_error
            ? `El perfil se creó, pero el acceso falló: ${access_error}`
            : access
              ? access.invite_sent
                ? `Invitación enviada a ${invite}.`
                : "Cuenta creada; no se pudo enviar el correo de invitación."
              : base.name,
          variant: access_error ? "destructive" : undefined,
        });
        dispatch(fetchAdminAuthors());
        onOpenChange(false);
      } else {
        toast({ title: "No se pudo crear", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  useEffect(() => {
    if (open) {
      slugTouchedByUser.current = !isNew;
      dispatch(resetSlugCheck());
      dispatch(clearSaveError());
    }
  }, [open, isNew, dispatch]);

  // Debounced slug availability
  const slug = formik.values.slug;
  useEffect(() => {
    if (!open || !slug || slug === author?.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
    const t = setTimeout(() => {
      dispatch(checkAuthorSlug({ slug, excludeId: author?.id ?? null }));
    }, 350);
    return () => clearTimeout(t);
  }, [slug, open, author?.slug, author?.id, dispatch]);

  const err = (k: keyof AuthorFormValues) => (formik.touched[k] && (formik.errors[k] as string | undefined)) || undefined;
  const slugState =
    !slug || slug === author?.slug ? null : slugCheck.slug !== slug || slugCheck.checking ? "checking" : slugCheck.available ? "ok" : slugCheck.available === false ? "taken" : null;
  const isSelf = Boolean(author && selfUserId && author.user_id === selfUserId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-0",
          isMobile ? "h-[92dvh] rounded-t-2xl" : "w-full sm:max-w-xl",
        )}
      >
        <SheetHeader className="border-b px-4 py-4 text-left sm:px-6">
          <p className="kicker">{isNew ? "Nuevo perfil" : "Editar perfil"}</p>
          <SheetTitle className="font-display text-2xl font-bold">{isNew ? "Agregar autor" : author!.name}</SheetTitle>
          <SheetDescription>Así aparece en la firma de cada nota y en su página de autor.</SheetDescription>
        </SheetHeader>

        <form id="author-form" noValidate onSubmit={formik.handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <ImageUploadCrop
              value={formik.values.avatar_url}
              onChange={(u) => void formik.setFieldValue("avatar_url", u)}
              uploadId={author ? `author_${author.id}` : newUploadId.current}
              aspectRatio={1}
              previewShape="circle"
              className="w-full"
            />
          </div>

          <Field id="au-name" label="Nombre" error={err("name")}>
            <input
              id="au-name"
              autoComplete="off"
              className={cn(fieldClass, err("name") && "border-destructive")}
              {...formik.getFieldProps("name")}
              onChange={(e) => {
                formik.handleChange(e);
                if (!slugTouchedByUser.current) void formik.setFieldValue("slug", toSlug(e.target.value));
              }}
            />
          </Field>

          <Field
            id="au-slug"
            label="Slug"
            error={err("slug") ?? (slugState === "taken" ? "Ese slug ya está en uso" : undefined)}
            hint={
              slugState === "checking" ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Comprobando</span>
              ) : slugState === "ok" ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> Disponible</span>
              ) : null
            }
          >
            <div className="flex items-center rounded-lg border bg-background focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <span className="pl-3 text-sm text-muted-foreground">/autor/</span>
              <input
                id="au-slug"
                autoComplete="off"
                className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none"
                {...formik.getFieldProps("slug")}
                onChange={(e) => {
                  slugTouchedByUser.current = true;
                  void formik.setFieldValue("slug", toSlug(e.target.value));
                }}
              />
            </div>
            {slugState === "taken" && slugCheck.suggestion && (
              <button type="button" className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => void formik.setFieldValue("slug", slugCheck.suggestion)}>
                Usar «{slugCheck.suggestion}»
              </button>
            )}
          </Field>

          <Field
            id="au-bio"
            label="Biografía"
            error={err("bio")}
            hint={<span className={cn("tabular-nums", formik.values.bio.length > BIO_MAX && "text-destructive")}>{formik.values.bio.length}/{BIO_MAX}</span>}
          >
            <textarea
              id="au-bio"
              rows={4}
              placeholder="Periodista especializada en…"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              {...formik.getFieldProps("bio")}
            />
          </Field>

          <Field id="au-email" label="Correo de contacto público" error={err("email")} hint="Opcional">
            <input id="au-email" type="email" inputMode="email" autoComplete="off" className={cn(fieldClass, err("email") && "border-destructive")} {...formik.getFieldProps("email")} />
          </Field>

          <div>
            <p className="mb-2 text-xs font-semibold">Redes</p>
            <SocialLinksFields formik={formik} idPrefix="au" />
          </div>

          {isNew ? (
            <section className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <div>
                <p className="kicker">Acceso al panel</p>
                <p className="mt-1 text-sm text-muted-foreground">Opcional. Si escribes un correo, le enviaremos una invitación para entrar.</p>
              </div>
              <Field id="au-invite" label="Correo de la cuenta" error={err("invite_email")}>
                <input id="au-invite" type="email" inputMode="email" autoComplete="off" placeholder="nombre@intelinota.com" className={cn(fieldClass, err("invite_email") && "border-destructive")} {...formik.getFieldProps("invite_email")} />
              </Field>
              {formik.values.invite_email.trim() && (
                <>
                  <Field id="au-invite-role" label="Rol">
                    <RoleSelect id="au-invite-role" value={formik.values.invite_role} onChange={(r) => void formik.setFieldValue("invite_role", r)} />
                  </Field>
                  {formik.values.invite_role === "author" && (
                    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                      <span className="text-sm font-medium">Puede publicar sin revisión</span>
                      <Switch checked={formik.values.invite_can_publish} onCheckedChange={(c) => void formik.setFieldValue("invite_can_publish", c)} />
                    </label>
                  )}
                </>
              )}
            </section>
          ) : (
            <AccessSection author={author!} isSelf={isSelf} />
          )}

          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        </form>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="ghost" className="h-10" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="author-form" className="h-10" disabled={formik.isSubmitting}>
            {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? "Crear autor" : "Guardar perfil"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Delete with reassignment ─────────────────────────────────

function DeleteAuthorDialog({
  author,
  others,
  onClose,
}: {
  author: AdminAuthor | null;
  others: AdminAuthor[];
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const total = author?.stats ? author.stats.published + author.stats.drafts + author.stats.in_review + author.stats.scheduled : 0;
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { reassign_to: "" },
    validationSchema: Yup.object({
      reassign_to: total > 0 ? Yup.string().required("Elige a quién pasar sus artículos") : Yup.string(),
    }),
    onSubmit: async (v) => {
      if (!author) return;
      setBusy(true);
      const target = v.reassign_to ? Number(v.reassign_to) : null;
      const r = await dispatch(deleteAdminAuthor({ id: author.id, reassignTo: target }));
      setBusy(false);
      if (deleteAdminAuthor.fulfilled.match(r)) {
        const to = others.find((o) => o.id === target);
        toast({ title: `${author.name} eliminado`, description: to ? `Sus ${total} artículos ahora son de ${to.name}.` : undefined });
        if (target) dispatch(fetchAdminAuthors());
        onClose();
      } else {
        toast({ title: "No se pudo eliminar", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  return (
    <AlertDialog open={Boolean(author)} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">¿Eliminar a {author?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {total > 0
              ? `Tiene ${total} ${total === 1 ? "artículo" : "artículos"}. Para no dejarlos sin firma, elige quién los firmará a partir de ahora.`
              : "No tiene artículos. Su página pública dejará de existir."}{" "}
            {author?.user_id && "Su cuenta perderá el acceso al panel."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {total > 0 && (
          <div>
            <label htmlFor="reassign" className="mb-1 block text-xs font-semibold">Reasignar artículos a</label>
            <select id="reassign" className={fieldClass} {...formik.getFieldProps("reassign_to")}>
              <option value="">Selecciona un autor…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {formik.touched.reassign_to && formik.errors.reassign_to && (
              <p role="alert" className="mt-1 text-xs text-destructive">{formik.errors.reassign_to}</p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10">Cancelar</AlertDialogCancel>
          <Button
            className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={() => formik.handleSubmit()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Eliminar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Page ──────────────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-display text-lg font-bold tabular-nums leading-none", tone)}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AdminAuthors() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const me = useAppSelector(selectAdminUser);
  const authors = useAppSelector(selectAdminAuthors);
  const loading = useAppSelector(selectAdminAuthorsLoading);
  const error = useAppSelector(selectAdminAuthorsError);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<AdminAuthor | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminAuthor | null>(null);

  useEffect(() => {
    if (me?.role === "admin") dispatch(fetchAdminAuthors());
  }, [dispatch, me?.role]);

  const counts = useMemo(
    () => ({
      all: authors.length,
      access: authors.filter((a) => a.user_id).length,
      noaccess: authors.filter((a) => !a.user_id).length,
      publish: authors.filter((a) => a.user_id && a.can_publish).length,
    }),
    [authors],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return authors.filter((a) => {
      if (filter === "access" && !a.user_id) return false;
      if (filter === "noaccess" && a.user_id) return false;
      if (filter === "publish" && !(a.user_id && a.can_publish)) return false;
      if (!needle) return true;
      return [a.name, a.slug, a.user_email, a.email].some((s) => s?.toLowerCase().includes(needle));
    });
  }, [authors, q, filter]);

  if (me && me.role !== "admin") return <Navigate to="/admin/dashboard" replace />;

  const openEditor = (a: AdminAuthor | null) => {
    setEditing(a);
    setSheetOpen(true);
  };

  const togglePublish = async (a: AdminAuthor, next: boolean) => {
    const r = await dispatch(setAuthorCanPublish({ id: a.id, can_publish: next }));
    if (setAuthorCanPublish.rejected.match(r)) {
      logger.warn("authors: can_publish toggle failed", r.payload);
      toast({ title: "No se pudo actualizar el permiso", description: String(r.payload ?? ""), variant: "destructive" });
      return;
    }
    toast({
      title: next ? `${a.name} ahora puede publicar` : `${a.name} vuelve a pasar por revisión`,
      action: (
        <ToastAction altText="Deshacer" onClick={() => dispatch(setAuthorCanPublish({ id: a.id, can_publish: !next }))}>
          Deshacer
        </ToastAction>
      ),
    });
  };

  const tabs: Array<{ v: Filter; label: string; n: number; icon: typeof Users }> = [
    { v: "all", label: "Todos", n: counts.all, icon: Users },
    { v: "access", label: "Con acceso", n: counts.access, icon: KeyRound },
    { v: "noaccess", label: "Sin acceso", n: counts.noaccess, icon: UserMinus },
    { v: "publish", label: "Pueden publicar", n: counts.publish, icon: BadgeCheck },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <MetaHead title="Equipo" noIndex includeSiteOrganization={false} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Redacción</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Equipo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Firmas, accesos al panel y permisos de publicación.</p>
        </div>
        <Button className="h-10" onClick={() => openEditor(null)}>
          <UserPlus className="mr-2 h-4 w-4" /> Nuevo autor
        </Button>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Filtro" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {tabs.map((t) => {
            const active = filter === t.v;
            return (
              <button
                key={t.v}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(t.v)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                  active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-background/20" : "bg-muted")}>{t.n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative lg:ml-auto lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="au-q" className="sr-only">Buscar autores</label>
          <input
            id="au-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {q && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQ("")} className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {loading && !authors.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-brand" strokeWidth={1.5} />
          <p className="mt-3 font-display text-xl font-semibold">{authors.length ? "Nadie coincide" : "Aún no hay autores"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {authors.length ? "Prueba con otra búsqueda o filtro." : "Crea el primer perfil para firmar artículos."}
          </p>
          {!authors.length && (
            <Button className="mt-4 h-10" onClick={() => openEditor(null)}>
              <UserPlus className="mr-2 h-4 w-4" /> Nuevo autor
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((a) => {
              const s = a.stats;
              const isSelf = Boolean(me && a.user_id === me.id);
              return (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="group flex flex-col rounded-xl border bg-card p-4 transition-shadow hover:shadow-md sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <AuthorAvatar author={a} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button type="button" onClick={() => openEditor(a)} className="truncate text-left font-display text-lg font-bold leading-tight hover:text-brand">
                          {a.name}
                        </button>
                        {isSelf && <span className="text-[11px] font-medium text-muted-foreground">(tú)</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <RoleBadge author={a} />
                      </div>
                      {a.user_email && (
                        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{a.user_email}</span>
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Acciones para ${a.name}`}
                          className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditor(a)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/autor/${a.slug}`} target="_blank">
                            <ExternalLink className="mr-2 h-4 w-4" /> Ver página pública
                          </Link>
                        </DropdownMenuItem>
                        {!isSelf && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(a)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 border-t pt-4">
                    <Stat label="Publicados" value={s?.published ?? 0} />
                    <Stat label="Borradores" value={s?.drafts ?? 0} />
                    <Stat label="En revisión" value={s?.in_review ?? 0} tone={s?.in_review ? "text-amber-600 dark:text-amber-400" : undefined} />
                    <Stat label="Vistas" value={formatNumber(s?.total_views ?? 0)} />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
                    <span
                      className="inline-flex items-center gap-1"
                      title={s?.last_published_at ? formatDate(s.last_published_at, { dateStyle: "long" }) : undefined}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {s?.last_published_at ? `Publicó ${formatRelative(s.last_published_at)}` : "Sin publicaciones"}
                    </span>
                    {a.user_id && a.user_role === "author" ? (
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 font-medium text-foreground">
                        Puede publicar
                        <Switch checked={Boolean(a.can_publish)} onCheckedChange={(c) => void togglePublish(a, c)} aria-label={`Permitir publicar a ${a.name}`} />
                      </label>
                    ) : !a.user_id ? (
                      <Button size="sm" variant="outline" className="h-10" onClick={() => openEditor(a)}>
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Invitar
                      </Button>
                    ) : (
                      <span className="inline-flex h-10 items-center gap-1 font-medium text-brand">
                        <BadgeCheck className="h-3.5 w-3.5" /> Publica siempre
                      </span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <AuthorEditor
        author={editing ? authors.find((x) => x.id === editing.id) ?? editing : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selfUserId={me?.id ?? null}
      />
      <DeleteAuthorDialog author={deleting} others={authors.filter((x) => x.id !== deleting?.id)} onClose={() => setDeleting(null)} />
    </div>
  );
}
