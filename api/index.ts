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
import { setArticleTags, getArticleTags, saveRevision, audit, slugify } from "./_lib/newsroom.js";
import { scoreComment } from "./_lib/moderation.js";
import {
  notifyUsers,
  getAdminUserIds,
  getAuthorUserIds,
  parseSnapshot,
  snapshotPlainText,
  suggestSlug,
  type NotificationInput,
  type Queryable,
} from "./_lib/workflow.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  MCP_SCOPE,
  MCP_ACCESS_TTL_SEC,
  MCP_REFRESH_TTL_SEC,
  MCP_CODE_TTL_MS,
  mcpCanonicalOrigin,
  mcpResourceUrl,
  mcpAuthorizationServerMetadata,
  mcpProtectedResourceMetadata,
  mcpWwwAuthenticate,
  sha256Hex,
  mcpRandomSecret,
  verifyPkceS256,
  parseBearerAuthorization,
  parseMcpRedirectUris,
  mcpRedirectUriOkForRegistration,
  mcpRedirectUriAllowed,
  mcpWriteConfirmed,
  mcpLimit,
  mcpPage,
  mcpJsonSchemaToZod,
  mcpToolsListForClaude,
  sanitizeMcpJsonRpcForClaude,
  redactMcpArgs,
  auditResultJson,
  htmlToPlainText,
  wordCount,
  truncateText,
  parseNewsroomDateTime,
} from "./_lib/mcpOAuth.js";
import {
  contentToSafeHtml,
  assertPublicHttpsUrl,
  fetchPublicImage,
  normalizeImageForUpload,
  SsrfError,
} from "./_lib/mcpContent.js";
import { MCP_TOOLS, MCP_PROMPTS } from "./_lib/mcpTools.js";

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
      // DB stores UTC: parse/serialize DATETIME/TIMESTAMP as UTC on every
      // machine (local dev in UTC-6 was shifting times by 6 hours).
      timezone: "Z",
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

