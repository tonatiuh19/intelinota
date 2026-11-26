import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminArticle,
  createAdminArticle,
  updateAdminArticle,
  clearCurrent,
  clearSaveError,
  selectAdminArticlesCurrent,
  selectAdminArticlesCurrentLoading,
  selectAdminArticlesCurrentError,
  selectAdminArticlesSaving,
  selectAdminArticlesSaveError,
  fetchFeaturedCount,
  selectAdminArticlesFeaturedCount,
} from "@/store/slices/adminArticlesSlice";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  selectAdminAuthors,
  fetchAdminAuthors,
} from "@/store/slices/adminAuthorsSlice";
import { fetchHome, selectHomeCategories } from "@/store/slices/homeSlice";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RichHtmlEditor from "@/components/RichHtmlEditor";
import ArticleBlock from "@/components/ArticleBlock";
import type {
  ArticleStatus,
  ContentBlockType,
  ContentBlock,
  ContentBlockData,
  UpsertBlockPayload,
} from "@shared/api";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Code2,
  Image as ImageIcon,
  Youtube,
  Twitter,
  Instagram,
  Quote,
  Minus,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ImageUploadCrop from "@/components/ImageUploadCrop";
import RevisionsPanel from "@/components/admin/RevisionsPanel";

// ── Slug generator ────────────────────────────────────────────
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

// ── Block type config ─────────────────────────────────────────
const BLOCK_TYPES: Array<{
  type: ContentBlockType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = [
  { type: "html", icon: Code2, label: "HTML" },
  { type: "image", icon: ImageIcon, label: "Imagen" },
  { type: "youtube", icon: Youtube, label: "YouTube" },
  { type: "twitter", icon: Twitter, label: "Twitter" },
  { type: "instagram", icon: Instagram, label: "Instagram" },
  { type: "quote", icon: Quote, label: "Cita" },
  { type: "divider", icon: Minus, label: "Divisor" },
];

const defaultBlockData = (type: ContentBlockType): ContentBlockData => {
  switch (type) {
    case "html":
      return { html: "" };
    case "image":
      return { url: "", caption: "", alt: "", credit: "" };
    case "youtube":
      return { video_id: "", caption: "" };
    case "twitter":
      return { tweet_url: "", tweet_id: "" };
    case "instagram":
      return { post_url: "" };
    case "quote":
      return { text: "", attribution: "" };
    default:
      return {};
  }
};

// ── Block editor components ───────────────────────────────────
function BlockEditor({
  block,
  onChange,
  articleUploadId,
  blockIndex,
}: {
  block: UpsertBlockPayload;
  onChange: (data: ContentBlockData) => void;
  articleUploadId: string;
  blockIndex: number;
}) {
  const data = block.data as Record<string, string>;

  const field = (
    key: string,
    label_: string,
    multiline = false,
    placeholder = "",
  ) => (
    <div className="space-y-1" key={key}>
      <Label className="text-xs text-muted-foreground">{label_}</Label>
      {multiline ? (
        <Textarea
          value={data[key] ?? ""}
          onChange={(e) =>
            onChange({ ...data, [key]: e.target.value } as ContentBlockData)
          }
          placeholder={placeholder}
          className="bg-accent/30 border-border text-sm min-h-[100px] resize-y font-mono text-xs"
          rows={4}
        />
      ) : (
        <Input
          value={data[key] ?? ""}
          onChange={(e) =>
            onChange({ ...data, [key]: e.target.value } as ContentBlockData)
          }
          placeholder={placeholder}
          className="bg-accent/30 border-border h-8 text-sm"
        />
      )}
    </div>
  );

  switch (block.type) {
    case "html":
      return (
        <RichHtmlEditor
          value={(block.data as Record<string, string>).html ?? ""}
          onChange={(html) =>
            onChange({ ...block.data, html } as ContentBlockData)
          }
        />
      );
    case "image":
      return (
        <div className="space-y-3">
          <ImageUploadCrop
            value={data.url ?? ""}
            onChange={(url) => onChange({ ...data, url } as ContentBlockData)}
            uploadId={`${articleUploadId}_block_${blockIndex}`}
            aspectRatio={16 / 9}
            label="Imagen del bloque"
            previewShape="rect"
          />
          <div className="grid grid-cols-2 gap-3">
            {field("alt", "Alt text", false, "Descripción de la imagen")}
            {field("caption", "Pie de foto", false, "Descripción visible")}
            {field("credit", "Crédito", false, "Fuente / fotógrafo")}
          </div>
        </div>
      );
    case "youtube":
      return (
        <div className="space-y-2">
          {field("video_id", "ID del video de YouTube *", false, "dQw4w9WgXcQ")}
          {field("caption", "Pie de video", false, "")}
        </div>
      );
    case "twitter":
      return (
        <div className="space-y-2">
          {field(
            "tweet_url",
            "URL del tweet *",
            false,
            "https://twitter.com/user/status/...",
          )}
          {field("tweet_id", "ID del tweet", false, "123456789")}
        </div>
      );
    case "instagram":
      return (
        <div className="space-y-2">
          {field(
            "post_url",
            "URL de la publicación *",
            false,
            "https://instagram.com/p/...",
          )}
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          {field("text", "Texto de la cita *", true, "La cita aquí...")}
          {field("attribution", "Atribución", false, "— Nombre, Cargo")}
        </div>
      );
    case "divider":
      return (
        <p className="text-xs text-muted-foreground italic">
          Divisor horizontal — no requiere configuración
        </p>
      );
    default:
      return null;
  }
}

// ── Main component ────────────────────────────────────────────
interface ArticleForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category_id: string;
  subcategory_id: string;
  author_id: string;
  image_url: string;
  read_time_minutes: string;
  featured: boolean;
  trending: boolean;
  status: ArticleStatus;
  published_at: string;
  tags: string;
}

