import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudOff,
  Eye,
  History,
  ImagePlus,
  Loader2,
  Monitor,
  PanelRight,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import type { ArticleStatus, ContentBlock } from "@shared/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import { fetchAdminAuthors, selectAdminAuthors } from "@/store/slices/adminAuthorsSlice";
import { fetchHome, selectHomeCategories } from "@/store/slices/homeSlice";
import {
  clearCurrent,
  fetchAdminArticle,
  selectAdminArticlesCurrent,
  selectAdminArticlesCurrentError,
} from "@/store/slices/adminArticlesSlice";
import { checkSlug, resetEditor, saveArticle, type EditorArticlePayload } from "@/store/slices/articleEditorSlice";
import { uploadMedia } from "@/store/slices/adminMediaSlice";
import { fetchArticleNotes, selectArticleNotes } from "@/store/slices/adminReviewsSlice";
import StoryEditor from "@/components/editor/StoryEditor";
import ImageUploadCrop from "@/components/ImageUploadCrop";
import RevisionsPanel from "@/components/admin/RevisionsPanel";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { blocksToHtml, countWords } from "@/lib/legacyBlocks";
import { resizeImageFile } from "@/lib/imageResize";
import { DEFAULT_NEWSROOM_TZ, formatInTz, isoToZonedLocal, zonedLocalToIso } from "@/lib/timezone";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Form model ─────────────────────────── */

interface EditorValues {
  title: string;
  excerpt: string;
  html: string;
  slug: string;
  category_id: string;
  subcategory_id: string;
  author_id: string;
  image_url: string;
  tags: string[];
  featured: boolean;
  trending: boolean;
  status: ArticleStatus;
  publish_local: string; // wall time in newsroom tz
  meta_title: string;
  meta_description: string;
}

const EMPTY: EditorValues = {
  title: "",
  excerpt: "",
  html: "",
  slug: "",
  category_id: "",
  subcategory_id: "",
  author_id: "",
  image_url: "",
  tags: [],
  featured: false,
  trending: false,
  status: "draft",
  publish_local: "",
  meta_title: "",
  meta_description: "",
};

/** Required to publish / submit (drafts autosave without full validation). */
const publishSchema = Yup.object({
  title: Yup.string().trim().min(10, "El título es muy corto").max(200).required("Escribe un título"),
  excerpt: Yup.string().trim().max(300, "Máximo 300 caracteres"),
  slug: Yup.string().matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones").required(),
  category_id: Yup.string().required("Elige una sección"),
  author_id: Yup.string().required("Elige un autor"),
  html: Yup.string().test("words", "La historia necesita al menos 50 palabras", (v) => countWords(v ?? "") >= 50),
  meta_title: Yup.string().max(70, "Máximo 70 caracteres"),
  meta_description: Yup.string().max(170, "Máximo 170 caracteres"),
});

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  draft: { label: "Borrador", dot: "bg-amber-500" },
  in_review: { label: "En revisión", dot: "bg-violet-500" },
  scheduled: { label: "Programado", dot: "bg-sky-500" },
  published: { label: "Publicado", dot: "bg-emerald-500" },
  archived: { label: "Archivado", dot: "bg-zinc-400" },
};

/** Canonical HTML: no inter-tag whitespace, no trailing empty paragraphs
 *  (TipTap keeps one at the end so the caret can always go below). */
function cleanHtml(html: string): string {
  return html
    .replace(/>\s+</g, "><")
    .replace(/(<p><\/p>)+$/g, "")
    .trim();
}

const backupKey = (id: number | null) => `intelinota_editor_backup_${id ?? "new"}`;

interface Backup {
  values: EditorValues;
  at: number;
}

function readBackup(id: number | null): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

/* ─────────────────────────── Component ─────────────────────────── */

