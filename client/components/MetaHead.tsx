import { Helmet } from "react-helmet-async";

const SITE_NAME = "INTELINOTA";
const DEFAULT_TITLE = "INTELINOTA — Noticias de tecnología, deportes y cultura";
const DEFAULT_DESCRIPTION =
  "El portal de noticias más inteligente. Últimas noticias de tecnología, deportes, videojuegos, cine y mundo.";
const DEFAULT_KEYWORDS =
  "noticias, tecnología, deportes, videojuegos, cine, inteligencia artificial, esports";
const DEFAULT_OG_IMAGE = "/og-home.jpg";
const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://intelinota.com";

export interface MetaHeadProps {
  /** Page title — rendered as "{title} | INTELINOTA". Pass null to use the full default title as-is. */
  title?: string | null;
  description?: string;
  keywords?: string;

  /** Open Graph */
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  /** "website" (default) | "article" */
  ogType?: "website" | "article";
  /** Canonical URL. Defaults to current href. */
  canonical?: string;

  /** Article-specific meta */
  articlePublishedTime?: string | null;
  articleModifiedTime?: string | null;
  articleAuthor?: string | null;
  articleSection?: string | null;
  articleTags?: string[];

  /** Twitter card type (default: summary_large_image) */
  twitterCard?: "summary" | "summary_large_image";

  /** Set true for pages that should not be indexed (e.g. admin, 404) */
  noIndex?: boolean;
}

/**
 * Robust, reusable meta/head component backed by react-helmet-async.
 *
 * Usage:
 *   <MetaHead title="My Article" description="..." ogImage="..." />
 */
export default function MetaHead({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  canonical,
  articlePublishedTime,
  articleModifiedTime,
  articleAuthor,
  articleSection,
  articleTags = [],
  twitterCard = "summary_large_image",
  noIndex = false,
}: MetaHeadProps) {
  const resolvedTitle =
    title === null || title === undefined
      ? DEFAULT_TITLE
      : `${title} | ${SITE_NAME}`;

  const resolvedOgTitle = ogTitle ?? title ?? SITE_NAME;
  const resolvedOgDescription = ogDescription ?? description;
  const resolvedCanonical =
    canonical ??
    (typeof window !== "undefined" ? window.location.href : SITE_URL);

  // Ensure og:image is always an absolute URL
  const resolvedOgImage = ogImage.startsWith("http")
    ? ogImage
    : `${SITE_URL}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;

  return (
    <Helmet>
      {/* ── Primary ──────────────────────────────────────────── */}
      <title>{resolvedTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={resolvedCanonical} />

      {/* ── Open Graph ───────────────────────────────────────── */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:alt" content={resolvedOgTitle} />
      <meta property="og:locale" content="es_MX" />

      {/* ── Twitter Card ─────────────────────────────────────── */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={resolvedOgImage} />

      {/* ── Article-specific ─────────────────────────────────── */}
      {ogType === "article" && articlePublishedTime && (
        <meta
          property="article:published_time"
          content={articlePublishedTime}
        />
      )}
      {ogType === "article" && articleModifiedTime && (
        <meta property="article:modified_time" content={articleModifiedTime} />
      )}
      {ogType === "article" && articleAuthor && (
        <meta property="article:author" content={articleAuthor} />
      )}
      {ogType === "article" && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}
      {ogType === "article" &&
        articleTags.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
    </Helmet>
  );
}
