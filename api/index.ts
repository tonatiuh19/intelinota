import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type RequestHandler } from "express";
import cors from "cors";
import mysql, {
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import crypto from "crypto";
import {
  sanitizeBlockData,
  sanitizeRichHtml,
  sanitizePlainText,
  generateOtp,
  hashOtp,
  safeEqual,
  getRequestIp,
  hashIp,
  escapeHtml,
  memoryRateLimit,
  randomToken,
  SECURITY_HEADERS,
} from "./_lib/security.js";
import { processAndStoreImage, isBlobConfigured } from "./_lib/media.js";
import { buildSitemap, buildNewsSitemap, buildRss } from "./_lib/feeds.js";
import { setArticleTags, getArticleTags, saveRevision, audit } from "./_lib/newsroom.js";

// JWT Secret — required in production (Vercel)
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProd = Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
  if (!secret) {
    if (isProd) {
      throw new Error("JWT_SECRET is required in production");
    }
    console.warn("⚠️  JWT_SECRET not set — using dev-only fallback");
    return "dev-only-jwt-secret-not-for-production";
  }
  return secret;
}

const JWT_SECRET = resolveJwtSecret();

// Base URL helper — prefers explicit BASE_URL, falls back to Vercel's auto-injected
// VERCEL_URL (no https:// prefix), then localhost for local dev
const getBaseUrl = (): string => {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 8080}`;
};

// Lazy database connection pool — only created when DB env vars are present
let pool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (!pool) {
    if (
      !process.env.DB_HOST ||
      !process.env.DB_USER ||
      !process.env.DB_PASSWORD ||
      !process.env.DB_NAME
    ) {
      throw new Error(
        "Database environment variables are required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME",
      );
    }
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || "3306"),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_LIMIT || 3),
      enableKeepAlive: true,
      queueLimit: 0,
      ...(process.env.DB_SSL === "true"
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    });
  }
  return pool;
}

async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1",
      [key],
    );
    const value = rows[0]?.setting_value;
    return value != null ? String(value) : null;
  } catch {
    return null;
  }
}

// Resend email client (admin OTP and transactional mail)
let resendClient: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn(
    "⚠️  RESEND_API_KEY not set — email functionality will be disabled.",
  );
}

const EMAIL_FROM =
  process.env.SMTP_FROM || "Intelinota <no-reply@intelinota.com>";

function getProvidedCronSecret(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const header = req.headers["x-cron-secret"];
  if (typeof header === "string" && header) return header;
  return undefined;
}

function verifyCronSecret(
  req: express.Request,
  res: express.Response,
): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res
      .status(503)
      .json({ success: false, message: "CRON_SECRET not configured" });
    return false;
  }
  const provided = getProvidedCronSecret(req);
  if (!provided || !safeEqual(provided, cronSecret)) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  return true;
}

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  if (!resendClient) {
    throw new Error("Email not configured (missing RESEND_API_KEY)");
  }
  const { error } = await resendClient.emails.send({
    from: options.from || EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  if (error) {
    throw new Error(error.message);
  }
}

// =====================================================
// VISITOR TRACKING
// =====================================================

type EventType =
  | "home_view"
  | "article_view"
  | "category_view"
  | "search"
  | "other";

interface TrackVisitOptions {
  req: import("express").Request;
  eventType: EventType;
  pagePath: string;
  articleId?: number | null;
  categoryId?: number | null;
  userId?: number | null;
}

/**
 * Parses the User-Agent string into structured fields.
 * Lightweight — no external library, covers the most common patterns.
 */
function parseUserAgent(ua: string): {
  browser: string;
  browserVersion: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  isBot: boolean;
} {
  const botPattern =
    /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu|duckduck|semrush|ahrefs|mj12bot|rogerbot|dotbot/i;
  if (botPattern.test(ua)) {
    return {
      browser: "bot",
      browserVersion: "",
      os: "bot",
      deviceType: "bot",
      isBot: true,
    };
  }

  let browser = "unknown";
  let browserVersion = "";
  let os = "unknown";
  let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "unknown";

  // OS
  if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // Device type
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) deviceType = "tablet";
  else if (/mobi|iphone|android|blackberry|mini|windows\sce|palm/i.test(ua))
    deviceType = "mobile";
  else deviceType = "desktop";

  // Browser (order matters — more specific first)
  const edgeMatch = ua.match(/Edg\/([^\s;]+)/);
  const chromeMatch = ua.match(/Chrome\/([^\s;]+)/);
  const safariMatch = ua.match(/Version\/([^\s;]+).*Safari/);
  const firefoxMatch = ua.match(/Firefox\/([^\s;]+)/);

  if (edgeMatch) {
    browser = "Edge";
    browserVersion = edgeMatch[1];
  } else if (chromeMatch && !safariMatch) {
    browser = "Chrome";
    browserVersion = chromeMatch[1];
  } else if (safariMatch) {
    browser = "Safari";
    browserVersion = safariMatch[1];
  } else if (firefoxMatch) {
    browser = "Firefox";
    browserVersion = firefoxMatch[1];
  }

  return { browser, browserVersion, os, deviceType, isBot: false };
}

/**
 * Extracts UTM parameters from a URL string (query part).
 */
function parseUtm(url: string): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
} {
  try {
    const params = new URLSearchParams(
      url.includes("?") ? url.split("?")[1] : url,
    );
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
    };
  } catch {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
    };
  }
}


function auditFrom(req: express.Request) {
  return {
    userId: req.adminUser?.userId ?? null,
    ipHash: (() => {
      try {
        return hashIp(getRequestIp(req));
      } catch {
        return null;
      }
    })(),
  };
}

const ARTICLE_STATUSES = new Set(["draft", "in_review", "published", "archived", "scheduled"]);

/** Defense in depth: sanitize stored blocks on read (covers legacy rows). */
function sanitizeBlockRows(rows: RowDataPacket[]): RowDataPacket[] {
  return rows.map((row) => {
    const raw = typeof row.data === "string" ? safeJsonParse(row.data) : row.data;
    return { ...row, data: sanitizeBlockData(String(row.type), raw) } as RowDataPacket;
  });
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** Only expose internal error details outside production. */
function devError(error: unknown): { error?: string } {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") return {};
  return { error: error instanceof Error ? error.message : "Unknown error" };
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}


/** Returns false after sending 403 if author role has no linked author_id. */
function ensureLinkedAuthor(
  req: express.Request,
  res: express.Response,
): boolean {
  if (req.adminUser!.role === "admin") return true;
  if (!req.adminUser!.authorId) {
    res.status(403).json({
      success: false,
      message: "Author account is not linked to a profile. Contact an admin.",
    });
    return false;
  }
  return true;
}

async function recordLoginAttempt(email: string, ipHash: string): Promise<void> {
  try {
    await getPool().query(
      "INSERT INTO admin_login_attempts (email, ip_hash) VALUES (?, ?)",
      [email, ipHash],
    );
  } catch {
    // Table may not exist yet — ignore
  }
}

async function isLoginRateLimited(
  email: string,
  ipHash: string,
): Promise<boolean> {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT
         SUM(email = ?) AS email_attempts,
         SUM(ip_hash = ?) AS ip_attempts
       FROM admin_login_attempts
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
      [email, ipHash],
    );
    const row = (rows as RowDataPacket[])[0];
    return (
      Number(row?.email_attempts ?? 0) >= 10 ||
      Number(row?.ip_attempts ?? 0) >= 30
    );
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget visitor event tracker.
 * Call this in any route handler — it never throws and never delays the
 * response because the DB insert is not awaited.
 */
function trackVisit(opts: TrackVisitOptions): void {
  const { req, eventType, pagePath, articleId, categoryId, userId } = opts;

  // Never block the event loop — run everything in a detached promise
  Promise.resolve().then(async () => {
    try {
      const ua = (req.headers["user-agent"] ?? "").substring(0, 512);
      const { browser, browserVersion, os, deviceType, isBot } =
        parseUserAgent(ua);

      // Raw IP — try forwarded headers first (Vercel / proxy)
      const rawIp = getRequestIp(req);

      const ipHash = hashIp(rawIp);

      // Geo from CDN headers (Vercel injects these, Cloudflare uses CF-IPCountry)
      const ipCountry =
        (
          (req.headers["x-vercel-ip-country"] ??
            req.headers["cf-ipcountry"]) as string | undefined
        )?.substring(0, 2) ?? null;
      const ipCity =
        (req.headers["x-vercel-ip-city"] as string | undefined)?.substring(
          0,
          100,
        ) ?? null;

      // Session ID — clients should send a stable UUID in X-Session-Id
      const sessionId =
        (req.headers["x-session-id"] as string | undefined)?.substring(0, 64) ??
        hashIp(rawIp + ua).substring(0, 64);

      // Referrer
      const referrerFull = (req.headers["referer"] ??
        req.headers["referrer"] ??
        "") as string;
      const referrer = referrerFull.substring(0, 500) || null;
      let referrerDomain: string | null = null;
      if (referrer) {
        try {
          referrerDomain = new URL(referrer).hostname.substring(0, 150);
        } catch {
          /* invalid URL — leave null */
        }
      }

      const utm = parseUtm(req.url ?? "");

      await getPool().query(
        `INSERT INTO visitors
           (session_id, ip_hash, ip_country, ip_city,
            user_agent, browser, browser_version, os, device_type, is_bot,
            event_type, page_path, article_id, category_id,
            referrer, referrer_domain,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          ipHash,
          ipCountry,
          ipCity,
          ua || null,
          browser,
          browserVersion || null,
          os,
          deviceType,
          isBot ? 1 : 0,
          eventType,
          pagePath.substring(0, 500),
          articleId ?? null,
          categoryId ?? null,
          referrer,
          referrerDomain,
          utm.utm_source,
          utm.utm_medium,
          utm.utm_campaign,
          utm.utm_content,
          utm.utm_term,
          userId ?? null,
        ],
      );
    } catch {
      // Silently swallow — tracking must never crash the API
    }
  });
}

// =====================================================
// ROUTE HANDLERS
// =====================================================

/**
 * GET /api/health
 */
const handleHealth: RequestHandler = async (_req, res) => {
  const dbConfigured = !!(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD &&
    process.env.DB_NAME
  );

  if (!dbConfigured) {
    return res.json({
      success: true,
      message: "Intelinota API is running",
      timestamp: new Date().toISOString(),
      database: "not configured",
    });
  }

  try {
    await getPool().query("SELECT 1");
    res.json({
      success: true,
      message: "Intelinota API is running",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed",
      database: "error",
      ...devError(error),
    });
  }
};

/**
 * GET /api/articles
 * Query params: category (slug), subcategory (slug), featured (1), trending (1),
 *               search (title/excerpt), page (default 1), limit (default 20)
 */