const DEFAULT_NEWSROOM_TZ = "America/Mexico_City";

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

    const categoryParam = req.query.category ? String(req.query.category) : "";
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
    // Free-text: title, excerpt or author name
    const searchTerm = req.query.search ? String(req.query.search).trim().slice(0, 100) : "";
    const likeTerm = `%${escapeLike(searchTerm)}%`;
    if (searchTerm) {
      conditions.push(
        "(a.title LIKE ? ESCAPE '\\\\' OR a.excerpt LIKE ? ESCAPE '\\\\' OR au.name LIKE ? ESCAPE '\\\\')",
      );
      params.push(likeTerm, likeTerm, likeTerm);
    }
    // Facet filters (kept separate so facet counts can ignore their own filter)
    const facetConds: Record<"category" | "author", { sql: string; val: string } | null> = {
      category: null,
      author: null,
    };
    if (typeof req.query.author === "string" && req.query.author) {
      facetConds.author = { sql: "au.slug = ?", val: req.query.author.slice(0, 120) };
    }
    if (typeof req.query.tag === "string" && req.query.tag) {
      conditions.push(
        "EXISTS (SELECT 1 FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = a.id AND t.slug = ?)",
      );
      params.push(req.query.tag.slice(0, 100));
    }
    const SINCE: Record<string, string> = { "24h": "1 DAY", "7d": "7 DAY", "30d": "30 DAY", "1y": "365 DAY" };
    if (typeof req.query.since === "string" && SINCE[req.query.since]) {
      conditions.push(`a.published_at >= NOW() - INTERVAL ${SINCE[req.query.since]}`);
    }
    const READ: Record<string, string> = {
      short: "a.read_time_minutes <= 4",
      medium: "a.read_time_minutes BETWEEN 5 AND 9",
      long: "a.read_time_minutes >= 10",
    };
    if (typeof req.query.read === "string" && READ[req.query.read]) {
      conditions.push(READ[req.query.read]);
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

    if (categoryParam) facetConds.category = { sql: "c.slug = ?", val: categoryParam };

    const baseConds = [...conditions];
    const baseParams = [...params];
    for (const f of Object.values(facetConds)) {
      if (f) {
        conditions.push(f.sql);
        params.push(f.val);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const FROM = `
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN subcategories sc ON sc.id = a.subcategory_id
      JOIN authors au ON au.id = a.author_id
    `;
    const countSql = `SELECT COUNT(*) AS total ${FROM} ${where}`;

    // Ordering: relevance (title > excerpt > author match), recent, popular, oldest
    const sort = String(req.query.sort ?? (searchTerm ? "relevance" : "recent"));
    let orderSql = "a.published_at DESC";
    const orderParams: string[] = [];
    if (sort === "popular") orderSql = "a.view_count DESC, a.published_at DESC";
    else if (sort === "oldest") orderSql = "a.published_at ASC";
    else if (sort === "relevance" && searchTerm) {
      orderSql =
        "((a.title LIKE ? ESCAPE '\\\\') * 3 + (a.excerpt LIKE ? ESCAPE '\\\\') * 2 + (au.name LIKE ? ESCAPE '\\\\')) DESC, a.published_at DESC";
      orderParams.push(likeTerm, likeTerm, likeTerm);
    }

    // Facet counts: each facet ignores its own filter so options stay visible
    const facetWhere = (skip: "category" | "author") => {
      const c = [...baseConds];
      const p: (string | number)[] = [...baseParams];
      for (const [k, f] of Object.entries(facetConds)) {
        if (f && k !== skip) {
          c.push(f.sql);
          p.push(f.val);
        }
      }
      return { sql: `WHERE ${c.join(" AND ")}`, params: p };
    };
    const wantFacets = req.query.facets === "1";
    const dataSql = `
      SELECT
        a.id, a.slug, a.title, a.excerpt,
        a.category_id, c.name AS category_name, c.slug AS category_slug,
        a.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
        a.author_id, au.name AS author_name, au.slug AS author_slug,
        a.image_url, a.read_time_minutes, a.featured, a.trending,
        a.status, a.published_at, a.view_count
      ${FROM}
      ${where}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const catF = facetWhere("category");
    const autF = facetWhere("author");
    const [[countRow], [rows], facetCats, facetAuthors] = await Promise.all([
      getPool().query<RowDataPacket[]>(countSql, params),
      getPool().query<RowDataPacket[]>(dataSql, [...params, ...orderParams, limit, offset]),
      wantFacets
        ? getPool().query<RowDataPacket[]>(
            `SELECT c.slug, c.name, COUNT(*) AS count ${FROM} ${catF.sql}
             GROUP BY c.slug, c.name ORDER BY count DESC, c.name`,
            catF.params,
          )
        : Promise.resolve(null),
      wantFacets
        ? getPool().query<RowDataPacket[]>(
            `SELECT au.slug, au.name, COUNT(*) AS count ${FROM} ${autF.sql}
             GROUP BY au.slug, au.name ORDER BY count DESC, au.name LIMIT 20`,
            autF.params,
          )
        : Promise.resolve(null),
    ]);

    const total = (countRow as RowDataPacket[])[0].total as number;

    res.json({
      success: true,
      data: rows,
      ...(wantFacets
        ? {
            facets: {
              categories: (facetCats?.[0] ?? []).map((r) => ({ slug: r.slug, name: r.name, count: Number(r.count) })),
              authors: (facetAuthors?.[0] ?? []).map((r) => ({ slug: r.slug, name: r.name, count: Number(r.count) })),
            },
          }
        : {}),
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
      // updated_at = updated_at: views must not bump the edit timestamp
      // (optimistic-concurrency checks compare it)
      "UPDATE articles SET view_count = view_count + 1, updated_at = updated_at WHERE slug = ? AND status = 'published'",
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
      a.status, a.published_at, a.view_count, a.updated_at,
      a.meta_title, a.meta_description
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
      // Renamed article? Old slugs of published articles resolve to the new one
      try {
        const [redirectRows] = await getPool().query<RowDataPacket[]>(
          `SELECT a.slug FROM article_slug_redirects r
           JOIN articles a ON a.id = r.article_id
           WHERE r.old_slug = ? AND a.status = 'published' LIMIT 1`,
          [slug],
        );
        if (redirectRows.length && redirectRows[0].slug !== slug) {
          return res.json({ success: true, data: { redirect: String(redirectRows[0].slug) } });
        }
      } catch (redirectErr) {
        console.error("slug redirect lookup failed:", redirectErr);
      }
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
        /** Admins always; authors when users.can_publish = 1 */
        canPublish: boolean;
      };
    }
  }
}

type StaffUser = NonNullable<express.Request["adminUser"]>;

/** Loads an active staff user (admin/author) with current rights; null if not allowed. */
async function loadStaffUser(userId: number): Promise<StaffUser | null> {
  let rows: RowDataPacket[];
  try {
    [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, role, author_id, can_publish FROM users WHERE id = ? AND role IN ('admin','author') LIMIT 1",
      [userId],
    );
  } catch (qErr: any) {
    // can_publish migration not applied yet
    if (qErr?.code !== "ER_BAD_FIELD_ERROR") throw qErr;
    [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, role, author_id, 0 AS can_publish FROM users WHERE id = ? AND role IN ('admin','author') LIMIT 1",
      [userId],
    );
  }
  const user = rows[0];
  if (!user) return null;
  return {
    userId: user.id as number,
    email: user.email as string,
    role: user.role as "admin" | "author",
    authorId: (user.author_id as number | null) ?? null,
    canPublish: user.role === "admin" || Number(user.can_publish) === 1,
  };
}

/** Verifies an admin-panel JWT and revalidates the user in DB. */
async function staffUserFromJwt(token: string): Promise<StaffUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    if (!payload?.userId) return null;
    return await loadStaffUser(Number(payload.userId));
  } catch {
    return null;
  }
}

/** JWT auth middleware — protects /api/admin/* routes; revalidates user in DB */
const requireAdminAuth: RequestHandler = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const user = await staffUserFromJwt(auth.slice(7));
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
  req.adminUser = user;
  next();
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

    // A successful OTP login proves the inbox (invited accounts start unverified)
    await getPool().query("UPDATE users SET email_verified = 1 WHERE id = ? AND email_verified = 0", [user.id]);

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
  let rows: RowDataPacket[];
  try {
    [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, name, role, author_id, avatar_url, can_publish FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
  } catch (qErr: any) {
    if (qErr?.code !== "ER_BAD_FIELD_ERROR") throw qErr;
    [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, email, name, role, author_id, avatar_url, 0 AS can_publish FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
  }
  if (!(rows as RowDataPacket[]).length) return null;

  const u = (rows as RowDataPacket[])[0];
  const base = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    author_id: u.author_id ?? null,
    avatar_url: u.avatar_url ?? null,
    can_publish: u.role === "admin" || Number(u.can_publish) === 1,
    newsroom_timezone: (await getSystemSetting("newsroom_timezone")) || DEFAULT_NEWSROOM_TZ,
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
        a.status, a.published_at, a.view_count, a.created_at, a.updated_at,
        a.meta_title, a.meta_description
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

    // The caller's own pending (unreviewed) edit of this live article, if any
    let pendingRevision: { id: number; created_at: string | null } | null = null;
    try {
      const [pendingRows] = await getPool().query<RowDataPacket[]>(
        `SELECT id, created_at FROM article_revisions
         WHERE article_id = ? AND user_id = ? AND kind = 'pending' AND review_status = 'pending'
         ORDER BY id DESC LIMIT 1`,
        [article.id, req.adminUser!.userId],
      );
      if (pendingRows[0]) {
        pendingRevision = { id: Number(pendingRows[0].id), created_at: toIso(pendingRows[0].created_at) };
      }
    } catch (qErr: any) {
      if (qErr?.code !== "ER_BAD_FIELD_ERROR") throw qErr;
    }

    res.json({
      success: true,
      data: {
        ...article,
        updated_at: toIso(article.updated_at),
        blocks,
        tags: tags.map((t) => t.name),
        pending_revision: pendingRevision,
      },
    });
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

// =====================================================
// NEWSROOM WORKFLOW HELPERS
// =====================================================

type BlockInput = { id?: number; position: number; type: string; data: unknown };

interface ArticleWriteBody {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  category_id?: number;
  subcategory_id?: number | null;
  author_id?: number;
  image_url?: string | null;
  read_time_minutes?: number;
  featured?: boolean;
  trending?: boolean;
  status?: string;
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  blocks?: BlockInput[];
  tags?: string[];
  /** Optimistic concurrency: ISO updated_at the client loaded */
  expected_updated_at?: string;
}

const adminArticleLink = (id: number) => `/admin/articles/${id}/edit`;

/** Trimmed, tag-free SEO override or null when empty. */
function cleanMeta(value: unknown, max: number): string | null {
  if (value == null) return null;
  const text = sanitizePlainText(String(value), max).slice(0, max);
  return text || null;
}

function toEpochSeconds(value: unknown): number | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  const t = d.getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function sanitizeBlocks(articleId: number, blocks: BlockInput[]) {
  return blocks.map((b) => [
    articleId,
    b.position,
    b.type,
    JSON.stringify(sanitizeBlockData(b.type, b.data)),
  ]);
}

async function replaceBlocks(db: Queryable, articleId: number, blocks: BlockInput[]) {
  await db.query("DELETE FROM article_blocks WHERE article_id = ?", [articleId]);
  if (blocks.length) {
    await db.query(
      "INSERT INTO article_blocks (article_id, position, type, data) VALUES ?",
      [sanitizeBlocks(articleId, blocks)],
    );
  }
}

/** Keeps an old public URL working after a published article is renamed. */
async function recordSlugChange(
  db: Queryable,
  articleId: number,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;
  await db.query(
    `INSERT INTO article_slug_redirects (old_slug, article_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE article_id = VALUES(article_id), created_at = CURRENT_TIMESTAMP`,
    [oldSlug, articleId],
  );
  // The new slug is live again: a redirect from it would loop
  await db.query("DELETE FROM article_slug_redirects WHERE old_slug = ?", [newSlug]);
}

function notifyOpts(exceptUserId: number | null) {
  return {
    exceptUserId,
    baseUrl: publicBase(),
    sendEmail: resendClient
      ? (to: string, subject: string, html: string) => sendEmail({ to, subject, html })
      : undefined,
  };
}

async function notifyAdmins(n: NotificationInput, exceptUserId: number | null) {
  try {
    const ids = await getAdminUserIds(getPool());
    await notifyUsers(getPool(), ids, n, notifyOpts(exceptUserId));
  } catch (error) {
    console.error("notifyAdmins failed:", error);
  }
}

async function notifyArticleAuthor(
  authorId: number,
  n: NotificationInput,
  exceptUserId: number | null,
) {
  try {
    const ids = await getAuthorUserIds(getPool(), authorId);
    await notifyUsers(getPool(), ids, n, notifyOpts(exceptUserId));
  } catch (error) {
    console.error("notifyArticleAuthor failed:", error);
  }
}

async function addReviewNote(entry: {
  articleId: number;
  revisionId?: number | null;
  userId: number | null;
  action: "returned" | "approved" | "published" | "comment";
  note?: string | null;
}): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO article_review_notes (article_id, revision_id, user_id, action, note)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.articleId, entry.revisionId ?? null, entry.userId, entry.action, entry.note ?? null],
    );
  } catch (error) {
    console.error("review note insert failed:", error);
  }
}

/**
 * Stores a proposed full snapshot for review. One pending edit per article
 * per user: a newer proposal replaces the previous one.
 */
async function storePendingRevision(
  articleId: number,
  userId: number,
  snapshot: { article: Record<string, unknown>; blocks: unknown[]; tags?: string[] },
): Promise<number> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `DELETE FROM article_revisions
       WHERE article_id = ? AND user_id = ? AND kind = 'pending' AND review_status = 'pending'`,
      [articleId, userId],
    );
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO article_revisions (article_id, user_id, title, status, snapshot, kind, review_status)
       VALUES (?, ?, ?, ?, ?, 'pending', 'pending')`,
      [
        articleId,
        userId,
        String(snapshot.article.title ?? "").slice(0, 255),
        String(snapshot.article.status ?? "published"),
        JSON.stringify(snapshot),
      ],
    );
    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function loadArticleSnapshotParts(articleId: number) {
  const [[articleRows], [blockRows], tags] = await Promise.all([
    getPool().query<RowDataPacket[]>(
      `SELECT id, slug, title, excerpt, content, category_id, subcategory_id, author_id,
              image_url, read_time_minutes, featured, trending, status, published_at,
              meta_title, meta_description, updated_at
       FROM articles WHERE id = ? LIMIT 1`,
      [articleId],
    ),
    getPool().query<RowDataPacket[]>(
      "SELECT position, type, data FROM article_blocks WHERE article_id = ? ORDER BY position",
      [articleId],
    ),
    getArticleTags(getPool(), articleId),
  ]);
  return {
    article: articleRows[0] as RowDataPacket | undefined,
    blocks: blockRows.map((b) => ({
      position: Number(b.position),
      type: String(b.type),
      data: typeof b.data === "string" ? safeJsonParse(b.data) : b.data,
    })),
    tags: tags.map((t) => t.name),
  };
}

/** Submits a proposed edit of a live article for review → 202. */
async function respondWithPendingEdit(
  req: express.Request,
  res: express.Response,
  articleId: number,
  snapshot: { article: Record<string, unknown>; blocks: unknown[]; tags?: string[] },
) {
  const revisionId = await storePendingRevision(articleId, req.adminUser!.userId, snapshot);
  await audit(getPool(), {
    ...auditFrom(req),
    action: "article.pending_edit",
    entityType: "article",
    entityId: articleId,
    details: { revisionId, title: snapshot.article.title },
  });
  await notifyAdmins(
    {
      type: "revision.submitted",
      title: `Edición pendiente: ${String(snapshot.article.title ?? "").slice(0, 180)}`,
      body: "Un autor propuso cambios a un artículo publicado. Revísalos antes de que salgan en vivo.",
      link: "/admin/reviews",
    },
    req.adminUser!.userId,
  );
  return res.status(202).json({
    success: true,
    data: { id: articleId, pending: true, revision_id: revisionId },
  });
}

/**
 * POST /api/admin/articles
 */
const handleAdminCreateArticle: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const body = req.body as ArticleWriteBody & {
      title: string;
      slug: string;
      category_id: number;
      author_id: number;
    };

    if (!body.title || !body.slug || !body.category_id || !body.author_id) {
      return res.status(400).json({
        success: false,
        message: "title, slug, category_id, author_id are required",
      });
    }

    // Author guard: non-admin can only create for their own author_id
    const isAdmin = req.adminUser!.role === "admin";
    const canPublish = req.adminUser!.canPublish;
    const effectiveAuthorId = isAdmin
      ? body.author_id
      : req.adminUser!.authorId!;

    // Authors without publish rights may only draft or submit for review;
    // homepage curation is admin-only either way
    const requested = ARTICLE_STATUSES.has(String(body.status)) ? String(body.status) : "draft";
    const effectiveStatus = canPublish
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

    const conn = await getPool().getConnection();
    let articleId: number;
    try {
      await conn.beginTransaction();
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO articles
           (slug, title, excerpt, content, category_id, subcategory_id, author_id,
            image_url, read_time_minutes, featured, trending, status, published_at,
            meta_title, meta_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            ? new Date()
            : canPublish
              ? (body.published_at ?? null)
              : null,
          cleanMeta(body.meta_title, 160),
          cleanMeta(body.meta_description, 320),
        ],
      );
      articleId = result.insertId;
      if (body.blocks?.length) await replaceBlocks(conn, articleId, body.blocks);
      if (Array.isArray(body.tags)) await setArticleTags(conn, articleId, body.tags);
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    await saveRevision(getPool(), articleId, req.adminUser!.userId);
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.create",
      entityType: "article",
      entityId: articleId,
      details: { title: body.title, status: effectiveStatus },
    });
    if (effectiveStatus === "in_review") {
      await notifyAdmins(
        {
          type: "review.submitted",
          title: `En revisión: ${body.title.slice(0, 200)}`,
          body: "Un artículo nuevo espera aprobación.",
          link: "/admin/reviews",
        },
        req.adminUser!.userId,
      );
    }

    const [after] = await getPool().query<RowDataPacket[]>(
      "SELECT updated_at FROM articles WHERE id = ? LIMIT 1",
      [articleId],
    );
    res.status(201).json({
      success: true,
      data: { id: articleId, status: effectiveStatus, updated_at: toIso(after[0]?.updated_at) },
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, code: "SLUG_TAKEN", message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to create article", ...devError(error) });
  }
};

/**
 * PUT /api/admin/articles/:id
 *
 * - expected_updated_at (optional): 409 { code: 'CONFLICT', data: { updated_at } }
 *   when the article changed since the client loaded it.
 * - A user without publish rights editing a *published* article does not
 *   touch the live article: the full proposed snapshot is stored as a
 *   pending revision → 202 { pending: true, revision_id }.
 */
const handleAdminUpdateArticle: RequestHandler = async (req, res) => {
  try {
    if (!ensureLinkedAuthor(req, res)) return;

    const id = parseInt(req.params.id as string);
    if (isNaN(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const [existingRows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, slug, title, excerpt, content, category_id, subcategory_id, author_id,
              image_url, read_time_minutes, featured, trending, status, published_at,
              meta_title, meta_description, updated_at
       FROM articles WHERE id = ? LIMIT 1`,
      [id],
    );
    const existing = existingRows[0];
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Article not found" });
    }
    const isAdmin = req.adminUser!.role === "admin";
    const canPublish = req.adminUser!.canPublish;
    if (!isAdmin && req.adminUser!.authorId !== existing.author_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const body = req.body as ArticleWriteBody;

    if (body.expected_updated_at) {
      const expected = toEpochSeconds(body.expected_updated_at);
      const current = toEpochSeconds(existing.updated_at);
      if (expected !== null && current !== null && expected !== current) {
        return res.status(409).json({
          success: false,
          code: "CONFLICT",
          message: "El artículo fue modificado por otra persona",
          data: { updated_at: toIso(existing.updated_at) },
        });
      }
    }

    // Live article edited without publish rights → proposal for review
    if (!canPublish && existing.status === "published") {
      const current = await loadArticleSnapshotParts(id);
      const base = { ...(current.article ?? existing) } as Record<string, unknown>;
      delete base.updated_at;
      const proposed: Record<string, unknown> = {
        ...base,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.excerpt !== undefined ? { excerpt: body.excerpt ?? null } : {}),
        ...(body.content !== undefined
          ? { content: body.content != null ? sanitizeRichHtml(body.content) : null }
          : {}),
        ...(body.category_id !== undefined ? { category_id: body.category_id } : {}),
        ...(body.subcategory_id !== undefined ? { subcategory_id: body.subcategory_id ?? null } : {}),
        ...(body.image_url !== undefined ? { image_url: body.image_url ?? null } : {}),
        ...(body.read_time_minutes !== undefined ? { read_time_minutes: body.read_time_minutes } : {}),
        ...(body.meta_title !== undefined ? { meta_title: cleanMeta(body.meta_title, 160) } : {}),
        ...(body.meta_description !== undefined
          ? { meta_description: cleanMeta(body.meta_description, 320) }
          : {}),
      };
      if (!proposed.title || !proposed.slug) {
        return res.status(400).json({ success: false, message: "title and slug are required" });
      }
      const blocks = body.blocks
        ? body.blocks.map((b) => ({
            position: b.position,
            type: b.type,
            data: sanitizeBlockData(b.type, b.data),
          }))
        : current.blocks;
      const tags = Array.isArray(body.tags) ? body.tags.map(String) : current.tags;
      return respondWithPendingEdit(req, res, id, { article: proposed, blocks, tags });
    }

    // Auto-displace oldest featured when the limit (5) would be exceeded
    if (isAdmin && (body.featured || body.trending)) {
      const wasAlreadyFeatured = Number(existing.featured) === 1;
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

    // Status: publishers (admins, trusted authors on their own articles) may
    // set any status. Others move between draft/in_review only; a live
    // article never reaches this point for them.
    const requestedStatus =
      body.status === undefined || !ARTICLE_STATUSES.has(String(body.status))
        ? undefined
        : String(body.status);
    const nextStatus: string | undefined = canPublish
      ? requestedStatus
      : requestedStatus === "in_review" || requestedStatus === "draft"
        ? requestedStatus
        : undefined;

    let publishedAt: unknown = canPublish ? body.published_at : undefined;
    const finalStatus = nextStatus ?? String(existing.status);
    if (canPublish && finalStatus === "published") {
      const resolved = publishedAt === undefined ? existing.published_at : publishedAt;
      if (!resolved) publishedAt = new Date();
    }

    const fields: Record<string, unknown> = {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt !== undefined ? (body.excerpt ?? null) : undefined,
      content:
        body.content !== undefined
          ? body.content != null
            ? sanitizeRichHtml(body.content)
            : null
          : undefined,
      category_id: body.category_id,
      subcategory_id: body.subcategory_id !== undefined ? (body.subcategory_id ?? null) : undefined,
      author_id: isAdmin ? body.author_id : undefined,
      image_url: body.image_url !== undefined ? (body.image_url ?? null) : undefined,
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
      status: nextStatus,
      published_at: publishedAt === undefined ? undefined : (publishedAt ?? null),
      meta_title: body.meta_title !== undefined ? cleanMeta(body.meta_title, 160) : undefined,
      meta_description:
        body.meta_description !== undefined ? cleanMeta(body.meta_description, 320) : undefined,
    };

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(val);
      }
    }

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      if (sets.length) {
        await conn.query(`UPDATE articles SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
      }
      if (body.blocks !== undefined) await replaceBlocks(conn, id, body.blocks);
      if (Array.isArray(body.tags)) await setArticleTags(conn, id, body.tags);
      if (body.slug && existing.status === "published") {
        await recordSlugChange(conn, id, String(existing.slug), body.slug);
      }
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    await saveRevision(getPool(), id, req.adminUser!.userId);
    await audit(getPool(), {
      ...auditFrom(req),
      action: nextStatus ? `article.status.${nextStatus}` : "article.update",
      entityType: "article",
      entityId: id,
      details: { title: body.title ?? existing.title },
    });

    if (nextStatus === "in_review" && existing.status !== "in_review") {
      await notifyAdmins(
        {
          type: "review.submitted",
          title: `En revisión: ${String(body.title ?? existing.title).slice(0, 200)}`,
          body: "Un artículo espera aprobación.",
          link: "/admin/reviews",
        },
        req.adminUser!.userId,
      );
    }

    const [after] = await getPool().query<RowDataPacket[]>(
      "SELECT status, updated_at FROM articles WHERE id = ? LIMIT 1",
      [id],
    );
    res.json({
      success: true,
      data: { id, status: after[0]?.status, updated_at: toIso(after[0]?.updated_at) },
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, code: "SLUG_TAKEN", message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to update article", ...devError(error) });
  }
};

/**
 * GET /api/admin/articles/slug-available?slug=&exclude_id=
 */
const handleAdminSlugAvailable: RequestHandler = async (req, res) => {
  try {
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const slug = slugify(raw);
    const excludeId = parseInt(String(req.query.exclude_id ?? ""));
    if (!slug) {
      return res.json({ success: true, data: { available: false, suggestion: "" } });
    }
    const like = `${escapeLike(slug)}-%`;
    const [articleRows] = await getPool().query<RowDataPacket[]>(
      `SELECT slug FROM articles WHERE (slug = ? OR slug LIKE ?) AND id != ?`,
      [slug, like, Number.isFinite(excludeId) ? excludeId : 0],
    );
    let redirectRows: RowDataPacket[] = [];
    try {
      [redirectRows] = await getPool().query<RowDataPacket[]>(
        `SELECT old_slug AS slug FROM article_slug_redirects
         WHERE (old_slug = ? OR old_slug LIKE ?) AND article_id != ?`,
        [slug, like, Number.isFinite(excludeId) ? excludeId : 0],
      );
    } catch (qErr: any) {
      if (qErr?.code !== "ER_NO_SUCH_TABLE") throw qErr;
    }
    const taken = new Set([...articleRows, ...redirectRows].map((r) => String(r.slug)));
    const suggestion = suggestSlug(slug, taken);
    res.json({
      success: true,
      data: { available: suggestion === slug && slug === raw, suggestion },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to check slug", ...devError(error) });
  }
};

// =====================================================
// REVIEW QUEUE (admin only)
// =====================================================

/** GET /api/admin/reviews — articles in review + pending edits of live articles */
const handleAdminGetReviews: RequestHandler = async (_req, res) => {
  try {
    const [[articles], [revisions]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT a.id, a.slug, a.title, a.excerpt, a.status, a.image_url, a.updated_at,
                a.author_id, au.name AS author_name, c.name AS category_name,
                (SELECT MAX(l.created_at) FROM audit_log l
                  WHERE l.entity_type = 'article' AND l.entity_id = a.id
                    AND l.action IN ('article.status.in_review','article.create')) AS submitted_at
         FROM articles a
         JOIN authors au ON au.id = a.author_id
         JOIN categories c ON c.id = a.category_id
         WHERE a.status = 'in_review'
         ORDER BY a.updated_at ASC
         LIMIT 100`,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT r.id, r.article_id, r.title AS proposed_title, r.snapshot, r.created_at,
                r.user_id, u.name AS user_name, u.email AS user_email,
                a.slug, a.title, a.excerpt, a.content, a.status, a.author_id,
                au.name AS author_name
         FROM article_revisions r
         JOIN articles a ON a.id = r.article_id
         JOIN authors au ON au.id = a.author_id
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.kind = 'pending' AND r.review_status = 'pending'
         ORDER BY r.created_at ASC
         LIMIT 100`,
      ),
    ]);

    const pendingEdits = await Promise.all(
      revisions.map(async (r) => {
        const proposed = parseSnapshot(r.snapshot);
        const live = await loadArticleSnapshotParts(Number(r.article_id));
        const currentSnap = {
          article: (live.article ?? {}) as Record<string, unknown>,
          blocks: live.blocks,
        };
        return {
          id: Number(r.id),
          article_id: Number(r.article_id),
          slug: String(r.slug),
          status: r.status,
          author_id: Number(r.author_id),
          author_name: r.author_name,
          user_id: r.user_id != null ? Number(r.user_id) : null,
          user_name: r.user_name ?? null,
          user_email: r.user_email ?? null,
          submitted_at: toIso(r.created_at),
          current: {
            title: String(r.title ?? ""),
            excerpt: (r.excerpt as string | null) ?? null,
            slug: String(r.slug),
            text: snapshotPlainText(currentSnap),
          },
          proposed: {
            title: String(proposed.article.title ?? ""),
            excerpt: (proposed.article.excerpt as string | null) ?? null,
            slug: String(proposed.article.slug ?? r.slug),
            text: snapshotPlainText(proposed),
          },
        };
      }),
    );

    res.json({
      success: true,
      data: {
        in_review: articles.map((a) => ({
          id: Number(a.id),
          slug: a.slug,
          title: a.title,
          excerpt: a.excerpt ?? null,
          status: a.status,
          image_url: a.image_url ?? null,
          author_id: Number(a.author_id),
          author_name: a.author_name,
          category_name: a.category_name,
          submitted_at: toIso(a.submitted_at ?? a.updated_at),
          updated_at: toIso(a.updated_at),
        })),
        pending_edits: pendingEdits,
        total: articles.length + pendingEdits.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load review queue", ...devError(error) });
  }
};

/**
 * POST /api/admin/articles/:id/approve { published_at?, note? }
 * in_review/draft → published (now) or scheduled (future published_at).
 */
const handleAdminApproveArticle: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const body = (req.body ?? {}) as { published_at?: string | null; note?: string };
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, title, slug, status, author_id FROM articles WHERE id = ? LIMIT 1",
      [id],
    );
    const article = rows[0];
    if (!article) return res.status(404).json({ success: false, message: "Article not found" });
    if (!["in_review", "draft", "scheduled"].includes(String(article.status))) {
      return res.status(409).json({ success: false, message: `Cannot approve an article that is ${article.status}` });
    }
    const when = body.published_at ? new Date(body.published_at) : null;
    if (when && !Number.isFinite(when.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid published_at" });
    }
    const scheduled = when != null && when.getTime() > Date.now() + 60_000;
    const status = scheduled ? "scheduled" : "published";
    await getPool().query("UPDATE articles SET status = ?, published_at = ? WHERE id = ?", [
      status,
      when ?? new Date(),
      id,
    ]);
    await saveRevision(getPool(), id, req.adminUser!.userId);
    const note = body.note ? sanitizePlainText(body.note, 5000) : null;
    await addReviewNote({
      articleId: id,
      userId: req.adminUser!.userId,
      action: scheduled ? "approved" : "published",
      note,
    });
    await audit(getPool(), {
      ...auditFrom(req),
      action: scheduled ? "article.review.approved" : "article.review.published",
      entityType: "article",
      entityId: id,
      details: { title: article.title, published_at: (when ?? new Date()).toISOString() },
    });
    await notifyArticleAuthor(
      Number(article.author_id),
      {
        type: scheduled ? "review.approved" : "review.published",
        title: scheduled
          ? `Aprobado y programado: ${String(article.title).slice(0, 180)}`
          : `Publicado: ${String(article.title).slice(0, 190)}`,
        body: note,
        link: scheduled ? adminArticleLink(id) : `/articulo/${article.slug}`,
      },
      req.adminUser!.userId,
    );
    const [after] = await getPool().query<RowDataPacket[]>(
      "SELECT status, published_at, updated_at FROM articles WHERE id = ? LIMIT 1",
      [id],
    );
    res.json({
      success: true,
      data: {
        id,
        status: after[0]?.status,
        published_at: toIso(after[0]?.published_at),
        updated_at: toIso(after[0]?.updated_at),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve article", ...devError(error) });
  }
};

/** POST /api/admin/articles/:id/return { note } — in_review → draft with feedback */
const handleAdminReturnArticle: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const note = sanitizePlainText((req.body ?? {}).note, 5000);
    if (note.length < 3) {
      return res.status(400).json({ success: false, message: "A note is required" });
    }
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, title, status, author_id FROM articles WHERE id = ? LIMIT 1",
      [id],
    );
    const article = rows[0];
    if (!article) return res.status(404).json({ success: false, message: "Article not found" });
    if (article.status !== "in_review") {
      return res.status(409).json({ success: false, message: "Article is not in review" });
    }
    await getPool().query("UPDATE articles SET status = 'draft' WHERE id = ?", [id]);
    await addReviewNote({ articleId: id, userId: req.adminUser!.userId, action: "returned", note });
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.review.returned",
      entityType: "article",
      entityId: id,
      details: { title: article.title },
    });
    await notifyArticleAuthor(
      Number(article.author_id),
      {
        type: "review.returned",
        title: `Devuelto con comentarios: ${String(article.title).slice(0, 170)}`,
        body: note,
        link: adminArticleLink(id),
      },
      req.adminUser!.userId,
    );
    res.json({ success: true, data: { id, status: "draft" } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to return article", ...devError(error) });
  }
};

async function loadPendingRevision(revId: number) {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT r.id, r.article_id, r.user_id, r.snapshot, a.slug, a.title, a.status, a.author_id
     FROM article_revisions r JOIN articles a ON a.id = r.article_id
     WHERE r.id = ? AND r.kind = 'pending' AND r.review_status = 'pending' LIMIT 1`,
    [revId],
  );
  return rows[0];
}

/** POST /api/admin/revisions/:revId/approve — applies a pending edit to the live article */
const handleAdminApproveRevision: RequestHandler = async (req, res) => {
  try {
    const revId = parseInt(String(req.params.revId));
    if (!Number.isFinite(revId)) return res.status(400).json({ success: false, message: "Invalid id" });
    const rev = await loadPendingRevision(revId);
    if (!rev) return res.status(404).json({ success: false, message: "Pending revision not found" });
    const articleId = Number(rev.article_id);
    const snap = parseSnapshot(rev.snapshot);
    const a = snap.article;
    const newSlug = String(a.slug ?? rev.slug);

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE articles SET title = ?, slug = ?, excerpt = ?, content = ?, category_id = ?,
           subcategory_id = ?, image_url = ?, read_time_minutes = ?,
           meta_title = ?, meta_description = ?
         WHERE id = ?`,
        [
          String(a.title ?? rev.title),
          newSlug,
          (a.excerpt as string | null) ?? null,
          a.content != null ? sanitizeRichHtml(String(a.content)) : null,
          a.category_id,
          (a.subcategory_id as number | null) ?? null,
          (a.image_url as string | null) ?? null,
          Number(a.read_time_minutes ?? 5),
          cleanMeta(a.meta_title, 160),
          cleanMeta(a.meta_description, 320),
          articleId,
        ],
      );
      await replaceBlocks(conn, articleId, snap.blocks);
      if (Array.isArray(snap.tags)) await setArticleTags(conn, articleId, snap.tags);
      if (rev.status === "published") {
        await recordSlugChange(conn, articleId, String(rev.slug), newSlug);
      }
      await conn.query(
        `UPDATE article_revisions SET review_status = 'approved', reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [req.adminUser!.userId, revId],
      );
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    await saveRevision(getPool(), articleId, req.adminUser!.userId);
    const note = sanitizePlainText((req.body ?? {}).note, 5000) || null;
    await addReviewNote({ articleId, revisionId: revId, userId: req.adminUser!.userId, action: "approved", note });
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.revision.approved",
      entityType: "article",
      entityId: articleId,
      details: { revisionId: revId, title: a.title },
    });
    if (rev.user_id) {
      try {
        await notifyUsers(
          getPool(),
          [Number(rev.user_id)],
          {
            type: "revision.approved",
            title: `Cambios aprobados: ${String(a.title ?? rev.title).slice(0, 180)}`,
            body: note,
            link: `/articulo/${newSlug}`,
          },
          notifyOpts(req.adminUser!.userId),
        );
      } catch (error) {
        console.error("notify revision approved failed:", error);
      }
    }
    const [after] = await getPool().query<RowDataPacket[]>(
      "SELECT updated_at FROM articles WHERE id = ? LIMIT 1",
      [articleId],
    );
    res.json({
      success: true,
      data: { id: articleId, revision_id: revId, slug: newSlug, updated_at: toIso(after[0]?.updated_at) },
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, code: "SLUG_TAKEN", message: "Slug already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to approve revision", ...devError(error) });
  }
};

/** POST /api/admin/revisions/:revId/reject { note } */
const handleAdminRejectRevision: RequestHandler = async (req, res) => {
  try {
    const revId = parseInt(String(req.params.revId));
    if (!Number.isFinite(revId)) return res.status(400).json({ success: false, message: "Invalid id" });
    const note = sanitizePlainText((req.body ?? {}).note, 5000);
    if (note.length < 3) {
      return res.status(400).json({ success: false, message: "A note is required" });
    }
    const rev = await loadPendingRevision(revId);
    if (!rev) return res.status(404).json({ success: false, message: "Pending revision not found" });
    const articleId = Number(rev.article_id);
    await getPool().query(
      `UPDATE article_revisions SET review_status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [req.adminUser!.userId, revId],
    );
    await addReviewNote({ articleId, revisionId: revId, userId: req.adminUser!.userId, action: "returned", note });
    await audit(getPool(), {
      ...auditFrom(req),
      action: "article.revision.rejected",
      entityType: "article",
      entityId: articleId,
      details: { revisionId: revId },
    });
    if (rev.user_id) {
      try {
        await notifyUsers(
          getPool(),
          [Number(rev.user_id)],
          {
            type: "revision.rejected",
            title: `Cambios no aprobados: ${String(rev.title).slice(0, 180)}`,
            body: note,
            link: adminArticleLink(articleId),
          },
          notifyOpts(req.adminUser!.userId),
        );
      } catch (error) {
        console.error("notify revision rejected failed:", error);
      }
    }
    res.json({ success: true, data: { id: articleId, revision_id: revId } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reject revision", ...devError(error) });
  }
};

/** GET /api/admin/articles/:id/notes — review feedback history (owner or admin) */
const handleAdminGetArticleNotes: RequestHandler = async (req, res) => {
  try {
    const id = await loadOwnedArticle(req, res);
    if (id == null) return;
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT n.id, n.article_id, n.revision_id, n.user_id, n.action, n.note, n.created_at,
              u.name AS user_name, u.email AS user_email
       FROM article_review_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.article_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 100`,
      [id],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load notes", ...devError(error) });
  }
};

// =====================================================
// NOTIFICATIONS
// =====================================================

/** GET /api/admin/notifications?unread=1 → latest 30 + unread_count */
const handleAdminGetNotifications: RequestHandler = async (req, res) => {
  try {
    const userId = req.adminUser!.userId;
    const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
    const [[items], [countRows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT id, type, title, body, link, read_at, created_at
         FROM notifications
         WHERE user_id = ? ${unreadOnly ? "AND read_at IS NULL" : ""}
         ORDER BY created_at DESC, id DESC
         LIMIT 30`,
        [userId],
      ),
      getPool().query<RowDataPacket[]>(
        "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read_at IS NULL",
        [userId],
      ),
    ]);
    res.json({
      success: true,
      data: { items, unread_count: Number(countRows[0]?.cnt ?? 0) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load notifications", ...devError(error) });
  }
};

/** POST /api/admin/notifications/:id/read */
const handleAdminReadNotification: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    await getPool().query(
      "UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL",
      [id, req.adminUser!.userId],
    );
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notification", ...devError(error) });
  }
};

/** POST /api/admin/notifications/read-all */
const handleAdminReadAllNotifications: RequestHandler = async (req, res) => {
  try {
    const [result] = await getPool().query<ResultSetHeader>(
      "UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL",
      [req.adminUser!.userId],
    );
    res.json({ success: true, data: { updated: result.affectedRows } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notifications", ...devError(error) });
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
 * GET /api/admin/authors — team directory with per-author article stats.
 * One aggregate query over articles (GROUP BY author_id) merged in memory.
 */
const handleAdminGetAuthors: RequestHandler = async (_req, res) => {
  try {
    let rows: RowDataPacket[];
    try {
      [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT
          au.id, au.name, au.slug, au.bio, au.avatar_url, au.email, au.twitter_handle, au.social_links,
          u.id AS user_id, u.role AS user_role, u.can_publish AS can_publish, u.email AS user_email
         FROM authors au
         LEFT JOIN users u ON u.author_id = au.id AND u.role IN ('admin','author')
         ORDER BY au.name ASC`,
      );
    } catch (queryErr: any) {
      // Graceful fallback if social_links / can_publish migrations haven't run yet
      if (queryErr?.code === "ER_BAD_FIELD_ERROR") {
        [rows] = await getPool().query<RowDataPacket[]>(
          `SELECT
            au.id, au.name, au.slug, au.bio, au.avatar_url, au.email, au.twitter_handle, NULL AS social_links,
            u.id AS user_id, u.role AS user_role, 0 AS can_publish, u.email AS user_email
           FROM authors au
           LEFT JOIN users u ON u.author_id = au.id AND u.role IN ('admin','author')
           ORDER BY au.name ASC`,
        );
      } else {
        throw queryErr;
      }
    }
    const [statRows] = await getPool().query<RowDataPacket[]>(
      `SELECT author_id,
              SUM(status = 'published') AS published,
              SUM(status = 'draft') AS drafts,
              SUM(status = 'in_review') AS in_review,
              SUM(status = 'scheduled') AS scheduled,
              COALESCE(SUM(view_count), 0) AS total_views,
              MAX(CASE WHEN status = 'published' THEN published_at END) AS last_published_at
       FROM articles
       GROUP BY author_id`,
    );
    const stats = new Map<number, RowDataPacket>();
    for (const s of statRows) stats.set(Number(s.author_id), s);

    // An author could (in legacy data) be linked to several users: keep the first
    const seen = new Set<number>();
    const data = rows
      .filter((r) => {
        const id = Number(r.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((r) => {
        const s = stats.get(Number(r.id));
        return {
          ...r,
          can_publish: r.user_role === "admin" || Number(r.can_publish) === 1,
          stats: {
            published: Number(s?.published ?? 0),
            drafts: Number(s?.drafts ?? 0),
            in_review: Number(s?.in_review ?? 0),
            scheduled: Number(s?.scheduled ?? 0),
            total_views: Number(s?.total_views ?? 0),
            last_published_at: s?.last_published_at ?? null,
          },
        };
      });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch authors", ...devError(error) });
  }
};

/** GET /api/admin/authors/slug-available?slug=&exclude_id= */
const handleAdminAuthorSlugAvailable: RequestHandler = async (req, res) => {
  try {
    const raw = typeof req.query.slug === "string" ? req.query.slug : "";
    const slug = slugify(raw);
    const excludeId = parseInt(String(req.query.exclude_id ?? ""));
    if (!slug) {
      return res.json({ success: true, data: { available: false, suggestion: "" } });
    }
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT slug FROM authors WHERE (slug = ? OR slug LIKE ?) AND id != ?",
      [slug, `${escapeLike(slug)}-%`, Number.isFinite(excludeId) ? excludeId : 0],
    );
    const suggestion = suggestSlug(slug, new Set(rows.map((r) => String(r.slug))));
    res.json({
      success: true,
      data: { available: suggestion === slug && slug === raw, suggestion },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to check slug", ...devError(error) });
  }
};

const ACCESS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildAuthorInviteEmailHtml(opts: {
  name: string;
  inviterName: string | null;
  role: "admin" | "author";
  canPublish: boolean;
  loginUrl: string;
}): string {
  const roleLabel =
    opts.role === "admin"
      ? "administrador"
      : opts.canPublish
        ? "autor (puede publicar)"
        : "autor";
  const inviter = opts.inviterName ? `${escapeHtml(opts.inviterName)} te dio` : "Tienes";
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitación a INTELINOTA</title></head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:Georgia,'Times New Roman',serif;color:#141414;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e6e2d9;border-radius:12px;">
      <tr><td style="padding:28px 32px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#2457ff;">Redacción INTELINOTA</td></tr>
      <tr><td style="padding:12px 32px 0;"><h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:700;">Hola, ${escapeHtml(opts.name)}</h1></td></tr>
      <tr><td style="padding:16px 32px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a3a3a;">
        ${inviter} acceso al panel de la redacción como <strong>${escapeHtml(roleLabel)}</strong>.
        Para entrar solo necesitas este correo: te enviaremos un código de 6 dígitos cada vez que inicies sesión.
      </td></tr>
      <tr><td style="padding:28px 32px;"><a href="${escapeHtml(opts.loginUrl)}" style="display:inline-block;background:#2457ff;color:#ffffff;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;">Entrar al panel</a></td></tr>
      <tr><td style="padding:0 32px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#777;">
        Si no esperabas esta invitación, puedes ignorar este mensaje.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

interface AccessResult {
  ok: boolean;
  userId?: number;
  created?: boolean;
  inviteSent?: boolean;
  status?: number;
  message?: string;
}

/**
 * Link (or create) the panel account for an author and send an invitation.
 * Email failures never fail the request.
 */
async function grantAuthorAccess(
  req: express.Request,
  authorId: number,
  authorName: string,
  input: { email?: unknown; role?: unknown; can_publish?: unknown },
): Promise<AccessResult> {
  const email = typeof input.email === "string" ? input.email.toLowerCase().trim() : "";
  if (!email || email.length > 255 || !ACCESS_EMAIL_RE.test(email)) {
    return { ok: false, status: 400, message: "Correo inválido" };
  }
  const role: "admin" | "author" = input.role === "admin" ? "admin" : "author";
  const canPublish = role === "admin" || input.can_publish === true;
  const selfId = req.adminUser!.userId;

  const [existingRows] = await getPool().query<RowDataPacket[]>(
    "SELECT id, author_id, role FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  const existing = existingRows[0];
  if (existing?.author_id && Number(existing.author_id) !== authorId) {
    return { ok: false, status: 409, message: "Ese correo ya está vinculado a otro autor" };
  }
  const [linkedRows] = await getPool().query<RowDataPacket[]>(
    "SELECT id FROM users WHERE author_id = ? AND role IN ('admin','author') AND email != ? LIMIT 1",
    [authorId, email],
  );
  if (linkedRows.length) {
    return { ok: false, status: 409, message: "Este autor ya tiene otra cuenta vinculada. Quita ese acceso primero." };
  }
  if (existing && Number(existing.id) === selfId && role !== "admin") {
    return { ok: false, status: 400, message: "No puedes quitarte el rol de administrador" };
  }

  let userId: number;
  let created = false;
  const hadAccess = existing && (existing.role === "admin" || existing.role === "author") && Number(existing.author_id) === authorId;
  if (existing) {
    userId = Number(existing.id);
    await getPool().query(
      "UPDATE users SET role = ?, can_publish = ?, author_id = ? WHERE id = ?",
      [role, canPublish ? 1 : 0, authorId, userId],
    );
  } else {
    // Unverified until the first OTP login proves ownership of the inbox
    const [ins] = await getPool().query<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, name, role, can_publish, author_id, email_verified)
       VALUES (?, '', ?, ?, ?, ?, 0)`,
      [email, authorName, role, canPublish ? 1 : 0, authorId],
    );
    userId = ins.insertId;
    created = true;
  }

  let inviteSent = false;
  if (!hadAccess) {
    try {
      const [inviterRows] = await getPool().query<RowDataPacket[]>(
        "SELECT name FROM users WHERE id = ? LIMIT 1",
        [selfId],
      );
      const base = getBaseUrl().replace(/\/$/, "");
      await sendEmail({
        to: email,
        subject: "Tienes acceso al panel de INTELINOTA",
        html: buildAuthorInviteEmailHtml({
          name: authorName,
          inviterName: (inviterRows[0]?.name as string | null) ?? null,
          role,
          canPublish,
          loginUrl: `${base}/admin/login`,
        }),
      });
      inviteSent = true;
    } catch (err) {
      console.error("author invite email failed:", err);
    }
  }

  await audit(getPool(), {
    ...auditFrom(req),
    action: hadAccess ? "author.access.update" : "author.access.grant",
    entityType: "author",
    entityId: authorId,
    details: { name: authorName, email, role, can_publish: canPublish, created, invite_sent: inviteSent },
  });
  return { ok: true, userId, created, inviteSent };
}

/**
 * POST /api/admin/authors
 */
const handleAdminCreateAuthor: RequestHandler = async (req, res) => {
  try {
    const body = req.body as {
      name?: string;
      slug?: string;
      bio?: string | null;
      avatar_url?: string | null;
      twitter_handle?: string | null;
      email?: string | null;
      social_links?: object | null;
      access?: { email?: string; role?: string; can_publish?: boolean } | null;
      /** Legacy */
      user_email?: string;
      user_role?: string;
    };

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
    const slug = slugify(typeof body.slug === "string" && body.slug ? body.slug : name);
    if (!name || !slug) {
      return res
        .status(400)
        .json({ success: false, message: "name and slug are required" });
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO authors (name, slug, bio, avatar_url, email, twitter_handle, social_links)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        body.bio ?? null,
        body.avatar_url ?? null,
        body.email ?? null,
        body.twitter_handle ?? null,
        body.social_links ? JSON.stringify(body.social_links) : null,
      ],
    );

    const authorId = result.insertId;
    await audit(getPool(), {
      ...auditFrom(req),
      action: "author.create",
      entityType: "author",
      entityId: authorId,
      details: { name, slug },
    });

    const access =
      body.access ??
      (body.user_email ? { email: body.user_email, role: body.user_role, can_publish: false } : null);
    let accessResult: AccessResult | null = null;
    if (access?.email) {
      accessResult = await grantAuthorAccess(req, authorId, name, access);
    }

    res.status(201).json({
      success: true,
      data: {
        id: authorId,
        access: accessResult?.ok
          ? { user_id: accessResult.userId, created: accessResult.created, invite_sent: accessResult.inviteSent }
          : null,
        access_error: accessResult && !accessResult.ok ? accessResult.message : null,
      },
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug or email already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to create author", ...devError(error) });
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
      "SELECT id, name FROM authors WHERE id = ? LIMIT 1",
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
      bio?: string | null;
      avatar_url?: string | null;
      twitter_handle?: string | null;
      email?: string | null;
      social_links?: object | null;
      user_email?: string;
      user_role?: string;
      can_publish?: boolean;
    };

    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    const fields: Record<string, string | number | null | undefined> = {
      name: typeof body.name === "string" ? body.name.trim().slice(0, 150) || undefined : undefined,
      slug: typeof body.slug === "string" ? slugify(body.slug) || undefined : undefined,
      bio: body.bio,
      avatar_url: body.avatar_url,
      email: body.email,
      twitter_handle: body.twitter_handle,
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
      await audit(getPool(), {
        ...auditFrom(req),
        action: "author.update",
        entityType: "author",
        entityId: id,
        details: { name: fields.name ?? exists[0].name, fields: Object.keys(fields).filter((k) => fields[k] !== undefined) },
      });
    }

    // Update linked user role when provided (never demote yourself)
    if (body.user_role) {
      const role = body.user_role === "admin" ? "admin" : "author";
      if (role !== "admin") {
        const [selfRows] = await getPool().query<RowDataPacket[]>(
          "SELECT id FROM users WHERE author_id = ? AND id = ? LIMIT 1",
          [id, req.adminUser!.userId],
        );
        if (selfRows.length) {
          return res.status(400).json({ success: false, message: "No puedes quitarte el rol de administrador" });
        }
      }
      await getPool().query(
        "UPDATE users SET role = ? WHERE author_id = ? AND role IN ('admin','author')",
        [role, id],
      );
      await audit(getPool(), {
        ...auditFrom(req),
        action: "author.role.update",
        entityType: "author",
        entityId: id,
        details: { name: exists[0].name, role },
      });
    }

    // Trusted author: may publish/schedule their own articles
    if (typeof body.can_publish === "boolean") {
      await getPool().query("UPDATE users SET can_publish = ? WHERE author_id = ?", [
        body.can_publish ? 1 : 0,
        id,
      ]);
      await audit(getPool(), {
        ...auditFrom(req),
        action: body.can_publish ? "author.can_publish.grant" : "author.can_publish.revoke",
        entityType: "author",
        entityId: id,
        details: { name: exists[0].name },
      });
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
      .json({ success: false, message: "Failed to update author", ...devError(error) });
  }
};

/** POST /api/admin/authors/:id/access — invite/link a panel account { email, role, can_publish } */
const handleAdminGrantAuthorAccess: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const [rows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, name FROM authors WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Author not found" });
    const r = await grantAuthorAccess(req, id, String(rows[0].name), req.body ?? {});
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    res.json({ success: true, data: { user_id: r.userId, created: r.created, invite_sent: r.inviteSent } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to grant access", ...devError(error) });
  }
};

/**
 * DELETE /api/admin/authors/:id/access — unlink the panel account (the users
 * row is kept but demoted to reader, so the person can no longer sign in).
 */
const handleAdminRevokeAuthorAccess: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT u.id, u.email, u.role, au.name
       FROM users u JOIN authors au ON au.id = u.author_id
       WHERE u.author_id = ? AND u.role IN ('admin','author')`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Este autor no tiene acceso al panel" });
    if (rows.some((r) => Number(r.id) === req.adminUser!.userId)) {
      return res.status(400).json({ success: false, message: "No puedes quitarte el acceso a ti mismo" });
    }
    await getPool().query(
      "UPDATE users SET role = 'reader', can_publish = 0, author_id = NULL WHERE author_id = ? AND role IN ('admin','author')",
      [id],
    );
    await audit(getPool(), {
      ...auditFrom(req),
      action: "author.access.revoke",
      entityType: "author",
      entityId: id,
      details: { name: rows[0].name, email: rows[0].email, role: rows[0].role },
    });
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to revoke access", ...devError(error) });
  }
};

/**
 * DELETE /api/admin/authors/:id?reassign_to=ID — admin only.
 * Authors with articles require reassigning them first (never orphaned).
 */
const handleAdminDeleteAuthor: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id))
    return res.status(400).json({ success: false, message: "Invalid id" });
  const reassignRaw = parseInt(String(req.query.reassign_to ?? ""));
  const reassignTo = Number.isFinite(reassignRaw) ? reassignRaw : null;

  let conn: mysql.PoolConnection | null = null;
  try {
    const [authorRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id, name FROM authors WHERE id = ? LIMIT 1",
      [id],
    );
    if (!authorRows.length) return res.status(404).json({ success: false, message: "Author not found" });

    const [selfRows] = await getPool().query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? AND author_id = ? LIMIT 1",
      [req.adminUser!.userId, id],
    );
    if (selfRows.length) {
      return res.status(400).json({ success: false, message: "No puedes eliminar tu propio perfil de autor" });
    }

    const [countRows] = await getPool().query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM articles WHERE author_id = ?",
      [id],
    );
    const articleCount = Number(countRows[0]?.cnt ?? 0);
    if (articleCount > 0) {
      if (reassignTo == null || reassignTo === id) {
        return res.status(409).json({
          success: false,
          message: "Este autor tiene artículos: elige a quién reasignarlos antes de eliminarlo.",
          data: { article_count: articleCount },
        });
      }
      const [target] = await getPool().query<RowDataPacket[]>(
        "SELECT id FROM authors WHERE id = ? LIMIT 1",
        [reassignTo],
      );
      if (!target.length) return res.status(400).json({ success: false, message: "Autor destino no encontrado" });
    }

    conn = await getPool().getConnection();
    await conn.beginTransaction();
    let moved = 0;
    if (articleCount > 0 && reassignTo != null) {
      const [upd] = await conn.query<ResultSetHeader>(
        "UPDATE articles SET author_id = ? WHERE author_id = ?",
        [reassignTo, id],
      );
      moved = upd.affectedRows;
    }
    // Linked "author" accounts lose panel access; admins stay admins
    await conn.query(
      "UPDATE users SET role = 'reader', can_publish = 0 WHERE author_id = ? AND role = 'author'",
      [id],
    );
    await conn.query("UPDATE users SET author_id = NULL WHERE author_id = ?", [id]);
    await conn.query("DELETE FROM authors WHERE id = ?", [id]);
    await conn.commit();

    await audit(getPool(), {
      ...auditFrom(req),
      action: "author.delete",
      entityType: "author",
      entityId: id,
      details: { name: authorRows[0].name, reassigned_to: moved ? reassignTo : null, articles_moved: moved },
    });
    res.json({ success: true, data: { id, articles_moved: moved } });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to delete author", ...devError(error) });
  } finally {
    conn?.release();
  }
};


/**
 * GET /api/admin/comments
 */
/** Authors only see/moderate comments on their own articles. */
function commentScope(req: express.Request): { sql: string; params: (string | number)[] } {
  if (req.adminUser!.role === "admin") return { sql: "1 = 1", params: [] };
  return { sql: "a.author_id = ?", params: [req.adminUser!.authorId ?? -1] };
}

const COMMENT_STATUSES = new Set(["pending", "approved", "spam"]);

/**
 * GET /api/admin/comments?status=&q=&flagged=1&article_id=&sort=recent|oldest|risk&page=&limit=
 * Moderation inbox: per-status counts, risk score/flags, commenter history.
 */
const handleAdminGetComments: RequestHandler = async (req, res) => {
  try {
    const status = String(req.query.status ?? "pending");
    const page = Math.max(1, parseInt(String(req.query.page || "1")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25")) || 25));
    const offset = (page - 1) * limit;
    const scope = commentScope(req);

    const conds = [scope.sql];
    const params: (string | number)[] = [...scope.params];
    if (COMMENT_STATUSES.has(status)) {
      conds.push("c.status = ?");
      params.push(status);
    }
    if (req.query.flagged === "1") conds.push("c.spam_score >= 40");
    if (req.query.article_id) {
      conds.push("c.article_id = ?");
      params.push(Number(req.query.article_id));
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (q) {
      const like = `%${escapeLike(q)}%`;
      conds.push(
        "(c.content LIKE ? ESCAPE '\\\\' OR c.author_name LIKE ? ESCAPE '\\\\' OR c.author_email LIKE ? ESCAPE '\\\\' OR a.title LIKE ? ESCAPE '\\\\')",
      );
      params.push(like, like, like, like);
    }
    const where = `WHERE ${conds.join(" AND ")}`;
    const order =
      req.query.sort === "risk"
        ? "c.spam_score DESC, c.created_at DESC"
        : req.query.sort === "oldest"
          ? "c.created_at ASC"
          : "c.created_at DESC";

    const [[countRow], [rows], [counts]] = await Promise.all([
      getPool().query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM comments c JOIN articles a ON a.id = c.article_id ${where}`,
        params,
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT c.id, c.article_id, a.title AS article_title, a.slug AS article_slug,
                c.parent_id, p.author_name AS parent_author, LEFT(p.content, 160) AS parent_excerpt,
                c.user_id, c.author_name, c.author_email, c.content, c.status,
                c.spam_score, c.flags, c.created_at,
                (SELECT COUNT(*) FROM comments h WHERE c.author_email IS NOT NULL AND h.author_email = c.author_email AND h.status = 'approved') AS author_approved,
                (SELECT COUNT(*) FROM comments h WHERE c.author_email IS NOT NULL AND h.author_email = c.author_email AND h.status = 'spam') AS author_spam
         FROM comments c
         JOIN articles a ON a.id = c.article_id
         LEFT JOIN comments p ON p.id = c.parent_id
         ${where}
         ORDER BY ${order}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      getPool().query<RowDataPacket[]>(
        `SELECT c.status, COUNT(*) AS n, SUM(c.spam_score >= 40) AS flagged
         FROM comments c JOIN articles a ON a.id = c.article_id
         WHERE ${scope.sql} GROUP BY c.status`,
        scope.params,
      ),
    ]);

    const total = Number(countRow[0]?.total ?? 0);
    const byStatus = { pending: 0, approved: 0, spam: 0, flagged_pending: 0 };
    for (const r of counts) {
      if (r.status in byStatus) byStatus[r.status as "pending" | "approved" | "spam"] = Number(r.n);
      if (r.status === "pending") byStatus.flagged_pending = Number(r.flagged ?? 0);
    }
    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        flags: typeof r.flags === "string" ? JSON.parse(r.flags) : (r.flags ?? []),
        spam_score: Number(r.spam_score ?? 0),
        author_approved: Number(r.author_approved ?? 0),
        author_spam: Number(r.author_spam ?? 0),
      })),
      counts: byStatus,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("admin comments error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch comments", ...devError(error) });
  }
};

/** Comment ids (from `ids`) the current user may moderate. */
async function allowedCommentIds(req: express.Request, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const scope = commentScope(req);
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT c.id FROM comments c JOIN articles a ON a.id = c.article_id
     WHERE c.id IN (${ids.map(() => "?").join(",")}) AND ${scope.sql}`,
    [...ids, ...scope.params],
  );
  return rows.map((r) => Number(r.id));
}

/** POST /api/admin/comments/bulk { ids, action: approve|spam|pending|delete } */
const handleAdminBulkComments: RequestHandler = async (req, res) => {
  try {
    const action = String(req.body?.action ?? "");
    const raw: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = raw.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
    if (!ids.length || !["approve", "spam", "pending", "delete"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }
    if (action === "delete" && req.adminUser!.role !== "admin") {
      return res.status(403).json({ success: false, message: "Solo administradores pueden eliminar" });
    }
    const allowed = await allowedCommentIds(req, ids);
    if (!allowed.length) return res.status(404).json({ success: false, message: "Comment not found" });
    const ph = allowed.map(() => "?").join(",");
    if (action === "delete") {
      // Detach replies so they aren't orphaned
      await getPool().query(`UPDATE comments SET parent_id = NULL WHERE parent_id IN (${ph})`, allowed);
      await getPool().query(`DELETE FROM comments WHERE id IN (${ph})`, allowed);
    } else {
      const status = action === "approve" ? "approved" : action;
      await getPool().query(`UPDATE comments SET status = ? WHERE id IN (${ph})`, [status, ...allowed]);
    }
    await audit(getPool(), {
      ...auditFrom(req),
      action: `comment.bulk.${action}`,
      entityType: "comment",
      entityId: allowed.length === 1 ? allowed[0] : null,
      details: { ids: allowed },
    });
    res.json({ success: true, data: { ids: allowed, action } });
  } catch (error) {
    console.error("bulk comments error:", error);
    res.status(500).json({ success: false, message: "Failed to update comments", ...devError(error) });
  }
};

/** POST /api/admin/comments/:id/reply { content } — staff reply, auto-approved */
const handleAdminReplyComment: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const content = sanitizePlainText(req.body?.content, 5000);
    if (!Number.isInteger(id) || content.length < 2) {
      return res.status(400).json({ success: false, message: "Escribe una respuesta" });
    }
    const allowed = await allowedCommentIds(req, [id]);
    if (!allowed.length) return res.status(404).json({ success: false, message: "Comment not found" });
    const [[parent], [me]] = await Promise.all([
      getPool().query<RowDataPacket[]>("SELECT article_id, status FROM comments WHERE id = ?", [id]),
      getPool().query<RowDataPacket[]>(
        "SELECT u.name, au.name AS author_name FROM users u LEFT JOIN authors au ON au.id = u.author_id WHERE u.id = ?",
        [req.adminUser!.userId],
      ),
    ]);
    const name = String(me[0]?.author_name || me[0]?.name || "Redacción");
    // Replying to a pending comment publishes it too
    if (parent[0]?.status === "pending") {
      await getPool().query("UPDATE comments SET status = 'approved' WHERE id = ?", [id]);
    }
    const [ins] = await getPool().query<ResultSetHeader>(
      `INSERT INTO comments (article_id, user_id, parent_id, author_name, content, status, spam_score, flags)
       VALUES (?, ?, ?, ?, ?, 'approved', 0, ?)`,
      [parent[0].article_id, req.adminUser!.userId, id, `${name} · INTELINOTA`, content, JSON.stringify(["staff"])],
    );
    await audit(getPool(), {
      ...auditFrom(req),
      action: "comment.reply",
      entityType: "comment",
      entityId: ins.insertId,
      details: { parent_id: id },
    });
    res.status(201).json({ success: true, data: { id: ins.insertId } });
  } catch (error) {
    console.error("reply comment error:", error);
    res.status(500).json({ success: false, message: "No se pudo responder", ...devError(error) });
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
    if (!(await allowedCommentIds(req, [id])).length) {
      return res.status(404).json({ success: false, message: "Comment not found" });
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

    // Risk scoring (history by email + IP), never blocks posting
    let risk = { score: 0, flags: [] as string[] };
    try {
      const email = authorEmail?.toLowerCase() ?? null;
      const [histRows, [dupes], [burst], blocklistRaw] = await Promise.all([
        email
          ? getPool()
              .query<RowDataPacket[]>(
                `SELECT SUM(status = 'approved') AS approved, SUM(status = 'spam') AS spam
                 FROM comments WHERE LOWER(author_email) = ?`,
                [email],
              )
              .then(([r]) => r)
          : Promise.resolve([] as RowDataPacket[]),
        getPool().query<RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM comments
           WHERE content = ? AND (ip_hash = ? OR (? IS NOT NULL AND LOWER(author_email) = ?))
             AND created_at >= NOW() - INTERVAL 1 DAY`,
          [content, ipHash, email, email],
        ),
        getPool().query<RowDataPacket[]>(
          "SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at >= NOW() - INTERVAL 10 MINUTE",
          [ipHash],
        ),
        getSystemSetting("comment_blocklist"),
      ]);
      risk = scoreComment({
        content,
        authorName,
        authorEmail: email,
        blocklist: (blocklistRaw ?? "").split(","),
        duplicateCount: Number(dupes[0]?.n ?? 0),
        recentFromIp: Number(burst[0]?.n ?? 0),
        approvedBefore: Number(histRows[0]?.approved ?? 0),
        spamBefore: Number(histRows[0]?.spam ?? 0),
      });
    } catch (scoreErr) {
      console.error("comment scoring failed:", scoreErr);
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO comments (article_id, parent_id, author_name, author_email, ip_hash, content, status, spam_score, flags)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [articleId, parentId, authorName, authorEmail, ipHash, content, risk.score, JSON.stringify(risk.flags)],
    );

    // Tell the article's author there's something to moderate (in-app only)
    if (risk.score < 60) {
      void (async () => {
        try {
          const [a] = await getPool().query<RowDataPacket[]>("SELECT author_id, title FROM articles WHERE id = ?", [articleId]);
          if (a[0]) {
            const ids = await getAuthorUserIds(getPool(), Number(a[0].author_id));
            await notifyUsers(
              getPool(),
              ids,
              {
                type: "comment.pending",
                title: `Nuevo comentario en “${String(a[0].title).slice(0, 80)}”`,
                body: `${authorName}: ${content.slice(0, 140)}`,
                link: "/admin/comments",
              },
              { exceptUserId: null, baseUrl: publicBase() },
            );
          }
        } catch (nErr) {
          console.error("comment notification failed:", nErr);
        }
      })();
    }

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
       WHERE r.article_id = ? AND r.kind = 'snapshot'
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
      "SELECT snapshot FROM article_revisions WHERE id = ? AND article_id = ? AND kind = 'snapshot' LIMIT 1",
      [revId, id],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Revision not found" });
    }
    // Restoring onto a live article without publish rights goes to review too
    if (!req.adminUser!.canPublish) {
      const [statusRows] = await getPool().query<RowDataPacket[]>(
        "SELECT status FROM articles WHERE id = ? LIMIT 1",
        [id],
      );
      if (statusRows[0]?.status === "published") {
        const restored = parseSnapshot(rows[0].snapshot);
        const live = await loadArticleSnapshotParts(id);
        const liveArticle = { ...(live.article ?? {}) } as Record<string, unknown>;
        delete liveArticle.updated_at;
        return respondWithPendingEdit(req, res, id, {
          article: {
            ...liveArticle,
            title: restored.article.title,
            slug: restored.article.slug,
            excerpt: restored.article.excerpt ?? null,
            content: restored.article.content ?? null,
            category_id: restored.article.category_id,
            subcategory_id: restored.article.subcategory_id ?? null,
            image_url: restored.article.image_url ?? null,
            read_time_minutes: restored.article.read_time_minutes ?? 5,
          },
          blocks: restored.blocks,
          tags: restored.tags ?? live.tags,
        });
      }
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

/**
 * Activity filter groups → static SQL over audit_log (alias l). Whitelisted:
 * only these fragments are ever interpolated; all values are parameters.
 */
const AUDIT_TYPE_SQL: Record<string, string> = {
  articles:
    "l.entity_type = 'article' AND l.action NOT LIKE 'article.review.%' AND l.action NOT LIKE 'article.revision.%' AND l.action NOT IN ('article.pending_edit','article.status.in_review')",
  review:
    "(l.action LIKE 'article.review.%' OR l.action LIKE 'article.revision.%' OR l.action IN ('article.pending_edit','article.status.in_review'))",
  comments: "l.entity_type = 'comment'",
  authors: "l.entity_type = 'author'",
  mcp: "(l.action LIKE 'mcp.%' OR l.entity_type LIKE 'mcp%')",
  settings:
    "(l.entity_type IN ('setting','settings','category','newsletter') OR l.action LIKE 'settings.%' OR l.action LIKE 'category.%' OR l.action LIKE 'newsletter.%')",
};
const AUDIT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/audit?page=&limit=&user_id=&type=&from=&to=&include_mcp=1 (admin only)
 * include_mcp merges mcp_audit_logs (tool calls made through an AI client):
 * executed writes in the general feed, every call when type=mcp.
 */
const handleAdminAuditLog: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50")) || 50));
    const offset = (page - 1) * limit;
    const type = typeof req.query.type === "string" && AUDIT_TYPE_SQL[req.query.type] ? req.query.type : null;
    const userIdRaw = parseInt(String(req.query.user_id ?? ""));
    const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;
    const from = typeof req.query.from === "string" && AUDIT_DATE_RE.test(req.query.from) ? req.query.from : null;
    const to = typeof req.query.to === "string" && AUDIT_DATE_RE.test(req.query.to) ? req.query.to : null;
    const includeMcp = req.query.include_mcp === "1" && (type === null || type === "mcp");

    const aWhere: string[] = [];
    const aParams: (string | number)[] = [];
    if (type) aWhere.push(AUDIT_TYPE_SQL[type]);
    if (userId) {
      aWhere.push("l.user_id = ?");
      aParams.push(userId);
    }
    if (from) {
      aWhere.push("l.created_at >= ?");
      aParams.push(`${from} 00:00:00`);
    }
    if (to) {
      aWhere.push("l.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
      aParams.push(`${to} 00:00:00`);
    }
    const aSql = aWhere.length ? `WHERE ${aWhere.join(" AND ")}` : "";

    const mWhere: string[] = [];
    const mParams: (string | number)[] = [];
    if (type !== "mcp") mWhere.push("m.confirm = 1");
    if (userId) {
      mWhere.push("m.user_id = ?");
      mParams.push(userId);
    }
    if (from) {
      mWhere.push("m.created_at >= ?");
      mParams.push(`${from} 00:00:00`);
    }
    if (to) {
      mWhere.push("m.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
      mParams.push(`${to} 00:00:00`);
    }
    const mSql = mWhere.length ? `WHERE ${mWhere.join(" AND ")}` : "";

    const auditSelect = `SELECT l.id, 'audit' AS source, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
              l.user_id, u.name AS user_name, u.email AS user_email
       FROM audit_log l LEFT JOIN users u ON u.id = l.user_id ${aSql}`;
    const mcpSelect = `SELECT m.id, 'mcp' AS source, m.tool_name AS action, 'mcp_tool' AS entity_type, NULL AS entity_id,
              JSON_OBJECT('tool', m.tool_name, 'ok', m.ok, 'confirm', m.confirm, 'client_id', m.client_id,
                          'duration_ms', m.duration_ms, 'error', m.error_message) AS details,
              m.created_at, m.user_id, u.name AS user_name, u.email AS user_email
       FROM mcp_audit_logs m LEFT JOIN users u ON u.id = m.user_id ${mSql}`;

    const listSql = includeMcp
      ? `SELECT * FROM (${auditSelect} UNION ALL ${mcpSelect}) t ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`
      : `${auditSelect} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`;
    const listParams = includeMcp ? [...aParams, ...mParams, limit, offset] : [...aParams, limit, offset];

    const [[rows], [countRows], mcpCount, [userRows]] = await Promise.all([
      getPool().query<RowDataPacket[]>(listSql, listParams),
      getPool().query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM audit_log l ${aSql}`, aParams),
      includeMcp
        ? getPool().query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM mcp_audit_logs m ${mSql}`, mParams)
        : Promise.resolve(null),
      page === 1
        ? getPool().query<RowDataPacket[]>(
            "SELECT id, name, email FROM users WHERE role IN ('admin','author') ORDER BY name ASC, email ASC",
          )
        : Promise.resolve([[] as RowDataPacket[]] as const),
    ]);
    const total =
      Number(countRows[0]?.total ?? 0) + Number((mcpCount?.[0] as RowDataPacket[] | undefined)?.[0]?.total ?? 0);
    const data = rows.map((r) => {
      let details = r.details;
      if (typeof details === "string") {
        try {
          details = JSON.parse(details);
        } catch {
          details = null;
        }
      }
      return { ...r, source: r.source === "mcp" ? "mcp" : "audit", details };
    });
    res.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      ...(page === 1 ? { users: userRows } : {}),
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
// REMOTE MCP (Streamable HTTP) + OAuth 2.1 — see mcp/README.md
// Tools invoke the SAME Express handlers as the admin UI (in-process), so
// every permission rule is exactly the signed-in user's rights.
// =====================================================

function mcpOrigin(): string {
  return mcpCanonicalOrigin(getBaseUrl());
}

function mcpStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

type HandlerResult = { status: number; body: any };

/**
 * Runs an Express handler chain in-process with a fake req/res bound to the
 * MCP user. Middlewares (requireAdmin) and handlers behave exactly as on the
 * real routes.
 */
async function invokeAsUser(
  chain: RequestHandler[],
  user: StaffUser,
  input: {
    method?: string;
    path?: string;
    params?: Record<string, string | number>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    ip?: string;
  },
): Promise<HandlerResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "intelinota-mcp",
    ...(input.ip ? { "x-real-ip": input.ip } : {}),
  };
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    query[k] = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
  }
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.params ?? {})) params[k] = String(v);
  const req = {
    method: input.method ?? "GET",
    url: input.path ?? "/api/mcp/internal",
    path: input.path ?? "/api/mcp/internal",
    originalUrl: input.path ?? "/api/mcp/internal",
    headers,
    params,
    query,
    body: input.body ?? {},
    socket: { remoteAddress: input.ip ?? "mcp" },
    adminUser: { ...user },
    get: (name: string) => headers[name.toLowerCase()],
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as express.Request;

  let done = false;
  let result: HandlerResult = { status: 500, body: { success: false, message: "No response" } };
  const res = {
    statusCode: 200,
    headersSent: false,
    locals: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      if (!done) {
        done = true;
        this.headersSent = true;
        result = { status: this.statusCode, body };
      }
      return this;
    },
    send(body: unknown) {
      return this.json(body);
    },
    end() {
      return this.json(null);
    },
    sendStatus(code: number) {
      this.statusCode = code;
      return this.json(null);
    },
    set() {
      return this;
    },
    setHeader() {
      return this;
    },
    header() {
      return this;
    },
    type() {
      return this;
    },
    getHeader() {
      return undefined;
    },
  } as unknown as express.Response & { statusCode: number };

  for (const handler of chain) {
    let nextCalled = false;
    let nextErr: unknown = null;
    await handler(req, res, (err?: unknown) => {
      nextCalled = true;
      nextErr = err ?? null;
    });
    if (nextErr) throw nextErr;
    if (done || !nextCalled) break;
  }
  return result;
}

