import { SITE_LOGO } from "@/lib/branding";
import { seoConfig } from "@/lib/seoConfig";
import { SITE_SOCIAL } from "@/lib/socialLinks";

export const SITE_NAME = seoConfig.site.name;
export const SITE_NAME_DISPLAY = seoConfig.site.displayName;
export const SITE_URL = seoConfig.site.url;

export const TWITTER_SITE = seoConfig.twitter.site;
export const FACEBOOK_APP_ID = seoConfig.facebook.appId;
export const FB_PAGE_ID = seoConfig.facebook.pageId;
export const GOOGLE_SITE_VERIFICATION = seoConfig.google.siteVerification;

export const DEFAULT_TITLE = seoConfig.defaults.title;
export const DEFAULT_DESCRIPTION = seoConfig.defaults.description;
export const DEFAULT_KEYWORDS = seoConfig.defaults.keywords;

export const DEFAULT_OG_IMAGE = seoConfig.openGraph.defaultImage;
export const DEFAULT_OG_IMAGE_WIDTH = seoConfig.openGraph.imageWidth;
export const DEFAULT_OG_IMAGE_HEIGHT = seoConfig.openGraph.imageHeight;
export const DEFAULT_OG_IMAGE_TYPE = seoConfig.openGraph.imageType;

export const OG_LOCALE = seoConfig.openGraph.locale;
export const OG_LOCALE_ALTERNATE = seoConfig.openGraph.localeAlternate;

export const THEME_COLOR = seoConfig.site.themeColor;
export const APPLE_WEB_APP_TITLE = seoConfig.apple.webAppTitle;
export const APPLICATION_NAME = seoConfig.site.applicationName;
export const TWITTER_DOMAIN = seoConfig.twitter.domain;

export const FACEBOOK_PUBLISHER_URL = seoConfig.facebook.publisherUrl;

export function getSiteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return SITE_URL;
}

export function absoluteUrl(url: string | null | undefined): string {
  if (!url?.trim()) return absoluteUrl(DEFAULT_OG_IMAGE);
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const origin = getSiteOrigin();
  return `${origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export function canonicalUrl(pathOrFull?: string): string {
  if (pathOrFull) {
    if (pathOrFull.startsWith("http")) {
      try {
        const u = new URL(pathOrFull);
        u.search = "";
        u.hash = "";
        return u.toString();
      } catch {
        return pathOrFull;
      }
    }
    const origin = getSiteOrigin();
    return `${origin}${pathOrFull.startsWith("/") ? "" : "/"}${pathOrFull}`;
  }
  if (typeof window !== "undefined") {
    const u = new URL(window.location.href);
    u.search = "";
    u.hash = "";
    return u.toString();
  }
  return SITE_URL;
}

export type JsonLd = Record<string, unknown>;

export type BreadcrumbItem = { name: string; path: string };

export function mergeJsonLd(
  ...blocks: (JsonLd | JsonLd[] | undefined | null)[]
): JsonLd[] {
  return blocks.flatMap((b) =>
    !b ? [] : Array.isArray(b) ? b : [b],
  );
}

export function buildOrganizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(SITE_LOGO),
    },
    sameAs: Object.values(SITE_SOCIAL).filter(Boolean),
  };
}

export function buildWebSiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "es-MX",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function buildWebPageJsonLd(input: {
  name: string;
  description: string;
  url: string;
}): JsonLd {
  const url = canonicalUrl(input.url);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url,
    inLanguage: "es-MX",
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description: string;
  url: string;
}): JsonLd {
  const url = canonicalUrl(input.url);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url,
    inLanguage: "es-MX",
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };
}

export function buildPersonJsonLd(input: {
  name: string;
  description: string;
  url: string;
  imageUrl?: string | null;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
    description: input.description,
    url: canonicalUrl(input.url),
    image: input.imageUrl ? absoluteUrl(input.imageUrl) : undefined,
  };
}

export function buildNewsArticleJsonLd(input: {
  headline: string;
  description: string;
  url: string;
  imageUrl: string | null | undefined;
  datePublished: string | null | undefined;
  dateModified?: string | null;
  authorName: string;
  authorUrl?: string;
  section?: string;
  keywords?: string[];
}): JsonLd {
  const url = canonicalUrl(input.url);
  const image = absoluteUrl(input.imageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: input.headline,
    description: input.description,
    image: [image],
    datePublished: input.datePublished ?? undefined,
    dateModified: input.dateModified ?? input.datePublished ?? undefined,
    author: {
      "@type": "Person",
      name: input.authorName,
      ...(input.authorUrl ? { url: canonicalUrl(input.authorUrl) } : {}),
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
  };
}

export function twitterHandle(
  handle: string | null | undefined,
): string | undefined {
  if (!handle?.trim()) return undefined;
  const h = handle.trim().replace(/^@/, "");
  return `@${h}`;
}

export function resolveOgImageDimensions(
  ogImage: string,
  width?: number,
  height?: number,
): { width?: number; height?: number } {
  if (width && height) return { width, height };
  const resolved = absoluteUrl(ogImage);
  const defaultResolved = absoluteUrl(DEFAULT_OG_IMAGE);
  if (resolved === defaultResolved || ogImage === DEFAULT_OG_IMAGE) {
    return {
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
    };
  }
  return {};
}