const handleGetArticles: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "20"))),
    );
    const offset = (page - 1) * limit;

    const conditions: string[] = ["a.status = 'published'"];
    const params: (string | number)[] = [];

    if (req.query.category) {
      conditions.push("c.slug = ?");
      params.push(String(req.query.category));
    }
    if (req.query.subcategory) {
      conditions.push("sc.slug = ?");
      params.push(String(req.query.subcategory));
    }
    if (req.query.featured === "1") {
      conditions.push("a.featured = 1");
    }
    if (req.query.trending === "1") {
      conditions.push("a.trending = 1");
    }
    if (req.query.search) {
      conditions.push("(a.title LIKE ? ESCAPE '\\\\' OR a.excerpt LIKE ? ESCAPE '\\\\')");
      const q = `%${escapeLike(String(req.query.search).slice(0, 100))}%`;
      params.push(q, q);
    }
    if (req.query.slugs) {
      const slugs = String(req.query.slugs)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);
      if (slugs.length) {
        conditions.push(`a.slug IN (${slugs.map(() => "?").join(", ")})`);
        params.push(...slugs);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) AS total
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
      ${where}
    `;
    const dataSql = `
      SELECT
        a.id, a.slug, a.title, a.excerpt,
        a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
        a.author_id, au.name AS author_name, au.slug AS author_slug,
        a.image_url, a.read_time_minutes, a.featured, a.trending,
        a.status, a.published_at, a.view_count
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
      JOIN authors au ON au.id = a.author_id
      ${where}
      ORDER BY a.published_at DESC
      LIMIT ? OFFSET ?
    `;

    const [[countRow], [rows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(countSql, params),
      getPool().query<RowDataPacket[]>(dataSql, [...params, limit, offset]),
    ]);

    const total = (countRow as RowDataPacket[])[0].total as number;

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch articles",
      ...devError(error),
    });
  }
};

/**
 * GET /api/articles/:slug
 * Returns article + content blocks + related articles in a single round-trip.
 * Increments view_count on each fetch.
 */
/**
 * POST /api/articles/:slug/view
 * Counts a view once per session+article per 30 min, ignoring bots.
 */
const handleArticleView: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { slug } = req.params;
  const ua = String(req.headers["user-agent"] ?? "");
  if (parseUserAgent(ua).isBot) return res.status(204).end();
  // Key on server-observed IP + UA (client headers are spoofable)
  const viewer = hashIp(`${getRequestIp(req)}|${ua}`);
  if (memoryRateLimit(`view:${viewer}:${slug}`, 1, 30 * 60 * 1000)) {
    return res.status(204).end();
  }
  try {
    await getPool().query(
      "UPDATE articles SET view_count = view_count + 1 WHERE slug = ? AND status = 'published'",
      [slug],
    );
  } catch (error) {
    console.error("view count error:", error);
  }
  res.status(204).end();
};

function sendXml(res: express.Response, body: string, type = "application/xml") {
  res.set("Content-Type", `${type}; charset=utf-8`);
  res.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  res.send(body);
}

const publicBase = () => getBaseUrl().replace(/\/$/, "");

const handleSitemap: RequestHandler = async (_req, res) => {
  try {
    sendXml(res, await buildSitemap(getPool(), publicBase()));
  } catch (error) {
    console.error("sitemap error:", error);
    res.status(500).end();
  }
};

const handleNewsSitemap: RequestHandler = async (_req, res) => {
  try {
    sendXml(res, await buildNewsSitemap(getPool(), publicBase()));
  } catch (error) {
    console.error("news sitemap error:", error);
    res.status(500).end();
  }
};

const handleRss: RequestHandler = async (req, res) => {
  try {
    const cat = typeof req.query.categoria === "string" ? req.query.categoria.slice(0, 100) : undefined;
    sendXml(res, await buildRss(getPool(), publicBase(), cat), "application/rss+xml");
  } catch (error) {
    console.error("rss error:", error);
    res.status(500).end();
  }
};

const handleGetArticle: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;
    const COLS = `
      a.id, a.slug, a.title, a.excerpt, a.content,
      a.category_id, c.name AS category_name, c.slug AS category_slug,
      a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
      a.author_id, au.name AS author_name, au.slug AS author_slug,
      a.image_url, a.read_time_minutes, a.featured, a.trending,
      a.status, a.published_at, a.view_count
    `;
    const JOINS = `
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
      JOIN authors au ON au.id = a.author_id
    `;

    const [articleRows] = await getPool().query<RowDataPacket[]>(
      `SELECT ${COLS} ${JOINS} WHERE a.slug = ? AND a.status = 'published' LIMIT 1`,
      [slug],
    );

    if (!articleRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    const article = articleRows[0] as RowDataPacket;

    // View counting happens via POST /api/articles/:slug/view (so this
    // response can be CDN-cached). Visit tracking stays fire-and-forget.
    trackVisit({
      req,
      eventType: "article_view",
      pagePath: `/articulo/${slug}`,
      articleId: article.id as number,
      categoryId: article.category_id as number,
    });

    // Parallel: blocks + related articles from same category
    const [[blockRows], [relatedRows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT id, article_id, position, type, data
         FROM article_blocks
         WHERE article_id = ?
         ORDER BY position ASC`,
        [article.id],
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT ${COLS} ${JOINS}
         WHERE a.status = 'published' AND a.category_id = ? AND a.id != ?
         ORDER BY a.published_at DESC LIMIT 6`,
        [article.category_id, article.id],
      ),
    ]);

    res.json({
      success: true,
      data: {
        article: {
          ...article,
          content: article.content ? sanitizeRichHtml(article.content) : article.content,
        },
        blocks: sanitizeBlockRows(blockRows),
        related: relatedRows,
        tags: await getArticleTags(getPool(), article.id as number),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch article",
      ...devError(error),
    });
  }
};

/**
 * GET /api/home
 * Single optimised endpoint for the home page.
 * Returns featured articles, trending articles, latest articles,
 * active categories (with subcategories) and SEO meta — all in one
 * round-trip using Promise.all.
 */
const handleGetHome: RequestHandler = async (_req, res) => {
  try {
    const ARTICLE_COLS = `
      a.id, a.slug, a.title, a.excerpt,
      a.category_id, c.name AS category_name, c.slug AS category_slug,
      a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
      a.author_id, au.name AS author_name, au.slug AS author_slug,
      a.image_url, a.read_time_minutes, a.featured, a.trending,
      a.status, a.published_at, a.view_count
    `;
    const ARTICLE_FROM = `
      FROM articles a
      JOIN   categories c  ON c.id = a.category_id
      LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
      JOIN   authors au ON au.id = a.author_id
      WHERE  a.status = 'published'
    `;

    const [
      [featuredRows],
      [trendingRows],
      [latestRows],
      [categoryRows],
      [subcategoryRows],
      appVersion,
      [mostReadRows],
    ] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT ${ARTICLE_COLS} ${ARTICLE_FROM} AND a.featured = 1 ORDER BY a.trending DESC, a.published_at DESC LIMIT 6`,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT ${ARTICLE_COLS} ${ARTICLE_FROM} AND a.trending = 1 ORDER BY a.published_at DESC LIMIT 5`,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT ${ARTICLE_COLS} ${ARTICLE_FROM} ORDER BY a.published_at DESC LIMIT 50`,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT id, name, slug, description, is_active, sort_order
         FROM categories
         WHERE is_active = 1
         ORDER BY sort_order ASC`,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT id, category_id, name, slug FROM subcategories ORDER BY name ASC`,
      ),
      getSystemSetting("app_version"),
      getPool().query<RowDataPacket[]>(
        `SELECT ${ARTICLE_COLS} ${ARTICLE_FROM}
           AND a.published_at >= NOW() - INTERVAL 30 DAY
         ORDER BY a.view_count DESC, a.published_at DESC LIMIT 5`,
      ),
    ]);

    const categories = (categoryRows as RowDataPacket[]).map((cat) => ({
      ...cat,
      is_active: Boolean(cat.is_active),
      subcategories: (subcategoryRows as RowDataPacket[]).filter(
        (sc) => sc.category_id === cat.id,
      ),
    }));

    const baseUrl = getBaseUrl();
    const meta = {
      title: "INTELINOTA — Noticias de tecnología, deportes y cultura",
      description:
        "El portal de noticias más inteligente. Últimas noticias de tecnología, deportes, videojuegos, cine y mundo.",
      keywords:
        "noticias, tecnología, deportes, videojuegos, cine, inteligencia artificial, esports",
      og_title: "INTELINOTA",
      og_description:
        "Las mejores noticias de tecnología, deportes y cultura digital.",
      og_image: `${baseUrl}/og-home.jpg`,
      canonical_url: baseUrl,
      app_version: appVersion,
    };

    res.json({
      success: true,
      data: {
        featured: featuredRows,
        trending: trendingRows,
        articles: latestRows,
        mostRead: mostReadRows.length
          ? mostReadRows
          : [...(latestRows as RowDataPacket[])]
              .sort((x, y) => Number(y.view_count) - Number(x.view_count))
              .slice(0, 5),
        categories,
        meta,
      },
    });

    // Fire-and-forget — track after response is queued
    trackVisit({ req: _req as any, eventType: "home_view", pagePath: "/" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load home data",
      ...devError(error),
    });
  }
};

/**
 * GET /api/categories
 * Returns active categories (is_active = 1) with their subcategories nested,
 * ordered by sort_order.
 */