type McpToolOutcome = { ok: boolean; result?: unknown; error?: string; status?: number };

function fromHandler(r: HandlerResult, map?: (data: any, body: any) => unknown): McpToolOutcome {
  const ok = r.status >= 200 && r.status < 300 && r.body?.success !== false;
  if (!ok) {
    return {
      ok: false,
      status: r.status,
      error: String(r.body?.message || r.body?.error || `HTTP ${r.status}`),
      result: r.body?.code ? { code: r.body.code, data: r.body.data ?? null } : undefined,
    };
  }
  return { ok: true, status: r.status, result: map ? map(r.body?.data, r.body) : r.body?.data ?? r.body };
}

const MCP_LIST_TEXT_MAX = 280;

function compactArticleRow(a: any) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: truncateText(a.excerpt, MCP_LIST_TEXT_MAX),
    status: a.status,
    category: a.category_slug ?? a.category_name ?? null,
    subcategory: a.subcategory_slug ?? null,
    author: a.author_name ?? null,
    author_id: a.author_id ?? null,
    featured: a.featured != null ? Boolean(Number(a.featured)) : undefined,
    published_at: toIso(a.published_at),
    updated_at: toIso(a.updated_at),
    view_count: a.view_count ?? undefined,
  };
}

async function mcpResolveCategory(
  input: unknown,
  subInput: unknown,
): Promise<{ category_id: number; subcategory_id: number | null } | { error: string }> {
  const raw = mcpStr(input);
  if (!raw) return { error: "category es obligatorio (slug o id; ver list_categories)" };
  const [rows] = await getPool().query<RowDataPacket[]>(
    /^\d+$/.test(raw)
      ? "SELECT id FROM categories WHERE id = ? LIMIT 1"
      : "SELECT id FROM categories WHERE slug = ? LIMIT 1",
    [raw],
  );
  if (!rows[0]) return { error: `Categoría no encontrada: ${raw}` };
  const categoryId = Number(rows[0].id);
  const sub = mcpStr(subInput);
  if (!sub) return { category_id: categoryId, subcategory_id: null };
  const [subRows] = await getPool().query<RowDataPacket[]>(
    /^\d+$/.test(sub)
      ? "SELECT id FROM subcategories WHERE id = ? AND category_id = ? LIMIT 1"
      : "SELECT id FROM subcategories WHERE slug = ? AND category_id = ? LIMIT 1",
    [sub, categoryId],
  );
  if (!subRows[0]) return { error: `Subcategoría no encontrada en esa categoría: ${sub}` };
  return { category_id: categoryId, subcategory_id: Number(subRows[0].id) };
}

