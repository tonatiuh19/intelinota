import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Navigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Loader2, Lock, MessageSquare, Newspaper, Rocket, Unlock, X } from "lucide-react";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminSettings,
  updateAdminSettings,
  selectAdminSettings,
  selectAdminSettingsLoading,
} from "@/store/slices/adminSettingsSlice";
import { DEFAULT_NEWSROOM_TZ } from "@/lib/timezone";
import { formatRelative } from "@/lib/format";
import { parseChips } from "@/lib/taxonomy";
import { logger } from "@/utils/logger";
import { cn } from "@/lib/utils";

const TIMEZONES: Array<{ group: string; zones: Array<[string, string]> }> = [
  {
    group: "México",
    zones: [
      ["America/Mexico_City", "Ciudad de México"],
      ["America/Monterrey", "Monterrey"],
      ["America/Cancun", "Cancún"],
      ["America/Chihuahua", "Chihuahua"],
      ["America/Mazatlan", "Mazatlán"],
      ["America/Tijuana", "Tijuana"],
    ],
  },
  {
    group: "Latinoamérica",
    zones: [
      ["America/Guatemala", "Guatemala / Centroamérica"],
      ["America/Bogota", "Bogotá"],
      ["America/Lima", "Lima"],
      ["America/Caracas", "Caracas"],
      ["America/Santiago", "Santiago"],
      ["America/Argentina/Buenos_Aires", "Buenos Aires"],
      ["America/Sao_Paulo", "São Paulo"],
      ["America/Montevideo", "Montevideo"],
    ],
  },
  { group: "España", zones: [["Europe/Madrid", "Madrid"], ["Atlantic/Canary", "Canarias"]] },
  {
    group: "Estados Unidos",
    zones: [
      ["America/New_York", "Nueva York (Este)"],
      ["America/Chicago", "Chicago (Centro)"],
      ["America/Denver", "Denver (Montaña)"],
      ["America/Los_Angeles", "Los Ángeles (Pacífico)"],
    ],
  },
  { group: "Otro", zones: [["UTC", "UTC"]] },
];
const ALL_ZONES = TIMEZONES.flatMap((g) => g.zones.map(([z]) => z));

const schema = Yup.object({
  newsroom_timezone: Yup.string().required("Elige una zona horaria"),
  comment_blocklist: Yup.array(Yup.string().trim().max(60, "Máximo 60 caracteres")).max(500, "Máximo 500 términos"),
  edit_version: Yup.boolean(),
  app_version: Yup.string().when("edit_version", {
    is: true,
    then: (s) => s.trim().matches(/^[\w.+-]{1,40}$/, "Formato inválido (ej. v1.4.2)").required("Obligatorio"),
  }),
});

type Values = { newsroom_timezone: string; comment_blocklist: string[]; edit_version: boolean; app_version: string };

function nowIn(tz: string) {
  try {
    return new Intl.DateTimeFormat("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short" }).format(new Date());
  } catch {
    return "";
  }
}