const handleGetCategories: RequestHandler = async (_req, res) => {
  try {
    const [categories] = await getPool().query<RowDataPacket[]>(
      `SELECT id, name, slug, description, is_active, sort_order
       FROM categories
       WHERE is_active = 1
       ORDER BY sort_order ASC`,
    );
    const [subcategories] = await getPool().query<RowDataPacket[]>(
      "SELECT id, category_id, name, slug FROM subcategories ORDER BY name ASC",
    );

    const result = (categories as RowDataPacket[]).map((cat) => ({
      ...cat,
      is_active: Boolean(cat.is_active),
      subcategories: (subcategories as RowDataPacket[]).filter(
        (sc) => sc.category_id === cat.id,
      ),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      ...devError(error),
    });
  }
};

/**
 * GET /api/authors
 */
const handleGetAuthors: RequestHandler = async (_req, res) => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT au.id, au.name, au.slug, au.bio, au.avatar_url, au.twitter_handle,
              COUNT(a.id) AS article_count,
              MAX(a.published_at) AS latest_published_at
       FROM authors au
       LEFT JOIN articles a ON a.author_id = au.id AND a.status = 'published'
       GROUP BY au.id, au.name, au.slug, au.bio, au.avatar_url, au.twitter_handle
       ORDER BY article_count DESC, au.name ASC`,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch authors",
      ...devError(error),
    });
  }
};

/**
 * GET /api/authors/:slug
 * Returns author profile + their published articles
 */
const handleGetAuthor: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    let authorRows: RowDataPacket[];
    try {
      [authorRows] = await getPool().query<RowDataPacket[]>(
        "SELECT id, name, slug, bio, avatar_url, twitter_handle, social_links FROM authors WHERE slug = ? LIMIT 1",
        [slug],
      );
    } catch (qErr: any) {
      if (qErr?.code === "ER_BAD_FIELD_ERROR") {
        [authorRows] = await getPool().query<RowDataPacket[]>(
          "SELECT id, name, slug, bio, avatar_url, twitter_handle, NULL AS social_links FROM authors WHERE slug = ? LIMIT 1",
          [slug],
        );
      } else {
        throw qErr;
      }
    }

    if (!authorRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Author not found" });
    }

    const author = authorRows[0];

    const [articleRows] = await getPool().query<RowDataPacket[]>(
      `SELECT
        a.id, a.slug, a.title, a.excerpt,
        a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
        a.author_id, au.name AS author_name, au.slug AS author_slug,
        a.image_url, a.read_time_minutes, a.featured, a.trending,
        a.status, a.published_at, a.view_count
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
       JOIN authors au ON au.id = a.author_id
       WHERE a.author_id = ? AND a.status = 'published'
       ORDER BY a.published_at DESC`,
      [author.id],
    );

    res.json({ success: true, data: { ...author, articles: articleRows } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch author",
      ...devError(error),
    });
  }
};

/**
 * GET /api/articles/:slug/blocks
 * Returns ordered content blocks for an article
 */
const handleGetArticleBlocks: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    const [articleRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug],
    );

    if (!articleRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    const [blocks] = await getPool().query<RowDataPacket[]>(
      `SELECT id, article_id, position, type, data
       FROM article_blocks
       WHERE article_id = ?
       ORDER BY position ASC`,
      [articleRows[0].id],
    );

    res.json({ success: true, data: sanitizeBlockRows(blocks) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch article blocks",
      ...devError(error),
    });
  }
};

/**
 * GET /api/category/:slug
 * Returns category info + paginated articles + trending in a single round-trip.
 * Query params: page (default 1), subcategory (subcategory name)
 */
const handleGetCategoryPage: RequestHandler = async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 20;
    const offset = (page - 1) * limit;
    const subcategoryFilter = req.query.subcategory
      ? String(req.query.subcategory)
      : null;

    const articleConditions = ["a.status = 'published'", "c.slug = ?"];
    const articleParams: (string | number)[] = [slug];
    if (subcategoryFilter) {
      articleConditions.push("sc.name = ?");
      articleParams.push(subcategoryFilter);
    }
    const articleWhere = articleConditions.join(" AND ");

    const COLS = `
      a.id, a.slug, a.title, a.excerpt,
      a.category_id, c.name AS category_name, c.slug AS category_slug,
      a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
      a.author_id, au.name AS author_name, au.slug AS author_slug,
      a.image_url, a.read_time_minutes, a.featured, a.trending,
      a.status, a.published_at, a.view_count
    `;
    const JOINS = `
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
      JOIN authors au ON au.id = a.author_id
    `;

    const [[categoryRows], [countRows], [articleRows], [trendingRows]] =
      await Promise.all([
        getPool().query<RowDataPacket[]>(
          `SELECT id, name, slug, description, is_active, sort_order
           FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1`,
          [slug],
        ),
        getPool().query<RowDataPacket[]>(
          `SELECT COUNT(*) AS total ${JOINS} WHERE ${articleWhere}`,
          articleParams,
        ),
        getPool().query<RowDataPacket[]>(
          `SELECT ${COLS} ${JOINS}
           WHERE ${articleWhere}
           ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
          [...articleParams, limit, offset],
        ),
        getPool().query<RowDataPacket[]>(
          `SELECT ${COLS} ${JOINS}
           WHERE a.status = 'published' AND a.trending = 1
           ORDER BY a.published_at DESC LIMIT 5`,
        ),
      ]);

    if (!(categoryRows as RowDataPacket[]).length) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const category = (categoryRows as RowDataPacket[])[0];
    const [subcategoryRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, category_id, name, slug FROM subcategories WHERE category_id = ? ORDER BY name ASC",
      [category.id],
    );

    const total = ((countRows as RowDataPacket[])[0]?.total as number) ?? 0;

    res.json({
      success: true,
      data: {
        category: {
          ...category,
          subcategories: subcategoryRows,
        },
        articles: articleRows,
        trending: trendingRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch category page",
      ...devError(error),
    });
  }
};

// =====================================================
// ADMIN AUTH HELPERS
// =====================================================

/** HTML email template for the OTP login code */
function buildOtpEmailHtml(code: string, recipientName: string | null): string {
  const name = recipientName ?? "Administrador";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Código de acceso — INTELINOTA</title></head>
<body style="margin:0;padding:0;background:#060d1f;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:48px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#0d1b3e;border-radius:16px;overflow:hidden;border:1px solid #1e3a5f;box-shadow:0 25px 60px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 28px;background:linear-gradient(135deg,#0d1b3e 0%,#0f2460 100%);border-bottom:1px solid #1e3a5f;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;font-family:'Helvetica Neue',Arial,sans-serif;">
                Inteli<span style="color:#3b82f6;">Nota</span>
              </span>
              <span style="margin-left:12px;background:#1e3a5f;color:#64a0e0;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;vertical-align:top;">Admin</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:44px 40px 36px;">
            <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px;">Tu código de acceso</h2>
            <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;line-height:1.65;">Hola, <strong style="color:#cbd5e1;">${escapeHtml(name)}</strong>.</p>
            <p style="margin:0 0 36px;font-size:15px;color:#94a3b8;line-height:1.65;">
              Usa el siguiente código para acceder al panel de administración de INTELINOTA.
              El código expira en <strong style="color:#3b82f6;">15 minutos</strong>.
            </p>
            <!-- OTP box -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:36px;">
              <tr><td align="center"
                style="background:linear-gradient(135deg,#0f2460 0%,#1e3a6e 100%);
                       border:2px solid #3b82f6;border-radius:12px;padding:28px 20px;">
                <div style="font-size:48px;font-weight:900;color:#ffffff;letter-spacing:16px;
                            font-family:'Courier New',Courier,monospace;text-shadow:0 0 30px rgba(59,130,246,0.5);">
                  ${code}
                </div>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
              style="background:#0a1628;border-radius:8px;padding:0;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                  🔒 &nbsp;Si no solicitaste este código, ignora este correo con seguridad. Tu cuenta no está en riesgo.<br>
                  <strong style="color:#94a3b8;">Nunca compartas este código con nadie.</strong>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #1e3a5f;">
            <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">
              © 2026 INTELINOTA &nbsp;·&nbsp; Panel de Administración &nbsp;·&nbsp; Este correo fue enviado de forma automática, no respondas.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Extend Express Request to carry decoded admin JWT payload */
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        userId: number;
        email: string;
        role: "admin" | "author";
        authorId: number | null;
      };
    }
  }
}

/** JWT auth middleware — protects /api/admin/* routes; revalidates user in DB */
const requireAdminAuth: RequestHandler = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
      userId: number;
      email: string;
      role: "admin" | "author";
      authorId: number | null;
    };

    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, role, author_id FROM users WHERE id = ? AND role IN ('admin','author') LIMIT 1",
      [payload.userId],
    );
    if (!(rows as RowDataPacket[]).length) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const user = (rows as RowDataPacket[])[0];
    req.adminUser = {
      userId: user.id as number,
      email: user.email as string,
      role: user.role as "admin" | "author",
      authorId: (user.author_id as number | null) ?? null,
    };
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

/** Role guard — only allows admin role */
const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.adminUser?.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Forbidden: admin role required" });
  }
  next();
};

// =====================================================
// ADMIN ROUTE HANDLERS
// =====================================================

/**
 * POST /api/admin/auth/request-code
 * Sends a 6-digit OTP to the given email if it belongs to an admin/author user.
 * Always returns success to avoid email enumeration.
 */
const handleAdminRequestCode: RequestHandler = async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res
      .status(400)
      .json({ success: false, message: "Valid email required" });
  }
  const normalEmail = email.toLowerCase().trim();

  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, name, role FROM users WHERE email = ? AND role IN ('admin','author') LIMIT 1",
      [normalEmail],
    );

    // Always return the same response to avoid leaking whether email exists
    if (!(rows as RowDataPacket[]).length) {
      return res.json({
        success: true,
        data: { message: "If that email is registered, a code was sent." },
      });
    }

    const user = (rows as RowDataPacket[])[0];

    // Clean up expired / old codes for this email
    await getPool().query(
      "DELETE FROM admin_login_codes WHERE email = ? AND (expires_at < NOW() OR used = 1)",
      [normalEmail],
    );

    // Rate limit: max 3 pending codes per email
    const [pending] = await getPool().query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM admin_login_codes WHERE email = ? AND expires_at > NOW() AND used = 0",
      [normalEmail],
    );
    if (((pending as RowDataPacket[])[0].cnt as number) >= 3) {
      return res.status(429).json({
        success: false,
        message: "Too many code requests. Please wait a few minutes.",
      });
    }

    // Generate 6-digit code
    const code = generateOtp();
    const codeHash = hashOtp(code, normalEmail);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const ipHash = hashIp(getRequestIp(req));

    await getPool().query(
      "INSERT INTO admin_login_codes (email, code, expires_at, ip_hash) VALUES (?, ?, ?, ?)",
      [normalEmail, codeHash, expiresAt, ipHash],
    );

    // Send email
    await sendEmail({
      to: normalEmail,
      subject: `${code} — Código de acceso a INTELINOTA`,
      html: buildOtpEmailHtml(code, user.name as string | null),
    });

    res.json({ success: true, data: { message: "Code sent to your email." } });
  } catch (error) {
    console.error("request-code error:", error);
    res.status(500).json({ success: false, message: "Failed to send code" });
  }
};

/**
 * POST /api/admin/auth/verify-code
 * Verifies the OTP and returns a signed JWT.
 */