async function mcpNewsroomTz(): Promise<string> {
  return (await getSystemSetting("newsroom_timezone")) || DEFAULT_NEWSROOM_TZ;
}

/** Builds the ArticleWriteBody fields shared by create_draft / update_article. */
async function mcpArticleBody(
  args: Record<string, unknown>,
  partial: boolean,
): Promise<{ body: Record<string, unknown>; wordCount?: number } | { error: string }> {
  const body: Record<string, unknown> = {};
  let words: number | undefined;
  if (args.title !== undefined) {
    const title = sanitizePlainText(String(args.title), 255);
    if (!title) return { error: "title vacío" };
    body.title = title;
  }
  if (args.excerpt !== undefined) body.excerpt = sanitizePlainText(String(args.excerpt), 1000) || null;
  if (args.content !== undefined) {
    const format = args.content_format === "html" ? "html" : "markdown";
    const html = contentToSafeHtml(String(args.content), format);
    body.content = html;
    words = wordCount(htmlToPlainText(html));
    if (args.read_time_minutes === undefined) {
      body.read_time_minutes = Math.max(1, Math.ceil(words / 200));
    }
  }
  if (args.read_time_minutes !== undefined) {
    body.read_time_minutes = Math.max(1, Math.min(120, Number(args.read_time_minutes) || 5));
  }
  if (args.category !== undefined || (!partial && args.category === undefined)) {
    const cat = await mcpResolveCategory(args.category, args.subcategory);
    if ("error" in cat) return cat;
    body.category_id = cat.category_id;
    body.subcategory_id = cat.subcategory_id;
  }
  if (Array.isArray(args.tags)) {
    body.tags = args.tags.map((t) => sanitizePlainText(String(t), 100)).filter(Boolean).slice(0, 20);
  }
  if (args.slug !== undefined) {
    const slug = slugify(String(args.slug));
    if (!slug) return { error: "slug inválido" };
    body.slug = slug;
  }
  if (args.image_url !== undefined) {
    const url = mcpStr(args.image_url);
    if (url && !/^https:\/\//i.test(url) && !url.startsWith("/api/media/")) {
      return { error: "image_url debe ser https (usa upload_image_from_url)" };
    }
    body.image_url = url || null;
  }
  if (args.meta_title !== undefined) body.meta_title = args.meta_title;
  if (args.meta_description !== undefined) body.meta_description = args.meta_description;
  return { body, wordCount: words };
}

