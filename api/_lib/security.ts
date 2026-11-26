import crypto from "crypto";
import sanitizeHtmlLib from "sanitize-html";
import type express from "express";

/** Allow-list for editorial rich HTML (TipTap output). */
const RICH_HTML_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i",
    "u", "s", "mark", "span", "sub", "sup", "blockquote", "pre", "code",
    "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead",
    "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
    td: ["colspan", "rowspan", "style"],
    th: ["colspan", "rowspan", "style"],
    col: ["style"],
    "*": ["class", "style", "data-color"],
  },
  // Arbitrary classes would let authors apply site CSS (e.g. "fixed inset-0")
  allowedClasses: {
    "*": ["text-left", "text-center", "text-right", "text-justify", "tableWrapper", "selectedCell"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "text-align": [/^(left|right|center|justify)$/],
      "min-width": [/^\d+(px|%)$/],
      width: [/^\d+(px|%)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedIframeHostnames: [
    "www.youtube.com",
    "www.youtube-nocookie.com",
    "player.vimeo.com",
    "open.spotify.com",
    "platform.twitter.com",
  ],
  // Drop iframes whose src was removed (non-whitelisted host)
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.target === "_blank"
          ? { rel: "noopener noreferrer nofollow" }
          : {}),
      },
    }),
  },
};

export function sanitizeRichHtml(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  return sanitizeHtmlLib(html, RICH_HTML_OPTIONS);
}

/** Strips every tag — for user-generated plain text (comments, names). */
export function sanitizePlainText(text: unknown, maxLen = 5000): string {
  if (typeof text !== "string") return "";
  // Strip tags, then decode the entities sanitize-html adds: the result is
  // rendered as React text (auto-escaped), so encoded output would show as
  // "&amp;" to readers.
  return decodeEntities(
    sanitizeHtmlLib(text, { allowedTags: [], allowedAttributes: {} }),
  )
    .trim()
    .slice(0, maxLen);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const URL_KEYS = new Set(["url", "src", "href", "link", "embed_url", "post_url", "tweet_url"]);

function sanitizeUrl(value: string): string {
  const v = value.trim();
  if (/^(https?:|mailto:|\/(?!\/))/i.test(v)) return v;
  return "";
}

/** Sanitizes a content block's data object, whatever its type. */
export function sanitizeBlockData(
  type: string,
  data: unknown,
): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === "object"
          ? sanitizeBlockData(type, item)
          : typeof item === "string"
            ? sanitizePlainText(item, 20000)
            : item,
      );
    } else if (value && typeof value === "object") {
      out[key] = sanitizeBlockData(type, value);
    } else if (typeof value !== "string") {
      out[key] = value;
    } else if (type === "html" && key === "html") {
      out[key] = sanitizeRichHtml(value);
    } else if (URL_KEYS.has(key)) {
      out[key] = sanitizeUrl(value);
    } else if (key === "video_id") {
      out[key] = /^[\w-]{6,20}$/.test(value.trim()) ? value.trim() : "";
    } else {
      out[key] = sanitizePlainText(value, 20000);
    }
  }
  return out;
}

/** Cryptographically secure 6-digit OTP. */
export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function otpSecret(): string {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("OTP_SECRET (or JWT_SECRET) must be set");
  return secret;
}

/** HMAC-SHA256 so a DB leak cannot be brute-forced offline. */
export function hashOtp(code: string, email: string): string {
  return crypto
    .createHmac("sha256", otpSecret())
    .update(`${email.toLowerCase().trim()}:${code.trim()}`)
    .digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Client IP that cannot be spoofed on Vercel: x-real-ip / x-vercel-forwarded-for
 * are set by the edge. Falls back to the LAST X-Forwarded-For hop (added by
 * our proxy), never the first (client-controlled).
 */
export function getRequestIp(req: express.Request): string {
  const vercel = req.headers["x-vercel-forwarded-for"];
  if (typeof vercel === "string" && vercel) return vercel.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real) return real.trim();
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export function hashIp(ip: string): string {
  const salt = process.env.VISITORS_SALT || process.env.JWT_SECRET;
  if (!salt) throw new Error("VISITORS_SALT must be set");
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Simple in-memory sliding window limiter (per serverless instance). */
const buckets = new Map<string, number[]>();
export function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return hits.length > limit;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