const handleAdminVerifyCode: RequestHandler = async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) {
    return res
      .status(400)
      .json({ success: false, message: "email and code are required" });
  }
  const normalEmail = email.toLowerCase().trim();
  const normalCode = code.trim();
  const ipHash = hashIp(getRequestIp(req));

  try {
    if (await isLoginRateLimited(normalEmail, ipHash)) {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please wait a few minutes.",
      });
    }

    const codeHash = hashOtp(normalCode, normalEmail);

    // Look up valid code (HMAC-hashed)
    const [codeRows] = await getPool().query<RowDataPacket[]>(
      `SELECT id FROM admin_login_codes
       WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalEmail, codeHash],
    );

    if (!(codeRows as RowDataPacket[]).length) {
      await recordLoginAttempt(normalEmail, ipHash);
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired code" });
    }

    const codeId = (codeRows as RowDataPacket[])[0].id as number;

    // Mark used
    await getPool().query(
      "UPDATE admin_login_codes SET used = 1 WHERE id = ?",
      [codeId],
    );

    // Fetch user
    const [userRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, name, role, author_id, avatar_url FROM users WHERE email = ? AND role IN ('admin','author') LIMIT 1",
      [normalEmail],
    );

    if (!(userRows as RowDataPacket[]).length) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const user = (userRows as RowDataPacket[])[0];

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        authorId: user.author_id ?? null,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          author_id: user.author_id ?? null,
          avatar_url: user.avatar_url ?? null,
        },
      },
    });
  } catch (error) {
    console.error("verify-code error:", error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

/**
 * Builds admin user payload including linked author profile fields.
 */
async function buildAdminUserResponse(userId: number) {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT id, email, name, role, author_id, avatar_url FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  if (!(rows as RowDataPacket[]).length) return null;

  const u = (rows as RowDataPacket[])[0];
  const base = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    author_id: u.author_id ?? null,
    avatar_url: u.avatar_url ?? null,
    bio: null as string | null,
    twitter_handle: null as string | null,
    social_links: null as object | null,
  };

  if (!u.author_id) return base;

  try {
    const [authorRows] = await getPool().query<RowDataPacket[]>(
      "SELECT bio, twitter_handle, social_links FROM authors WHERE id = ? LIMIT 1",
      [u.author_id],
    );
    if ((authorRows as RowDataPacket[]).length) {
      const a = (authorRows as RowDataPacket[])[0];
      base.bio = a.bio ?? null;
      base.twitter_handle = a.twitter_handle ?? null;
      base.social_links = a.social_links ?? null;
    }
  } catch (qErr: any) {
    if (qErr?.code !== "ER_BAD_FIELD_ERROR") throw qErr;
    const [authorRows] = await getPool().query<RowDataPacket[]>(
      "SELECT bio, twitter_handle FROM authors WHERE id = ? LIMIT 1",
      [u.author_id],
    );
    if ((authorRows as RowDataPacket[]).length) {
      const a = (authorRows as RowDataPacket[])[0];
      base.bio = a.bio ?? null;
      base.twitter_handle = a.twitter_handle ?? null;
    }
  }

  return base;
}

/**
 * GET /api/admin/me
 * Returns the currently authenticated admin user.
 */
const handleAdminMe: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.adminUser!;
    const user = await buildAdminUserResponse(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};

/**
 * PUT /api/admin/me/profile
 * Updates the authenticated user's own profile (name, avatar_url)
 * and optionally their linked author record if author_id is set.
 */
const handleAdminUpdateMyProfile: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.adminUser!;
    const body = req.body as {
      name?: string;
      avatar_url?: string;
      bio?: string;
      twitter_handle?: string;
      social_links?: object | null;
    };

    // Update the users table
    const userSets: string[] = [];
    const userVals: (string | null)[] = [];
    if (body.name !== undefined) {
      userSets.push("name = ?");
      userVals.push(body.name ?? null);
    }
    if (body.avatar_url !== undefined) {
      userSets.push("avatar_url = ?");
      userVals.push(body.avatar_url ?? null);
    }
    if (userSets.length) {
      userVals.push(userId as unknown as string);
      await getPool().query(
        `UPDATE users SET ${userSets.join(", ")} WHERE id = ?`,
        userVals,
      );
    }

    // Also update the linked author record if one exists
    const [userRows] = await getPool().query<RowDataPacket[]>(
      "SELECT author_id FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    const authorId = (userRows as RowDataPacket[])[0]?.author_id ?? null;

    if (authorId) {
      const authorSets: string[] = [];
      const authorVals: (string | null)[] = [];
      if (body.name !== undefined) {
        authorSets.push("name = ?");
        authorVals.push(body.name ?? null);
      }
      if (body.avatar_url !== undefined) {
        authorSets.push("avatar_url = ?");
        authorVals.push(body.avatar_url ?? null);
      }
      if (body.bio !== undefined) {
        authorSets.push("bio = ?");
        authorVals.push(body.bio ?? null);
      }
      if (body.twitter_handle !== undefined) {
        authorSets.push("twitter_handle = ?");
        authorVals.push(body.twitter_handle ?? null);
      }
      if (body.social_links !== undefined) {
        authorSets.push("social_links = ?");
        authorVals.push(
          body.social_links ? JSON.stringify(body.social_links) : null,
        );
      }
      if (authorSets.length) {
        authorVals.push(authorId as unknown as string);
        try {
          await getPool().query(
            `UPDATE authors SET ${authorSets.join(", ")} WHERE id = ?`,
            authorVals,
          );
        } catch (updateErr: any) {
          // If social_links column doesn't exist yet, retry without it
          if (updateErr?.code === "ER_BAD_FIELD_ERROR") {
            const filteredSets: string[] = [];
            const filteredVals: (string | null)[] = [];
            authorSets.forEach((s, i) => {
              if (!s.startsWith("social_links")) {
                filteredSets.push(s);
                filteredVals.push(authorVals[i]);
              }
            });
            if (filteredSets.length) {
              filteredVals.push(authorId as unknown as string);
              await getPool().query(
                `UPDATE authors SET ${filteredSets.join(", ")} WHERE id = ?`,
                filteredVals,
              );
            }
          } else {
            throw updateErr;
          }
        }
      }
    }

    // Return updated user with linked author fields
    const user = await buildAdminUserResponse(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update profile" });
  }
};

/**
 * GET /api/admin/dashboard
 * Aggregate metrics for the dashboard.
 */
const handleAdminDashboard: RequestHandler = async (req, res) => {
  try {
    const isAdmin = req.adminUser!.role === "admin";
    const authorId = req.adminUser!.authorId;

    if (!isAdmin && !authorId) {
      return res.status(403).json({
        success: false,
        message: "Author account is not linked to a profile",
      });
    }

    // Article counts + total views
    const articleWhere = isAdmin ? "" : "WHERE author_id = ?";
    const articleParams = isAdmin ? [] : [authorId];

    const viewsByDaySql = isAdmin
      ? `SELECT DATE(created_at) AS date, COUNT(*) AS count
         FROM visitors
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      : `SELECT DATE(v.created_at) AS date, COUNT(*) AS count
         FROM visitors v
         INNER JOIN articles a ON a.id = v.article_id AND a.author_id = ?
         WHERE v.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(v.created_at)
         ORDER BY date ASC`;

    const [[statRows], [topRows], [viewsByDayRows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT
          COUNT(*) AS total_articles,
          SUM(status = 'published') AS published_articles,
          SUM(status = 'draft') AS draft_articles,
          SUM(status = 'archived') AS archived_articles,
          COALESCE(SUM(view_count), 0) AS total_views
         FROM articles ${articleWhere}`,
        articleParams,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT a.id, a.slug, a.title, a.view_count, c.name AS category_name
         FROM articles a
         JOIN categories c ON c.id = a.category_id
         ${isAdmin ? "" : "WHERE a.author_id = ?"}
         ORDER BY a.view_count DESC LIMIT 10`,
        isAdmin ? [] : [authorId],
      ),
      getPool().query<RowDataPacket[]>(
        viewsByDaySql,
        isAdmin ? [] : [authorId],
      ),
    ]);

    let totalAuthors = 0;
    let totalVisitors30d = 0;

    if (isAdmin) {
      const [[authorsRow], [visitorsRow]] = await Promise.all([
        getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM authors"),
        getPool().query<RowDataPacket[]>(
          "SELECT COUNT(*) AS cnt FROM visitors WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        ),
      ]);
      totalAuthors = ((authorsRow as RowDataPacket[])[0].cnt as number) ?? 0;
      totalVisitors30d =
        ((visitorsRow as RowDataPacket[])[0].cnt as number) ?? 0;
    }

    const stats = (statRows as RowDataPacket[])[0];

    res.json({
      success: true,
      data: {
        total_articles: Number(stats.total_articles) || 0,
        published_articles: Number(stats.published_articles) || 0,
        draft_articles: Number(stats.draft_articles) || 0,
        archived_articles: Number(stats.archived_articles) || 0,
        total_views: Number(stats.total_views) || 0,
        total_authors: totalAuthors,
        total_visitors_30d: totalVisitors30d,
        top_articles: topRows as RowDataPacket[],
        views_by_day: (viewsByDayRows as RowDataPacket[]).map((r) => ({
          date: String(r.date),
          count: Number(r.count),
        })),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to load dashboard" });
  }
};

/**
 * GET /api/admin/articles
 */
const handleAdminGetArticles: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "20"))),
    );
    const offset = (page - 1) * limit;
    const isAdmin = req.adminUser!.role === "admin";
    const authorId = req.adminUser!.authorId;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!isAdmin) {
      conditions.push("a.author_id = ?");
      params.push(authorId!);
    }
    if (req.query.status) {
      conditions.push("a.status = ?");
      params.push(String(req.query.status));
    }
    if (req.query.category) {
      conditions.push("c.slug = ?");
      params.push(String(req.query.category));
    }
    if (req.query.search) {
      conditions.push("(a.title LIKE ? ESCAPE '\\\\' OR a.excerpt LIKE ? ESCAPE '\\\\')");
      const q = `%${escapeLike(String(req.query.search))}%`;
      params.push(q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[countRow], [rows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM articles a
         JOIN categories c ON c.id = a.category_id
         LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
         ${where}`,
        params,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT
          a.id, a.slug, a.title, a.excerpt,
          a.category_id, c.name AS category_name, c.slug AS category_slug,
          a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
          a.author_id, au.name AS author_name, au.slug AS author_slug,
          a.image_url, a.read_time_minutes, a.featured, a.trending,
          a.status, a.published_at, a.view_count, a.created_at, a.updated_at
         FROM articles a
         JOIN categories c ON c.id = a.category_id
         LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
         JOIN authors au ON au.id = a.author_id
         ${where}
         ORDER BY a.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: ((countRow as RowDataPacket[])[0].total as number) ?? 0,
        totalPages: Math.ceil(
          ((countRow as RowDataPacket[])[0].total as number) / limit,
        ),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch articles" });
  }
};

/**
 * GET /api/admin/articles/:id
 */
const handleAdminGetArticle: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT
        a.id, a.slug, a.title, a.excerpt, a.content,
        a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
        a.author_id, au.name AS author_name, au.slug AS author_slug,
        a.image_url, a.read_time_minutes, a.featured, a.trending,
        a.status, a.published_at, a.view_count, a.created_at, a.updated_at
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
       JOIN authors au ON au.id = a.author_id
       WHERE a.id = ? LIMIT 1`,
      [id],
    );

    if (!(rows as RowDataPacket[]).length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    const article = (rows as RowDataPacket[])[0];

    // Author guard
    const isAdmin = req.adminUser!.role === "admin";
    if (!isAdmin && req.adminUser!.authorId !== article.author_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const [blocks] = await getPool().query<RowDataPacket[]>(
      "SELECT id, article_id, position, type, data FROM article_blocks WHERE article_id = ? ORDER BY position ASC",
      [article.id],
    );
    const tags = await getArticleTags(getPool(), article.id as number);

    res.json({ success: true, data: { ...article, blocks, tags: tags.map((t) => t.name) } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch article" });
  }
};

/**
 * GET /api/cron/publish-scheduled
 * POST /api/cron/publish-scheduled
 * Called by the cPanel cron job (e.g. every 5 minutes via curl).
 * Protected by CRON_SECRET — pass as ?secret=, Authorization: Bearer, or x-cron-secret header.
 *
 *   curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=CRON_SECRET"
 */
const handleCronPublishScheduled: RequestHandler = async (req, res) => {
  try {
    if (!verifyCronSecret(req, res)) return;

    const [result] = await getPool().query<ResultSetHeader>(
      `UPDATE articles
         SET status = 'published'
       WHERE status = 'scheduled'
         AND published_at IS NOT NULL
         AND published_at <= NOW()`,
    );
    res.json({
      success: true,
      published: result.affectedRows,
      message: `${result.affectedRows} article(s) published`,
    });
  } catch (error) {
    console.error("Cron publish error:", error);
    res.status(500).json({ success: false, message: "Cron job failed" });
  }
};

/**
 * GET /api/admin/articles/featured-count
 */
const handleAdminFeaturedCount: RequestHandler = async (req, res) => {
  try {
    const isAdmin = req.adminUser!.role === "admin";
    const authorId = req.adminUser!.authorId;
    if (!isAdmin && !authorId) {
      return res.json({ success: true, count: 0 });
    }

    const [rows] = await getPool().query<RowDataPacket[]>(
      isAdmin
        ? "SELECT COUNT(*) AS cnt FROM articles WHERE featured = 1"
        : "SELECT COUNT(*) AS cnt FROM articles WHERE featured = 1 AND author_id = ?",
      isAdmin ? [] : [authorId],
    );
    res.json({
      success: true,
      count: (rows as RowDataPacket[])[0].cnt as number,
    });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch featured count" });
  }
};

/**
 * POST /api/admin/articles
 */
const handleAdminCreateArticle: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const body = req.body as {
      title: string;
      slug: string;
      excerpt?: string;
      content?: string;
      category_id: number;
      subcategory_id?: number;
      author_id: number;
      image_url?: string;
      read_time_minutes?: number;
      featured?: boolean;
      trending?: boolean;
      status?: string;
      published_at?: string;
      blocks?: Array<{ position: number; type: string; data: object }>;
      tags?: string[];
    };

    if (!body.title || !body.slug || !body.category_id || !body.author_id) {
      return res.status(400).json({
        success: false,
        message: "title, slug, category_id, author_id are required",
      });
    }

    // Author guard: non-admin can only create for their own author_id
    const isAdmin = req.adminUser!.role === "admin";
    const effectiveAuthorId = isAdmin
      ? body.author_id
      : req.adminUser!.authorId!;

    // Non-admin authors cannot publish, schedule, or curate homepage flags
    const requested = ARTICLE_STATUSES.has(String(body.status)) ? String(body.status) : "draft";
    const effectiveStatus = isAdmin
      ? requested
      : requested === "in_review"
        ? "in_review"
        : "draft";
    const effectiveFeatured = isAdmin ? Boolean(body.featured) : false;
    const effectiveTrending = isAdmin ? Boolean(body.trending) : false;

    // Auto-displace oldest featured when the limit (5) would be exceeded
    if (isAdmin && effectiveFeatured) {
      const [cntRows] = await getPool().query<RowDataPacket[]>(
        "SELECT COUNT(*) AS cnt FROM articles WHERE featured = 1",
      );
      if ((cntRows as RowDataPacket[])[0].cnt >= 5) {
        await getPool().query(
          "UPDATE articles SET featured = 0 WHERE featured = 1 ORDER BY COALESCE(published_at, created_at) ASC LIMIT 1",
        );
      }
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO articles
         (slug, title, excerpt, content, category_id, subcategory_id, author_id,
          image_url, read_time_minutes, featured, trending, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.slug,
        body.title,
        body.excerpt ?? null,
        body.content != null ? sanitizeRichHtml(body.content) : null,
        body.category_id,
        body.subcategory_id ?? null,
        effectiveAuthorId,
        body.image_url ?? null,
        body.read_time_minutes ?? 5,
        effectiveTrending ? 1 : effectiveFeatured ? 1 : 0,
        effectiveTrending ? 1 : 0,
        effectiveStatus,
        // Scheduled: published_at is the target time; Published with no date: NOW()
        effectiveStatus === "published" && !body.published_at
          ? new Date().toISOString()
          : (body.published_at ?? null),
      ],
    );

    const articleId = result.insertId;

    if (body.blocks?.length) {
      const blockValues = body.blocks.map((b) => [
        articleId,
        b.position,
        b.type,
        JSON.stringify(sanitizeBlockData(b.type, b.data)),
      ]);
      await getPool().query(
        "INSERT INTO article_blocks (article_id, position, type, data) VALUES ?",
        [blockValues],
      );
    }

    if (Array.isArray(body.tags)) {
      await setArticleTags(getPool(), articleId, body.tags);
    }
    await saveRevision(getPool(), articleId, req.adminUser!.userId);
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.create",
      entityType: "article",
      entityId: articleId,
      details: { title: body.title, status: effectiveStatus },
    });

    res.status(201).json({ success: true, data: { id: articleId } });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to create article" });
  }
};