function mcpRights(user: StaffUser) {
  const isAdmin = user.role === "admin";
  return {
    role: user.role,
    can_publish: user.canPublish,
    can_approve_reviews: isAdmin,
    can_feature: isAdmin,
    can_moderate_comments: isAdmin ? "all" : "own_articles",
    can_delete_comments: isAdmin,
    sees_articles: isAdmin ? "all" : "own",
    live_edits: user.canPublish ? "applied_immediately" : "pending_review",
  };
}

function mcpDryRun(action: string, preview: Record<string, unknown>): McpToolOutcome {
  return {
    ok: true,
    result: {
      dry_run: true,
      action,
      preview,
      next_step: "Muestra esta vista previa al usuario. Si la aprueba, repite la llamada con confirm=true y confirm_phrase=CONFIRM.",
    },
  };
}

async function executeMcpTool(
  user: StaffUser,
  name: string,
  args: Record<string, unknown>,
  confirm: boolean,
  ip: string,
): Promise<McpToolOutcome> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Herramienta desconocida: ${name}` };
  if (tool.adminOnly && user.role !== "admin") {
    return { ok: false, status: 403, error: "Solo administradores" };
  }
  const run = (chain: RequestHandler[], input: Parameters<typeof invokeAsUser>[2]) =>
    invokeAsUser(tool.adminOnly ? [requireAdmin, ...chain] : chain, user, { ip, ...input });
  const limit = mcpLimit(args);
  const page = mcpPage(args);
  const articleId = Number(args.article_id);
  const needArticle = () =>
    Number.isInteger(articleId) && articleId > 0 ? null : ({ ok: false, error: "article_id inválido" } as McpToolOutcome);

  switch (name) {
    // ── READ ──────────────────────────────────────────
    case "whoami": {
      const r = await run([handleAdminMe], { path: "/api/admin/me" });
      return fromHandler(r, (d) => ({
        id: d?.id,
        name: d?.name,
        email: d?.email,
        role: d?.role,
        author_id: d?.author_id ?? null,
        author_profile: d?.author_id ? { bio: truncateText(d?.bio, 400), twitter_handle: d?.twitter_handle ?? null } : null,
        newsroom_timezone: d?.newsroom_timezone,
        rights: mcpRights(user),
      }));
    }
    case "list_articles": {
      // "mine" for admins narrows to their own author profile (never widens).
      const asUser: StaffUser =
        args.mine === true && user.role === "admin" && user.authorId ? { ...user, role: "author" } : user;
      const r = await invokeAsUser([handleAdminGetArticles], asUser, {
        ip,
        path: "/api/admin/articles",
        query: { page, limit, status: args.status, category: args.category, search: args.q },
      });
      return fromHandler(r, (d, b) => ({
        articles: (d ?? []).map(compactArticleRow),
        pagination: b?.pagination,
      }));
    }
    case "get_article": {
      const bad = needArticle();
      if (bad) return bad;
      const r = await run([handleAdminGetArticle], { path: `/api/admin/articles/${articleId}`, params: { id: articleId } });
      return fromHandler(r, (d) => {
        const plain = htmlToPlainText(d?.content);
        return {
          ...compactArticleRow(d),
          excerpt: d?.excerpt ?? null,
          image_url: d?.image_url ?? null,
          read_time_minutes: d?.read_time_minutes,
          trending: Boolean(Number(d?.trending)),
          meta_title: d?.meta_title ?? null,
          meta_description: d?.meta_description ?? null,
          tags: d?.tags ?? [],
          word_count: wordCount(plain),
          content_html: truncateText(d?.content, 150_000),
          content_text: truncateText(plain, 60_000),
          legacy_blocks: Array.isArray(d?.blocks) ? d.blocks.length : 0,
          pending_revision: d?.pending_revision ?? null,
          public_url: d?.status === "published" ? `${mcpOrigin()}/articulo/${d?.slug}` : null,
          admin_url: `${mcpOrigin()}/admin/articles/${articleId}/edit`,
        };
      });
    }
    case "search_published": {
      const r = await run([handleGetArticles], {
        path: "/api/articles",
        query: {
          search: args.q,
          category: args.category,
          author: args.author,
          tag: args.tag,
          since: args.since,
          sort: args.sort,
          page,
          limit,
          facets: "1",
        },
      });
      return fromHandler(r, (d, b) => {
        const list = Array.isArray(d) ? d : Array.isArray(d?.articles) ? d.articles : Array.isArray(d?.results) ? d.results : [];
        return {
          articles: list.map((a: any) => ({
            ...compactArticleRow(a),
            category: a.category?.slug ?? a.category_slug ?? a.category ?? null,
            author: a.author?.name ?? a.author_name ?? a.author ?? null,
            url: a.slug ? `${mcpOrigin()}/articulo/${a.slug}` : null,
          })),
          facets: d?.facets ?? b?.facets ?? null,
          pagination: b?.pagination ?? d?.pagination ?? null,
        };
      });
    }
    case "list_categories": {
      const r = await run([handleGetCategories], { path: "/api/categories" });
      return fromHandler(r, (d) =>
        (d ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          subcategories: (c.subcategories ?? []).map((s: any) => ({ id: s.id, name: s.name, slug: s.slug })),
        })),
      );
    }
    case "list_authors": {
      const r = await run([handleGetAuthors], { path: "/api/authors" });
      return fromHandler(r, (d) =>
        (d ?? []).map((a: any) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          bio: truncateText(a.bio, 160),
          article_count: Number(a.article_count) || 0,
          latest_published_at: toIso(a.latest_published_at),
        })),
      );
    }
    case "list_tags": {
      const q = mcpStr(args.q).slice(0, 100);
      const where = q ? "WHERE t.name LIKE ? ESCAPE '\\\\'" : "";
      const params: (string | number)[] = q ? [`%${escapeLike(q)}%`] : [];
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT t.id, t.name, t.slug, COUNT(at.article_id) AS uses
         FROM tags t LEFT JOIN article_tags at ON at.tag_id = t.id
         ${where}
         GROUP BY t.id, t.name, t.slug
         ORDER BY uses DESC, t.name ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit],
      );
      return { ok: true, result: { tags: rows.map((t) => ({ ...t, uses: Number(t.uses) })), page, limit } };
    }
    case "get_article_revisions": {
      const bad = needArticle();
      if (bad) return bad;
      const r = await run([handleAdminListRevisions], { params: { id: articleId } });
      return fromHandler(r, (d) =>
        (d ?? []).slice(0, limit).map((v: any) => ({
          id: v.id,
          title: v.title,
          status: v.status,
          created_at: toIso(v.created_at),
          by: v.user_name ?? v.user_email ?? null,
        })),
      );
    }
    case "list_review_queue": {
      const r = await run([handleAdminGetReviews], { path: "/api/admin/reviews" });
      return fromHandler(r, (d) => {
        const compact = (list: unknown) =>
          Array.isArray(list)
            ? list.slice(0, 50).map((x: any) => ({ ...x, excerpt: truncateText(x.excerpt, MCP_LIST_TEXT_MAX), snapshot: undefined }))
            : list;
        return d && typeof d === "object"
          ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, compact(v)]))
          : d;
      });
    }
    case "get_review_notes": {
      const bad = needArticle();
      if (bad) return bad;
      const r = await run([handleAdminGetArticleNotes], { params: { id: articleId } });
      return fromHandler(r, (d) =>
        (d ?? []).slice(0, limit).map((n: any) => ({
          id: n.id,
          action: n.action,
          note: n.note,
          revision_id: n.revision_id,
          by: n.user_name ?? null,
          created_at: toIso(n.created_at),
        })),
      );
    }
    case "list_comments": {
      const r = await run([handleAdminGetComments], {
        path: "/api/admin/comments",
        query: {
          status: args.status ?? "pending",
          flagged: args.flagged === true ? "1" : undefined,
          q: args.q,
          article_id: args.article_id,
          page,
          limit,
        },
      });
      return fromHandler(r, (d, b) => {
        const list = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        return {
          comments: list.map((c: any) => ({
            id: c.id,
            article_id: c.article_id,
            article_title: c.article_title ?? null,
            author_name: c.author_name,
            content: truncateText(c.content, 600),
            status: c.status,
            spam_score: c.spam_score ?? null,
            flags: c.flags ?? null,
            parent_id: c.parent_id ?? null,
            created_at: toIso(c.created_at),
          })),
          counts: b?.counts ?? d?.counts ?? null,
          pagination: b?.pagination ?? d?.pagination ?? null,
        };
      });
    }
    case "list_notifications": {
      const r = await run([handleAdminGetNotifications], { query: { unread: args.unread_only === true ? "1" : undefined } });
      return fromHandler(r);
    }
    case "get_dashboard_stats": {
      const r = await run([handleAdminDashboard], { path: "/api/admin/dashboard" });
      return fromHandler(r, (d) => ({ scope: user.role === "admin" ? "site" : "mine", ...d }));
    }
    case "get_audit_log": {
      const r = await run([handleAdminAuditLog], { query: { page, limit } });
      return fromHandler(r, (d, b) => ({ entries: d, pagination: b?.pagination }));
    }
    case "check_slug": {
      const r = await run([handleAdminSlugAvailable], {
        query: { slug: args.slug, exclude_id: args.exclude_article_id },
      });
      return fromHandler(r);
    }

    // ── WRITE ─────────────────────────────────────────
    case "create_draft": {
      const built = await mcpArticleBody(args, false);
      if ("error" in built) return { ok: false, error: built.error };
      const body = built.body;
      let authorId: number | null = user.authorId;
      if (user.role === "admin" && args.author_id !== undefined) authorId = Number(args.author_id);
      if (!authorId) return { ok: false, error: "Tu usuario no tiene perfil de autor; indica author_id (admin)." };
      body.author_id = authorId;
      body.status = "draft";
      if (!body.slug) {
        const sr = await run([handleAdminSlugAvailable], { query: { slug: String(body.title ?? "") } });
        body.slug = sr.body?.data?.suggestion || slugify(String(body.title ?? ""));
      }
      if (!body.slug) return { ok: false, error: "No se pudo generar slug" };
      if (!confirm) {
        return mcpDryRun("create_draft", {
          ...body,
          content: truncateText(body.content, 1500),
          word_count: built.wordCount ?? 0,
          status: "draft",
        });
      }
      const r = await run([handleAdminCreateArticle], { method: "POST", path: "/api/admin/articles", body });
      return fromHandler(r, (d) => ({ ...d, slug: body.slug, admin_url: `${mcpOrigin()}/admin/articles/${d?.id}/edit` }));
    }
    case "update_article":
    case "submit_for_review":
    case "publish_article":
    case "archive_article":
    case "set_featured": {
      const bad = needArticle();
      if (bad) return bad;
      let body: Record<string, unknown> = {};
      let wc: number | undefined;
      if (name === "update_article") {
        const built = await mcpArticleBody(args, true);
        if ("error" in built) return { ok: false, error: built.error };
        body = built.body;
        wc = built.wordCount;
        if (!Object.keys(body).length) return { ok: false, error: "No hay campos para actualizar" };
      } else if (name === "submit_for_review") {
        body.status = "in_review";
      } else if (name === "publish_article" || name === "archive_article") {
        if (!user.canPublish) {
          return {
            ok: false,
            status: 403,
            error: "No tienes permiso de publicar/archivar. Usa submit_for_review para enviarla a revisión.",
          };
        }
        if (name === "archive_article") body.status = "archived";
        else {
          const tz = await mcpNewsroomTz();
          const when = args.publish_at ? parseNewsroomDateTime(args.publish_at, tz) : null;
          if (args.publish_at && !when) return { ok: false, error: "publish_at inválido (usa ISO, p. ej. 2026-12-01T08:00)" };
          if (when && when.getTime() > Date.now() + 60_000) {
            body.status = "scheduled";
            body.published_at = when.toISOString();
          } else {
            body.status = "published";
          }
        }
      } else if (name === "set_featured") {
        body.featured = args.featured === true;
        if (args.trending !== undefined) body.trending = args.trending === true;
      }
      if (name !== "set_featured") {
        const expected = mcpStr(args.expected_updated_at);
        if (!expected) return { ok: false, error: "expected_updated_at es obligatorio (de get_article)" };
        body.expected_updated_at = expected;
      }
      // Load current state with the user's rights (403/404 as in the UI)
      const cur = await run([handleAdminGetArticle], { params: { id: articleId } });
      if (cur.status !== 200) return fromHandler(cur);
      const current = cur.body?.data ?? {};
      if (!confirm) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const [k, v] of Object.entries(body)) {
          if (k === "expected_updated_at") continue;
          const from = k === "content" ? truncateText(current.content, 400) : current[k];
          changes[k] = { from, to: k === "content" ? truncateText(v, 1200) : v };
        }
        const pending = !user.canPublish && current.status === "published";
        return mcpDryRun(name, {
          article_id: articleId,
          title: current.title,
          current_status: current.status,
          changes,
          ...(wc !== undefined ? { new_word_count: wc } : {}),
          outcome: pending
            ? "La nota está publicada y no puedes publicar: el cambio quedará PENDIENTE de revisión (no sale en vivo)."
            : "El cambio se aplicará directamente.",
          stale:
            body.expected_updated_at && toIso(current.updated_at) !== toIso(body.expected_updated_at)
              ? "expected_updated_at no coincide con la versión actual: al confirmar devolverá 409 CONFLICT. Vuelve a leer con get_article."
              : undefined,
        });
      }
      const r = await run([handleAdminUpdateArticle], {
        method: "PUT",
        path: `/api/admin/articles/${articleId}`,
        params: { id: articleId },
        body,
      });
      return fromHandler(r, (d) =>
        r.status === 202
          ? { ...d, pending_review: true, message: "Edición enviada a revisión; la versión en vivo no cambió." }
          : d,
      );
    }
    case "restore_revision": {
      const bad = needArticle();
      if (bad) return bad;
      const revId = Number(args.revision_id);
      if (!Number.isInteger(revId) || revId < 1) return { ok: false, error: "revision_id inválido" };
      if (!confirm) {
        const list = await run([handleAdminListRevisions], { params: { id: articleId } });
        if (list.status !== 200) return fromHandler(list);
        const rev = (list.body?.data ?? []).find((v: any) => Number(v.id) === revId);
        if (!rev) return { ok: false, status: 404, error: "Versión no encontrada" };
        return mcpDryRun("restore_revision", {
          article_id: articleId,
          revision: { id: rev.id, title: rev.title, created_at: toIso(rev.created_at), by: rev.user_name ?? null },
          outcome: user.canPublish
            ? "Se restaurará el contenido (no cambia el estado de publicación)."
            : "Si la nota está publicada, quedará como edición pendiente de revisión.",
        });
      }
      const r = await run([handleAdminRestoreRevision], { method: "POST", params: { id: articleId, revId } });
      return fromHandler(r, (d) => (r.status === 202 ? { ...d, pending_review: true } : d));
    }
    case "upload_image_from_url": {
      const url = mcpStr(args.url);
      try {
        const target = await assertPublicHttpsUrl(url);
        if (!confirm) {
          return mcpDryRun("upload_image_from_url", {
            url: target.url.toString(),
            alt_text: args.alt_text ?? null,
            limits: "https, imagen ≤ 10 MB; se optimiza y guarda en la mediateca",
          });
        }
        const fetched = await fetchPublicImage(url);
        const norm = await normalizeImageForUpload(fetched.buffer, fetched.contentType, MAX_UPLOAD_BYTES);
        const ext = norm.mime === "image/png" ? "png" : norm.mime === "image/webp" ? "webp" : "jpg";
        const base = slugify(decodeURIComponent(target.url.pathname.split("/").pop() || "imagen").replace(/\.[a-z0-9]+$/i, "")) || "imagen";
        const r = await run([handleAdminUpload], {
          method: "POST",
          path: "/api/admin/upload",
          body: {
            data_base64: norm.buffer.toString("base64"),
            mime_type: norm.mime,
            filename: `${base.slice(0, 80)}.${ext}`,
            alt_text: args.alt_text,
          },
        });
        return fromHandler(r, (d) => ({ id: d?.id, url: d?.url, width: d?.width, height: d?.height, source: fetched.finalUrl }));
      } catch (err) {
        if (err instanceof SsrfError) return { ok: false, status: 400, error: `URL rechazada: ${err.code}` };
        throw err;
      }
    }
    case "approve_article": {
      const bad = needArticle();
      if (bad) return bad;
      const tz = await mcpNewsroomTz();
      const when = args.publish_at ? parseNewsroomDateTime(args.publish_at, tz) : null;
      if (args.publish_at && !when) return { ok: false, error: "publish_at inválido" };
      const body = { published_at: when ? when.toISOString() : null, note: args.note };
      if (!confirm) {
        const cur = await run([handleAdminGetArticle], { params: { id: articleId } });
        if (cur.status !== 200) return fromHandler(cur);
        return mcpDryRun("approve_article", {
          article_id: articleId,
          title: cur.body?.data?.title,
          current_status: cur.body?.data?.status,
          outcome: when && when.getTime() > Date.now() + 60_000 ? `Programada para ${when.toISOString()} (${tz})` : "Se publica ahora",
          note: args.note ?? null,
        });
      }
      return fromHandler(await run([handleAdminApproveArticle], { method: "POST", params: { id: articleId }, body }));
    }
    case "return_article": {
      const bad = needArticle();
      if (bad) return bad;
      if (!confirm) return mcpDryRun("return_article", { article_id: articleId, note: args.note });
      return fromHandler(
        await run([handleAdminReturnArticle], { method: "POST", params: { id: articleId }, body: { note: args.note } }),
      );
    }
    case "approve_pending_edit":
    case "reject_pending_edit": {
      const revId = Number(args.revision_id);
      if (!Number.isInteger(revId) || revId < 1) return { ok: false, error: "revision_id inválido" };
      if (!confirm) return mcpDryRun(name, { revision_id: revId, note: args.note ?? null });
      const handler = name === "approve_pending_edit" ? handleAdminApproveRevision : handleAdminRejectRevision;
      return fromHandler(await run([handler], { method: "POST", params: { revId }, body: { note: args.note } }));
    }
    case "moderate_comments": {
      const ids = (Array.isArray(args.ids) ? args.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
      if (!ids.length) return { ok: false, error: "ids vacío" };
      if (!confirm) {
        return mcpDryRun("moderate_comments", {
          action: args.action,
          ids,
          note: args.action === "delete" && user.role !== "admin" ? "delete es solo para administradores" : undefined,
        });
      }
      return fromHandler(await run([handleAdminBulkComments], { method: "POST", body: { ids, action: args.action } }));
    }
    case "reply_to_comment": {
      const cid = Number(args.comment_id);
      if (!Number.isInteger(cid) || cid < 1) return { ok: false, error: "comment_id inválido" };
      if (!confirm) return mcpDryRun("reply_to_comment", { comment_id: cid, content: args.content });
      return fromHandler(
        await run([handleAdminReplyComment], { method: "POST", params: { id: cid }, body: { content: args.content } }),
      );
    }
    case "mark_notifications_read": {
      const ids = (Array.isArray(args.ids) ? args.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
      if (args.all !== true && !ids.length) return { ok: false, error: "Indica ids o all=true" };
      if (!confirm) return mcpDryRun("mark_notifications_read", args.all === true ? { all: true } : { ids });
      if (args.all === true) return fromHandler(await run([handleAdminReadAllNotifications], { method: "POST" }));
      for (const nid of ids) {
        const r = await run([handleAdminReadNotification], { method: "POST", params: { id: nid } });
        if (r.status >= 400) return fromHandler(r);
      }
      return { ok: true, result: { ids } };
    }
    default:
      return { ok: false, error: `Herramienta no implementada: ${name}` };
  }
}

function mcpToolsFor(user: StaffUser) {
  return MCP_TOOLS.filter((t) => !t.adminOnly || user.role === "admin");
}

async function writeMcpAudit(entry: {
  userId: number;
  clientId: string | null;
  tool: string;
  confirm: boolean;
  args: Record<string, unknown>;
  outcome: McpToolOutcome;
  durationMs: number;
}) {
  try {
    await getPool().query(
      `INSERT INTO mcp_audit_logs (user_id, client_id, tool_name, confirm, ok, status_code, duration_ms, request_json, result_json, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.clientId,
        entry.tool.slice(0, 120),
        entry.confirm ? 1 : 0,
        entry.outcome.ok ? 1 : 0,
        entry.outcome.status ?? null,
        entry.durationMs,
        JSON.stringify(redactMcpArgs(entry.args)),
        auditResultJson(entry.outcome.result ?? null),
        entry.outcome.error ? entry.outcome.error.slice(0, 500) : null,
      ],
    );
  } catch (err) {
    console.error("[mcp] audit insert failed", err);
  }
}

