/**
 * Vercel Routing Middleware (runs at the edge, framework-agnostic).
 *
 * The site is a client-rendered SPA, so crawlers and social scrapers
 * (Google, WhatsApp, Facebook, X, LinkedIn…) would otherwise only see
 * `<title>INTELINOTA</title>`. For article / category / author routes we
 * fetch the (CDN-cached) API and inject:
 *   - <title>, description, canonical
 *   - Open Graph + Twitter Card tags
 *   - NewsArticle JSON-LD
 *   - a server-rendered semantic <article> inside #root (replaced by React)
 */
export const config = {
  matcher: ["/articulo/:slug*", "/categoria/:slug*", "/autor/:slug*"],
};

const SITE = "INTELINOTA";
const DEFAULT_IMAGE = "/og-home.jpg";
const TWITTER = "@intelinota";

interface PageMeta {
  title: string;
  description: string;
  image: string;
  type: "article" | "website" | "profile";
  jsonLd?: Record<string, unknown>;
  body: string;
  publishedAt?: string;
  section?: string;
  author?: string;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function abs(url: string, origin: string): string {
  if (!url) return `${origin}${DEFAULT_IMAGE}`;
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: T };
    return body?.data ?? null;
  } catch {
    return null;
  }
}

async function articleMeta(slug: string, origin: string): Promise<PageMeta | null> {
  const data = await getJson<{
    article: Record<string, any>;
    blocks: Array<{ type: string; data: Record<string, any> }>;
  }>(`${origin}/api/articles/${encodeURIComponent(slug)}`);
  if (!data?.article) return null;
  const a = data.article;
  const url = `${origin}/articulo/${a.slug}`;
  const image = abs(a.image_url, origin);
  const text = (data.blocks ?? [])
    .map((b) =>
      b.type === "html" ? b.data?.html ?? "" : b.type === "quote" ? `<blockquote>${esc(b.data?.text)}</blockquote>` : "",
    )
    .join("\n");
  const plain = stripHtml(text || a.content || "");
  return {
    title: `${a.title} | ${SITE}`,
    description: a.excerpt || plain.slice(0, 160),
    image,
    type: "article",
    publishedAt: a.published_at,
    section: a.category_name,
    author: a.author_name,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: String(a.title).slice(0, 110),
      description: a.excerpt,
      image: [image],
      datePublished: a.published_at,
      dateModified: a.published_at,
      articleSection: a.category_name,
      inLanguage: "es-MX",
      mainEntityOfPage: url,
      author: [{ "@type": "Person", name: a.author_name, url: `${origin}/autor/${a.author_slug}` }],
      publisher: {
        "@type": "NewsMediaOrganization",
        name: SITE,
        logo: { "@type": "ImageObject", url: `${origin}/favicon.ico` },
      },
    },
    body: `<article><p><a href="/categoria/${esc(a.category_slug)}">${esc(a.category_name)}</a></p>
<h1>${esc(a.title)}</h1><p>${esc(a.excerpt)}</p>
<p>Por <a href="/autor/${esc(a.author_slug)}">${esc(a.author_name)}</a> · <time datetime="${esc(a.published_at)}">${esc(a.published_at)}</time></p>
${a.image_url ? `<img src="${esc(image)}" alt="${esc(a.title)}" />` : ""}
${text || esc(plain)}</article>`,
  };
}

async function categoryMeta(slug: string, origin: string): Promise<PageMeta | null> {
  const data = await getJson<{ category: Record<string, any>; articles?: Array<Record<string, any>> }>(
    `${origin}/api/category/${encodeURIComponent(slug)}`,
  );
  if (!data?.category) return null;
  const c = data.category;
  const list = (data.articles ?? [])
    .slice(0, 20)
    .map((a) => `<li><a href="/articulo/${esc(a.slug)}">${esc(a.title)}</a></li>`)
    .join("");
  return {
    title: `${c.name} — Noticias | ${SITE}`,
    description: c.description || `Últimas noticias de ${c.name} en ${SITE}.`,
    image: abs(data.articles?.[0]?.image_url ?? "", origin),
    type: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: c.name,
      url: `${origin}/categoria/${c.slug}`,
      inLanguage: "es-MX",
    },
    body: `<section><h1>${esc(c.name)}</h1><p>${esc(c.description)}</p><ul>${list}</ul></section>`,
  };
}