/**
 * PUT /api/admin/articles/:id
 */
const handleAdminUpdateArticle: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    // Ownership check
    const [existing] = await getPool().query<RowDataPacket[]>(
      "SELECT author_id, featured, status FROM articles WHERE id = ? LIMIT 1",
      [id],
    );
    if (!(existing as RowDataPacket[]).length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }
    const isAdmin = req.adminUser!.role === "admin";
    if (
      !isAdmin &&
      req.adminUser!.authorId !== (existing as RowDataPacket[])[0].author_id
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const body = req.body as {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      category_id?: number;
      subcategory_id?: number;
      author_id?: number;
      image_url?: string;
      read_time_minutes?: number;
      featured?: boolean;
      trending?: boolean;
      status?: string;
      published_at?: string;
      blocks?: Array<{
        id?: number;
        position: number;
        type: string;
        data: object;
      }>;
      tags?: string[];
    };

    // Auto-displace oldest featured when the limit (5) would be exceeded
    if (isAdmin && body.featured) {
      const wasAlreadyFeatured =
        (existing as RowDataPacket[])[0].featured === 1;
      if (!wasAlreadyFeatured) {
        const [cntRows] = await getPool().query<RowDataPacket[]>(
          "SELECT COUNT(*) AS cnt FROM articles WHERE featured = 1",
        );
        if ((cntRows as RowDataPacket[])[0].cnt >= 5) {
          await getPool().query(
            "UPDATE articles SET featured = 0 WHERE featured = 1 AND id != ? ORDER BY COALESCE(published_at, created_at) ASC LIMIT 1",
            [id],
          );
        }
      }
    }

    // Build dynamic SET clause
    const sets: string[] = [];
    const vals: (string | number | null | boolean)[] = [];

    const fields: Record<string, unknown> = {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt ?? null,
      content: body.content != null ? sanitizeRichHtml(body.content) : null,
      category_id: body.category_id,
      subcategory_id: body.subcategory_id ?? null,
      author_id: isAdmin ? body.author_id : undefined,
      image_url: body.image_url ?? null,
      read_time_minutes: body.read_time_minutes,
      featured: isAdmin
        ? body.trending
          ? 1
          : body.featured !== undefined
            ? body.featured
              ? 1
              : 0
            : undefined
        : undefined,
      trending: isAdmin
        ? body.trending !== undefined
          ? body.trending
            ? 1
            : 0
          : undefined
        : undefined,
      // Non-admin authors may move between draft/in_review only. Any other
      // value leaves the current status untouched, so an author fixing a typo
      // in a live article does not unpublish it.
      status:
        body.status === undefined || !ARTICLE_STATUSES.has(String(body.status))
          ? undefined
          : isAdmin
            ? body.status
            : body.status === "in_review" || body.status === "draft"
              ? (existing as RowDataPacket[])[0].status === "published" &&
                body.status === "draft"
                ? undefined
                : body.status
              : undefined,
      published_at: isAdmin ? (body.published_at ?? null) : undefined,
    };

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(val as string | number | null);
      }
    }

    if (sets.length) {
      await getPool().query(
        `UPDATE articles SET ${sets.join(", ")} WHERE id = ?`,
        [...vals, id],
      );
    }

    // Replace blocks if provided
    if (body.blocks !== undefined) {
      await getPool().query("DELETE FROM article_blocks WHERE article_id = ?", [
        id,
      ]);
      if (body.blocks.length) {
        const blockValues = body.blocks.map((b) => [
          id,
          b.position,
          b.type,
          JSON.stringify(sanitizeBlockData(b.type, b.data)),
        ]);
        await getPool().query(
          "INSERT INTO article_blocks (article_id, position, type, data) VALUES ?",
          [blockValues],
        );
      }
    }

    if (Array.isArray(body.tags)) {
      await setArticleTags(getPool(), id, body.tags);
    }
    await saveRevision(getPool(), id, req.adminUser!.userId);
    await audit(getPool(), {
      ...auditFrom(req),
      action: fields.status ? `article.status.${String(fields.status)}` : "article.update",
      entityType: "article",
      entityId: id,
      details: { title: body.title },
    });

    res.json({ success: true, data: { id } });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to update article" });
  }
};

/**
 * DELETE /api/admin/articles/:id  — archives instead of hard-deletes
 */
const handleAdminDeleteArticle: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const [existing] = await getPool().query<RowDataPacket[]>(
      "SELECT author_id FROM articles WHERE id = ? LIMIT 1",
      [id],
    );
    if (!(existing as RowDataPacket[]).length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }
    const isAdmin = req.adminUser!.role === "admin";
    if (
      !isAdmin &&
      req.adminUser!.authorId !== (existing as RowDataPacket[])[0].author_id
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await getPool().query(
      "UPDATE articles SET status = 'archived' WHERE id = ?",
      [id],
    );
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.archive",
      entityType: "article",
      entityId: id,
    });
    res.json({ success: true, data: { id } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete article" });
  }
};

/**
 * GET /api/admin/authors
 */