const MCP_RATE_LIMIT_PER_MIN = 60;

/** Bearer = opaque OAuth access token (sha256 lookup) or, as fallback, an admin-panel JWT. */
const requireMcpAuth: RequestHandler = async (req, res, next) => {
  const fail = (reason: string) => {
    console.warn("[mcp] auth_reject", { reason });
    res.setHeader("WWW-Authenticate", mcpWwwAuthenticate(mcpOrigin()));
    res.status(401).json({ error: "unauthorized", error_description: reason });
  };
  try {
    const bearer = parseBearerAuthorization(req.headers.authorization);
    if (!bearer) return fail(req.headers.authorization ? "authorization_not_bearer" : "missing_authorization");
    if (!bearer.includes(".")) {
      const hash = sha256Hex(bearer);
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT id, user_id, client_id FROM mcp_oauth_tokens
         WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
        [hash],
      );
      if (!rows[0]) return fail("token_unknown_or_expired");
      const user = await loadStaffUser(Number(rows[0].user_id));
      if (!user) return fail("user_not_allowed");
      await getPool().query("UPDATE mcp_oauth_tokens SET last_used_at = NOW() WHERE id = ?", [rows[0].id]);
      req.adminUser = user;
      res.locals.mcpClientId = String(rows[0].client_id);
      return next();
    }
    const user = await staffUserFromJwt(bearer);
    if (!user) return fail("session_invalid");
    req.adminUser = user;
    res.locals.mcpClientId = "admin-session";
    return next();
  } catch (err) {
    console.error("[mcp] requireMcpAuth", err);
    return fail("auth_error");
  }
};

