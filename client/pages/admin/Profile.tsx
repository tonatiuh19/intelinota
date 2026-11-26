import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  updateMyProfile,
  selectAdminUser,
  selectAdminToken,
  selectAdminMeLoading,
} from "@/store/slices/adminAuthSlice";
import type { SocialLinks } from "@shared/api";
import { parseSocialLinks } from "@/lib/socialLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ImageUploadCrop from "@/components/ImageUploadCrop";
import {
  User,
  Save,
  Loader2,
  Shield,
  Pen,
  Globe,
  ChevronDown,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  CheckCircle2,
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { cn } from "@/lib/utils";

interface ProfileForm {
  name: string;
  avatar_url: string;
  bio: string;
  twitter_handle: string;
  social_facebook: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
  social_tiktok: string;
  social_website: string;
}

const emptyForm: ProfileForm = {
  name: "",
  avatar_url: "",
  bio: "",
  twitter_handle: "",
  social_facebook: "",
  social_instagram: "",
  social_linkedin: "",
  social_youtube: "",
  social_tiktok: "",
  social_website: "",
};

function buildSocialLinks(form: ProfileForm): SocialLinks | null {
  const s: SocialLinks = {};
  if (form.social_facebook) s.facebook = form.social_facebook;
  if (form.social_instagram) s.instagram = form.social_instagram;
  if (form.social_linkedin) s.linkedin = form.social_linkedin;
  if (form.social_youtube) s.youtube = form.social_youtube;
  if (form.social_tiktok) s.tiktok = form.social_tiktok;
  if (form.social_website) s.website = form.social_website;
  return Object.keys(s).length ? s : null;
}

export default function Profile() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAdminUser);
  const token = useAppSelector(selectAdminToken);
  const meLoading = useAppSelector(selectAdminMeLoading);

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  // Stable upload ID tied to the user's author profile
  const uploadId = user?.author_id
    ? `author_${user.author_id}`
    : `user_${user?.id ?? "temp"}`;

  // Populate form when user is available (loaded by AdminGuard)
  useEffect(() => {
    if (!user) return;
    const sl = parseSocialLinks(user.social_links);

    setForm({
      name: user.name ?? "",
      avatar_url: user.avatar_url ?? "",
      bio: user.bio ?? "",
      twitter_handle: user.twitter_handle ?? "",
      social_facebook: sl.facebook ?? "",
      social_instagram: sl.instagram ?? "",
      social_linkedin: sl.linkedin ?? "",
      social_youtube: sl.youtube ?? "",
      social_tiktok: sl.tiktok ?? "",
      social_website: sl.website ?? "",
    });
  }, [user]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const payload: Parameters<typeof updateMyProfile>[0] = {
      name: form.name || undefined,
      avatar_url: form.avatar_url || undefined,
    };

    // Only send author fields if the user has a linked author profile
    if (user?.author_id) {
      payload.bio = form.bio || undefined;
      payload.twitter_handle = form.twitter_handle || undefined;
      payload.social_links = buildSocialLinks(form);
    }

    try {
      await dispatch(updateMyProfile(payload)).unwrap();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(typeof err === "string" ? err : "Error al guardar perfil");
    } finally {
      setSaving(false);
    }
  }

  if (meLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Actualiza tu información personal y de autor
          </p>
        </div>
      </div>

      {/* Account info (read-only) */}
      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Cuenta
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted-foreground">Email</div>
            <div className="text-sm font-medium text-foreground truncate">
              {user?.email}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "flex items-center gap-1.5 flex-shrink-0",
              user?.role === "admin"
                ? "border-blue-500/30 text-blue-400"
                : "border-emerald-500/30 text-emerald-400",
            )}
          >
            {user?.role === "admin" ? (
              <Shield className="w-3 h-3" />
            ) : (
              <Pen className="w-3 h-3" />
            )}
            <span className="capitalize">{user?.role}</span>
          </Badge>
        </div>
      </div>

      {/* Editable profile form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card/40 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Información Personal
          </h2>

          {/* Avatar */}
          <div className="flex items-start gap-5 flex-col sm:flex-row">
            <div className="flex-shrink-0">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Foto de perfil
              </Label>
              <ImageUploadCrop
                value={form.avatar_url}
                onChange={(url) =>
                  setForm((prev) => ({ ...prev, avatar_url: url }))
                }
                uploadId={uploadId}
                aspectRatio={1}
                previewShape="circle"
                label="Subir foto"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-4 w-full">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Tu nombre completo"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Author section — only shown when user has an author profile */}
        {user?.author_id && (
          <div className="rounded-xl border border-border bg-card/40 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Perfil de Autor
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={3}
                placeholder="Cuéntale a los lectores sobre ti..."
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="twitter_handle">Twitter / X</Label>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="twitter_handle"
                  name="twitter_handle"
                  value={form.twitter_handle}
                  onChange={handleChange}
                  placeholder="@usuario"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Social links */}
            <Collapsible open={socialOpen} onOpenChange={setSocialOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-2 -ml-2"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Redes Sociales</span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform",
                      socialOpen && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Facebook className="w-3.5 h-3.5 text-blue-400" />
                      Facebook
                    </Label>
                    <Input
                      name="social_facebook"
                      value={form.social_facebook}
                      onChange={handleChange}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Instagram className="w-3.5 h-3.5 text-pink-400" />
                      Instagram
                    </Label>
                    <Input
                      name="social_instagram"
                      value={form.social_instagram}
                      onChange={handleChange}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Linkedin className="w-3.5 h-3.5 text-blue-500" />
                      LinkedIn
                    </Label>
                    <Input
                      name="social_linkedin"
                      value={form.social_linkedin}
                      onChange={handleChange}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Youtube className="w-3.5 h-3.5 text-red-400" />
                      YouTube
                    </Label>
                    <Input
                      name="social_youtube"
                      value={form.social_youtube}
                      onChange={handleChange}
                      placeholder="https://youtube.com/@..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <FaTiktok className="w-3.5 h-3.5 text-foreground" />
                      TikTok
                    </Label>
                    <Input
                      name="social_tiktok"
                      value={form.social_tiktok}
                      onChange={handleChange}
                      placeholder="https://tiktok.com/@..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      Sitio Web
                    </Label>
                    <Input
                      name="social_website"
                      value={form.social_website}
                      onChange={handleChange}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Feedback */}
        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <AlertDescription className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Perfil actualizado correctamente
            </AlertDescription>
          </Alert>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
