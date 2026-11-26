import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAdminUser } from "@/store/slices/adminAuthSlice";
import {
  fetchAdminAuthors,
  createAdminAuthor,
  updateAdminAuthor,
  deleteAdminAuthor,
  setAuthorCanPublish,
  clearSaveError,
  selectAdminAuthors,
  selectAdminAuthorsLoading,
  selectAdminAuthorsError,
  selectAdminAuthorsSaving,
  selectAdminAuthorsSaveError,
  selectAdminAuthorsDeleteError,
} from "@/store/slices/adminAuthorsSlice";
import type {
  AdminAuthor,
  UpsertAuthorPayload,
  AdminRole,
  SocialLinks,
} from "@shared/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  UserPlus,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  Pen,
  Users,
  Twitter,
  Loader2,
  Mail,
  Globe,
  ChevronDown,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { cn } from "@/lib/utils";
import ImageUploadCrop from "@/components/ImageUploadCrop";

// ── Slug helper ───────────────────────────────────────────────
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

interface AuthorForm {
  name: string;
  slug: string;
  bio: string;
  avatar_url: string;
  twitter_handle: string;
  email: string;
  user_email: string;
  user_role: AdminRole;
  social_facebook: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
  social_tiktok: string;
  social_website: string;
}

const EMPTY_FORM: AuthorForm = {
  name: "",
  slug: "",
  bio: "",
  avatar_url: "",
  twitter_handle: "",
  email: "",
  user_email: "",
  user_role: "author",
  social_facebook: "",
  social_instagram: "",
  social_linkedin: "",
  social_youtube: "",
  social_tiktok: "",
  social_website: "",
};

function authorToForm(a: AdminAuthor): AuthorForm {
  const sl = (a.social_links ?? {}) as Record<string, string>;
  return {
    name: a.name,
    slug: a.slug,
    bio: a.bio ?? "",
    avatar_url: a.avatar_url ?? "",
    twitter_handle: a.twitter_handle ?? "",
    email: a.email ?? "",
    user_email: a.email ?? "",
    user_role: (a.user_role as AdminRole) ?? "author",
    social_facebook: sl.facebook ?? "",
    social_instagram: sl.instagram ?? "",
    social_linkedin: sl.linkedin ?? "",
    social_youtube: sl.youtube ?? "",
    social_tiktok: sl.tiktok ?? "",
    social_website: sl.website ?? "",
  };
}