async function handleMcpStreamable(req: express.Request, res: express.Response) {
  const user = req.adminUser!;
  const clientId = (res.locals.mcpClientId as string | undefined) ?? null;
  const ip = getRequestIp(req);
  const server = new McpServer({ name: "intelinota", version: "1.0.0" });

  for (const t of mcpToolsFor(user)) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: mcpJsonSchemaToZod(t.inputSchema).shape },
      async (toolArgs: Record<string, unknown>) => {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(toolArgs || {})) if (v !== undefined) cleaned[k] = v;
        const confirm = !t.readOnly && mcpWriteConfirmed(cleaned);
        const started = Date.now();
        let outcome: McpToolOutcome;
        if (memoryRateLimit(`mcp:${user.userId}`, MCP_RATE_LIMIT_PER_MIN, 60_000)) {
          outcome = { ok: false, status: 429, error: "Límite de 60 llamadas por minuto. Espera un momento." };
        } else {
          try {
            outcome = await executeMcpTool(user, t.name, cleaned, confirm, ip);
          } catch (err) {
            console.error("[mcp] tool", t.name, err);
            outcome = { ok: false, status: 500, error: "La herramienta falló" };
          }
        }
        await writeMcpAudit({ userId: user.userId, clientId, tool: t.name, confirm, args: cleaned, outcome, durationMs: Date.now() - started });
        const payload = outcome.ok ? outcome.result : { ok: false, error: outcome.error, ...(outcome.result ? { detail: outcome.result } : {}) };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
          isError: !outcome.ok,
        };
      },
    );
  }

  for (const p of MCP_PROMPTS) {
    const argsShape: Record<string, z.ZodTypeAny> = {};
    for (const [k, desc] of Object.entries(p.args)) argsShape[k] = z.string().describe(desc).optional();
    server.registerPrompt(p.name, { description: p.description, argsSchema: argsShape }, (a: Record<string, string | undefined>) => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: p.build(a ?? {}) } }],
    }));
  }

  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpToolsListForClaude(mcpToolsFor(user)),
  }));

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

  // Sanitize Claude-hostile fields on the wire
  const origSend = res.send.bind(res);
  (res as any).json = (body: unknown) => {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    res.setHeader("Content-Type", "application/json");
    return origSend(sanitizeMcpJsonRpcForClaude(raw));
  };
  (res as any).send = (body: unknown) =>
    typeof body === "string" ? origSend(sanitizeMcpJsonRpcForClaude(body)) : origSend(body as any);
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req as any, res as any, req.body);
}

const MCP_CORS_PATHS = /^\/(api\/mcp|\.well-known\/)/;

/** Public CORS for MCP/OAuth discovery (tokens are bearer, never cookies). */
const mcpCors: RequestHandler = (req, res, next) => {
  if (!MCP_CORS_PATHS.test(req.path)) return next();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
};

async function findMcpClient(clientId: string): Promise<RowDataPacket | null> {
  if (!clientId || clientId.length > 128) return null;
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT client_id, client_name, redirect_uris_json FROM mcp_oauth_clients WHERE client_id = ? LIMIT 1",
    [clientId],
  );
  return rows[0] ?? null;
}

function mcpResourceOk(resource: string): boolean {
  if (!resource) return true;
  const want = mcpResourceUrl(mcpOrigin());
  return resource.replace(/\/+$/, "") === want;
}

function mcpTokenResponse(res: express.Response, access: string, refresh: string) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return res.json({
    access_token: access,
    token_type: "bearer",
    expires_in: MCP_ACCESS_TTL_SEC,
    refresh_token: refresh,
    scope: MCP_SCOPE,
  });
}