export default function ArticleEditor() {
  const { id: idParam } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const user = useAppSelector(selectAdminUser);
  const categories = useAppSelector(selectHomeCategories);
  const authors = useAppSelector(selectAdminAuthors);
  const current = useAppSelector(selectAdminArticlesCurrent);
  const loadError = useAppSelector(selectAdminArticlesCurrentError);
  const editorState = useAppSelector((s) => s.articleEditor);

  const [articleId, setArticleId] = useState<number | null>(idParam ? Number(idParam) : null);
  const [serverStatus, setServerStatus] = useState<ArticleStatus>("draft");
  const [serverPublishedAt, setServerPublishedAt] = useState<string | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string>("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loaded, setLoaded] = useState(!idParam);
  const [dirty, setDirty] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"phone" | "desktop">("phone");
  const [conflict, setConflict] = useState(false);
  const [recover, setRecover] = useState<Backup | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [tagDraft, setTagDraft] = useState("");
  const [, forceTick] = useState(0);

  const updatedAtRef = useRef<string | null>(null);
  const newUploadId = useRef(`article_new_${Date.now()}`);
  const savingRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = user?.role === "admin";
  const canPublish = isAdmin || Boolean(user?.can_publish);
  const tz = user?.newsroom_timezone || DEFAULT_NEWSROOM_TZ;
  const notes = useAppSelector(selectArticleNotes(articleId ?? 0));
  const pendingRevision = (current as { pending_revision?: { id: number; created_at: string | null } | null } | null)?.pending_revision ?? null;
  const isLive = serverStatus === "published";

  /* ── Load ─────────────────────────────────────────────────────── */
  useEffect(() => {
    dispatch(fetchHome());
    if (isAdmin) dispatch(fetchAdminAuthors());
  }, [dispatch, isAdmin]);

  useEffect(() => {
    dispatch(resetEditor());
    if (articleId) {
      dispatch(fetchAdminArticle(articleId));
      dispatch(fetchArticleNotes(articleId));
    }
    return () => {
      dispatch(clearCurrent());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const formik = useFormik<EditorValues>({
    initialValues: EMPTY,
    validationSchema: publishSchema,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: () => undefined, // saving is explicit (autosave / publish dialog)
  });
  const v = formik.values;
  const formikValuesRef = useRef(v);
  formikValuesRef.current = v;

  // Populate from server once
  useEffect(() => {
    if (!articleId || loaded || !current || current.id !== articleId) return;
    const blocks = (current.blocks ?? []) as ContentBlock[];
    const html =
      blocks.length === 1 && blocks[0].type === "html"
        ? String((blocks[0].data as { html?: string }).html ?? "")
        : blocks.length
          ? blocksToHtml(blocks)
          : current.content ?? "";
    const c = current as typeof current & { updated_at?: string; meta_title?: string | null; meta_description?: string | null };
    const values: EditorValues = {
      title: current.title,
      excerpt: current.excerpt ?? "",
      html,
      slug: current.slug,
      category_id: String(current.category_id ?? ""),
      subcategory_id: current.subcategory_id ? String(current.subcategory_id) : "",
      author_id: String(current.author_id ?? ""),
      image_url: current.image_url ?? "",
      tags: current.tags ?? [],
      featured: Boolean(current.featured),
      trending: Boolean(current.trending),
      status: current.status,
      publish_local: isoToZonedLocal(current.published_at, tz),
      meta_title: c.meta_title ?? "",
      meta_description: c.meta_description ?? "",
    };
    formik.resetForm({ values });
    updatedAtRef.current = c.updated_at ?? null;
    setServerStatus(current.status);
    setServerPublishedAt(current.published_at);
    setOriginalSlug(current.slug);
    setSlugTouched(true);
    setLoaded(true);
    // Unsaved local work newer than the server copy?
    const b = readBackup(articleId);
    const serverTs = c.updated_at ? Date.parse(c.updated_at) : 0;
    if (b && b.at > serverTs + 2000 && (b.values.html !== values.html || b.values.title !== values.title)) setRecover(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, articleId, loaded]);

  // New article defaults (own author, first section) + recover unsaved new draft
  useEffect(() => {
    if (articleId || !user) return;
    if (!v.author_id && (user.author_id || authors[0]))
      formik.setFieldValue("author_id", String(user.author_id ?? authors[0]?.id ?? ""), false);
    if (!v.category_id && categories[0]) formik.setFieldValue("category_id", String(categories[0].id), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authors, categories, articleId]);

  useEffect(() => {
    if (articleId) return;
    const b = readBackup(null);
    if (b && (b.values.title || countWords(b.values.html) > 0)) setRecover(b);
  }, [articleId]);

  /* ── Derived ──────────────────────────────────────────────────── */
  const words = useMemo(() => countWords(v.html), [v.html]);
  const readMinutes = Math.max(1, Math.round(words / 200));
  const subcategories = categories.find((c) => String(c.id) === v.category_id)?.subcategories ?? [];
  const authorName =
    authors.find((a) => String(a.id) === v.author_id)?.name ?? (current?.author_name || user?.name || "Autor");

  // Auto slug from title until the writer edits it (or it's published)
  useEffect(() => {
    if (slugTouched || isLive) return;
    formik.setFieldValue("slug", slugify(v.title), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.title]);

  // Slug availability (debounced)
  useEffect(() => {
    if (!v.slug) return;
    const t = setTimeout(() => dispatch(checkSlug({ slug: v.slug, excludeId: articleId })), 450);
    return () => clearTimeout(t);
  }, [v.slug, articleId, dispatch]);
  const slugTaken = editorState?.slugCheck?.slug === v.slug && !editorState.slugCheck.available;

  /* ── Save ─────────────────────────────────────────────────────── */
  const buildPayload = useCallback(
    (status: ArticleStatus, publishedAt: string | null, force = false): EditorArticlePayload => ({
      title: v.title.trim() || "Sin título",
      slug: v.slug || slugify(v.title) || `borrador-${Date.now()}`,
      excerpt: v.excerpt.trim() || null,
      category_id: Number(v.category_id),
      subcategory_id: v.subcategory_id ? Number(v.subcategory_id) : null,
      author_id: Number(v.author_id),
      image_url: v.image_url || null,
      read_time_minutes: readMinutes,
      featured: v.featured,
      trending: v.trending,
      status,
      published_at: publishedAt,
      tags: v.tags,
      meta_title: v.meta_title.trim() || null,
      meta_description: v.meta_description.trim() || null,
      blocks: [{ position: 0, type: "html", data: { html: cleanHtml(v.html) } }],
      expected_updated_at: force ? null : updatedAtRef.current,
    }),
    [v, readMinutes],
  );

  const doSave = useCallback(
    async (opts: { status?: ArticleStatus; publishedAt?: string | null; autosave?: boolean; force?: boolean } = {}) => {
      if (savingRef.current) return null;
      if (!v.category_id || !v.author_id) return null;
      savingRef.current = true;
      const status = opts.status ?? serverStatus;
      const publishedAt = opts.publishedAt !== undefined ? opts.publishedAt : serverPublishedAt;
      const result = await dispatch(
        saveArticle({ id: articleId, payload: buildPayload(status, publishedAt, opts.force), autosave: opts.autosave }),
      );
      savingRef.current = false;
      if (saveArticle.rejected.match(result)) {
        if (!opts.autosave) toast({ title: "No se pudo guardar", description: String(result.payload ?? ""), variant: "destructive" });
        return null;
      }
      const out = result.payload;
      if (out.kind === "conflict") {
        setConflict(true);
        return out;
      }
      setDirty(false);
      baselineRef.current = snapshot(formikValuesRef.current);
      if (out.kind === "saved") {
        updatedAtRef.current = out.updated_at;
        setServerStatus(status);
        setServerPublishedAt(publishedAt);
        setOriginalSlug(buildPayload(status, publishedAt).slug);
        try {
          localStorage.removeItem(backupKey(articleId));
        } catch {
          /* ignore */
        }
        if (!articleId) {
          try {
            localStorage.removeItem(backupKey(null));
          } catch {
            /* ignore */
          }
          setArticleId(out.id);
          navigate(`/admin/articles/${out.id}/edit`, { replace: true });
        }
      }
      return out;
    },
    [v, articleId, serverStatus, serverPublishedAt, buildPayload, dispatch, navigate, toast],
  );

  // Dirty = differs from the last loaded/saved snapshot. The baseline is
  // captured shortly after load so the editor's HTML normalization of the
  // stored content doesn't count as a change.
  const baselineRef = useRef<string | null>(null);
  // Compare ignoring inter-tag whitespace (TipTap drops it on first update)
  const snapshot = (x: EditorValues) => JSON.stringify({ ...x, html: cleanHtml(x.html) });
  const serialized = snapshot(v);
  useEffect(() => {
    if (!loaded) return;
    baselineRef.current = null;
    const t = setTimeout(() => {
      baselineRef.current = snapshot(formikValuesRef.current);
      setDirty(false);
    }, 400);
    return () => clearTimeout(t);
  }, [loaded]);
  useEffect(() => {
    if (!loaded || baselineRef.current === null) return;
    const changed = serialized !== baselineRef.current;
    setDirty(changed);
    if (!changed) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(backupKey(articleId), JSON.stringify({ values: v, at: Date.now() } satisfies Backup));
      } catch {
        /* storage full */
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, loaded]);

  // Server autosave for drafts / in-review (never for live articles)
  const autosaveEligible = !isLive && serverStatus !== "scheduled" && v.title.trim().length > 0;
  useEffect(() => {
    if (!dirty || !autosaveEligible || offline || conflict) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void doSave({ autosave: true }), 4000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [dirty, autosaveEligible, offline, conflict, doSave]);

  // Online/offline + unload guard + Cmd/Ctrl+S
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isLive) setPublishOpen(true);
        else void doSave().then((r) => r?.kind === "saved" && toast({ title: "Guardado" }));
      }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", onKey);
    };
  }, [dirty, isLive, doSave, toast]);

  // Re-render the "Guardado hace Xs" label
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  /* ── Image upload (resized on device) ─────────────────────────── */
  const uploadInline = useCallback(
    async (file: File) => {
      const r = await resizeImageFile(file);
      const res = await dispatch(
        uploadMedia({
          data_base64: r.base64,
          mime_type: r.mime,
          filename: `${(articleId ? `article_${articleId}` : "article_new")}_${Date.now()}.${r.mime === "image/webp" ? "webp" : "jpg"}`,
        }),
      );
      if (uploadMedia.rejected.match(res)) throw new Error(String(res.payload ?? "No se pudo subir"));
      return res.payload.url;
    },
    [dispatch, articleId],
  );

  /* ── Publish flow ─────────────────────────────────────────────── */
  const checklist = [
    { ok: v.title.trim().length >= 10, label: "Título claro" },
    { ok: Boolean(v.image_url), label: "Imagen principal", soft: true },
    { ok: v.excerpt.trim().length >= 40, label: "Resumen (40+ caracteres)", soft: true },
    { ok: words >= 50, label: `Texto (${words} palabras)` },
    { ok: Boolean(v.category_id), label: "Sección" },
    { ok: !slugTaken, label: "URL disponible" },
  ];
  const blocking = checklist.filter((c) => !c.ok && !c.soft);

  async function confirmPublish() {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length || blocking.length) {
      formik.setTouched(Object.fromEntries(Object.keys(errors).map((k) => [k, true])), false);
      toast({ title: "Revisa antes de continuar", description: Object.values(errors)[0] as string ?? blocking[0]?.label, variant: "destructive" });
      return;
    }
    let status: ArticleStatus;
    let publishedAt: string | null = serverPublishedAt;
    if (!canPublish) {
      status = isLive ? "published" : "in_review"; // live → server stores a pending change
    } else if (scheduleMode === "later") {
      const iso = zonedLocalToIso(v.publish_local, tz);
      if (!iso || Date.parse(iso) < Date.now() + 60_000) {
        toast({ title: "Fecha inválida", description: "Elige una fecha futura.", variant: "destructive" });
        return;
      }
      status = "scheduled";
      publishedAt = iso;
    } else {
      status = "published";
      publishedAt = isLive ? serverPublishedAt : new Date().toISOString();
    }
    const out = await doSave({ status, publishedAt });
    if (!out || out.kind === "conflict") return;
    setPublishOpen(false);
    if (out.kind === "pending") {
      toast({ title: "Cambios enviados a revisión", description: "La versión publicada no cambia hasta que un editor los apruebe." });
    } else if (status === "in_review") {
      toast({ title: "Enviado a revisión", description: "Te avisaremos cuando un editor lo revise." });
    } else if (status === "scheduled") {
      toast({ title: "Programado", description: `Se publicará el ${formatInTz(publishedAt, tz)}.` });
    } else {
      toast({ title: isLive ? "Actualizado" : "¡Publicado!", description: v.title });
    }
  }

  const primaryLabel = !canPublish
    ? isLive
      ? "Enviar cambios"
      : serverStatus === "in_review"
        ? "Reenviar"
        : "Enviar a revisión"
    : isLive
      ? "Actualizar"
      : serverStatus === "scheduled"
        ? "Reprogramar"
        : "Publicar";

  const saveIndicator = offline ? (
    <span className="inline-flex items-center gap-1.5 text-amber-600"><CloudOff className="h-3.5 w-3.5" /> Sin conexión · copia local</span>
  ) : editorState?.saving ? (
    <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</span>
  ) : dirty ? (
    <span>{isLive ? "Cambios sin publicar" : "Cambios sin guardar"}</span>
  ) : editorState?.lastSavedAt ? (
    <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Guardado {formatRelative(new Date(editorState.lastSavedAt))}</span>
  ) : articleId ? (
    <span>Todo guardado</span>
  ) : (
    <span>Nuevo borrador</span>
  );

  /* ── Details panel (shared desktop / mobile sheet) ────────────── */
  const field = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  const label = "mb-1.5 block font-sans text-xs font-semibold text-muted-foreground";
  const metaTitle = v.meta_title || v.title;
  const metaDesc = v.meta_description || v.excerpt;

  const details = (
    <div className="space-y-7 pb-6">
      <section className="space-y-3">
        <h3 className="kicker !text-muted-foreground">Imagen principal</h3>
        <ImageUploadCrop
          value={v.image_url}
          onChange={(url: string) => formik.setFieldValue("image_url", url ?? "")}
          uploadId={articleId ? `article_${articleId}` : newUploadId.current}
          aspectRatio={16 / 9}
        />
      </section>

      <section className="space-y-3">
        <h3 className="kicker !text-muted-foreground">Clasificación</h3>
        <div>
          <label htmlFor="ed-cat" className={label}>Sección</label>
          <select id="ed-cat" className={field} {...formik.getFieldProps("category_id")} onChange={(e) => { formik.setFieldValue("category_id", e.target.value); formik.setFieldValue("subcategory_id", ""); }}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {subcategories.length > 0 && (
          <div>
            <label htmlFor="ed-sub" className={label}>Subsección</label>
            <select id="ed-sub" className={field} {...formik.getFieldProps("subcategory_id")}>
              <option value="">— Ninguna —</option>
              {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="ed-tags" className={label}>Temas</label>
          <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border bg-background p-1.5 focus-within:border-brand">
            {v.tags.map((t) => (
              <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-brand/10 pl-2.5 pr-1 text-xs font-medium">
                {t}
                <button type="button" aria-label={`Quitar ${t}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand/20" onClick={() => formik.setFieldValue("tags", v.tags.filter((x) => x !== t))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id="ed-tags"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === ",") && tagDraft.trim()) {
                  e.preventDefault();
                  const t = tagDraft.trim().slice(0, 40);
                  if (!v.tags.some((x) => x.toLowerCase() === t.toLowerCase()) && v.tags.length < 12) formik.setFieldValue("tags", [...v.tags, t]);
                  setTagDraft("");
                } else if (e.key === "Backspace" && !tagDraft && v.tags.length) {
                  formik.setFieldValue("tags", v.tags.slice(0, -1));
                }
              }}
              placeholder={v.tags.length ? "" : "IA, Liga MX… (Enter)"}
              className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none"
            />
          </div>
        </div>
        {isAdmin && (
          <div>
            <label htmlFor="ed-author" className={label}>Autor</label>
            <select id="ed-author" className={field} {...formik.getFieldProps("author_id")}>
              {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        {isAdmin && (
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Destacado en portada</span>
              <Switch checked={v.featured} onCheckedChange={(c) => formik.setFieldValue("featured", c)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Tendencia</span>
              <Switch checked={v.trending} onCheckedChange={(c) => formik.setFieldValue("trending", c)} />
            </label>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="kicker !text-muted-foreground">URL</h3>
        <div className="flex items-center rounded-lg border bg-background focus-within:border-brand">
          <span className="hidden pl-3 font-mono text-xs text-muted-foreground sm:inline">/articulo/</span>
          <input
            aria-label="URL del artículo"
            className="h-10 min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none"
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              formik.setFieldValue("slug", slugify(e.target.value));
            }}
          />
        </div>
        {slugTaken && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-destructive">
            Esta URL ya existe.
            <button type="button" className="font-semibold underline" onClick={() => formik.setFieldValue("slug", editorState!.slugCheck!.suggestion)}>
              Usar “{editorState?.slugCheck?.suggestion}”
            </button>
          </p>
        )}
        {isLive && v.slug !== originalSlug && (
          <p className="text-xs text-muted-foreground">La URL anterior redirigirá automáticamente a la nueva.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="kicker !text-muted-foreground">SEO y redes</h3>
        <div>
          <label htmlFor="ed-mt" className={cn(label, "flex justify-between")}>
            <span>Título SEO</span>
            <span className={cn("tabular-nums", (v.meta_title || v.title).length > 60 && "text-amber-600")}>{(v.meta_title || v.title).length}/60</span>
          </label>
          <input id="ed-mt" className={field} placeholder={v.title || "Usa el título del artículo"} {...formik.getFieldProps("meta_title")} />
        </div>
        <div>
          <label htmlFor="ed-md" className={cn(label, "flex justify-between")}>
            <span>Descripción SEO</span>
            <span className={cn("tabular-nums", metaDesc.length > 155 && "text-amber-600")}>{metaDesc.length}/155</span>
          </label>
          <textarea id="ed-md" rows={3} className={cn(field, "h-auto py-2")} placeholder={v.excerpt || "Usa el resumen"} {...formik.getFieldProps("meta_description")} />
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="font-sans text-[11px] text-muted-foreground">intelinota.com › articulo › {v.slug.slice(0, 30) || "…"}</p>
          <p className="mt-0.5 line-clamp-1 font-sans text-[15px] text-[#1a0dab] dark:text-[#8ab4f8]">{metaTitle || "Título del artículo"}</p>
          <p className="mt-0.5 line-clamp-2 font-sans text-xs text-muted-foreground">{metaDesc || "La descripción aparecerá aquí en Google."}</p>
        </div>
      </section>

      {notes.length > 0 && (
        <section className="space-y-2">
          <h3 className="kicker !text-muted-foreground">Notas de revisión</h3>
          <ol className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border bg-background p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{n.user_name ?? "Editor"}</span> ·{" "}
                  {{ returned: "devolvió", approved: "aprobó", published: "publicó", comment: "comentó" }[n.action]} · {formatRelative(n.created_at)}
                </p>
                {n.note && <p className="mt-1 whitespace-pre-wrap">{n.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {articleId && (
        <section>
          <RevisionsPanel articleId={articleId} onRestored={() => { setLoaded(false); dispatch(fetchAdminArticle(articleId)); }} />
        </section>
      )}
    </div>
  );

  /* ── Render ───────────────────────────────────────────────────── */
  if (articleId && !loaded) {
    return (
      <div className="mx-auto max-w-[720px] space-y-6 py-10">
        {loadError ? (
          <div className="text-center">
            <p className="font-display text-xl font-semibold">{loadError}</p>
            <Button asChild variant="outline" className="mt-4 h-10"><Link to="/admin/articles">Volver</Link></Button>
          </div>
        ) : (
          <>
            <Skeleton className="h-12 w-4/5" />
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
      </div>
    );
  }

  const st = STATUS_META[serverStatus] ?? STATUS_META.draft;

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] pb-24 sm:-m-6 md:pb-10">
      <MetaHead title={v.title ? `Editando: ${v.title}` : "Nuevo artículo"} noIndex includeSiteOrganization={false} />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Volver a artículos">
            <Link to="/admin/articles"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            <span className={cn("h-2 w-2 rounded-full", st.dot)} /> {st.label}
          </span>
          <span className="ml-1 hidden min-w-0 truncate text-xs text-muted-foreground sm:block" aria-live="polite">{saveIndicator}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="hidden h-10 w-10 sm:inline-flex" aria-label="Vista previa" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-10 w-10 lg:inline-flex"
              aria-label={panelOpen ? "Ocultar detalles" : "Mostrar detalles"}
              aria-pressed={panelOpen}
              onClick={() => setPanelOpen((o) => !o)}
            >
              <PanelRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 lg:hidden" aria-label="Detalles" onClick={() => setMobilePanel(true)}>
              <PanelRight className="h-5 w-5" />
            </Button>
            {!isLive && (
              <Button variant="outline" className="hidden h-10 sm:inline-flex" disabled={editorState?.saving} onClick={() => void doSave().then((r) => r?.kind === "saved" && toast({ title: "Guardado" }))}>
                Guardar
              </Button>
            )}
            <Button className="h-10 bg-brand px-4 text-brand-foreground hover:bg-brand/90" onClick={() => setPublishOpen(true)}>
              {canPublish ? null : <Send className="mr-1.5 h-4 w-4" />}
              {primaryLabel}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-1 text-[11px] text-muted-foreground sm:hidden">
          <span aria-live="polite">{saveIndicator}</span>
          <button type="button" className="inline-flex h-8 items-center gap-1 font-semibold text-foreground" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Vista previa
          </button>
        </div>
      </div>

      {/* Banners */}
      {recover && (
        <div className="mx-auto mt-4 flex max-w-[720px] flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <History className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1">Encontramos cambios sin guardar de {formatRelative(new Date(recover.at))}.</span>
          <Button size="sm" className="h-9" onClick={() => { formik.setValues(recover.values); setDirty(true); setRecover(null); }}>Recuperar</Button>
          <Button size="sm" variant="ghost" className="h-9" onClick={() => { try { localStorage.removeItem(backupKey(articleId)); } catch { /* ignore */ } setRecover(null); }}>Descartar</Button>
        </div>
      )}
      {(() => {
        const last = notes[0];
        return last && last.action === "returned" && serverStatus === "draft" ? (
          <div className="mx-auto mt-4 max-w-[720px] rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-sm">
            <p className="font-semibold">Devuelto con comentarios · {last.user_name ?? "Editor"} · {formatRelative(last.created_at)}</p>
            {last.note && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">“{last.note}”</p>}
          </div>
        ) : null;
      })()}
      {pendingRevision && (
        <div className="mx-auto mt-4 max-w-[720px] rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
          Tienes cambios enviados a revisión ({formatRelative(pendingRevision.created_at)}). Si vuelves a enviar, reemplazarán a los anteriores.
        </div>
      )}
      {isLive && !canPublish && (
        <div className="mx-auto mt-4 max-w-[720px] rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Este artículo está publicado. Tus cambios se enviarán a revisión y la versión publicada no cambiará hasta que un editor los apruebe.
        </div>
      )}

      {/* ── Canvas + panel ──────────────────────────────────────── */}
      <div className={cn("grid gap-0", panelOpen && "lg:grid-cols-[minmax(0,1fr)_360px]")}>
        <main className="min-w-0 px-4 pt-8 sm:px-8 sm:pt-12">
          <div className="mx-auto max-w-[720px]">
            {/* Cover */}
            {v.image_url ? (
              <button type="button" onClick={() => (window.innerWidth < 1024 ? setMobilePanel(true) : setPanelOpen(true))} className="group relative mb-8 block w-full overflow-hidden rounded-xl" aria-label="Cambiar imagen principal">
                <img src={v.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">Cambiar imagen</span>
              </button>
            ) : (
              <button type="button" onClick={() => (window.innerWidth < 1024 ? setMobilePanel(true) : setPanelOpen(true))} className="mb-6 inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                <ImagePlus className="h-4 w-4" /> Añadir imagen principal
              </button>
            )}

            {/* Title */}
            <label htmlFor="ed-title" className="sr-only">Título</label>
            <textarea
              id="ed-title"
              rows={1}
              value={v.title}
              onChange={(e) => {
                formik.setFieldValue("title", e.target.value.replace(/\n/g, " "));
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), document.getElementById("ed-excerpt")?.focus())}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              placeholder="Título"
              maxLength={200}
              className="w-full resize-none overflow-hidden bg-transparent font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] outline-none placeholder:text-muted-foreground/40 sm:text-[2.6rem]"
            />
            {formik.touched.title && formik.errors.title && <p role="alert" className="text-sm text-destructive">{formik.errors.title}</p>}

            {/* Dek */}
            <label htmlFor="ed-excerpt" className="sr-only">Resumen</label>
            <textarea
              id="ed-excerpt"
              rows={2}
              value={v.excerpt}
              onChange={(e) => {
                formik.setFieldValue("excerpt", e.target.value.replace(/\n/g, " "));
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
              placeholder="Resumen: una o dos frases que enganchen al lector"
              maxLength={300}
              className="mt-3 w-full resize-none overflow-hidden bg-transparent font-body text-lg leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/40 sm:text-xl"
            />

            <div className="mb-6 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-4 text-xs text-muted-foreground">
              <span>Por <span className="font-semibold text-foreground">{authorName}</span></span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{words.toLocaleString("es-MX")} palabras</span>
              <span aria-hidden>·</span>
              <span>{readMinutes} min de lectura</span>
              <span className="ml-auto hidden md:inline">Escribe <kbd className="rounded border px-1 font-sans">/</kbd> para insertar · <kbd className="rounded border px-1 font-sans">⌘S</kbd> guardar</span>
            </div>

            <StoryEditor value={v.html} onChange={(html) => formik.setFieldValue("html", html, false)} onUploadImage={uploadInline} />
            {formik.errors.html && formik.submitCount > 0 && <p role="alert" className="mt-2 text-sm text-destructive">{formik.errors.html}</p>}
          </div>
        </main>

        {panelOpen && (
          <aside className="hidden border-l bg-card/40 lg:block" aria-label="Detalles del artículo">
            <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto px-5 pt-6">{details}</div>
          </aside>
        )}
      </div>

      {/* Mobile details sheet */}
      <Sheet open={mobilePanel} onOpenChange={setMobilePanel}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left font-display">Detalles del artículo</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{details}</div>
        </SheetContent>
      </Sheet>

      {/* Publish / submit dialog */}
      <Sheet open={publishOpen} onOpenChange={setPublishOpen}>
        <SheetContent side={window.innerWidth < 640 ? "bottom" : "right"} className="w-full overflow-y-auto sm:max-w-md max-sm:max-h-[90vh] max-sm:rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left font-display text-2xl">{primaryLabel}</SheetTitle>
          </SheetHeader>
          <div className="mt-5 space-y-6">
            <ul className="space-y-2">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2.5 text-sm">
                  {c.ok ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>
                  ) : c.soft ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"><X className="h-3 w-3" /></span>
                  )}
                  <span className={cn(!c.ok && !c.soft && "font-semibold")}>{c.label}</span>
                  {!c.ok && c.soft && <span className="text-xs text-muted-foreground">(recomendado)</span>}
                </li>
              ))}
            </ul>

            {canPublish && !isLive && (
              <div className="space-y-2">
                <p className="kicker !text-muted-foreground">Cuándo</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["now", "later"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setScheduleMode(m)} aria-pressed={scheduleMode === m}
                      className={cn("h-11 rounded-lg border text-sm font-semibold", scheduleMode === m ? "border-brand bg-brand/10 ring-1 ring-brand/30" : "hover:border-foreground/40")}>
                      {m === "now" ? "Ahora" : "Programar"}
                    </button>
                  ))}
                </div>
                {scheduleMode === "later" && (
                  <div>
                    <input type="datetime-local" className={cn(field, "mt-2")} value={v.publish_local} onChange={(e) => formik.setFieldValue("publish_local", e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">Hora de la redacción ({tz.replace("_", " ")})</p>
                  </div>
                )}
              </div>
            )}

            {!canPublish && (
              <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                {isLive
                  ? "Tus cambios quedarán pendientes hasta que un editor los apruebe. El artículo publicado no cambiará mientras tanto."
                  : "Un editor revisará tu historia. Recibirás una notificación cuando sea aprobada o si necesita cambios."}
              </p>
            )}

            <Button className="h-12 w-full bg-brand text-base text-brand-foreground hover:bg-brand/90" disabled={editorState?.saving || blocking.length > 0} onClick={() => void confirmPublish()}>
              {editorState?.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {canPublish
                ? isLive
                  ? "Actualizar publicación"
                  : scheduleMode === "later"
                    ? "Programar publicación"
                    : "Publicar ahora"
                : isLive
                  ? "Enviar cambios a revisión"
                  : "Enviar a revisión"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[92vh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 p-0 sm:w-full">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <DialogTitle className="font-display text-lg">Vista previa</DialogTitle>
            <div className="ml-auto inline-flex rounded-lg border p-0.5">
              {([["phone", Smartphone, "Móvil"], ["desktop", Monitor, "Escritorio"]] as const).map(([d, Icon, l]) => (
                <button key={d} type="button" onClick={() => setPreviewDevice(d)} aria-pressed={previewDevice === d} aria-label={l}
                  className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", previewDevice === d ? "bg-foreground text-background" : "text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/40 p-4">
            <article className={cn("mx-auto rounded-xl bg-background shadow-sm transition-all", previewDevice === "phone" ? "max-w-[390px] p-4" : "max-w-[900px] p-10")}>
              <p className="kicker">{categories.find((c) => String(c.id) === v.category_id)?.name}</p>
              <h1 className={cn("mt-3 font-display font-bold leading-[1.08] tracking-[-0.02em]", previewDevice === "phone" ? "text-[1.9rem]" : "text-[2.8rem]")}>{v.title || "Título"}</h1>
              {v.excerpt && <p className="mt-3 font-body text-lg text-muted-foreground">{v.excerpt}</p>}
              <p className="mt-4 border-y py-3 text-sm"><span className="font-semibold">{authorName}</span> · {readMinutes} min de lectura</p>
              {v.image_url && <img src={v.image_url} alt="" className="mt-6 aspect-[16/9] w-full rounded-lg object-cover" />}
              <div className="article-content mt-6" dangerouslySetInnerHTML={{ __html: v.html }} />
            </article>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict */}
      <Dialog open={conflict} onOpenChange={setConflict}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md sm:w-full">
          <DialogTitle className="font-display text-xl">Alguien más editó este artículo</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Se guardó otra versión mientras escribías. Tu texto está a salvo en este dispositivo.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <Button className="h-11" onClick={() => { setConflict(false); void doSave({ force: true }); }}>Guardar mi versión</Button>
            <Button variant="outline" className="h-11" onClick={() => { setConflict(false); setLoaded(false); if (articleId) dispatch(fetchAdminArticle(articleId)); }}>
              Cargar la otra versión
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Si cargas la otra versión podrás recuperar la tuya desde el aviso de cambios sin guardar.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
