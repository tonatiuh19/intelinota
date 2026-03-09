import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type RequestHandler } from "express";
import cors from "cors";
import mysql, {
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { ImapFlow } from "imapflow";

// JWT Secret with fallback (warn in production)
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    console.warn(
      "⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET in .env for production!",
    );
    return "default-jwt-secret-CHANGE-THIS-IN-PRODUCTION";
  })();

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
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

// Lazy nodemailer transporter
let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

// Lazy IMAP client factory (creates a new connection per use)
function createImapClient(): ImapFlow {
  return new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: parseInt(process.env.IMAP_PORT || "993"),
    secure: true,
    auth: {
      user: process.env.IMAP_USER || "",
      pass: process.env.IMAP_PASS || "",
    },
    logger: false,
  });
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

/**
 * Hashes an IP address with a salt for privacy-safe storage.
 * Uses SHA-256(ip + salt); raw IP is never persisted.
 */
function hashIp(ip: string): string {
  const salt = process.env.VISITORS_SALT ?? "intelinota-default-salt";
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex");
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
      const rawIp =
        (req.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ??
        (req.headers["x-real-ip"] as string | undefined) ??
        req.socket?.remoteAddress ??
        "unknown";

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
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/articles
 * Query params: category (slug), subcategory (slug), featured (1), trending (1),
 *               page (default 1), limit (default 20)
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
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/articles/:slug
 * Returns article + content blocks + related articles in a single round-trip.
 * Increments view_count on each fetch.
 */
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

    // Fire-and-forget: view count + visit tracking
    getPool()
      .query("UPDATE articles SET view_count = view_count + 1 WHERE slug = ?", [
        slug,
      ])
      .catch(() => {});
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
      data: { article, blocks: blockRows, related: relatedRows },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch article",
      error: error instanceof Error ? error.message : "Unknown error",
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
    };

    res.json({
      success: true,
      data: {
        featured: featuredRows,
        trending: trendingRows,
        articles: latestRows,
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
      error: error instanceof Error ? error.message : "Unknown error",
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
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/authors
 */
const handleGetAuthors: RequestHandler = async (_req, res) => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, name, slug, bio, avatar_url, twitter_handle
       FROM authors ORDER BY name ASC`,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch authors",
      error: error instanceof Error ? error.message : "Unknown error",
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

    const [authorRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, name, slug, bio, avatar_url, twitter_handle FROM authors WHERE slug = ? LIMIT 1",
      [slug],
    );

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
      error: error instanceof Error ? error.message : "Unknown error",
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

    res.json({ success: true, data: blocks });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch article blocks",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/category/:slug
 * Returns category info + paginated articles + trending in a single round-trip.
 * Query params: page (default 1)
 */
const handleGetCategoryPage: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 20;
    const offset = (page - 1) * limit;

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
          `SELECT COUNT(*) AS total ${JOINS} WHERE a.status = 'published' AND c.slug = ?`,
          [slug],
        ),
        getPool().query<RowDataPacket[]>(
          `SELECT ${COLS} ${JOINS}
           WHERE a.status = 'published' AND c.slug = ?
           ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
          [slug, limit, offset],
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

    const total = ((countRows as RowDataPacket[])[0]?.total as number) ?? 0;

    res.json({
      success: true,
      data: {
        category: (categoryRows as RowDataPacket[])[0],
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
      error: error instanceof Error ? error.message : "Unknown error",
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
            <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;line-height:1.65;">Hola, <strong style="color:#cbd5e1;">${name}</strong>.</p>
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

/** JWT auth middleware — protects /api/admin/* routes */
const requireAdminAuth: RequestHandler = (req, res, next) => {
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
    req.adminUser = payload;
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
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Hash IP for audit
    const rawIp =
      (req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() ??
      req.socket?.remoteAddress ??
      "unknown";
    const ipHash = hashIp(rawIp);

    await getPool().query(
      "INSERT INTO admin_login_codes (email, code, expires_at, ip_hash) VALUES (?, ?, ?, ?)",
      [normalEmail, code, expiresAt, ipHash],
    );

    // Send email
    await getTransporter().sendMail({
      from: `"INTELINOTA" <${process.env.SMTP_USER}>`,
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

  try {
    // Look up valid code
    const [codeRows] = await getPool().query<RowDataPacket[]>(
      `SELECT id FROM admin_login_codes
       WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalEmail, normalCode],
    );

    if (!(codeRows as RowDataPacket[]).length) {
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
 * GET /api/admin/me
 * Returns the currently authenticated admin user.
 */
const handleAdminMe: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.adminUser!;
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, name, role, author_id, avatar_url FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!(rows as RowDataPacket[]).length) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const u = (rows as RowDataPacket[])[0];
    res.json({
      success: true,
      data: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        author_id: u.author_id ?? null,
        avatar_url: u.avatar_url ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user" });
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

    // Article counts + total views
    const articleWhere = isAdmin ? "" : "WHERE author_id = ?";
    const articleParams = isAdmin ? [] : [authorId];

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
        `SELECT DATE(created_at) AS date, COUNT(*) AS count
         FROM visitors
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
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

    if (!isAdmin && authorId) {
      conditions.push("a.author_id = ?");
      params.push(authorId);
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
      conditions.push("(a.title LIKE ? OR a.excerpt LIKE ?)");
      const q = `%${String(req.query.search)}%`;
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

    res.json({ success: true, data: { ...article, blocks } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch article" });
  }
};

/**
 * POST /api/cron/publish-scheduled
 * GET  /api/cron/publish-scheduled
 * Called by the cPanel cron job (e.g. every minute via curl).
 * Protected by CRON_SECRET env variable (x-cron-secret header or ?secret= query).
 */
const handleCronPublishScheduled: RequestHandler = async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res
        .status(503)
        .json({ success: false, message: "CRON_SECRET not configured" });
    }
    const provided =
      (req.headers["x-cron-secret"] as string | undefined) ??
      (req.query.secret as string | undefined);
    if (provided !== cronSecret) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
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
const handleAdminFeaturedCount: RequestHandler = async (_req, res) => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM articles WHERE featured = 1",
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
      : (req.adminUser!.authorId ?? body.author_id);

    // Non-admin authors cannot publish or schedule — force to draft
    const effectiveStatus = isAdmin ? (body.status ?? "draft") : "draft";

    // Auto-displace oldest featured when the limit (5) would be exceeded
    if (body.featured) {
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
        body.content ?? null,
        body.category_id,
        body.subcategory_id ?? null,
        effectiveAuthorId,
        body.image_url ?? null,
        body.read_time_minutes ?? 5,
        body.trending ? 1 : body.featured ? 1 : 0,
        body.trending ? 1 : 0,
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
        JSON.stringify(b.data),
      ]);
      await getPool().query(
        "INSERT INTO article_blocks (article_id, position, type, data) VALUES ?",
        [blockValues],
      );
    }

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
    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    // Ownership check
    const [existing] = await getPool().query<RowDataPacket[]>(
      "SELECT author_id, featured FROM articles WHERE id = ? LIMIT 1",
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
    };

    // Auto-displace oldest featured when the limit (5) would be exceeded
    if (body.featured) {
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
      content: body.content ?? null,
      category_id: body.category_id,
      subcategory_id: body.subcategory_id ?? null,
      author_id: isAdmin ? body.author_id : undefined,
      image_url: body.image_url ?? null,
      read_time_minutes: body.read_time_minutes,
      featured: body.trending
        ? 1
        : body.featured !== undefined
          ? body.featured
            ? 1
            : 0
          : undefined,
      trending:
        body.trending !== undefined ? (body.trending ? 1 : 0) : undefined,
      // Non-admin authors cannot publish or schedule — force status to draft
      status: isAdmin
        ? body.status
        : body.status !== undefined
          ? "draft"
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
          JSON.stringify(b.data),
        ]);
        await getPool().query(
          "INSERT INTO article_blocks (article_id, position, type, data) VALUES ?",
          [blockValues],
        );
      }
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
      .json({ success: false, message: "Failed to update article" });
  }
};

/**
 * DELETE /api/admin/articles/:id  — archives instead of hard-deletes
 */
const handleAdminDeleteArticle: RequestHandler = async (req, res) => {
  try {
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
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT
        au.id, au.name, au.slug, au.bio, au.avatar_url, au.email, au.twitter_handle,
        u.id AS user_id, u.role AS user_role
       FROM authors au
       LEFT JOIN users u ON u.author_id = au.id
       ORDER BY au.name ASC`,
    );
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
      user_email?: string;
      user_role?: string;
    };

    if (!body.name || !body.slug) {
      return res
        .status(400)
        .json({ success: false, message: "name and slug are required" });
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO authors (name, slug, bio, avatar_url, email, twitter_handle)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.name,
        body.slug,
        body.bio ?? null,
        body.avatar_url ?? null,
        body.email ?? null,
        body.twitter_handle ?? null,
      ],
    );

    const authorId = result.insertId;

    // Optionally create/link a user account
    if (body.user_email) {
      const role = body.user_role === "admin" ? "admin" : "author";
      await getPool().query(
        `INSERT INTO users (email, password_hash, name, role, author_id, email_verified)
         VALUES (?, '', ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE author_id = ?, role = ?`,
        [body.user_email, body.name, role, authorId, authorId, role],
      );
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

    const body = req.body as {
      name?: string;
      slug?: string;
      bio?: string;
      avatar_url?: string;
      twitter_handle?: string;
      email?: string;
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
    if (sets.length) {
      await getPool().query(
        `UPDATE authors SET ${sets.join(", ")} WHERE id = ?`,
        [...vals, id],
      );
    }

    // Update linked user if present
    if (body.user_email && body.user_role) {
      const role = body.user_role === "admin" ? "admin" : "author";
      await getPool().query(
        `UPDATE users SET role = ? WHERE author_id = ? AND email = ?`,
        [role, id, body.user_email],
      );
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

// =====================================================
// SERVER INITIALIZATION
// =====================================================

// Create the Express app once (reused across invocations)
let app: express.Application | null = null;

function createServer() {
  console.log("Creating Express server for Vercel...");

  const expressApp = express();

  // Middleware
  expressApp.use(cors());
  expressApp.use(express.json({ limit: "10mb" }));
  expressApp.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Log requests
  expressApp.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
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
  expressApp.get("/api/articles/:slug", handleGetArticle);

  // Category page (consolidated: category info + articles + trending)
  expressApp.get("/api/category/:slug", handleGetCategoryPage);

  // Categories list
  expressApp.get("/api/categories", handleGetCategories);

  // Authors
  expressApp.get("/api/authors", handleGetAuthors);
  expressApp.get("/api/authors/:slug", handleGetAuthor);

  // ── Cron (secret-protected, no auth token needed) ──────────
  expressApp.post("/api/cron/publish-scheduled", handleCronPublishScheduled);
  expressApp.get("/api/cron/publish-scheduled", handleCronPublishScheduled);

  // ── Admin Auth (public) ───────────────────────────────────
  expressApp.post("/api/admin/auth/request-code", handleAdminRequestCode);
  expressApp.post("/api/admin/auth/verify-code", handleAdminVerifyCode);

  // ── Admin Protected Routes ────────────────────────────────
  expressApp.get("/api/admin/me", requireAdminAuth, handleAdminMe);
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
      console.error("Express error:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message,
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
          details: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
};