async function authorMeta(slug: string, origin: string): Promise<PageMeta | null> {
  const a = await getJson<Record<string, any>>(`${origin}/api/authors/${encodeURIComponent(slug)}`);
  if (!a?.name) return null;
  return {
    title: `${a.name} | ${SITE}`,
    description: a.bio || `Artículos de ${a.name} en ${SITE}.`,
    image: abs(a.avatar_url ?? "", origin),
    type: "profile",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: { "@type": "Person", name: a.name, description: a.bio, image: a.avatar_url },
    },
    body: `<section><h1>${esc(a.name)}</h1><p>${esc(a.bio)}</p></section>`,
  };
}

function headTags(meta: PageMeta, url: string): string {
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" data-edge>`,
    `<link rel="canonical" href="${esc(url)}" data-edge>`,
    `<meta property="og:site_name" content="${SITE}" data-edge>`,
    `<meta property="og:locale" content="es_MX" data-edge>`,
    `<meta property="og:type" content="${meta.type}" data-edge>`,
    `<meta property="og:title" content="${esc(meta.title)}" data-edge>`,
    `<meta property="og:description" content="${esc(meta.description)}" data-edge>`,
    `<meta property="og:url" content="${esc(url)}" data-edge>`,
    `<meta property="og:image" content="${esc(meta.image)}" data-edge>`,
    `<meta name="twitter:card" content="summary_large_image" data-edge>`,
    `<meta name="twitter:site" content="${TWITTER}" data-edge>`,
    `<meta name="twitter:title" content="${esc(meta.title)}" data-edge>`,
    `<meta name="twitter:description" content="${esc(meta.description)}" data-edge>`,
    `<meta name="twitter:image" content="${esc(meta.image)}" data-edge>`,
  ];
  if (meta.publishedAt) {
    tags.push(`<meta property="article:published_time" content="${esc(meta.publishedAt)}" data-edge>`);
  }
  if (meta.section) tags.push(`<meta property="article:section" content="${esc(meta.section)}" data-edge>`);
  if (meta.author) tags.push(`<meta name="author" content="${esc(meta.author)}" data-edge>`);
  if (meta.jsonLd) {
    tags.push(
      `<script type="application/ld+json" data-edge>${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`,
    );
  }
  return tags.join("\n    ");
}

/** Search engines, social unfurlers, chat apps, SEO tools. */
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|twitterbot|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|embedly|pinterest|redditbot|applebot|skypeuripreview|vkshare|quora link preview|outbrain|google-inspectiontool|lighthouse|bingpreview|yandex|baiduspider|duckduckbot|petalbot|ahrefs|semrush/i;

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== "GET") return undefined;
  // Humans get the static SPA shell straight from the CDN (no extra latency).
  if (!BOT_UA.test(request.headers.get("user-agent") ?? "")) return undefined;
  const url = new URL(request.url);
  const [, kind, rawSlug] = url.pathname.split("/");
  const slug = decodeURIComponent(rawSlug ?? "");
  if (!slug) return undefined;

  const origin = url.origin;
  const [shell, meta] = await Promise.all([
    fetch(`${origin}/index.html`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
    kind === "articulo"
      ? articleMeta(slug, origin)
      : kind === "categoria"
        ? categoryMeta(slug, origin)
        : authorMeta(slug, origin),
  ]);

  // On any failure fall through to the normal SPA rewrite
  if (!shell || !meta) return undefined;

  const canonical = `${origin}${url.pathname}`;
  const html = shell
    .replace(/<meta [^>]*data-edge[^>]*>\s*/g, "")
    .replace(/<meta name="description"[^>]*>\s*/, "")
    .replace(/<title>[^<]*<\/title>/, headTags(meta, canonical))
    .replace(
      '<div id="root"></div>',
      `<div id="root"><div data-ssr-fallback class="mx-auto max-w-3xl px-4 py-10 article-content">${meta.body}</div></div>`,
    );

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
      vary: "User-Agent",
    },
  });
}
