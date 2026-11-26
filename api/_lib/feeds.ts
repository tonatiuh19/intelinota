import type { RowDataPacket, Pool } from "mysql2/promise";
import { escapeHtml } from "./security.js";

const SITE_NAME = "INTELINOTA";
const LANG = "es";

function xml(value: unknown): string {
  return escapeHtml(String(value ?? ""));
}

function iso(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function buildSitemap(pool: Pool, base: string): Promise<string> {
  const [[articles], [categories], [authors]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT slug, image_url, published_at AS lastmod
       FROM articles WHERE status = 'published' AND published_at <= NOW()
       ORDER BY published_at DESC LIMIT 45000`,
    ),
    pool.query<RowDataPacket[]>(
      "SELECT slug FROM categories WHERE is_active = 1 ORDER BY sort_order",
    ),
    pool.query<RowDataPacket[]>("SELECT slug FROM authors"),
  ]);

  const urls: string[] = [
    `<url><loc>${base}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...categories.map(
      (c) =>
        `<url><loc>${base}/categoria/${xml(c.slug)}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`,
    ),
    ...articles.map(
      (a) =>
        `<url><loc>${base}/articulo/${xml(a.slug)}</loc><lastmod>${iso(a.lastmod)}</lastmod>${
          a.image_url
            ? `<image:image><image:loc>${xml(a.image_url)}</image:loc></image:image>`
            : ""
        }</url>`,
    ),
    ...authors.map(
      (a) => `<url><loc>${base}/autor/${xml(a.slug)}</loc><priority>0.4</priority></url>`,
    ),
    ...["about", "team", "contact", "privacy", "autores"].map(
      (p) => `<url><loc>${base}/${p}</loc><priority>0.3</priority></url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

/** Google News sitemap: only articles from the last 48 hours. */
export async function buildNewsSitemap(pool: Pool, base: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT slug, title, published_at FROM articles
     WHERE status = 'published' AND published_at <= NOW()
       AND published_at >= NOW() - INTERVAL 2 DAY
     ORDER BY published_at DESC LIMIT 1000`,
  );
  const items = rows.map(
    (a) => `<url><loc>${base}/articulo/${xml(a.slug)}</loc><news:news>
<news:publication><news:name>${SITE_NAME}</news:name><news:language>${LANG}</news:language></news:publication>
<news:publication_date>${iso(a.published_at)}</news:publication_date>
<news:title>${xml(a.title)}</news:title></news:news></url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items.join("\n")}
</urlset>`;
}

export async function buildRss(
  pool: Pool,
  base: string,
  categorySlug?: string,
): Promise<string> {
  const params: unknown[] = [];
  let where = "a.status = 'published' AND a.published_at <= NOW()";
  if (categorySlug) {
    where += " AND c.slug = ?";
    params.push(categorySlug);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.slug, a.title, a.excerpt, a.image_url, a.published_at,
            c.name AS category_name, au.name AS author_name
     FROM articles a
     JOIN categories c ON c.id = a.category_id
     JOIN authors au ON au.id = a.author_id
     WHERE ${where}
     ORDER BY a.published_at DESC LIMIT 50`,
    params,
  );
  const feedUrl = `${base}/rss.xml${categorySlug ? `?categoria=${encodeURIComponent(categorySlug)}` : ""}`;
  const items = rows
    .map(
      (a) => `<item>
<title>${xml(a.title)}</title>
<link>${base}/articulo/${xml(a.slug)}</link>
<guid isPermaLink="true">${base}/articulo/${xml(a.slug)}</guid>
<pubDate>${new Date(iso(a.published_at)).toUTCString()}</pubDate>
<dc:creator>${xml(a.author_name)}</dc:creator>
<category>${xml(a.category_name)}</category>
<description>${xml(a.excerpt)}</description>${
        a.image_url
          ? `\n<media:content url="${xml(a.image_url)}" medium="image" />`
          : ""
      }
</item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${SITE_NAME}</title>
<link>${base}</link>
<description>Noticias de tecnología, deportes y cultura</description>
<language>es-MX</language>
<atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
}
