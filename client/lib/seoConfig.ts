/**
 * Intelinota — SEO, Open Graph, Twitter, and social meta configuration.
 * Edit this file instead of .env (these values are public in the client bundle).
 */
export const seoConfig = {
  site: {
    name: "INTELINOTA",
    displayName: "InteliNota",
    url: "https://www.intelinota.com",
    applicationName: "INTELINOTA",
    themeColor: "#0a0a0a",
  },

  defaults: {
    title: "INTELINOTA — Noticias de tecnología, deportes y cultura",
    description:
      "El portal de noticias más inteligente. Últimas noticias de tecnología, deportes, videojuegos, cine y mundo.",
    keywords:
      "noticias, tecnología, deportes, videojuegos, cine, inteligencia artificial, esports",
  },

  openGraph: {
    defaultImage: "/og-home.jpg",
    imageWidth: 1200,
    imageHeight: 630,
    imageType: "image/jpeg",
    locale: "es_MX",
    localeAlternate: "es_ES",
  },

  twitter: {
    site: "@intelinota",
    domain: "intelinota.com",
  },

  facebook: {
    pageId: "intelinota",
    publisherUrl: "https://www.facebook.com/intelinota/",
    /** Meta app ID — leave empty until you create a Facebook app */
    appId: "",
  },

  google: {
    /** Search Console HTML tag value — leave empty until verified */
    siteVerification: "",
  },

  apple: {
    webAppTitle: "INTELINOTA",
  },

  /** CDN base for logos, favicon, etc. */
  assets: {
    base: "https://disruptinglabs.com/data/intelinota/assets",
  },

  /**
   * Web analytics (public IDs — safe in client bundle).
   * Enable GA4, Plausible, or both by filling the respective fields.
   */
  analytics: {
    /** GA4 measurement ID, e.g. G-XXXXXXXXXX */
    ga4MeasurementId: "",
    /** Plausible site domain, e.g. intelinota.com */
    plausibleDomain: "intelinota.com",
    /** Plausible script URL (default: plausible.io hosted) */
    plausibleScriptUrl: "https://plausible.io/js/script.js",
    /** Do not track /admin/* routes */
    excludeAdmin: true,
    /** Honor browser Do Not Track */
    respectDoNotTrack: true,
  },
} as const;

export type SeoConfig = typeof seoConfig;
