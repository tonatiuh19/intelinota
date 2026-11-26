import { Helmet } from "react-helmet-async";
import { SITE_LOGO, SITE_FAVICON } from "@/lib/branding";
import {
  SITE_NAME,
  APPLICATION_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  TWITTER_SITE,
  THEME_COLOR,
  OG_LOCALE,
  OG_LOCALE_ALTERNATE,
  APPLE_WEB_APP_TITLE,
  FACEBOOK_APP_ID,
  FB_PAGE_ID,
  GOOGLE_SITE_VERIFICATION,
  FACEBOOK_PUBLISHER_URL,
  absoluteUrl,
  canonicalUrl,
  buildOrganizationJsonLd,
  resolveOgImageDimensions,
  type JsonLd,
} from "@/lib/seo";

export interface MetaHeadProps {
  title?: string | null;
  description?: string;
  keywords?: string;

  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  ogImageType?: string;
  ogType?: "website" | "article" | "profile";
  canonical?: string;

  articlePublishedTime?: string | null;
  articleModifiedTime?: string | null;
  articleAuthor?: string | null;
  articleSection?: string | null;
  articleTags?: string[];
  /** Open Graph article:publisher (Facebook page URL) */
  articlePublisher?: string;

  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterSite?: string;
  twitterCreator?: string;
  twitterDomain?: string;

  facebookAppId?: string;
  fbPageId?: string;

  author?: string;
  googleSiteVerification?: string;

  ogLocale?: string;
  ogLocaleAlternate?: string;

  /** Append Organization JSON-LD on public pages (default: true when indexed) */
  includeSiteOrganization?: boolean;

  jsonLd?: JsonLd | JsonLd[];

  noIndex?: boolean;
  noFollow?: boolean;
  noArchive?: boolean;
  noSnippet?: boolean;
}

export default function MetaHead({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_OG_IMAGE,
  ogImageWidth,
  ogImageHeight,
  ogImageType = DEFAULT_OG_IMAGE_TYPE,
  ogType = "website",
  canonical,
  articlePublishedTime,
  articleModifiedTime,
  articleAuthor,
  articleSection,
  articleTags = [],
  articlePublisher = FACEBOOK_PUBLISHER_URL || undefined,
  twitterCard = "summary_large_image",
  twitterSite = TWITTER_SITE,
  twitterCreator,
  twitterDomain,
  facebookAppId = FACEBOOK_APP_ID || undefined,
  fbPageId = FB_PAGE_ID || undefined,
  author,
  googleSiteVerification = GOOGLE_SITE_VERIFICATION || undefined,
  ogLocale = OG_LOCALE,
  ogLocaleAlternate = OG_LOCALE_ALTERNATE,
  includeSiteOrganization,
  jsonLd,
  noIndex = false,
  noFollow = false,
  noArchive = false,
  noSnippet = false,
}: MetaHeadProps) {
  const resolvedTitle =
    title === null || title === undefined
      ? DEFAULT_TITLE
      : `${title} | ${SITE_NAME}`;

  const resolvedOgTitle = ogTitle ?? title ?? SITE_NAME;
  const resolvedOgDescription = ogDescription ?? description;
  const resolvedCanonical = canonicalUrl(canonical);
  const resolvedOgImage = absoluteUrl(ogImage);
  const isHttpsImage = resolvedOgImage.startsWith("https://");

  const dims = resolveOgImageDimensions(
    ogImage,
    ogImageWidth,
    ogImageHeight,
  );

  const shouldIncludeOrg =
    includeSiteOrganization ?? !noIndex;

  const robotsParts = [
    noIndex ? "noindex" : "index",
    noFollow || noIndex ? "nofollow" : "follow",
    noArchive ? "noarchive" : null,
    noSnippet ? "nosnippet" : null,
    !noIndex ? "max-image-preview:large" : null,
    !noIndex ? "max-snippet:-1" : null,
    !noIndex ? "max-video-preview:-1" : null,
  ].filter(Boolean);

  const extraJsonLd = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const jsonLdBlocks = [
    ...(shouldIncludeOrg ? [buildOrganizationJsonLd()] : []),
    ...extraJsonLd,
  ];

  return (
    <Helmet htmlAttributes={{ lang: "es" }}>
      {/* ── Primary ──────────────────────────────────────────── */}
      <title>{resolvedTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={robotsParts.join(", ")} />
      <meta name="googlebot" content={robotsParts.join(", ")} />
      {author && <meta name="author" content={author} />}
      <meta name="application-name" content={APPLICATION_NAME} />
      <meta name="generator" content="InteliNota" />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      <meta name="format-detection" content="telephone=no" />
      {googleSiteVerification && (
        <meta
          name="google-site-verification"
          content={googleSiteVerification}
        />
      )}
      <link rel="canonical" href={resolvedCanonical} />
      <link rel="alternate" hrefLang="es" href={resolvedCanonical} />
      {ogLocaleAlternate && (
        <link
          rel="alternate"
          hrefLang={ogLocaleAlternate.replace("_", "-").toLowerCase()}
          href={resolvedCanonical}
        />
      )}
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="msapplication-TileColor" content={THEME_COLOR} />
      <meta name="color-scheme" content="dark light" />

      {/* ── Icons / PWA hints ────────────────────────────────── */}
      <link rel="icon" href={SITE_FAVICON} />
      <link rel="apple-touch-icon" href={absoluteUrl(SITE_LOGO)} />
      <meta name="apple-mobile-web-app-title" content={APPLE_WEB_APP_TITLE} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />

      {/* ── Open Graph ───────────────────────────────────────── */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:image" content={resolvedOgImage} />
      {isHttpsImage && (
        <meta property="og:image:secure_url" content={resolvedOgImage} />
      )}
      <meta property="og:image:alt" content={resolvedOgTitle} />
      <meta property="og:image:type" content={ogImageType} />
      {dims.width && (
        <meta property="og:image:width" content={String(dims.width)} />
      )}
      {dims.height && (
        <meta property="og:image:height" content={String(dims.height)} />
      )}
      <meta property="og:locale" content={ogLocale} />
      {ogLocaleAlternate && (
        <meta property="og:locale:alternate" content={ogLocaleAlternate} />
      )}
      {facebookAppId && (
        <meta property="fb:app_id" content={facebookAppId} />
      )}
      {fbPageId && <meta property="fb:pages" content={fbPageId} />}

      {/* ── Twitter / X ──────────────────────────────────────── */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={twitterSite} />
      {twitterCreator && (
        <meta name="twitter:creator" content={twitterCreator} />
      )}
      {twitterDomain && (
        <meta name="twitter:domain" content={twitterDomain} />
      )}
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={resolvedOgImage} />
      <meta name="twitter:image:alt" content={resolvedOgTitle} />
      <meta name="twitter:url" content={resolvedCanonical} />

      {/* ── Article (Open Graph) ─────────────────────────────── */}
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
      {ogType === "article" && articlePublisher && (
        <meta property="article:publisher" content={articlePublisher} />
      )}
      {ogType === "article" &&
        articleTags.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}

      {/* ── JSON-LD ──────────────────────────────────────────── */}
      {jsonLdBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
