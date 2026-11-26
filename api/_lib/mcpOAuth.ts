/**
 * Remote MCP (Streamable HTTP) + OAuth 2.1 helpers for Intelinota.
 *
 * Pure functions only (no DB, no Express app) so they are unit-testable.
 * Architecture ported from groundwork/api/index.ts (OAuth metadata, redirect
 * allowlist, Claude JSON-RPC sanitizers, JSON-schema → zod, write confirm).
 */
import crypto from "crypto";
import { z } from "zod";

/** Product scope — never bare "mcp" (Claude may discard such tokens). */
export const MCP_SCOPE = "intelinota.newsroom";
export const MCP_ACCESS_TTL_SEC = 3600;
export const MCP_REFRESH_TTL_SEC = 30 * 24 * 3600;
export const MCP_CODE_TTL_MS = 10 * 60_000;

/** Canonical public origin, without trailing slash (BASE_URL in prod). */
export function mcpCanonicalOrigin(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function mcpResourceUrl(origin: string): string {
  return `${origin}/api/mcp`;
}

export function mcpAuthorizationServerMetadata(origin: string) {
  const issuer = mcpResourceUrl(origin);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [MCP_SCOPE],
    resource_indicator_parameter_supported: true,
  };
}

export function mcpProtectedResourceMetadata(origin: string) {
  const resource = mcpResourceUrl(origin);
  return {
    resource,
    authorization_servers: [resource],
    bearer_methods_supported: ["header"],
    scopes_supported: [MCP_SCOPE],
    resource_name: "Intelinota Redacción",
  };
}