function Card({ icon: Icon, title, desc, children }: { icon: typeof Clock; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function ChipEditor({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const next = [...value];
    for (const t of raw.split(",")) {
      const term = t.trim().toLowerCase();
      if (term && !next.includes(term)) next.push(term);
    }
    onChange(next);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-background p-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <AnimatePresence initial={false}>
          {value.map((t) => (
            <motion.span
              key={t}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-3 pr-0.5 text-sm"
            >
              {t}
              <button type="button" aria-label={`Quitar ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-background">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <label htmlFor="blocklist-input" className="sr-only">Añadir término</label>
        <input
          id="blocklist-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft.trim() && add(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.includes(",")) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder={value.length ? "Añadir…" : "Escribe una palabra y pulsa Enter"}
          className="h-9 min-w-[8rem] flex-1 bg-transparent px-2 text-sm outline-none"
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        {error ? <p role="alert" className="text-destructive">{error}</p> : <span>Enter o coma para añadir. Se guarda separado por comas.</span>}
        <span className="tabular-nums">{value.length}</span>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const items = useAppSelector(selectAdminSettings);
  const loading = useAppSelector(selectAdminSettingsLoading);
  const error = useAppSelector((s) => s.adminSettings.error);

  useEffect(() => {
    dispatch(fetchAdminSettings());
  }, [dispatch]);

  const byKey = useMemo(() => new Map(items.map((i) => [i.setting_key, i])), [items]);
  const initial: Values = {
    newsroom_timezone: byKey.get("newsroom_timezone")?.setting_value || DEFAULT_NEWSROOM_TZ,
    comment_blocklist: parseChips(byKey.get("comment_blocklist")?.setting_value),
    edit_version: false,
    app_version: byKey.get("app_version")?.setting_value ?? "",
  };

  const formik = useFormik<Values>({
    enableReinitialize: true,
    initialValues: initial,
    validationSchema: schema,
    onSubmit: async (v, helpers) => {
      const changes: Array<{ key: string; value: string }> = [];
      if (v.newsroom_timezone !== initial.newsroom_timezone) changes.push({ key: "newsroom_timezone", value: v.newsroom_timezone });
      const bl = v.comment_blocklist.join(",");
      if (bl !== initial.comment_blocklist.join(",")) changes.push({ key: "comment_blocklist", value: bl });
      if (v.edit_version && v.app_version.trim() !== initial.app_version) changes.push({ key: "app_version", value: v.app_version.trim() });
      if (!changes.length) return;
      const prev = changes.map((c) => ({
        key: c.key,
        value: c.key === "comment_blocklist" ? initial.comment_blocklist.join(",") : c.key === "newsroom_timezone" ? initial.newsroom_timezone : initial.app_version,
      }));
      const r = await dispatch(updateAdminSettings(changes));
      if (updateAdminSettings.fulfilled.match(r)) {
        helpers.setFieldValue("edit_version", false);
        toast({
          title: "Configuración guardada",
          action: (
            <ToastAction altText="Deshacer" onClick={() => void dispatch(updateAdminSettings(prev))}>
              Deshacer
            </ToastAction>
          ),
        });
      } else {
        logger.warn("settings save failed", r.payload);
        toast({ title: "No se pudo guardar", description: String(r.payload ?? ""), variant: "destructive" });
      }
    },
  });

  if (user?.role !== "admin") return <Navigate to="/admin/dashboard" replace />;

  const updated = (key: string) => {
    const at = byKey.get(key)?.updated_at;
    return at ? <span className="text-xs text-muted-foreground">Actualizado {formatRelative(at)}</span> : null;
  };
  const tzKnown = ALL_ZONES.includes(formik.values.newsroom_timezone);

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="mx-auto max-w-3xl space-y-6 pb-28">
      <MetaHead title="Configuración" noIndex includeSiteOrganization={false} />
      <header>
        <p className="kicker">Sistema</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ajustes globales de la redacción y del sitio.</p>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {loading && !items.length ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card icon={Newspaper} title="Redacción" desc="Cómo trabaja el equipo editorial.">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor="tz" className="text-sm font-semibold">Zona horaria de la redacción</label>
                {updated("newsroom_timezone")}
              </div>
              <select id="tz" className="mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" {...formik.getFieldProps("newsroom_timezone")}>
                {!tzKnown && <option value={formik.values.newsroom_timezone}>{formik.values.newsroom_timezone}</option>}
                {TIMEZONES.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.zones.map(([z, label]) => (
                      <option key={z} value={z}>{label} — {z}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Ahora allí: <span className="font-medium capitalize text-foreground">{nowIn(formik.values.newsroom_timezone)}</span>. Las publicaciones programadas se escriben y muestran en esta zona.
              </p>
            </div>
          </Card>

          <Card icon={MessageSquare} title="Comentarios" desc="Moderación automática de la conversación.">
            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">Palabras bloqueadas</p>
                {updated("comment_blocklist")}
              </div>
              <ChipEditor
                value={formik.values.comment_blocklist}
                onChange={(v) => void formik.setFieldValue("comment_blocklist", v)}
                error={typeof formik.errors.comment_blocklist === "string" ? formik.errors.comment_blocklist : undefined}
              />
              <p className="mt-2 text-xs text-muted-foreground">Los comentarios que contienen estos términos suben su puntuación de riesgo y se marcan para revisión.</p>
            </div>
          </Card>

          <Card icon={Rocket} title="Sitio" desc="Información del despliegue.">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor="app_version" className="text-sm font-semibold">Versión de la app</label>
                {updated("app_version")}
              </div>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="app_version"
                  readOnly={!formik.values.edit_version}
                  className={cn(
                    "h-10 w-full rounded-lg border px-3 font-mono text-sm outline-none sm:max-w-xs",
                    formik.values.edit_version ? "bg-background focus:border-brand focus:ring-2 focus:ring-brand/20" : "cursor-default bg-muted/50 text-muted-foreground",
                  )}
                  {...formik.getFieldProps("app_version")}
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={formik.values.edit_version}
                    onCheckedChange={(v) => {
                      void formik.setFieldValue("edit_version", v);
                      if (!v) void formik.setFieldValue("app_version", initial.app_version);
                    }}
                  />
                  {formik.values.edit_version ? <Unlock className="h-4 w-4 text-amber-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                  Editar manualmente
                </label>
              </div>
              {formik.touched.app_version && formik.errors.app_version && <p role="alert" className="mt-1 text-xs text-destructive">{formik.errors.app_version}</p>}
              <p className="mt-1.5 text-xs text-muted-foreground">
                La fija el despliegue (<code className="rounded bg-muted px-1">npm run deploy:prod</code>) y aparece en el footer público. Edítala solo si corriges un despliegue manual.
              </p>
            </div>
          </Card>
        </>
      )}

      <AnimatePresence>
        {formik.dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:left-64"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
              <span className="text-sm font-semibold">Cambios sin guardar</span>
              <Button type="button" variant="ghost" className="ml-auto h-10" onClick={() => formik.resetForm()}>Descartar</Button>
              <Button type="submit" className="h-10 bg-brand text-brand-foreground hover:bg-brand/90" disabled={formik.isSubmitting}>
                {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
