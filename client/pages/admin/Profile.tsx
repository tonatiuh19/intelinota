import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Shield,
  Twitter,
  Youtube,
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import MetaHead from "@/components/MetaHead";
import ImageUploadCrop from "@/components/ImageUploadCrop";
import McpConnectionsCard from "@/components/admin/McpConnectionsCard";
import SocialLinksFields, {
  fieldClass,
  normalizeTwitter,
  socialLinksFrom,
  socialSchemaFields,
  socialValuesFrom,
  type SocialFormValues,
} from "@/components/admin/SocialLinksFields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  logout,
  selectAdminMeLoading,
  selectAdminUser,
  updateMyProfile,
} from "@/store/slices/adminAuthSlice";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";

const BIO_MAX = 600;

interface ProfileValues extends SocialFormValues {
  name: string;
  avatar_url: string;
  bio: string;
}

const profileSchema = Yup.object({
  name: Yup.string().trim().min(2, "Mínimo 2 caracteres").max(150, "Máximo 150 caracteres").required("Tu nombre es obligatorio"),
  avatar_url: Yup.string(),
  bio: Yup.string().max(BIO_MAX, `Máximo ${BIO_MAX} caracteres`),
  ...socialSchemaFields,
});

function Section({
  kicker,
  title,
  description,
  children,
  delay = 0,
}: {
  kicker: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="rounded-xl border bg-card p-4 sm:p-6"
    >
      <p className="kicker">{kicker}</p>
      <h2 className="mt-1 font-display text-xl font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function tzLabel(tz: string | undefined) {
  if (!tz) return "—";
  try {
    const now = new Intl.DateTimeFormat("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date());
    return `${tz.replace(/_/g, " ")} · ${now}`;
  } catch {
    return tz;
  }
}

const SOCIAL_ICONS: Array<{ key: keyof SocialFormValues; icon: React.ElementType; label: string }> = [
  { key: "twitter_handle", icon: Twitter, label: "X" },
  { key: "social_instagram", icon: Instagram, label: "Instagram" },
  { key: "social_linkedin", icon: Linkedin, label: "LinkedIn" },
  { key: "social_facebook", icon: Facebook, label: "Facebook" },
  { key: "social_youtube", icon: Youtube, label: "YouTube" },
  { key: "social_tiktok", icon: FaTiktok, label: "TikTok" },
  { key: "social_website", icon: Globe, label: "Sitio web" },
];

/** Mirrors the article byline + author page header. */
function BylinePreview({ values, hasAuthor }: { values: ProfileValues; hasAuthor: boolean }) {
  const name = values.name.trim() || "Tu nombre";
  const socials = SOCIAL_ICONS.filter((s) => values[s.key].trim());
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vista previa</div>
      <div className="p-4 sm:p-5">
        <p className="kicker">Firma en artículos</p>
        <div className="mt-3 flex items-center gap-3">
          {values.avatar_url ? (
            <img src={values.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 font-display text-sm font-bold text-brand">
              {name[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold">Por {name}</p>
            <p className="text-xs text-muted-foreground">Hace 2 horas · 4 min de lectura</p>
          </div>
        </div>

        <div className="my-5 border-t" />

        <p className="kicker">Página de autor</p>
        <div className="mt-3 flex flex-col items-center text-center">
          {values.avatar_url ? (
            <img src={values.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-brand/20" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 font-display text-2xl font-bold text-brand">
              {name[0]?.toUpperCase()}
            </span>
          )}
          <p className="mt-3 font-display text-xl font-bold">{name}</p>
          {values.bio.trim() ? (
            <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-muted-foreground">{values.bio}</p>
          ) : (
            <p className="mt-2 text-sm italic text-muted-foreground/70">Sin biografía todavía.</p>
          )}
          {socials.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {socials.map(({ key, icon: Icon, label }) => (
                <span key={key} title={label} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          )}
        </div>
        {!hasAuthor && (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Tu cuenta no tiene perfil de autor vinculado: la biografía y redes no se mostrarán hasta que un administrador lo vincule.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAppSelector(selectAdminUser);
  const meLoading = useAppSelector(selectAdminMeLoading);
  const hasAuthor = Boolean(user?.author_id);

  const initialValues = useMemo<ProfileValues>(
    () => ({
      name: user?.name ?? "",
      avatar_url: user?.avatar_url ?? "",
      bio: user?.bio ?? "",
      ...socialValuesFrom(user?.twitter_handle, user?.social_links),
    }),
    [user],
  );

  const formik = useFormik<ProfileValues>({
    enableReinitialize: true,
    initialValues,
    validationSchema: profileSchema,
    onSubmit: async (v) => {
      const payload: Parameters<typeof updateMyProfile>[0] = {
        name: v.name.trim(),
        avatar_url: v.avatar_url,
      };
      if (hasAuthor) {
        payload.bio = v.bio.trim();
        payload.twitter_handle = normalizeTwitter(v.twitter_handle) ?? "";
        payload.social_links = socialLinksFrom(v);
      }
      const r = await dispatch(updateMyProfile(payload));
      if (updateMyProfile.fulfilled.match(r)) {
        toast({ title: "Perfil guardado", description: "Los cambios ya se ven en tus artículos." });
      } else {
        logger.warn("profile: save failed", r.payload);
        toast({ title: "No se pudo guardar", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  const handleLogout = () => {
    dispatch(logout());
    navigate("/admin/login", { replace: true });
  };

  if (meLoading && !user) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-16 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const err = (k: keyof ProfileValues) => (formik.touched[k] && (formik.errors[k] as string | undefined)) || undefined;
  const isAdmin = user?.role === "admin";
  const canPublish = isAdmin || Boolean(user?.can_publish);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <MetaHead title="Mi perfil" noIndex includeSiteOrganization={false} />

      <header>
        <p className="kicker">Tu cuenta</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tu acceso, tu firma pública y tus conexiones.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section kicker="Cuenta" title="Acceso al panel">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Correo</dt>
                <dd className="mt-1 truncate text-sm font-medium">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rol</dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      isAdmin ? "bg-brand/10 text-brand" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {isAdmin ? <Shield className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                    {isAdmin ? "Administrador" : "Autor"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Publicación</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm">
                  {canPublish ? (
                    <><BadgeCheck className="h-4 w-4 text-brand" /> Puede publicar y programar</>
                  ) : (
                    <span className="text-muted-foreground">Envía a revisión antes de publicar</span>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Zona horaria de la redacción</dt>
                <dd className="mt-1 truncate text-sm">{tzLabel(user?.newsroom_timezone)}</dd>
              </div>
            </dl>
          </Section>

          <Section
            kicker="Perfil público"
            title="Tu firma"
            description="Aparece en la firma de tus artículos y en tu página de autor."
            delay={0.05}
          >
            <form noValidate onSubmit={formik.handleSubmit} className="space-y-5">
              <ImageUploadCrop
                value={formik.values.avatar_url}
                onChange={(u) => void formik.setFieldValue("avatar_url", u, false)}
                uploadId={user?.author_id ? `author_${user.author_id}` : `user_${user?.id ?? "temp"}`}
                aspectRatio={1}
                previewShape="circle"
                label="Foto"
              />

              <div>
                <label htmlFor="pf-name" className="mb-1 block text-xs font-semibold">Nombre</label>
                <input id="pf-name" autoComplete="name" className={cn(fieldClass, err("name") && "border-destructive")} {...formik.getFieldProps("name")} />
                {err("name") && <p role="alert" className="mt-1 text-xs text-destructive">{err("name")}</p>}
              </div>

              {hasAuthor && (
                <>
                  <div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <label htmlFor="pf-bio" className="text-xs font-semibold">Biografía</label>
                      <span className={cn("text-[11px] tabular-nums text-muted-foreground", formik.values.bio.length > BIO_MAX && "text-destructive")}>
                        {formik.values.bio.length}/{BIO_MAX}
                      </span>
                    </div>
                    <textarea
                      id="pf-bio"
                      rows={4}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      {...formik.getFieldProps("bio")}
                    />
                    {err("bio") && <p role="alert" className="mt-1 text-xs text-destructive">{err("bio")}</p>}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold">Redes</p>
                    <SocialLinksFields formik={formik} idPrefix="pf" />
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                {formik.dirty && (
                  <Button type="button" variant="ghost" className="h-10" onClick={() => formik.resetForm()}>
                    Descartar
                  </Button>
                )}
                <Button type="submit" className="h-10" disabled={formik.isSubmitting || !formik.dirty}>
                  {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar cambios
                </Button>
              </div>
            </form>
          </Section>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
            <McpConnectionsCard />
          </motion.div>

          <Section kicker="Sesión" title="Cerrar sesión" description="Sal del panel en este dispositivo. Tus borradores autoguardados se conservan." delay={0.15}>
            <Button variant="outline" className="h-10" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </Button>
          </Section>
        </div>

        <aside>
          <div className="lg:sticky lg:top-20">
            <BylinePreview values={formik.values} hasAuthor={hasAuthor} />
          </div>
        </aside>
      </div>
    </div>
  );
}