export function mcpWwwAuthenticate(origin: string): string {
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="${MCP_SCOPE}"`;
}

/** sha256 hex — tokens/codes are stored only as hashes. */
export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** Opaque random secret (hex). */
export function mcpRandomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  // RFC 7636: verifier is 43–128 unreserved chars
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const dig = crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
  const a = Buffer.from(dig);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseBearerAuthorization(header: string | undefined | null): string | null {
  if (!header) return null;
  const m = String(header).match(/^\s*Bearer\s+(\S+)\s*$/i);
  if (!m) return null;
  const tok = m[1];
  if (!tok || tok === "undefined" || tok === "null") return null;
  return tok;
}

/**
 * Post-login return path allowlist (AdminLogin `?return=`). Only the MCP
 * consent page, same-origin, no protocol-relative / backslash tricks.
 */
export function mcpReturnPathAllowed(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw) return false;
  if (raw.length > 4000) return false;
  if (!raw.startsWith("/admin/mcp-consent")) return false;
  if (/[\\\r\n\t]/.test(raw) || raw.startsWith("//")) return false;
  try {
    const u = new URL(raw, "https://www.intelinota.com");
    return u.origin === "https://www.intelinota.com" && u.pathname === "/admin/mcp-consent";
  } catch {
    return false;
  }
}

// ── Redirect URI allowlist ───────────────────────────────────

export const KNOWN_MCP_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  "cursor://anysphere.cursor-mcp/oauth/callback",
  "https://www.cursor.com/agents/mcp/oauth/callback",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseMcpRedirectUris(json: unknown): string[] {
  if (Array.isArray(json)) return json.map(String);
  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Loopback redirects may differ only in port (RFC 8252 §7.3). */
function loopbackRedirectOk(requested: string, registered: string): boolean {
  try {
    const req = new URL(requested);
    const reg = new URL(registered);
    if (!LOOPBACK_HOSTS.has(req.hostname) || !LOOPBACK_HOSTS.has(reg.hostname)) return false;
    return (
      req.protocol === "http:" &&
      req.protocol === reg.protocol &&
      req.hostname === reg.hostname &&
      req.pathname === reg.pathname &&
      req.search === reg.search
    );
  } catch {
    return false;
  }
}

function httpsRedirectPathOk(host: string, pathname: string): boolean {
  const h = host.toLowerCase();
  const p = pathname || "/";
  if (["claude.ai", "www.claude.ai", "claude.com", "www.claude.com"].includes(h)) {
    return p === "/api/mcp/auth_callback" || p.startsWith("/api/mcp/auth_callback/");
  }
  if (h === "cursor.com" || h === "www.cursor.com") {
    return p === "/agents/mcp/oauth/callback" || p.startsWith("/agents/mcp/oauth/callback/");
  }
  return false;
}

/** DCR: Claude/Cursor callback paths, loopback http, or cursor: — never arbitrary https. */
export function mcpRedirectUriOkForRegistration(uri: string): boolean {
  if (typeof uri !== "string" || uri.length > 1000) return false;
  try {
    const u = new URL(uri);
    if (u.username || u.password) return false;
    if (u.hash) return false;
    if (u.protocol === "cursor:") return u.hostname === "anysphere.cursor-mcp";
    if (u.protocol === "http:") return LOOPBACK_HOSTS.has(u.hostname);
    if (u.protocol === "https:") {
      if (u.port) return false;
      return httpsRedirectPathOk(u.hostname, u.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

/** Authorize/approve/token: must be registered (exact, or loopback port variant) AND still safe. */
export function mcpRedirectUriAllowed(requested: string, registered: string[]): boolean {
  if (!requested || !mcpRedirectUriOkForRegistration(requested)) return false;
  return registered.some((r) => r === requested || loopbackRedirectOk(requested, r));
}

// ── Write confirmation ───────────────────────────────────────

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Writes need BOTH confirm=true and confirm_phrase=CONFIRM (phrase alone never executes). */
export function mcpWriteConfirmed(args: Record<string, unknown>): boolean {
  const c = args.confirm;
  const confirmed =
    c === true || c === 1 || c === "1" || (typeof c === "string" && c.toLowerCase() === "true");
  return confirmed && str(args.confirm_phrase) === "CONFIRM";
}

export function mcpLimit(args: Record<string, unknown>, def = 20, max = 50): number {
  const n = Number(args.limit ?? def);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
}

export function mcpPage(args: Record<string, unknown>): number {
  const n = Number(args.page ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 10_000);
}

// ── Tool definitions plumbing ────────────────────────────────

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  adminOnly?: boolean;
};

const MCP_CONFIRM_PROPERTIES: Record<string, Record<string, unknown>> = {
  confirm: {
    type: "boolean",
    description:
      "true SOLO después de que el usuario aprobó la vista previa (dry-run). Requiere también confirm_phrase=CONFIRM.",
  },
  confirm_phrase: {
    type: "string",
    description: "Obligatorio con confirm=true. Debe ser exactamente CONFIRM.",
  },
};

export function withMcpWriteConfirm(tool: McpToolDef): McpToolDef {
  if (tool.readOnly) return tool;
  const props =
    tool.inputSchema.properties && typeof tool.inputSchema.properties === "object"
      ? { ...(tool.inputSchema.properties as Record<string, unknown>) }
      : {};
  return {
    ...tool,
    description: `${tool.description} SIEMPRE primero en modo vista previa (sin confirm): muestra la vista previa al usuario y, solo si la aprueba, vuelve a llamar con confirm=true y confirm_phrase=CONFIRM.`,
    inputSchema: { ...tool.inputSchema, type: "object", properties: { ...props, ...MCP_CONFIRM_PROPERTIES } },
  };
}

export function mcpJsonSchemaToZod(
  inputSchema: Record<string, unknown>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const props =
    inputSchema.properties && typeof inputSchema.properties === "object" && !Array.isArray(inputSchema.properties)
      ? (inputSchema.properties as Record<string, Record<string, unknown>>)
      : {};
  const required = new Set(Array.isArray(inputSchema.required) ? inputSchema.required.map(String) : []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(props)) {
    const p = prop || {};
    let base: z.ZodTypeAny;
    if (Array.isArray(p.enum) && p.enum.length > 0) {
      base = z.enum(p.enum.map(String) as [string, ...string[]]);
    } else if (p.type === "integer") {
      base = z.coerce.number().int();
    } else if (p.type === "number") {
      base = z.coerce.number();
    } else if (p.type === "boolean") {
      base = z.preprocess((v) => {
        if (v === true || v === "true" || v === 1 || v === "1") return true;
        if (v === false || v === "false" || v === 0 || v === "0") return false;
        return v;
      }, z.boolean());
    } else if (p.type === "array") {
      const items = (p.items || {}) as Record<string, unknown>;
      if (items.type === "integer") base = z.array(z.coerce.number().int());
      else if (items.type === "number") base = z.array(z.coerce.number());
      else base = z.array(z.string());
    } else {
      base = z.string();
    }
    if (typeof p.description === "string" && p.description) base = base.describe(p.description);
    shape[key] = required.has(key) ? base : base.optional();
  }
  return z.object(shape);
}

/** Claude-safe tool list: name + description + plain JSON Schema only. */
export function mcpToolsListForClaude(tools: McpToolDef[]) {
  return tools.map((t) => {
    const schema: Record<string, unknown> = { ...(t.inputSchema || {}) };
    delete schema.$schema;
    if (!schema.type) schema.type = "object";
    if (!schema.properties) schema.properties = {};
    return { name: t.name, description: t.description, inputSchema: schema };
  });
}

/**
 * Claude (web/mobile) drops whole tool catalogs when tools/list includes newer
 * fields (`execution`, `annotations`, `title`, `outputSchema`) or JSON Schema
 * metadata. Keep wire responses to { name, description, inputSchema }.
 */
export function sanitizeMcpJsonRpcForClaude(raw: string): string {
  if (!raw) return raw;
  const t = raw.trimStart();
  if (!t.startsWith("{") && !t.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    let changed = false;
    for (const msg of messages) {
      if (!msg || typeof msg !== "object") continue;
      const r = (msg as Record<string, unknown>).result;
      if (!r || typeof r !== "object") continue;
      const result = r as Record<string, unknown>;
      if (Array.isArray(result.tools)) {
        result.tools = result.tools.map((tool) => {
          if (!tool || typeof tool !== "object") return tool;
          const tt = tool as Record<string, unknown>;
          const inputSchema: Record<string, unknown> =
            tt.inputSchema && typeof tt.inputSchema === "object" && !Array.isArray(tt.inputSchema)
              ? { ...(tt.inputSchema as Record<string, unknown>) }
              : { type: "object", properties: {} };
          delete inputSchema.$schema;
          const ap = inputSchema.additionalProperties;
          if (ap && typeof ap === "object" && !Array.isArray(ap) && Object.keys(ap).length === 0) {
            delete inputSchema.additionalProperties;
          }
          return { name: tt.name, description: tt.description, inputSchema };
        });
        changed = true;
      }
      const caps = result.capabilities;
      if (caps && typeof caps === "object") {
        const c = caps as Record<string, unknown>;
        if (c.tools && typeof c.tools === "object" && Object.keys(c.tools as object).length > 0) {
          c.tools = {};
          changed = true;
        }
      }
      if ("instructions" in result) {
        delete result.instructions;
        changed = true;
      }
    }
    if (!changed) return raw;
    return JSON.stringify(Array.isArray(parsed) ? messages : messages[0]);
  } catch {
    return raw;
  }
}

const SECRET_KEYS = /token|secret|password|authorization|code_verifier|data_base64/i;

/** Redacts secrets and truncates long strings before writing mcp_audit_logs. */
export function redactMcpArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (SECRET_KEYS.test(k)) out[k] = "[redacted]";
    else if (typeof v === "string" && v.length > 800) out[k] = `[omitted, ${v.length} chars]`;
    else out[k] = v;
  }
  return out;
}

/** Truncates the JSON result stored in the audit log. */
export function auditResultJson(result: unknown, max = 8000): string {
  let s: string;
  try {
    s = JSON.stringify(result ?? null);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
  return s.length > max ? JSON.stringify({ truncated: true, chars: s.length }) : s;
}

/** HTML → plain text (compact, for get_article and word counts). */
export function htmlToPlainText(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|figcaption|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function wordCount(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

export function truncateText(text: unknown, max: number): string | null {
  if (text == null) return null;
  const s = String(text);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Parses a publish time. ISO with Z/offset is absolute; a naive
 * "YYYY-MM-DDTHH:mm[:ss]" is wall-clock time in the newsroom timezone.
 * Returns null when unparseable.
 */
export function parseNewsroomDateTime(input: unknown, timeZone: string): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const s = input.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number) as unknown as number[];
  const wall = Date.UTC(y, mo - 1, d, h, mi, se || 0);
  const offsetAt = (utcMs: number): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return asUtc - utcMs;
  };
  try {
    let utc = wall - offsetAt(wall);
    utc = wall - offsetAt(utc);
    const out = new Date(utc);
    return Number.isFinite(out.getTime()) ? out : null;
  } catch {
    return null;
  }
}
