/**
 * MCP content helpers: Markdown → sanitized HTML and SSRF-safe image fetch.
 *
 * markdown-it@14 ships a CommonJS build (dist/index.cjs.js) → loads under
 * Vercel's CJS runtime with require(esm) disabled (npm run check:api-runtime).
 */
import dns from "dns/promises";
import https from "https";
import net from "net";
import MarkdownIt from "markdown-it";
import sharp from "sharp";
import { sanitizeRichHtml } from "./security.js";

// html:false → raw HTML inside Markdown is escaped, never passed through.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });

/** Markdown → HTML, then the same allow-list sanitizer as the admin editor. */
export function markdownToSafeHtml(markdown: string): string {
  // H1 is reserved for the article title: demote "# x" to H2.
  const rendered = md.render(String(markdown ?? "")).replace(/<(\/?)h1>/g, "<$1h2>");
  return sanitizeRichHtml(rendered);
}

/** Content in either format → sanitized HTML. */
export function contentToSafeHtml(content: string, format: "markdown" | "html"): string {
  return format === "markdown" ? markdownToSafeHtml(content) : sanitizeRichHtml(content);
}

// ── SSRF guard ───────────────────────────────────────────────

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local + cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

/** True when the IP literal is private, loopback, link-local, metadata or otherwise non-public. */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const n = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (kind === 6) {
    const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
    // IPv4-mapped / compatible (::ffff:a.b.c.d)
    const mapped = v.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    const hexMapped = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isBlockedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (v === "::" || v === "::1") return true;
    const first = parseInt(v.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (v.startsWith("64:ff9b:")) return true; // NAT64 can reach v4 internals
    if (v.startsWith("2001:db8:")) return true; // documentation
    if (v.startsWith("fd00:ec2::254")) return true; // AWS metadata v6
    return false;
  }
  return true; // not an IP → refuse
}

export type ResolvedTarget = { url: URL; address: string; family: 4 | 6 };

export class SsrfError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

type Lookup = (host: string) => Promise<Array<{ address: string; family: number }>>;
const defaultLookup: Lookup = (host) => dns.lookup(host, { all: true, verbatim: true });

/** Validates an https URL and resolves it; every resolved address must be public. */
export async function assertPublicHttpsUrl(raw: string, lookup: Lookup = defaultLookup): Promise<ResolvedTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("invalid_url");
  }
  if (url.protocol !== "https:") throw new SsrfError("https_only");
  if (url.username || url.password) throw new SsrfError("credentials_not_allowed");
  if (url.port && url.port !== "443") throw new SsrfError("port_not_allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new SsrfError("host_not_allowed");
  }
  let addrs: Array<{ address: string; family: number }>;
  if (net.isIP(host)) addrs = [{ address: host, family: net.isIP(host) }];
  else {
    try {
      addrs = await lookup(host);
    } catch {
      throw new SsrfError("dns_failed");
    }
  }
  if (!addrs.length) throw new SsrfError("dns_failed");
  if (addrs.some((a) => isBlockedIp(a.address))) throw new SsrfError("private_address");
  return { url, address: addrs[0].address, family: addrs[0].family === 6 ? 6 : 4 };
}

export const MCP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Downloads an image over https with the connection PINNED to the validated IP
 * (no DNS rebinding), manual redirects (each hop re-validated), 10 MB cap,
 * image/* content type and a timeout.
 */
export async function fetchPublicImage(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; lookup?: Lookup } = {},
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const maxBytes = opts.maxBytes ?? MCP_IMAGE_MAX_BYTES;
  let current = raw;
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    const target = await assertPublicHttpsUrl(current, opts.lookup);
    const result = await new Promise<
      { redirect: string } | { buffer: Buffer; contentType: string }
    >((resolve, reject) => {
      const req = https.request(
        {
          protocol: "https:",
          hostname: target.url.hostname.replace(/^\[|\]$/g, ""),
          servername: net.isIP(target.url.hostname) ? undefined : target.url.hostname,
          port: 443,
          path: `${target.url.pathname}${target.url.search}`,
          method: "GET",
          headers: { "User-Agent": "IntelinotaMCP/1.0", Accept: "image/*" },
          // Pin to the validated address
          lookup: (_h: string, _o: unknown, cb: (e: Error | null, a: string, f: number) => void) =>
            cb(null, target.address, target.family),
          timeout: opts.timeoutMs ?? 15_000,
        } as any,
        (resp) => {
          const status = resp.statusCode ?? 0;
          if (status >= 300 && status < 400 && resp.headers.location) {
            resp.resume();
            resolve({ redirect: new URL(resp.headers.location, target.url).toString() });
            return;
          }
          if (status !== 200) {
            resp.resume();
            reject(new SsrfError(`http_${status}`));
            return;
          }
          const ct = String(resp.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
          if (!ct.startsWith("image/") || ct === "image/svg+xml") {
            resp.resume();
            reject(new SsrfError("not_an_image"));
            return;
          }
          const declared = Number(resp.headers["content-length"] || 0);
          if (declared > maxBytes) {
            resp.destroy();
            reject(new SsrfError("too_large"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          resp.on("data", (c: Buffer) => {
            size += c.length;
            if (size > maxBytes) {
              resp.destroy();
              reject(new SsrfError("too_large"));
              return;
            }
            chunks.push(c);
          });
          resp.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: ct }));
          resp.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new SsrfError("timeout")));
      req.on("error", reject);
      req.end();
    });
    if ("redirect" in result) {
      current = result.redirect;
      continue;
    }
    return { ...result, finalUrl: current };
  }
  throw new SsrfError("too_many_redirects");
}

/**
 * Normalizes a fetched image for the existing upload pipeline (jpeg/png/webp,
 * ≤ maxBytes). Re-encodes other formats or oversized files with sharp.
 */
export async function normalizeImageForUpload(
  buffer: Buffer,
  contentType: string,
  maxBytes: number,
): Promise<{ buffer: Buffer; mime: string }> {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (allowed.has(contentType) && buffer.length <= maxBytes) return { buffer, mime: contentType };
  for (const width of [2400, 1800, 1200]) {
    const out = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    if (out.length <= maxBytes) return { buffer: out, mime: "image/jpeg" };
  }
  throw new SsrfError("too_large");
}