export default function AdminAuthors() {
  const user = useAppSelector(selectAdminUser);
  const dispatch = useAppDispatch();
  const authors = useAppSelector(selectAdminAuthors);
  const loading = useAppSelector(selectAdminAuthorsLoading);
  const listError = useAppSelector(selectAdminAuthorsError);
  const saving = useAppSelector(selectAdminAuthorsSaving);
  const saveError = useAppSelector(selectAdminAuthorsSaveError);
  const deleteError = useAppSelector(selectAdminAuthorsDeleteError);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<AdminAuthor | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<AuthorForm>(EMPTY_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  // Stable upload ID per dialog session: reused if editing, new temp key if creating
  const [uploadId, setUploadId] = useState<string>("");

  useEffect(() => {
    if (user?.role === "admin") {
      dispatch(fetchAdminAuthors());
    }
  }, [dispatch, user?.role]);

  if (user?.role !== "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const openCreate = () => {
    dispatch(clearSaveError());
    setEditingAuthor(null);
    setForm(EMPTY_FORM);
    setSlugEdited(false);
    setUploadId(`author_temp_${Date.now()}`);
    setDialogOpen(true);
  };

  const openEdit = (author: AdminAuthor) => {
    dispatch(clearSaveError());
    setEditingAuthor(author);
    setForm(authorToForm(author));
    setSlugEdited(true);
    setUploadId(`author_${author.id}`);
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugEdited ? f.slug : toSlug(name),
    }));
  };

  const buildSocialLinks = (): SocialLinks | null => {
    const sl: SocialLinks = {};
    if (form.social_facebook) sl.facebook = form.social_facebook;
    if (form.social_instagram) sl.instagram = form.social_instagram;
    if (form.social_linkedin) sl.linkedin = form.social_linkedin;
    if (form.social_youtube) sl.youtube = form.social_youtube;
    if (form.social_tiktok) sl.tiktok = form.social_tiktok;
    if (form.social_website) sl.website = form.social_website;
    return Object.keys(sl).length > 0 ? sl : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearSaveError());

    const payload: UpsertAuthorPayload = {
      name: form.name,
      slug: form.slug,
      bio: form.bio || null,
      avatar_url: form.avatar_url || null,
      twitter_handle: form.twitter_handle || null,
      email: form.email || null,
      social_links: buildSocialLinks(),
      user_email: form.user_email || undefined,
      user_role: form.user_email ? form.user_role : undefined,
    };

    try {
      if (editingAuthor) {
        await dispatch(
          updateAdminAuthor({ id: editingAuthor.id, payload }),
        ).unwrap();
      } else {
        await dispatch(createAdminAuthor(payload)).unwrap();
      }
      setDialogOpen(false);
      dispatch(fetchAdminAuthors());
    } catch {
      // error shown via saveError
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await dispatch(deleteAdminAuthor(deleteId)).unwrap();
      setDeleteId(null);
    } catch {
      // deleteError shown in alert
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Autores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {authors.length} autor{authors.length !== 1 ? "es" : ""} registrados
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo autor
        </Button>
      </div>

      {listError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
            <span>{listError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(fetchAdminAuthors())}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Authors grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/60 p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : authors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Users className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm">No hay autores registrados</p>
          <Button onClick={openCreate} size="sm" variant="outline">
            Crear el primero
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authors.map((author) => (
            <div
              key={author.id}
              className="rounded-xl border border-border bg-card/60 p-5 space-y-4 hover:bg-card/80 transition-colors group relative"
            >
              {/* Actions */}
              <div className="absolute top-3 right-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => openEdit(author)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteId(author.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 flex-shrink-0">
                  {author.avatar_url && (
                    <AvatarImage src={author.avatar_url} alt={author.name} />
                  )}
                  <AvatarFallback className="bg-blue-600/20 text-blue-400 font-bold text-sm">
                    {initials(author.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {author.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {author.email ?? author.slug}
                  </p>
                </div>
              </div>

              {/* Bio */}
              {author.bio && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {author.bio}
                </p>
              )}

              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {author.user_id && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      author.user_role === "admin"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    )}
                  >
                    {author.user_role === "admin" ? (
                      <Shield className="w-3 h-3 mr-1" />
                    ) : (
                      <Pen className="w-3 h-3 mr-1" />
                    )}
                    {author.user_role === "admin" ? "Admin" : "Autor"}
                  </Badge>
                )}
                {author.twitter_handle && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-sky-500/10 text-sky-400 border-sky-500/20"
                  >
                    <Twitter className="w-3 h-3 mr-1" />@{author.twitter_handle}
                  </Badge>
                )}
                {/* Social links indicators */}
                {(() => {
                  const sl = (author.social_links ?? {}) as Record<
                    string,
                    string
                  >;
                  const icons = [
                    { key: "facebook", Icon: Facebook, color: "text-blue-500" },
                    {
                      key: "instagram",
                      Icon: Instagram,
                      color: "text-pink-500",
                    },
                    { key: "linkedin", Icon: Linkedin, color: "text-blue-400" },
                    { key: "youtube", Icon: Youtube, color: "text-red-500" },
                    { key: "website", Icon: Globe, color: "text-emerald-400" },
                  ];
                  return icons
                    .filter(({ key }) => sl[key])
                    .map(({ key, Icon, color }) => (
                      <a
                        key={key}
                        href={sl[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "w-5 h-5 flex items-center justify-center rounded hover:opacity-70 transition-opacity",
                          color,
                        )}
                        title={key}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </a>
                    ));
                })()}
              </div>

              {/* Trusted author: may publish/schedule own articles */}
              {author.user_id && author.user_role === "author" && (
                <label
                  htmlFor={`can-publish-${author.id}`}
                  className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">
                      Puede publicar
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Publica y programa sus notas sin revisión
                    </span>
                  </span>
                  <Switch
                    id={`can-publish-${author.id}`}
                    checked={Boolean(author.can_publish)}
                    onCheckedChange={(checked) =>
                      dispatch(setAuthorCanPublish({ id: author.id, can_publish: checked }))
                    }
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) dispatch(clearSaveError());
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAuthor ? "Editar autor" : "Nuevo autor"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {saveError && (
              <Alert
                variant="destructive"
                className="border-destructive/50 bg-destructive/10"
              >
                <AlertDescription className="text-sm">
                  {saveError}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nombre completo *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Elena Vance"
                  className="bg-accent/40 border-border h-9"
                  required
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setForm((f) => ({ ...f, slug: toSlug(e.target.value) }));
                  }}
                  placeholder="elena-vance"
                  className="bg-accent/40 border-border h-9 font-mono text-sm"
                  required
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Biografía</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Editora de tecnología e IA…"
                  className="bg-accent/40 border-border text-sm resize-none"
                  rows={3}
                />
              </div>

              {/* Avatar upload */}
              <div className="col-span-2">
                <ImageUploadCrop
                  value={form.avatar_url}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, avatar_url: url }))
                  }
                  uploadId={uploadId}
                  aspectRatio={1}
                  label="Foto de perfil"
                  previewShape="circle"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Twitter / X handle</Label>
                <div className="relative">
                  <Twitter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={form.twitter_handle}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        twitter_handle: e.target.value.replace("@", ""),
                      }))
                    }
                    placeholder="username"
                    className="pl-8 bg-accent/40 border-border h-9 text-sm"
                  />
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Email del autor</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="autor@intelinota.com"
                    className="pl-8 bg-accent/40 border-border h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Social networks */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Redes sociales
                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Facebook className="w-3.5 h-3.5 text-blue-500" />
                      Facebook
                    </Label>
                    <Input
                      value={form.social_facebook}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_facebook: e.target.value,
                        }))
                      }
                      placeholder="https://facebook.com/..."
                      className="bg-accent/40 border-border h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Instagram className="w-3.5 h-3.5 text-pink-500" />
                      Instagram
                    </Label>
                    <Input
                      value={form.social_instagram}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_instagram: e.target.value,
                        }))
                      }
                      placeholder="https://instagram.com/..."
                      className="bg-accent/40 border-border h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Linkedin className="w-3.5 h-3.5 text-blue-400" />
                      LinkedIn
                    </Label>
                    <Input
                      value={form.social_linkedin}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_linkedin: e.target.value,
                        }))
                      }
                      placeholder="https://linkedin.com/in/..."
                      className="bg-accent/40 border-border h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Youtube className="w-3.5 h-3.5 text-red-500" />
                      YouTube
                    </Label>
                    <Input
                      value={form.social_youtube}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_youtube: e.target.value,
                        }))
                      }
                      placeholder="https://youtube.com/@..."
                      className="bg-accent/40 border-border h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <FaTiktok className="w-3 h-3 text-foreground" />
                      TikTok
                    </Label>
                    <Input
                      value={form.social_tiktok}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_tiktok: e.target.value,
                        }))
                      }
                      placeholder="https://tiktok.com/@..."
                      className="bg-accent/40 border-border h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      Sitio web
                    </Label>
                    <Input
                      value={form.social_website}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          social_website: e.target.value,
                        }))
                      }
                      placeholder="https://miwebsite.com"
                      className="bg-accent/40 border-border h-8 text-xs"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* User account section */}
            <div className="rounded-lg border border-border/60 border-dashed p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Cuenta de acceso al panel (opcional)
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs">Email de acceso</Label>
                <Input
                  type="email"
                  value={form.user_email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, user_email: e.target.value }))
                  }
                  placeholder="acceso@intelinota.com"
                  className="bg-accent/40 border-border h-9 text-sm"
                />
              </div>

              {form.user_email && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Rol</Label>
                  <Select
                    value={form.user_role}
                    onValueChange={(v: AdminRole) =>
                      setForm((f) => ({ ...f, user_role: v }))
                    }
                  >
                    <SelectTrigger className="bg-accent/40 border-border h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="author">
                        <span className="flex items-center gap-2">
                          <Pen className="w-3.5 h-3.5 text-emerald-400" />
                          Autor — crea y edita sus propios artículos
                        </span>
                      </SelectItem>
                      <SelectItem value="admin">
                        <span className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-blue-400" />
                          Admin — acceso completo
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.name || !form.slug}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingAuthor ? "Guardar cambios" : "Crear autor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este autor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al autor permanentemente. No puedes eliminar
              autores con artículos publicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
