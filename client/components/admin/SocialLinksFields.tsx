import type { FormikProps } from "formik";
import * as Yup from "yup";
import { Facebook, Globe, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import type { SocialLinks } from "@shared/api";
import { parseSocialLinks } from "@/lib/socialLinks";
import { cn } from "@/lib/utils";

/** Flat Formik fields for an author's public social presence. */
export interface SocialFormValues {
  twitter_handle: string;
  social_facebook: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
  social_tiktok: string;
  social_website: string;
}

const KEYS = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "website"] as const;
type SocialKey = (typeof KEYS)[number];

export const emptySocialValues: SocialFormValues = {
  twitter_handle: "",
  social_facebook: "",
  social_instagram: "",
  social_linkedin: "",
  social_youtube: "",
  social_tiktok: "",
  social_website: "",
};

export function socialValuesFrom(
  twitter: string | null | undefined,
  raw: SocialLinks | string | null | undefined,
): SocialFormValues {
  const sl = parseSocialLinks(raw);
  return {
    twitter_handle: twitter ?? "",
    social_facebook: sl.facebook ?? "",
    social_instagram: sl.instagram ?? "",
    social_linkedin: sl.linkedin ?? "",
    social_youtube: sl.youtube ?? "",
    social_tiktok: sl.tiktok ?? "",
    social_website: sl.website ?? "",
  };
}

/** Same `social_links` JSON shape the public author page already reads. */
export function socialLinksFrom(v: SocialFormValues): SocialLinks | null {
  const out: SocialLinks = {};
  for (const k of KEYS) {
    const val = v[`social_${k}` as keyof SocialFormValues].trim();
    if (val) out[k] = val;
  }
  return Object.keys(out).length ? out : null;
}

export function normalizeTwitter(handle: string): string | null {
  const h = handle.trim().replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "").replace(/^@/, "").replace(/\/$/, "");
  return h || null;
}

const url = Yup.string().trim().url("Debe ser una URL válida (https://…)").max(500, "Demasiado largo");

export const socialSchemaFields = {
  twitter_handle: Yup.string()
    .trim()
    .max(100, "Demasiado largo")
    .matches(/^(@?[A-Za-z0-9_]{1,30}|https?:\/\/(www\.)?(twitter|x)\.com\/[A-Za-z0-9_]{1,30}\/?)?$/, "Usuario de X inválido"),
  social_facebook: url,
  social_instagram: url,
  social_linkedin: url,
  social_youtube: url,
  social_tiktok: url,
  social_website: url,
};

const FIELDS: Array<{ name: keyof SocialFormValues; label: string; icon: React.ElementType; placeholder: string }> = [
  { name: "twitter_handle", label: "X / Twitter", icon: Twitter, placeholder: "@usuario" },
  { name: "social_instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/…" },
  { name: "social_linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/…" },
  { name: "social_facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/…" },
  { name: "social_youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@…" },
  { name: "social_tiktok", label: "TikTok", icon: FaTiktok, placeholder: "https://tiktok.com/@…" },
  { name: "social_website", label: "Sitio web", icon: Globe, placeholder: "https://…" },
];

export const fieldClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function SocialLinksFields<T extends SocialFormValues>({
  formik,
  idPrefix,
}: {
  formik: FormikProps<T>;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FIELDS.map((f) => {
        const err = formik.touched[f.name as keyof T] && (formik.errors[f.name as keyof T] as string | undefined);
        const Icon = f.icon;
        return (
          <div key={f.name} className={cn(f.name === "social_website" && "sm:col-span-2")}>
            <label htmlFor={`${idPrefix}-${f.name}`} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {f.label}
            </label>
            <input
              id={`${idPrefix}-${f.name}`}
              type={f.name === "twitter_handle" ? "text" : "url"}
              inputMode={f.name === "twitter_handle" ? "text" : "url"}
              autoComplete="off"
              placeholder={f.placeholder}
              aria-invalid={Boolean(err)}
              className={cn(fieldClass, err && "border-destructive")}
              {...formik.getFieldProps(f.name as string)}
            />
            {err && <p role="alert" className="mt-1 text-xs text-destructive">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}

export type { SocialKey };
