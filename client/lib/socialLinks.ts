import type { SocialLinks } from "@shared/api";
import { seoConfig } from "@/lib/seoConfig";

export function parseSocialLinks(
  raw: SocialLinks | string | null | undefined,
): SocialLinks {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SocialLinks;
    } catch {
      return {};
    }
  }
  return raw;
}

export const FACEBOOK_PAGE_URL = seoConfig.facebook.publisherUrl;

export const SITE_SOCIAL = {
  facebook: FACEBOOK_PAGE_URL,
  twitter: "https://twitter.com/intelinota",
  instagram: "https://instagram.com/intelinota",
  linkedin: "https://linkedin.com/company/intelinota",
  github: "https://github.com/intelinota",
} as const;