const handleAdminGetAuthors: RequestHandler = async (_req, res) => {
  try {
    let rows: RowDataPacket[];
    try {
      [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT
          au.id, au.name, au.slug, au.bio, au.avatar_url, au.email, au.twitter_handle, au.social_links,
          u.id AS user_id, u.role AS user_role
         FROM authors au
         LEFT JOIN users u ON u.author_id = au.id
         ORDER BY au.name ASC`,
      );
    } catch (queryErr: any) {
      // Graceful fallback if social_links migration hasn't run yet
      if (queryErr?.code === "ER_BAD_FIELD_ERROR") {
        [rows] = await getPool().query<RowDataPacket[]>(
          `SELECT
            au.id, au.name, au.slug, au.bio, au.avatar_url, au.email, au.twitter_handle, NULL AS social_links,
            u.id AS user_id, u.role AS user_role
           FROM authors au
           LEFT JOIN users u ON u.author_id = au.id
           ORDER BY au.name ASC`,
        );
      } else {
        throw queryErr;
      }
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch authors" });
  }
};

/**
 * POST /api/admin/authors
 */
const handleAdminCreateAuthor: RequestHandler = async (req, res) => {
  try {
    const body = req.body as {
      name: string;
      slug: string;
      bio?: string;
      avatar_url?: string;
      twitter_handle?: string;
      email?: string;
      social_links?: object | null;
      user_email?: string;
      user_role?: string;
    };

    if (!body.name || !body.slug) {
      return res
        .status(400)
        .json({ success: false, message: "name and slug are required" });
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO authors (name, slug, bio, avatar_url, email, twitter_handle, social_links)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name,
        body.slug,
        body.bio ?? null,
        body.avatar_url ?? null,
        body.email ?? null,
        body.twitter_handle ?? null,
        body.social_links ? JSON.stringify(body.social_links) : null,
      ],
    );

    const authorId = result.insertId;

    // Optionally create/link a user account
    if (body.user_email) {
      const role = body.user_role === "admin" ? "admin" : "author";
      const [existingUsers] = await getPool().query<RowDataPacket[]>(
        "SELECT id, author_id FROM users WHERE email = ? LIMIT 1",
        [body.user_email],
      );
      if ((existingUsers as RowDataPacket[]).length) {
        const existing = (existingUsers as RowDataPacket[])[0];
        if (
          existing.author_id &&
          Number(existing.author_id) !== Number(authorId)
        ) {
          return res.status(409).json({
            success: false,
            message: "Email already linked to another author",
          });
        }
        await getPool().query(
          "UPDATE users SET name = ?, role = ?, author_id = ?, email_verified = 1 WHERE id = ?",
          [body.name, role, authorId, existing.id],
        );
      } else {
        await getPool().query(
          `INSERT INTO users (email, password_hash, name, role, author_id, email_verified)
           VALUES (?, '', ?, ?, ?, 1)`,
          [body.user_email, body.name, role, authorId],
        );
      }
    }

    res.status(201).json({ success: true, data: { id: authorId } });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug or email already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to create author" });
  }
};

/**
 * PUT /api/admin/authors/:id
 */
const handleAdminUpdateAuthor: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const [exists] = await getPool().query<RowDataPacket[]>(
      "SELECT id FROM authors WHERE id = ? LIMIT 1",
      [id],
    );
    if (!(exists as RowDataPacket[]).length) {
      return res
        .status(404)
        .json({ success: false, message: "Author not found" });
    }

    const body = req.body as {
      name?: string;
      slug?: string;
      bio?: string;
      avatar_url?: string;
      twitter_handle?: string;
      email?: string;
      social_links?: object | null;
      user_email?: string;
      user_role?: string;
    };

    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    const fields: Record<string, string | number | null | undefined> = {
      name: body.name,
      slug: body.slug,
      bio: body.bio ?? null,
      avatar_url: body.avatar_url ?? null,
      email: body.email ?? null,
      twitter_handle: body.twitter_handle ?? null,
    };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(val);
      }
    }
    if (body.social_links !== undefined) {
      sets.push(`social_links = ?`);
      vals.push(body.social_links ? JSON.stringify(body.social_links) : null);
    }
    if (sets.length) {
      await getPool().query(
        `UPDATE authors SET ${sets.join(", ")} WHERE id = ?`,
        [...vals, id],
      );
    }

    // Update linked user role when provided
    if (body.user_role) {
      const role = body.user_role === "admin" ? "admin" : "author";
      if (body.user_email) {
        await getPool().query(
          "UPDATE users SET role = ? WHERE author_id = ? AND email = ?",
          [role, id, body.user_email],
        );
      } else {
        await getPool().query("UPDATE users SET role = ? WHERE author_id = ?", [
          role,
          id,
        ]);
      }
    }

    res.json({ success: true, data: { id } });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug or email already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to update author" });
  }
};

/**
 * DELETE /api/admin/authors/:id — admin only
 */
const handleAdminDeleteAuthor: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    // Check no published articles
    const [articleCount] = await getPool().query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM articles WHERE author_id = ? AND status = 'published'",
      [id],
    );
    if (((articleCount as RowDataPacket[])[0].cnt as number) > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete author with published articles. Archive their articles first.",
      });
    }

    // Unlink user
    await getPool().query(
      "UPDATE users SET author_id = NULL WHERE author_id = ?",
      [id],
    );
    await getPool().query("DELETE FROM authors WHERE id = ?", [id]);

    res.json({ success: true, data: { id } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete author" });
  }
};

/**
 * GET /api/admin/comments
 */
const handleAdminGetComments: RequestHandler = async (req, res) => {
  try {
    const status = req.query.status
      ? String(req.query.status)
      : "pending";
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "20"))),
    );
    const offset = (page - 1) * limit;

    const [[countRow], [rows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM comments WHERE status = ?",
        [status],
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT c.id, c.article_id, a.title AS article_title, a.slug AS article_slug,
                c.author_name, c.author_email, c.content, c.status, c.created_at
         FROM comments c
         JOIN articles a ON a.id = c.article_id
         WHERE c.status = ?
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [status, limit, offset],
      ),
    ]);

    const total = Number((countRow as RowDataPacket[])[0]?.total ?? 0);
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch comments" });
  }
};

/**
 * PATCH /api/admin/comments/:id
 */
const handleAdminPatchComment: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const status = String(req.body?.status ?? "");
    if (isNaN(id) || !["pending", "approved", "spam"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }
    const [result] = await getPool().query<ResultSetHeader>(
      "UPDATE comments SET status = ? WHERE id = ?",
      [status, id],
    );
    if (!result.affectedRows) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    await audit(getPool(), {
      ...auditFrom(req),
      action: `comment.${String(status)}`,
      entityType: "comment",
      entityId: id,
    });
    res.json({ success: true, data: { id, status } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update comment" });
  }
};

/**
 * GET /api/admin/categories
 */
const handleAdminGetCategories: RequestHandler = async (_req, res) => {
  try {
    const [categories] = await getPool().query<RowDataPacket[]>(
      `SELECT id, name, slug, description, is_active, sort_order
       FROM categories ORDER BY sort_order ASC, name ASC`,
    );
    const [subcategories] = await getPool().query<RowDataPacket[]>(
      "SELECT id, category_id, name, slug FROM subcategories ORDER BY name ASC",
    );
    const data = (categories as RowDataPacket[]).map((cat) => ({
      ...cat,
      is_active: Boolean(cat.is_active),
      subcategories: (subcategories as RowDataPacket[]).filter(
        (sc) => sc.category_id === cat.id,
      ),
    }));
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch categories" });
  }
};

/**
 * PUT /api/admin/categories/:id
 */
const handleAdminUpdateCategory: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const body = req.body as {
      name?: string;
      slug?: string;
      description?: string;
      is_active?: boolean;
      sort_order?: number;
    };

    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    if (body.name !== undefined) {
      sets.push("name = ?");
      vals.push(body.name);
    }
    if (body.slug !== undefined) {
      sets.push("slug = ?");
      vals.push(body.slug);
    }
    if (body.description !== undefined) {
      sets.push("description = ?");
      vals.push(body.description ?? null);
    }
    if (body.is_active !== undefined) {
      sets.push("is_active = ?");
      vals.push(body.is_active ? 1 : 0);
    }
    if (body.sort_order !== undefined) {
      sets.push("sort_order = ?");
      vals.push(body.sort_order);
    }

    if (!sets.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `UPDATE categories SET ${sets.join(", ")} WHERE id = ?`,
      [...vals, id],
    );
    if (!result.affectedRows) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to update category" });
  }
};

/**
 * GET /api/admin/newsletter/subscribers
 */
const handleAdminGetNewsletterSubscribers: RequestHandler = async (
  req,
  res,
) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "20"))),
    );
    const offset = (page - 1) * limit;
    const status = req.query.status ? String(req.query.status) : null;

    const conditions: string[] = [];
    const params: string[] = [];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[countRow], [rows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM newsletter_subscribers ${where}`,
        params,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT id, email, name, source, status, subscribed_at, unsubscribed_at
         FROM newsletter_subscribers ${where}
         ORDER BY subscribed_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
    ]);

    const total = Number((countRow as RowDataPacket[])[0]?.total ?? 0);
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch newsletter subscribers",
    });
  }
};

/**
 * GET /api/admin/settings
 */
const handleAdminGetSettings: RequestHandler = async (_req, res) => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT setting_key, setting_value, setting_type, description, updated_at FROM system_settings ORDER BY setting_key ASC",
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
};

/**
 * PUT /api/admin/settings
 */
