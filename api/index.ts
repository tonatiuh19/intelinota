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
 * Increments view_count on each fetch
 */
const handleGetArticle: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT
        a.id, a.slug, a.title, a.excerpt, a.content,
        a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
        a.author_id, au.name AS author_name, au.slug AS author_slug,
        a.image_url, a.read_time_minutes, a.featured, a.trending,
        a.status, a.published_at, a.view_count
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
       JOIN authors au ON au.id = a.author_id
       WHERE a.slug = ? AND a.status = 'published'
       LIMIT 1`,
      [slug],
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }

    // Fire-and-forget: increment view count + track visitor
    const articleRow = rows[0] as RowDataPacket;
    getPool()
      .query("UPDATE articles SET view_count = view_count + 1 WHERE slug = ?", [
        slug,
      ])
      .catch(() => {});
    trackVisit({
      req,
      eventType: "article_view",
      pagePath: `/article/${slug}`,
      articleId: articleRow.id as number,
      categoryId: articleRow.category_id as number,
    });

    res.json({ success: true, data: rows[0] });
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
        `SELECT ${ARTICLE_COLS} ${ARTICLE_FROM} AND a.featured = 1 ORDER BY a.published_at DESC LIMIT 6`,
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
      title: "InteliNota — Noticias de tecnología, deportes y cultura",
      description:
        "El portal de noticias más inteligente. Últimas noticias de tecnología, deportes, videojuegos, cine y mundo.",
      keywords:
        "noticias, tecnología, deportes, videojuegos, cine, inteligencia artificial, esports",
      og_title: "InteliNota",
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

  // Categories
  expressApp.get("/api/categories", handleGetCategories);

  // Authors
  expressApp.get("/api/authors", handleGetAuthors);
  expressApp.get("/api/authors/:slug", handleGetAuthor);

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
