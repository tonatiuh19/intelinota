/**
 * Post-login return path allowlist (AdminLogin `?return=`): only the MCP
 * consent page, same-origin. Mirrors mcpReturnPathAllowed in api/_lib/mcpOAuth.ts
 * (the API cannot import shared/ — see scripts/check-api-inline.ts).
 */
export const MCP_CONSENT_PATH = "/admin/mcp-consent";

export function safeAdminReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 4000) return null;
  if (!raw.startsWith(MCP_CONSENT_PATH)) return null;
  if (/[\\\r\n\t]/.test(raw) || raw.startsWith("//")) return null;
  try {
    const base = "https://www.intelinota.com";
    const u = new URL(raw, base);
    if (u.origin !== base || u.pathname !== MCP_CONSENT_PATH) return null;
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}