const handleAdminUpdateSettings: RequestHandler = async (req, res) => {
  try {
    const settings = req.body?.settings as
      | Array<{ key: string; value: string }>
      | undefined;
    if (!Array.isArray(settings) || !settings.length) {
      return res
        .status(400)
        .json({ success: false, message: "settings array required" });
    }

    for (const item of settings) {
      if (!item.key || item.value === undefined) continue;
      await getPool().query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
         VALUES (?, ?, 'string', 'Updated via admin settings')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [String(item.key).slice(0, 100), String(item.value)],
      );
    }

    res.json({ success: true, data: { message: "Settings updated" } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update settings" });
  }
};

/**
 * POST /api/newsletter/subscribe
 * Stores email for future newsletter sends.
 */
const handleNewsletterSubscribe: RequestHandler = async (req, res) => {
  try {
    // Honeypot: bots fill hidden "website" field
    if (req.body?.website) {
      return res.json({ success: true, data: { message: "Revisa tu correo para confirmar" } });
    }
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 255);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Correo electrónico inválido" });
    }
    const ipHash = hashIp(getRequestIp(req));
    if (memoryRateLimit(`nl:${ipHash}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Demasiados intentos. Intenta más tarde.",
      });
    }

    const source = req.body?.source
      ? sanitizePlainText(String(req.body.source), 64)
      : null;

    const [existing] = await getPool().query<RowDataPacket[]>(
      "SELECT id, status FROM newsletter_subscribers WHERE email = ? LIMIT 1",
      [email],
    );
    if (existing[0]?.status === "active") {
      // Do not reveal subscription state
      return res.json({ success: true, data: { message: "Revisa tu correo para confirmar" } });
    }

    const confirmToken = randomToken(24);
    const unsubscribeToken = randomToken(24);
    await getPool().query(
      `INSERT INTO newsletter_subscribers (email, source, status, confirm_token, unsubscribe_token)
       VALUES (?, ?, 'pending', ?, ?)
       ON DUPLICATE KEY UPDATE
         source = COALESCE(VALUES(source), source),
         status = 'pending',
         confirm_token = VALUES(confirm_token),
         unsubscribe_token = COALESCE(unsubscribe_token, VALUES(unsubscribe_token))`,
      [email, source, confirmToken, unsubscribeToken],
    );

    const base = (process.env.BASE_URL || "https://intelinota.com").replace(/\/$/, "");
    const confirmUrl = `${base}/api/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`;
    try {
      await sendEmail({
        to: email,
        subject: "Confirma tu suscripción a INTELINOTA",
        html: `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px">
<h1 style="font-size:24px">Un paso más</h1>
<p>Confirma tu suscripción al boletín de INTELINOTA:</p>
<p><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Confirmar suscripción</a></p>
<p style="color:#777;font-size:13px">Si no solicitaste esto, ignora este correo.</p></div>`,
      });
    } catch (mailErr) {
      console.error("newsletter confirm email failed:", mailErr);
    }

    res.json({
      success: true,
      data: { message: "Revisa tu correo para confirmar" },
    });
  } catch (error) {
    console.error("newsletter subscribe error:", error);
    res.status(500).json({
      success: false,
      message: "No se pudo registrar la suscripción",
      ...devError(error),
    });
  }
};

/** GET /api/newsletter/confirm?token= — double opt-in confirmation */
const handleNewsletterConfirm: RequestHandler = async (req, res) => {
  const base = (process.env.BASE_URL || "").replace(/\/$/, "");
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) return res.redirect(302, `${base}/newsletter?status=invalid`);
  try {
    const [result] = await getPool().query<ResultSetHeader>(
      `UPDATE newsletter_subscribers
       SET status = 'active', confirmed_at = NOW(), confirm_token = NULL, unsubscribed_at = NULL
       WHERE confirm_token = ?`,
      [token],
    );
    res.redirect(
      302,
      `${base}/newsletter?status=${result.affectedRows ? "confirmed" : "invalid"}`,
    );
  } catch (error) {
    console.error("newsletter confirm error:", error);
    res.redirect(302, `${base}/newsletter?status=error`);
  }
};

/** GET|POST /api/newsletter/unsubscribe?token= — one-click unsubscribe */
const handleNewsletterUnsubscribe: RequestHandler = async (req, res) => {
  const base = (process.env.BASE_URL || "").replace(/\/$/, "");
  const token =
    typeof req.query.token === "string"
      ? req.query.token
      : String(req.body?.token ?? "");
  if (!token) return res.redirect(302, `${base}/newsletter?status=invalid`);
  // GET never mutates: mail scanners pre-fetch links. Show a confirm page
  // that POSTs (RFC 8058 one-click clients POST directly).
  if (req.method !== "POST") {
    return res.redirect(
      302,
      `${base}/newsletter?unsubscribe=${encodeURIComponent(token)}`,
    );
  }
  try {
    await getPool().query(
      `UPDATE newsletter_subscribers
       SET status = 'unsubscribed', unsubscribed_at = NOW()
       WHERE unsubscribe_token = ?`,
      [token],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("newsletter unsubscribe error:", error);
    res.status(500).json({ success: false, message: "No se pudo procesar" });
  }
};

/**
 * GET /api/articles/:slug/comments
 * Returns approved comments for a published article.
 */
const handleGetComments: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;
    const [articleRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug],
    );
    if (!articleRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT c.id, c.article_id, c.parent_id, c.author_name, c.content, c.created_at
       FROM comments c
       WHERE c.article_id = ? AND c.status = 'approved'
       ORDER BY c.created_at ASC`,
      [articleRows[0].id],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
      ...devError(error),
    });
  }
};

/**
 * POST /api/articles/:slug/comments
 * Submits a comment for moderation (status = pending).
 */
const handlePostComment: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;
    const authorName = sanitizePlainText(req.body?.author_name, 150);
    const authorEmail = req.body?.author_email
      ? String(req.body.author_email).trim().slice(0, 255)
      : null;
    if (req.body?.website) {
      // Honeypot triggered — pretend success
      return res.status(201).json({ success: true, data: { id: 0, status: "pending" } });
    }
    const content = sanitizePlainText(req.body?.content, 6000);
    const ipHash = hashIp(getRequestIp(req));
    if (memoryRateLimit(`cm:${ipHash}`, 5, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Estás comentando muy rápido. Intenta en unos minutos.",
      });
    }
    const parentId =
      req.body?.parent_id != null ? Number(req.body.parent_id) : null;

    if (!authorName || content.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Nombre y comentario (mín. 3 caracteres) son requeridos",
      });
    }
    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Comentario demasiado largo",
      });
    }

    const [articleRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug],
    );
    if (!articleRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    const articleId = articleRows[0].id as number;

    if (parentId) {
      const [parentRows] = await getPool().query<RowDataPacket[]>(
        "SELECT id FROM comments WHERE id = ? AND article_id = ? LIMIT 1",
        [parentId, articleId],
      );
      if (!parentRows.length) {
        return res
          .status(400)
          .json({ success: false, message: "Comentario padre inválido" });
      }
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO comments (article_id, parent_id, author_name, author_email, ip_hash, content, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [articleId, parentId, authorName, authorEmail, ipHash, content],
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        message:
          "Comentario enviado. Aparecerá cuando sea aprobado por el equipo.",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "No se pudo enviar el comentario",
      ...devError(error),
    });
  }
};

const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * GET /api/media/:id
 * Serves uploaded media stored in the database (or redirects legacy external URLs).
 */
const handleGetMedia: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid media id" });
    }

    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT mime_type, file_data, url FROM media WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows.length) {
      return res.status(404).end();
    }

    const row = rows[0];
    if (row.file_data) {
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.type(String(row.mime_type || "application/octet-stream"));
      return res.send(row.file_data);
    }

    const externalUrl = String(row.url ?? "");
    res.set("Cache-Control", "public, max-age=86400");
    if (externalUrl.startsWith("http")) {
      return res.redirect(302, externalUrl);
    }

    return res.status(404).end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load media",
      ...devError(error),
    });
  }
};

/**
 * POST /api/admin/upload
 * Body: { data_base64, filename?, mime_type?, alt_text? }
 */
const handleAdminUpload: RequestHandler = async (req, res) => {
  try {
    const body = req.body ?? {};
    const dataBase64 = body.data_base64;
    if (!dataBase64 || typeof dataBase64 !== "string") {
      return res.status(400).json({
        success: false,
        message: "data_base64 is required",
      });
    }

    const mime = String(body.mime_type || "image/jpeg");
    if (!ALLOWED_UPLOAD_MIMES.has(mime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image type (jpeg, png, webp only)",
      });
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        message: "Empty image data",
      });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(400).json({
        success: false,
        message: "Image too large (max 5MB)",
      });
    }

    const safeName = sanitizePlainText(String(body.filename || "image.jpg"), 200)
      .replace(/[^\w.\-]/g, "_");
    const altText = body.alt_text ? sanitizePlainText(String(body.alt_text), 255) : null;
    const userId = req.adminUser!.userId;

    if (isBlobConfigured()) {
      let processed;
      try {
        processed = await processAndStoreImage(buffer);
      } catch (imgErr) {
        if ((imgErr as Error).message === "INVALID_IMAGE") {
          return res.status(400).json({ success: false, message: "Invalid image file" });
        }
        throw imgErr;
      }
      const [ins] = await getPool().query<ResultSetHeader>(
        `INSERT INTO media (filename, url, storage, variants, mime_type, size_bytes, width, height, alt_text, uploaded_by)
         VALUES (?, ?, 'blob', ?, 'image/webp', ?, ?, ?, ?, ?)`,
        [
          safeName,
          processed.url,
          JSON.stringify(processed.variants),
          processed.sizeBytes,
          processed.width,
          processed.height,
          altText,
          userId,
        ],
      );
      return res.json({
        success: true,
        data: {
          id: ins.insertId,
          url: processed.url,
          width: processed.width,
          height: processed.height,
          variants: processed.variants,
        },
      });
    }

    // Fallback (local dev without BLOB_READ_WRITE_TOKEN): store bytes in DB
    let insertResult: ResultSetHeader;
    try {
      [insertResult] = await getPool().query<ResultSetHeader>(
        `INSERT INTO media (filename, url, mime_type, size_bytes, alt_text, uploaded_by, file_data)
         VALUES (?, '', ?, ?, ?, ?, ?)`,
        [safeName, mime, buffer.length, altText, userId, buffer],
      );
    } catch (dbErr: any) {
      if (dbErr?.code === "ER_BAD_FIELD_ERROR") {
        return res.status(503).json({
          success: false,
          message:
            "Media storage not configured. Run database/migrations/20260313_120000_media_file_data.sql",
        });
      }
      throw dbErr;
    }

    const mediaId = insertResult.insertId;
    const url = `${getBaseUrl()}/api/media/${mediaId}`;
    await getPool().query("UPDATE media SET url = ? WHERE id = ?", [
      url,
      mediaId,
    ]);

    res.json({ success: true, data: { id: mediaId, url } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Upload failed",
      ...devError(error),
    });
  }
};

// =====================================================
// NEWSROOM: revisions, audit log, tags
// =====================================================

async function loadOwnedArticle(
  req: express.Request,
  res: express.Response,
): Promise<number | null> {
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return null;
  }
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT author_id FROM articles WHERE id = ? LIMIT 1",
    [id],
  );
  if (!rows.length) {
    res.status(404).json({ success: false, message: "Article not found" });
    return null;
  }
  if (req.adminUser!.role !== "admin" && req.adminUser!.authorId !== rows[0].author_id) {
    res.status(403).json({ success: false, message: "Forbidden" });
    return null;
  }
  return id;
}

/** GET /api/admin/articles/:id/revisions */
const handleAdminListRevisions: RequestHandler = async (req, res) => {
  try {
    const id = await loadOwnedArticle(req, res);
    if (id == null) return;
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT r.id, r.article_id, r.title, r.status, r.created_at,
              u.name AS user_name, u.email AS user_email
       FROM article_revisions r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.article_id = ?
       ORDER BY r.created_at DESC, r.id DESC LIMIT 50`,
      [id],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load revisions", ...devError(error) });
  }
};

/** POST /api/admin/articles/:id/revisions/:revId/restore */
const handleAdminRestoreRevision: RequestHandler = async (req, res) => {
  try {
    const id = await loadOwnedArticle(req, res);
    if (id == null) return;
    const revId = parseInt(String(req.params.revId));
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT snapshot FROM article_revisions WHERE id = ? AND article_id = ? LIMIT 1",
      [revId, id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Revision not found" });
    }
    const snap = (typeof rows[0].snapshot === "string"
      ? JSON.parse(rows[0].snapshot)
      : rows[0].snapshot) as {
      article: Record<string, unknown>;
      blocks: Array<{ position: number; type: string; data: unknown }>;
      tags?: string[];
    };
    const a = snap.article;
    // Content-only restore: publication state is never changed here.
    // Blocks are replaced atomically.
    const conn = await getPool().getConnection();
    try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE articles SET title = ?, slug = ?, excerpt = ?, content = ?, category_id = ?,
         subcategory_id = ?, image_url = ?, read_time_minutes = ?
       WHERE id = ?`,
      [
        a.title, a.slug, a.excerpt ?? null,
        a.content != null ? sanitizeRichHtml(a.content) : null,
        a.category_id, a.subcategory_id ?? null, a.image_url ?? null,
        a.read_time_minutes ?? 5, id,
      ],
    );
    await conn.query("DELETE FROM article_blocks WHERE article_id = ?", [id]);
    if (snap.blocks?.length) {
      await conn.query(
        "INSERT INTO article_blocks (article_id, position, type, data) VALUES ?",
        [snap.blocks.map((b) => [id, b.position, b.type, JSON.stringify(sanitizeBlockData(b.type, b.data))])],
      );
    }
    await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    if (Array.isArray(snap.tags)) await setArticleTags(getPool(), id, snap.tags);
    await saveRevision(getPool(), id, req.adminUser!.userId);
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.restore",
      entityType: "article",
      entityId: id,
      details: { revisionId: revId },
    });
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to restore revision", ...devError(error) });
  }
};