const EMPTY_FORM: ArticleForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category_id: "",
  subcategory_id: "",
  author_id: "",
  image_url: "",
  read_time_minutes: "5",
  featured: false,
  trending: false,
  status: "draft",
  published_at: "",
  tags: "",
};

export default function ArticleEditor() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const current = useAppSelector(selectAdminArticlesCurrent);
  const currentLoading = useAppSelector(selectAdminArticlesCurrentLoading);
  const currentError = useAppSelector(selectAdminArticlesCurrentError);
  const saving = useAppSelector(selectAdminArticlesSaving);
  const saveError = useAppSelector(selectAdminArticlesSaveError);
  const user = useAppSelector(selectAdminUser);
  const { toast } = useToast();
  const categories = useAppSelector(selectHomeCategories);
  const authors = useAppSelector(selectAdminAuthors);
  const featuredCount = useAppSelector(selectAdminArticlesFeaturedCount);

  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [blocks, setBlocks] = useState<UpsertBlockPayload[]>([]);
  const [slugEdited, setSlugEdited] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Stable upload ID: article_<id> for existing, article_temp_<ts> for new
  const tempUploadIdRef = useRef(`article_temp_${Date.now()}`);
  const articleUploadId =
    isEditing && id ? `article_${id}` : tempUploadIdRef.current;

  // Load categories + authors
  useEffect(() => {
    dispatch(fetchHome());
    dispatch(fetchFeaturedCount());
    if (user?.role === "admin") dispatch(fetchAdminAuthors());
  }, [dispatch, user?.role]);

  // Load existing article
  useEffect(() => {
    if (isEditing && id) {
      dispatch(fetchAdminArticle(parseInt(id)));
    }
    return () => {
      dispatch(clearCurrent());
    };
  }, [dispatch, id, isEditing]);

  // Populate form from loaded article
  useEffect(() => {
    if (isEditing && current) {
      setForm({
        title: current.title,
        slug: current.slug,
        excerpt: current.excerpt ?? "",
        content: current.content ?? "",
        category_id: String(current.category_id),
        subcategory_id: String(current.subcategory_id ?? ""),
        author_id: String(current.author_id),
        image_url: current.image_url ?? "",
        read_time_minutes: String(current.read_time_minutes),
        featured: Boolean(current.featured),
        trending: Boolean(current.trending),
        status: current.status,
        published_at: current.published_at
          ? new Date(current.published_at).toISOString().slice(0, 16)
          : "",
        tags: (current.tags ?? []).join(", "),
      });
      setSlugEdited(true);
      if (current.blocks) {
        setBlocks(
          current.blocks.map((b: ContentBlock, i: number) => ({
            id: b.id,
            position: i + 1,
            type: b.type,
            data: b.data,
          })),
        );
      }
    }
  }, [isEditing, current]);

  // Pre-fill author for non-admin
  useEffect(() => {
    if (!isEditing && user?.role === "author" && user.author_id) {
      setForm((f) => ({ ...f, author_id: String(user.author_id) }));
    }
  }, [isEditing, user]);

  // Auto slug
  const handleTitleChange = useCallback(
    (title: string) => {
      setForm((f) => ({
        ...f,
        title,
        slug: slugEdited ? f.slug : toSlug(title),
      }));
    },
    [slugEdited],
  );

  const handleSlugChange = (slug: string) => {
    setSlugEdited(true);
    setForm((f) => ({ ...f, slug: toSlug(slug) }));
  };

  // Blocks management
  const addBlock = (type: ContentBlockType) => {
    setBlocks((prev) => [
      ...prev,
      { position: prev.length + 1, type, data: defaultBlockData(type) },
    ]);
  };

  const removeBlock = (idx: number) => {
    setBlocks((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((b, i) => ({ ...b, position: i + 1 })),
    );
  };

  const moveBlock = (idx: number, dir: "up" | "down") => {
    setBlocks((prev) => {
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((b, i) => ({ ...b, position: i + 1 }));
    });
  };

  const updateBlockData = (idx: number, data: ContentBlockData) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, data } : b)));
  };

  const handleBlockDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      return;
    }
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next.map((b, i) => ({ ...b, position: i + 1 }));
    });
    setDragIdx(null);
  };

  // Auto-calculate reading time whenever blocks or excerpt change
  // Strip HTML tags, count words, divide by 200 wpm (average reader)
  useEffect(() => {
    const stripHtml = (html: string) =>
      html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const blockText = blocks
      .map((b) => {
        const d = b.data as Record<string, string>;
        if (b.type === "html") return stripHtml(d.html ?? "");
        if (b.type === "quote") return `${d.text ?? ""} ${d.attribution ?? ""}`;
        return "";
      })
      .join(" ");

    const allText = `${form.title} ${form.excerpt} ${blockText}`.trim();
    const wordCount = allText.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(wordCount / 200));
    setForm((f) => ({ ...f, read_time_minutes: String(minutes) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, form.excerpt, form.title]);
  const buildPayload = () => {
    const finalStatus: ArticleStatus = form.status;
    const finalPublishedAt =
      finalStatus === "published" && !form.published_at
        ? new Date().toISOString()
        : form.published_at
          ? new Date(form.published_at).toISOString()
          : null;
    // Validate: scheduled must have a future published_at
    if (finalStatus === "scheduled" && !form.published_at) {
      return null;
    }
    return {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || null,
      content: form.content || null,
      category_id: parseInt(form.category_id),
      subcategory_id: form.subcategory_id
        ? parseInt(form.subcategory_id)
        : null,
      author_id: parseInt(form.author_id),
      image_url: form.image_url || null,
      read_time_minutes: parseInt(form.read_time_minutes) || 5,
      featured: form.featured,
      trending: form.trending,
      status: finalStatus,
      published_at: finalPublishedAt,
      blocks,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
  };

  // Step 1: validate + open preview
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearSaveError());
    if (!form.title || !form.slug || !form.category_id || !form.author_id) {
      toast({
        title: "Campos requeridos",
        description: "Completa título, slug, categoría y autor.",
        variant: "destructive",
      });
      return;
    }
    if (form.status === "scheduled" && !form.published_at) {
      toast({
        title: "Fecha requerida",
        description: "Indica la fecha de publicación programada.",
        variant: "destructive",
      });
      return;
    }
    setShowPreview(true);
  };

  const previewStatusLabel = (() => {
    if (user?.role !== "admin")
      return form.status === "in_review"
        ? "Se enviará a revisión editorial"
        : "Se guardará como borrador";
    if (form.status === "in_review") return "Quedará en revisión";
    if (form.status === "published") return "Se publicará al guardar";
    if (form.status === "scheduled") return "Se programará al guardar";
    if (form.status === "archived") return "Se archivará al guardar";
    return "Se guardará como borrador";
  })();

  const previewSaveLabel =
    user?.role !== "admin"
      ? form.status === "in_review"
        ? "Enviar a revisión"
        : "Guardar borrador"
      : form.status === "published"
        ? "Publicar artículo"
        : form.status === "scheduled"
          ? "Programar artículo"
          : form.status === "archived"
            ? "Archivar artículo"
            : "Guardar borrador";

  // Step 2: confirmed in preview → actually save
  const performSave = async () => {
    const payload = buildPayload();
    if (!payload) return;
    try {
      if (isEditing && id) {
        await dispatch(
          updateAdminArticle({ id: parseInt(id), payload }),
        ).unwrap();
        setShowPreview(false);
        navigate("/admin/articles");
      } else {
        const newId = await dispatch(createAdminArticle(payload)).unwrap();
        setShowPreview(false);
        navigate(`/admin/articles/${newId}/edit`, { replace: true });
      }
    } catch {
      // saveError shown in modal footer via Redux state
    }
  };

  const selectedCategory = categories.find(
    (c) => String(c.id) === form.category_id,
  );
  const subcategories = selectedCategory?.subcategories ?? [];

  // Whether enabling featured on THIS save will push out the oldest featured article
  const willDisplaceFeatured =
    form.featured &&
    featuredCount !== null &&
    featuredCount >= 5 &&
    !(isEditing && Boolean(current?.featured));

  if (isEditing && currentLoading && !current) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (isEditing && currentError && !current) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{currentError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate("/admin/articles")}>
          Volver a artículos
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center gap-2 sm:gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/articles")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Artículos
        </Button>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">
          {isEditing ? "Editar artículo" : "Nuevo artículo"}
        </h1>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode((p) => !p)}
            className="gap-2 h-9"
          >
            {previewMode ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {previewMode ? "Editar" : "Vista previa bloques"}
            </span>
          </Button>
          <Button
            form="article-form"
            type="submit"
            disabled={
              saving ||
              !form.title ||
              !form.slug ||
              !form.category_id ||
              !form.author_id
            }
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-lg shadow-blue-500/20"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {saveError && (
        <Alert
          variant="destructive"
          className="border-destructive/50 bg-destructive/10"
        >
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <form id="article-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Main column */}
          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Título *
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="El título de tu artículo"
                className="bg-accent/40 border-border h-11 text-base font-medium"
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-sm font-medium">
                Slug *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="url-del-articulo"
                  className="bg-accent/40 border-border h-9 font-mono text-sm"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSlugEdited(false);
                    setForm((f) => ({ ...f, slug: toSlug(f.title) }));
                  }}
                  className="h-9 px-3 flex-shrink-0"
                  title="Regenerar desde el título"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                /articulo/{form.slug || "…"}
              </p>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt" className="text-sm font-medium">
                Resumen
              </Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
                placeholder="Breve descripción del artículo (aparece en listados y SEO)"
                className="bg-accent/40 border-border text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label htmlFor="image_url" className="text-sm font-medium">
                Imagen principal
              </Label>
              <ImageUploadCrop
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
                uploadId={articleUploadId}
                aspectRatio={16 / 9}
                previewShape="rect"
              />
            </div>

            {/* Content Blocks section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Bloques de contenido
                </Label>
                <Badge variant="secondary" className="text-xs">
                  {blocks.length} bloque{blocks.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Add block buttons */}
              <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-accent/20 border border-dashed border-border">
                <span className="text-xs text-muted-foreground self-center mr-1">
                  Agregar:
                </span>
                {BLOCK_TYPES.map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addBlock(type)}
                    className="h-7 px-2.5 text-xs gap-1.5"
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </Button>
                ))}
              </div>

              {/* Block list */}
              <div className="space-y-3">
                {blocks.map((block, idx) => {
                  const blockConfig = BLOCK_TYPES.find(
                    (t) => t.type === block.type,
                  );
                  const Icon = blockConfig?.icon ?? Code2;
                  return (
                    <div
                      key={idx}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverIdx(idx);
                      }}
                      onDrop={(e) => handleBlockDrop(e, idx)}
                      onDragLeave={() => setDragOverIdx(null)}
                      className={cn(
                        "rounded-lg border bg-card/60 overflow-hidden transition-all",
                        dragIdx === idx
                          ? "opacity-40 border-border"
                          : dragOverIdx === idx
                            ? "border-blue-500 border-2"
                            : "border-border",
                      )}
                    >
                      {/* Block header */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-accent/30 border-b border-border">
                        <div
                          draggable
                          onDragStart={(e) => {
                            setDragIdx(idx);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragIdx(null);
                            setDragOverIdx(null);
                          }}
                          className="cursor-grab active:cursor-grabbing flex items-center flex-shrink-0"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                        <Icon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-foreground flex-1">
                          {blockConfig?.label ?? block.type} #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6"
                            onClick={() => moveBlock(idx, "up")}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6"
                            onClick={() => moveBlock(idx, "down")}
                            disabled={idx === blocks.length - 1}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-destructive hover:text-destructive"
                            onClick={() => removeBlock(idx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Block content editor / preview */}
                      <div className="p-3">
                        {previewMode ? (
                          <BlockPreview block={block} />
                        ) : (
                          <BlockEditor
                            block={block}
                            onChange={(data) => updateBlockData(idx, data)}
                            articleUploadId={articleUploadId}
                            blockIndex={idx}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar column */}
          <div className="space-y-4">
            {isEditing && id && (
              <RevisionsPanel
                articleId={parseInt(id)}
                onRestored={() => dispatch(fetchAdminArticle(parseInt(id)))}
              />
            )}
            {/* Status */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Publicación
              </h3>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                {user?.role === "admin" ? (
                  <Select
                    value={form.status}
                    onValueChange={(v: ArticleStatus) =>
                      setForm((f) => ({
                        ...f,
                        status: v,
                        published_at:
                          v === "scheduled" || v === "published"
                            ? f.published_at
                            : "",
                      }))
                    }
                  >
                    <SelectTrigger className="bg-accent/40 border-border h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="in_review">En revisión</SelectItem>
                      <SelectItem value="published">Publicado</SelectItem>
                      <SelectItem value="scheduled">
                        Programar publicación
                      </SelectItem>
                      <SelectItem value="archived">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Select
                      value={form.status === "in_review" ? "in_review" : "draft"}
                      onValueChange={(v: "draft" | "in_review") =>
                        setForm((f) => ({ ...f, status: v, published_at: "" }))
                      }
                    >
                      <SelectTrigger className="bg-accent/40 border-border h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="in_review">Enviar a revisión</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Un editor revisará y publicará el artículo.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-tags" className="text-xs text-muted-foreground">
                  Temas (separados por coma)
                </Label>
                <Input
                  id="article-tags"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="IA, OpenAI, Startups"
                  className="h-9 text-sm"
                />
                {form.tags.trim() && (
                  <div className="flex flex-wrap gap-1">
                    {form.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 12)
                      .map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              {(form.status === "published" || form.status === "scheduled") && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {form.status === "scheduled"
                      ? "Publicar automáticamente el"
                      : "Fecha de publicación"}
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.published_at}
                    min={
                      form.status === "scheduled"
                        ? new Date(Date.now() + 60_000)
                            .toISOString()
                            .slice(0, 16)
                        : undefined
                    }
                    onChange={(e) =>
                      setForm((f) => ({ ...f, published_at: e.target.value }))
                    }
                    className="bg-accent/40 border-border h-9 text-sm"
                  />
                  {form.status === "scheduled" && form.published_at && (
                    <p className="text-xs text-blue-400 flex items-center gap-1">
                      <span>⏰</span> El cron publicará este artículo
                      automáticamente.
                    </p>
                  )}
                  {form.status === "scheduled" && !form.published_at && (
                    <p className="text-xs text-amber-500">
                      Selecciona una fecha y hora futura.
                    </p>
                  )}
                </div>
              )}

              {user?.role === "admin" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground cursor-pointer">
                      Destacado
                    </Label>
                    <Switch
                      checked={form.featured}
                      onCheckedChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          featured: v,
                          trending: v ? f.trending : false,
                        }))
                      }
                    />
                  </div>
                  {willDisplaceFeatured && (
                    <p className="text-[11px] text-amber-400 leading-snug">
                      Ya hay 5 destacados. Al guardar se quitará el más antiguo.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground cursor-pointer">
                      Trending
                    </Label>
                    <Switch
                      checked={form.trending}
                      onCheckedChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          trending: v,
                          featured: v ? true : f.featured,
                        }))
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/50 leading-snug">
                    Trending aparece primero en destacados y requiere ser
                    destacado.
                  </p>
                </div>
              </div>
              )}
            </div>

            {/* Category */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Categoría
              </h3>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Categoría *
                </Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      category_id: v,
                      subcategory_id: "",
                    }))
                  }
                >
                  <SelectTrigger className="bg-accent/40 border-border h-9 text-sm">
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {subcategories.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Subcategoría
                  </Label>
                  <Select
                    value={form.subcategory_id || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        subcategory_id: v === "none" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-accent/40 border-border h-9 text-sm">
                      <SelectValue placeholder="Ninguna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {subcategories.map((sc) => (
                        <SelectItem key={sc.id} value={String(sc.id)}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Author */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Autor</h3>
              {user?.role === "admin" ? (
                <Select
                  value={form.author_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, author_id: v }))
                  }
                >
                  <SelectTrigger className="bg-accent/40 border-border h-9 text-sm">
                    <SelectValue placeholder="Seleccionar autor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {authors.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {authors.find((a) => a.id === user?.author_id)?.name ??
                    "Tu perfil de autor"}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Meta</h3>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Tiempo de lectura
                </Label>
                <div className="flex items-center gap-2">
                  <div className="bg-accent/40 border border-border rounded-md h-8 px-3 flex items-center text-sm text-foreground w-24 select-none">
                    {form.read_time_minutes} min
                  </div>
                  <span className="text-[10px] text-blue-400/70 font-medium">
                    Auto
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/60">
                  Calculado desde el contenido
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* ── Article preview modal ─────────────────────────────── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base font-semibold flex-1">
                Vista previa antes de guardar
              </DialogTitle>
              {user?.role === "admin" ? (
                <Badge className="bg-green-500/15 text-green-400 border border-green-500/30 text-xs font-medium">
                  {previewStatusLabel}
                </Badge>
              ) : (
                <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs font-medium">
                  {previewStatusLabel}
                </Badge>
              )}
            </div>
            {willDisplaceFeatured && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <span className="text-amber-400 mt-0.5">⚠️</span>
                <p className="text-xs text-amber-300 leading-snug">
                  Ya existen <strong>5 artículos destacados</strong>. Al
                  guardar, el artículo destacado más antiguo será removido
                  automáticamente de destacados para dar lugar a este.
                </p>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 py-5 space-y-5">
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt={form.title}
                  className="w-full max-h-56 object-cover rounded-xl"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}

              <div className="space-y-1">
                {form.category_id && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    {
                      categories.find((c) => String(c.id) === form.category_id)
                        ?.name
                    }
                  </p>
                )}
                <h1 className="text-xl font-bold text-foreground leading-snug">
                  {form.title || "Sin título"}
                </h1>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground border-y border-border py-2.5">
                <span className="font-medium">
                  {authors.find((a) => String(a.id) === form.author_id)?.name ??
                    "—"}
                </span>
                <span>·</span>
                <span>{form.read_time_minutes} min de lectura</span>
                {form.category_id && (
                  <>
                    <span>·</span>
                    <span>
                      {
                        categories.find(
                          (c) => String(c.id) === form.category_id,
                        )?.name
                      }
                    </span>
                  </>
                )}
              </div>

              {form.excerpt && (
                <p className="text-sm text-muted-foreground italic border-l-2 border-blue-500/40 pl-3 leading-relaxed">
                  {form.excerpt}
                </p>
              )}

              {blocks.length > 0 && (
                <div className="space-y-4 pt-1">
                  {blocks.map((block, idx) => (
                    <BlockPreview key={idx} block={block} />
                  ))}
                </div>
              )}

              {blocks.length === 0 && !form.excerpt && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Sin contenido aún.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card/60 flex-shrink-0">
            {saveError && (
              <p className="text-xs text-red-400 mr-auto">{saveError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(false)}
              className="h-9"
            >
              Seguir editando
            </Button>
            <Button
              size="sm"
              onClick={performSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Guardando…" : previewSaveLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockPreview({ block }: { block: UpsertBlockPayload }) {
  const previewBlock: ContentBlock = {
    id: block.id ?? 0,
    article_id: 0,
    position: block.position,
    type: block.type,
    data: block.data,
  };
  return <ArticleBlock block={previewBlock} />;
}