function registerMcpRoutes(app: express.Application) {
  const meta = (_req: express.Request, res: express.Response) =>
    res.json(mcpAuthorizationServerMetadata(mcpOrigin()));
  const prm = (_req: express.Request, res: express.Response) =>
    res.json(mcpProtectedResourceMetadata(mcpOrigin()));
  app.get(
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/api/mcp",
      "/.well-known/openid-configuration",
      "/.well-known/openid-configuration/api/mcp",
      "/api/mcp/.well-known/oauth-authorization-server",
      "/api/mcp/.well-known/openid-configuration",
    ],
    meta,
  );
  app.get(
    [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/api/mcp",
      "/api/mcp/.well-known/oauth-protected-resource",
    ],
    prm,
  );

  // Streamable HTTP (stateless, JSON responses)
  app.get("/api/mcp", requireMcpAuth, (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "use_post" });
  });
  app.delete("/api/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "stateless_server" });
  });
  app.post(["/api/mcp", "/api/mcp/"], requireMcpAuth, (req, res) => {
    handleMcpStreamable(req, res).catch((err) => {
      console.error("[mcp] streamable", err);
      if (!res.headersSent) res.status(500).json({ error: "mcp_error" });
    });
  });

  // Dynamic Client Registration (RFC 7591) — public clients only (PKCE)
  app.post("/api/mcp/oauth/register", async (req, res) => {
    try {
      const ipHash = hashIp(getRequestIp(req));
      if (memoryRateLimit(`mcp-dcr:${ipHash}`, 20, 60 * 60_000)) {
        return res.status(429).json({ error: "rate_limited" });
      }
      const rawUris: unknown[] = Array.isArray(req.body?.redirect_uris) ? req.body.redirect_uris : [];
      const redirectUris = rawUris.map(String).filter(mcpRedirectUriOkForRegistration).slice(0, 10);
      if (!redirectUris.length || redirectUris.length !== rawUris.length) {
        return res.status(400).json({
          error: "invalid_redirect_uri",
          error_description: "redirect_uris must be Claude/Cursor callbacks, loopback http, or cursor://",
        });
      }
      const clientName = sanitizePlainText(mcpStr(req.body?.client_name), 120) || "Cliente MCP";
      const clientId = `mcp_${randomToken(18)}`;
      await getPool().query(
        "INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris_json) VALUES (?, ?, ?)",
        [clientId, clientName, JSON.stringify(redirectUris)],
      );
      return res.status(201).json({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: clientName,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: MCP_SCOPE,
      });
    } catch (err) {
      console.error("[mcp] register", err);
      return res.status(500).json({ error: "registration_failed" });
    }
  });

  // Authorization endpoint → SPA consent page (login first if needed)
  app.get("/api/mcp/oauth/authorize", async (req, res) => {
    try {
      const clientId = mcpStr(req.query.client_id);
      const redirectUri = mcpStr(req.query.redirect_uri);
      const challenge = mcpStr(req.query.code_challenge);
      const method = mcpStr(req.query.code_challenge_method) || "S256";
      const state = mcpStr(req.query.state).slice(0, 1000);
      const resource = mcpStr(req.query.resource);
      if (!clientId || !redirectUri || mcpStr(req.query.response_type) !== "code") {
        return res.status(400).send("invalid_request");
      }
      const client = await findMcpClient(clientId);
      if (!client) return res.status(400).send("unknown_client");
      if (!mcpRedirectUriAllowed(redirectUri, parseMcpRedirectUris(client.redirect_uris_json))) {
        return res.status(400).send("invalid redirect_uri");
      }
      // From here on errors go back to the (validated) client redirect
      const back = (error: string) => {
        const u = new URL(redirectUri);
        u.searchParams.set("error", error);
        if (state) u.searchParams.set("state", state);
        return res.redirect(302, u.toString());
      };
      if (!challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return back("invalid_request");
      if (method !== "S256") return back("invalid_request");
      if (!mcpResourceOk(resource)) return back("invalid_target");
      const consent = new URL(`${mcpOrigin()}/admin/mcp-consent`);
      consent.searchParams.set("client_id", clientId);
      consent.searchParams.set("redirect_uri", redirectUri);
      consent.searchParams.set("code_challenge", challenge);
      consent.searchParams.set("scope", MCP_SCOPE);
      if (state) consent.searchParams.set("state", state);
      return res.redirect(302, consent.toString());
    } catch (err) {
      console.error("[mcp] authorize", err);
      return res.status(500).send("authorize_failed");
    }
  });

  // Consent page data: client name + validated redirect + my rights
  app.get("/api/admin/mcp/oauth/client", requireAdminAuth, async (req, res) => {
    try {
      const clientId = mcpStr(req.query.client_id);
      const redirectUri = mcpStr(req.query.redirect_uri);
      const client = await findMcpClient(clientId);
      if (!client || !mcpRedirectUriAllowed(redirectUri, parseMcpRedirectUris(client.redirect_uris_json))) {
        return res.status(400).json({ success: false, message: "Cliente o redirect_uri inválido" });
      }
      const me = await buildAdminUserResponse(req.adminUser!.userId);
      return res.json({
        success: true,
        data: {
          client_id: clientId,
          client_name: String(client.client_name || "Cliente MCP"),
          redirect_host: new URL(redirectUri).host || new URL(redirectUri).protocol,
          scope: MCP_SCOPE,
          user: { name: me?.name ?? null, email: req.adminUser!.email, role: req.adminUser!.role },
          rights: mcpRights(req.adminUser!),
        },
      });
    } catch (err) {
      console.error("[mcp] consent client", err);
      return res.status(500).json({ success: false, message: "Error" });
    }
  });

  // Consent decision → single-use code (hashed, 10 min)
  app.post("/api/admin/mcp/oauth/approve", requireAdminAuth, async (req, res) => {
    try {
      const clientId = mcpStr(req.body?.client_id);
      const redirectUri = mcpStr(req.body?.redirect_uri);
      const challenge = mcpStr(req.body?.code_challenge);
      const state = mcpStr(req.body?.state).slice(0, 1000);
      const approve = req.body?.approve === true;
      const client = await findMcpClient(clientId);
      if (!client || !mcpRedirectUriAllowed(redirectUri, parseMcpRedirectUris(client.redirect_uris_json))) {
        return res.status(400).json({ success: false, message: "invalid_client_or_redirect" });
      }
      const target = new URL(redirectUri);
      if (state) target.searchParams.set("state", state);
      if (!approve) {
        target.searchParams.set("error", "access_denied");
        return res.json({ success: true, data: { redirect_to: target.toString() } });
      }
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
        return res.status(400).json({ success: false, message: "invalid_code_challenge" });
      }
      const code = mcpRandomSecret(32);
      await getPool().query(
        `INSERT INTO mcp_oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scopes, expires_at)
         VALUES (?, ?, ?, ?, ?, 'S256', ?, ?)`,
        [sha256Hex(code), clientId, req.adminUser!.userId, redirectUri, challenge, MCP_SCOPE, new Date(Date.now() + MCP_CODE_TTL_MS)],
      );
      await audit(getPool(), {
        ...auditFrom(req),
        action: "mcp.authorize",
        entityType: "mcp_client",
        entityId: null,
        details: { client_id: clientId, client_name: client.client_name },
      });
      target.searchParams.set("code", code);
      return res.json({ success: true, data: { redirect_to: target.toString() } });
    } catch (err) {
      console.error("[mcp] approve", err);
      return res.status(500).json({ success: false, message: "approve_failed" });
    }
  });

  // Token endpoint: authorization_code (PKCE S256) and rotating refresh_token
  app.post("/api/mcp/oauth/token", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const ipHash = hashIp(getRequestIp(req));
      if (memoryRateLimit(`mcp-token:${ipHash}`, 60, 60_000)) return res.status(429).json({ error: "rate_limited" });
      const grantType = mcpStr(req.body?.grant_type);
      const clientId = mcpStr(req.body?.client_id);
      const client = await findMcpClient(clientId);
      if (!client) return res.status(401).json({ error: "invalid_client" });
      if (!mcpResourceOk(mcpStr(req.body?.resource))) return res.status(400).json({ error: "invalid_target" });

      if (grantType === "refresh_token") {
        const refresh = mcpStr(req.body?.refresh_token);
        if (!refresh) return res.status(400).json({ error: "invalid_request" });
        const [rows] = await getPool().query<RowDataPacket[]>(
          `SELECT id, user_id FROM mcp_oauth_tokens
           WHERE refresh_token_hash = ? AND client_id = ? AND revoked_at IS NULL
             AND refresh_expires_at IS NOT NULL AND refresh_expires_at > NOW()
           LIMIT 1`,
          [sha256Hex(refresh), clientId],
        );
        if (!rows[0] || !(await loadStaffUser(Number(rows[0].user_id)))) {
          return res.status(400).json({ error: "invalid_grant" });
        }
        const access = mcpRandomSecret();
        const newRefresh = mcpRandomSecret();
        // Rotation guarded by the old hash: a replayed refresh token loses the race
        const [upd] = await getPool().query<ResultSetHeader>(
          `UPDATE mcp_oauth_tokens
           SET token_hash = ?, refresh_token_hash = ?,
               expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
               refresh_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
               last_used_at = NOW()
           WHERE id = ? AND refresh_token_hash = ? AND revoked_at IS NULL`,
          [sha256Hex(access), sha256Hex(newRefresh), MCP_ACCESS_TTL_SEC, MCP_REFRESH_TTL_SEC, rows[0].id, sha256Hex(refresh)],
        );
        if (!upd.affectedRows) return res.status(400).json({ error: "invalid_grant" });
        return mcpTokenResponse(res, access, newRefresh);
      }

      if (grantType !== "authorization_code") return res.status(400).json({ error: "unsupported_grant_type" });
      const code = mcpStr(req.body?.code);
      const redirectUri = mcpStr(req.body?.redirect_uri);
      const verifier = mcpStr(req.body?.code_verifier);
      if (!code || !redirectUri || !verifier) return res.status(400).json({ error: "invalid_request" });
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT id, user_id, redirect_uri, code_challenge FROM mcp_oauth_codes
         WHERE code_hash = ? AND client_id = ? AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1`,
        [sha256Hex(code), clientId],
      );
      const row = rows[0];
      if (!row || String(row.redirect_uri) !== redirectUri || !verifyPkceS256(verifier, String(row.code_challenge))) {
        return res.status(400).json({ error: "invalid_grant" });
      }
      // Single use: consume atomically before issuing
      const [consumed] = await getPool().query<ResultSetHeader>(
        "UPDATE mcp_oauth_codes SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL",
        [row.id],
      );
      if (!consumed.affectedRows) return res.status(400).json({ error: "invalid_grant" });
      if (!(await loadStaffUser(Number(row.user_id)))) return res.status(400).json({ error: "invalid_grant" });
      const access = mcpRandomSecret();
      const refresh = mcpRandomSecret();
      await getPool().query(
        `INSERT INTO mcp_oauth_tokens
           (token_hash, refresh_token_hash, client_id, client_name, user_id, scopes, expires_at, refresh_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), DATE_ADD(NOW(), INTERVAL ? SECOND))`,
        [
          sha256Hex(access),
          sha256Hex(refresh),
          clientId,
          String(client.client_name || "Cliente MCP"),
          row.user_id,
          MCP_SCOPE,
          MCP_ACCESS_TTL_SEC,
          MCP_REFRESH_TTL_SEC,
        ],
      );
      return mcpTokenResponse(res, access, refresh);
    } catch (err) {
      console.error("[mcp] token", err);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // RFC 7009: always 200
  app.post("/api/mcp/oauth/revoke", async (req, res) => {
    try {
      const token = mcpStr(req.body?.token);
      if (token) {
        const hash = sha256Hex(token);
        await getPool().query(
          "UPDATE mcp_oauth_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL AND (token_hash = ? OR refresh_token_hash = ?)",
          [hash, hash],
        );
      }
    } catch (err) {
      console.error("[mcp] revoke", err);
    }
    return res.json({ revoked: true });
  });

  // My connections (profile page)
  app.get("/api/admin/me/mcp-connections", requireAdminAuth, async (req, res) => {
    try {
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT id, client_id, client_name, scopes, created_at, last_used_at, expires_at, refresh_expires_at
         FROM mcp_oauth_tokens
         WHERE user_id = ? AND revoked_at IS NULL AND refresh_expires_at > NOW()
         ORDER BY id DESC LIMIT 50`,
        [req.adminUser!.userId],
      );
      res.json({
        success: true,
        data: {
          connector_url: mcpResourceUrl(mcpOrigin()),
          connections: rows.map((r) => ({
            id: Number(r.id),
            client_id: String(r.client_id),
            client_name: r.client_name ? String(r.client_name) : "Cliente MCP",
            scopes: String(r.scopes || MCP_SCOPE),
            created_at: toIso(r.created_at),
            last_used_at: toIso(r.last_used_at),
            expires_at: toIso(r.expires_at),
            refresh_expires_at: toIso(r.refresh_expires_at),
          })),
        },
      });
    } catch (err: any) {
      if (err?.code === "ER_NO_SUCH_TABLE") {
        return res.json({ success: true, data: { connector_url: mcpResourceUrl(mcpOrigin()), connections: [] } });
      }
      res.status(500).json({ success: false, message: "No se pudieron cargar las conexiones", ...devError(err) });
    }
  });

  app.delete("/api/admin/me/mcp-connections/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(String(req.params.id));
      if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: "Invalid id" });
      const [result] = await getPool().query<ResultSetHeader>(
        "UPDATE mcp_oauth_tokens SET revoked_at = NOW() WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
        [id, req.adminUser!.userId],
      );
      if (!result.affectedRows) return res.status(404).json({ success: false, message: "Conexión no encontrada" });
      await audit(getPool(), { ...auditFrom(req), action: "mcp.revoke", entityType: "mcp_token", entityId: id });
      res.json({ success: true, data: { id } });
    } catch (err) {
      res.status(500).json({ success: false, message: "No se pudo revocar", ...devError(err) });
    }
  });
}

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
  // MCP/OAuth discovery needs open CORS (bearer tokens only) — before cors()
  expressApp.use(mcpCors);
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
      !req.path.startsWith("/api/mcp") &&
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
    "/api/admin/articles/slug-available",
    requireAdminAuth,
    handleAdminSlugAvailable,
  );

  // Review workflow (approvals: admin only)
  expressApp.get("/api/admin/reviews", requireAdminAuth, requireAdmin, handleAdminGetReviews);
  expressApp.post(
    "/api/admin/articles/:id/approve",
    requireAdminAuth,
    requireAdmin,
    handleAdminApproveArticle,
  );
  expressApp.post(
    "/api/admin/articles/:id/return",
    requireAdminAuth,
    requireAdmin,
    handleAdminReturnArticle,
  );
  expressApp.post(
    "/api/admin/revisions/:revId/approve",
    requireAdminAuth,
    requireAdmin,
    handleAdminApproveRevision,
  );
  expressApp.post(
    "/api/admin/revisions/:revId/reject",
    requireAdminAuth,
    requireAdmin,
    handleAdminRejectRevision,
  );
  expressApp.get("/api/admin/articles/:id/notes", requireAdminAuth, handleAdminGetArticleNotes);

  // Notifications (per signed-in user)
  expressApp.get("/api/admin/notifications", requireAdminAuth, handleAdminGetNotifications);
  expressApp.post(
    "/api/admin/notifications/read-all",
    requireAdminAuth,
    handleAdminReadAllNotifications,
  );
  expressApp.post(
    "/api/admin/notifications/:id/read",
    requireAdminAuth,
    handleAdminReadNotification,
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
  expressApp.get(
    "/api/admin/authors/slug-available",
    requireAdminAuth,
    requireAdmin,
    handleAdminAuthorSlugAvailable,
  );
  expressApp.post(
    "/api/admin/authors/:id/access",
    requireAdminAuth,
    requireAdmin,
    handleAdminGrantAuthorAccess,
  );
  expressApp.delete(
    "/api/admin/authors/:id/access",
    requireAdminAuth,
    requireAdmin,
    handleAdminRevokeAuthorAccess,
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

  // Comments: admins see all; authors moderate their own articles' comments
  expressApp.get("/api/admin/comments", requireAdminAuth, handleAdminGetComments);
  expressApp.post("/api/admin/comments/bulk", requireAdminAuth, handleAdminBulkComments);
  expressApp.post("/api/admin/comments/:id/reply", requireAdminAuth, handleAdminReplyComment);
  expressApp.patch("/api/admin/comments/:id", requireAdminAuth, handleAdminPatchComment);
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

  // Remote MCP + OAuth (also /.well-known/* via vercel.json rewrite)
  registerMcpRoutes(expressApp);

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