/** GET /api/admin/audit?page=&limit= (admin only) */
const handleAdminAuditLog: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50")) || 50));
    const offset = (page - 1) * limit;
    const [[rows], [countRows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
                u.name AS user_name, u.email AS user_email
         FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
      getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM audit_log"),
    ]);
    const total = Number(countRows[0]?.total ?? 0);
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load audit log", ...devError(error) });
  }
};

/** GET /api/tags/:slug — public tag page (tag + latest articles) */
const handleGetTag: RequestHandler = async (req, res) => {
  try {
    const [tagRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, name, slug FROM tags WHERE slug = ? LIMIT 1",
      [req.params.slug],
    );
    if (!tagRows.length) {
      return res.status(404).json({ success: false, message: "Tag not found" });
    }
    const [articles] = await getPool().query<RowDataPacket[]>(
      `SELECT a.id, a.slug, a.title, a.excerpt,
              a.category_id, c.name AS category_name, c.slug AS category_slug,
              a.subcategory_id, NULL AS subcategory_name, NULL AS subcategory_slug,
              a.author_id, au.name AS author_name, au.slug AS author_slug,
              a.image_url, a.read_time_minutes, a.featured, a.trending,
              a.status, a.published_at, a.view_count
       FROM article_tags at
       JOIN articles a ON a.id = at.article_id
       JOIN categories c ON c.id = a.category_id
       JOIN authors au ON au.id = a.author_id
       WHERE at.tag_id = ? AND a.status = 'published'
       ORDER BY a.published_at DESC LIMIT 40`,
      [tagRows[0].id],
    );
    res.json({ success: true, data: { tag: tagRows[0], articles } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load tag", ...devError(error) });
  }
};

// =====================================================
// SERVER INITIALIZATION
// =====================================================

// Create the Express app once (reused across invocations)
let app: express.Application | null = null;

function createServer() {
  console.log("Creating Express server for Vercel...");

  const expressApp = express();

  // Middleware
  const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  const corsOrigin = process.env.BASE_URL?.trim();
  const allowedOrigins = [
    ...(corsOrigin ? [corsOrigin] : []),
    ...(isProd ? [] : ["http://localhost:8080", "http://localhost:5173"]),
  ];
  expressApp.disable("x-powered-by");
  expressApp.use((_req, res, next) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    next();
  });
  expressApp.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin / server-to-server requests have no Origin header
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  expressApp.use(express.json({ limit: "10mb" }));
  expressApp.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Log requests
  expressApp.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Public, read-only JSON → CDN cache (edge serves stale while revalidating)
  expressApp.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api/admin") &&
      !req.path.startsWith("/api/cron") &&
      !req.path.startsWith("/api/newsletter") &&
      !req.path.includes("/comments")
    ) {
      // Article/category/author/tag pages: short staleness so unpublished
      // content disappears quickly (takedowns). Lists/home tolerate more.
      const detail = /^\/api\/(articles\/[^/]+$|category\/|authors\/|tags\/)/.test(req.path);
      res.set(
        "Cache-Control",
        detail
          ? "public, max-age=0, s-maxage=30, stale-while-revalidate=30"
          : "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      );
    } else {
      res.set("Cache-Control", "no-store");
    }
    next();
  });

  // ==================== CONFIGURE API ROUTES ====================

  // Health
  expressApp.get("/api/health", handleHealth);

  // Home (single optimised endpoint)
  expressApp.get("/api/home", handleGetHome);

  // Articles
  expressApp.get("/api/articles", handleGetArticles);
  expressApp.get("/api/articles/:slug/blocks", handleGetArticleBlocks);
  expressApp.get("/api/articles/:slug/comments", handleGetComments);
  expressApp.post("/api/articles/:slug/comments", handlePostComment);
  expressApp.get("/api/articles/:slug", handleGetArticle);
  expressApp.post("/api/articles/:slug/view", handleArticleView);

  // SEO feeds (rewritten from /sitemap.xml, /news-sitemap.xml, /rss.xml)
  expressApp.get(["/sitemap.xml", "/api/seo/sitemap.xml"], handleSitemap);
  expressApp.get(["/news-sitemap.xml", "/api/seo/news-sitemap.xml"], handleNewsSitemap);
  expressApp.get(["/rss.xml", "/api/seo/rss.xml"], handleRss);

  // Category page (consolidated: category info + articles + trending)
  expressApp.get("/api/category/:slug", handleGetCategoryPage);

  // Categories list
  expressApp.get("/api/categories", handleGetCategories);
  expressApp.get("/api/tags/:slug", handleGetTag);

  // Authors
  expressApp.get("/api/authors", handleGetAuthors);
  expressApp.get("/api/authors/:slug", handleGetAuthor);

  // Media (public)
  expressApp.get("/api/media/:id", handleGetMedia);

  // Newsletter
  expressApp.post("/api/newsletter/subscribe", handleNewsletterSubscribe);
  expressApp.get("/api/newsletter/confirm", handleNewsletterConfirm);
  expressApp.get("/api/newsletter/unsubscribe", handleNewsletterUnsubscribe);
  expressApp.post("/api/newsletter/unsubscribe", handleNewsletterUnsubscribe);

  // ── Cron (secret-protected, no auth token needed) ──────────
  expressApp.post("/api/cron/publish-scheduled", handleCronPublishScheduled);
  // Vercel Cron issues GET with Authorization: Bearer $CRON_SECRET
  expressApp.get("/api/cron/publish-scheduled", handleCronPublishScheduled);

  // ── Admin Auth (public) ───────────────────────────────────
  expressApp.post("/api/admin/auth/request-code", handleAdminRequestCode);
  expressApp.post("/api/admin/auth/verify-code", handleAdminVerifyCode);

  // ── Admin Protected Routes ────────────────────────────────
  expressApp.get("/api/admin/me", requireAdminAuth, handleAdminMe);
  expressApp.put(
    "/api/admin/me/profile",
    requireAdminAuth,
    handleAdminUpdateMyProfile,
  );
  expressApp.get(
    "/api/admin/dashboard",
    requireAdminAuth,
    handleAdminDashboard,
  );

  // Admin articles
  expressApp.get(
    "/api/admin/articles",
    requireAdminAuth,
    handleAdminGetArticles,
  );
  expressApp.get(
    "/api/admin/articles/featured-count",
    requireAdminAuth,
    handleAdminFeaturedCount,
  );
  expressApp.get(
    "/api/admin/articles/:id",
    requireAdminAuth,
    handleAdminGetArticle,
  );
  expressApp.get(
    "/api/admin/articles/:id/revisions",
    requireAdminAuth,
    handleAdminListRevisions,
  );
  expressApp.post(
    "/api/admin/articles/:id/revisions/:revId/restore",
    requireAdminAuth,
    handleAdminRestoreRevision,
  );
  expressApp.get("/api/admin/audit", requireAdminAuth, requireAdmin, handleAdminAuditLog);
  expressApp.post(
    "/api/admin/articles",
    requireAdminAuth,
    handleAdminCreateArticle,
  );
  expressApp.put(
    "/api/admin/articles/:id",
    requireAdminAuth,
    handleAdminUpdateArticle,
  );
  expressApp.delete(
    "/api/admin/articles/:id",
    requireAdminAuth,
    handleAdminDeleteArticle,
  );

  // Admin authors (admin role required to manage other authors)
  expressApp.get(
    "/api/admin/authors",
    requireAdminAuth,
    requireAdmin,
    handleAdminGetAuthors,
  );
  expressApp.post(
    "/api/admin/authors",
    requireAdminAuth,
    requireAdmin,
    handleAdminCreateAuthor,
  );
  expressApp.put(
    "/api/admin/authors/:id",
    requireAdminAuth,
    requireAdmin,
    handleAdminUpdateAuthor,
  );
  expressApp.delete(
    "/api/admin/authors/:id",
    requireAdminAuth,
    requireAdmin,
    handleAdminDeleteAuthor,
  );

  expressApp.get(
    "/api/admin/comments",
    requireAdminAuth,
    requireAdmin,
    handleAdminGetComments,
  );
  expressApp.patch(
    "/api/admin/comments/:id",
    requireAdminAuth,
    requireAdmin,
    handleAdminPatchComment,
  );
  expressApp.get(
    "/api/admin/categories",
    requireAdminAuth,
    requireAdmin,
    handleAdminGetCategories,
  );
  expressApp.put(
    "/api/admin/categories/:id",
    requireAdminAuth,
    requireAdmin,
    handleAdminUpdateCategory,
  );
  expressApp.get(
    "/api/admin/newsletter/subscribers",
    requireAdminAuth,
    requireAdmin,
    handleAdminGetNewsletterSubscribers,
  );
  expressApp.get(
    "/api/admin/settings",
    requireAdminAuth,
    requireAdmin,
    handleAdminGetSettings,
  );
  expressApp.put(
    "/api/admin/settings",
    requireAdminAuth,
    requireAdmin,
    handleAdminUpdateSettings,
  );
  expressApp.post(
    "/api/admin/upload",
    requireAdminAuth,
    handleAdminUpload,
  );

  // 404 handler - only for API routes
  expressApp.use("/api", (_req, res, next) => {
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: "API endpoint not found",
      });
    } else {
      next();
    }
  });

  // Error handler
  expressApp.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      // Client errors from body-parser (malformed JSON, oversized body)
      const status = Number(err?.status ?? err?.statusCode);
      if (status >= 400 && status < 500) {
        return res.status(status).json({
          success: false,
          message:
            err?.type === "entity.too.large"
              ? "Payload too large"
              : err?.type === "entity.parse.failed"
                ? "Malformed JSON body"
                : "Bad request",
        });
      }
      console.error("Express error:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        ...devError(err),
      });
    },
  );

  return expressApp;
}

function getApp() {
  if (!app) {
    console.log("Initializing Express app for serverless...");
    app = createServer();
  }
  return app;
}

// Export createServer for development use
export { createServer };

// Export handler for Vercel serverless
export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const expressApp = getApp();
    expressApp(req as any, res as any);
  } catch (error) {
    console.error("API Handler Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: {
          code: "500",
          message: "A server error has occurred",
          ...devError(error),
        },
      });
    }
  }
};
