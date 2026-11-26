# Intelinota Remote MCP

Remote MCP server (Streamable HTTP, stateless, JSON responses) that lets Claude,
Cursor and other MCP clients work in the newsroom **with exactly the signed-in
user's rights**.

- **Connector URL:** `https://www.intelinota.com/api/mcp`
- **Scope:** `intelinota.newsroom`
- **Who can connect:** `users.role IN ('admin','author')` (revalidated on every call)

## Connect

**Claude** (web/desktop/mobile): Settings → Customize → Connectors → *Add custom
connector* → paste the URL → Connect → sign in with the email code → Autorizar.

**Cursor**: `.cursor/mcp.json` (already in the repo):

```json
{ "mcpServers": { "intelinota": { "url": "https://www.intelinota.com/api/mcp" } } }
```

Then click *Needs login* in Cursor's MCP settings.

Users see and revoke their connections in **Perfil → Conexiones de IA (MCP)**.

## Architecture

| Piece | Where |
| --- | --- |
| OAuth metadata, redirect allowlist, PKCE, hashing, Claude sanitizers, JSON-schema→zod, confirm | `api/_lib/mcpOAuth.ts` |
| Markdown→HTML (markdown-it, `html:false`, then `sanitizeRichHtml`), SSRF-safe image fetch | `api/_lib/mcpContent.ts` |
| Tool catalog + prompts | `api/_lib/mcpTools.ts` |
| Auth, routes, `executeMcpTool`, in-process handler invocation | `api/index.ts` (`REMOTE MCP` section) |
| Consent page / slice / profile card | `client/pages/admin/McpConsent.tsx`, `client/store/slices/adminMcpSlice.ts`, `client/components/admin/McpConnectionsCard.tsx` |
| Migration | `database/migrations/20261126_150000_mcp_oauth.sql` |

**Permissions = the user's rights.** Each tool builds a fake `req` with
`adminUser {userId, email, role, authorId, canPublish}` and calls the *same*
Express handler as the admin UI (`invokeAsUser`). Author scoping, `can_publish`,
live-edit → pending review (202), sanitization, revisions, slug redirects,
notifications, `audit_log`, 409 conflicts and comment scoping are therefore
identical. Admin-only tools run `requireAdmin` first, like their routes.
Every tool call also writes `mcp_audit_logs` (args redacted/truncated).

**Writes** always dry-run first; execution requires `confirm=true` **and**
`confirm_phrase="CONFIRM"`. Rate limit: 60 tool calls/min per user (in-memory).

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/.well-known/oauth-authorization-server[/api/mcp]`, `/.well-known/openid-configuration[/api/mcp]` | AS metadata (issuer `…/api/mcp`) |
| GET | `/.well-known/oauth-protected-resource[/api/mcp]` | RFC 9728 |
| POST | `/api/mcp` | MCP JSON-RPC (Bearer). GET → 405, OPTIONS → 204 CORS |
| POST | `/api/mcp/oauth/register` | DCR; redirect URIs must be Claude/Cursor callbacks, loopback http or `cursor://` |
| GET | `/api/mcp/oauth/authorize` | Validates client/redirect/PKCE → `/admin/mcp-consent` |
| GET | `/api/admin/mcp/oauth/client` | Consent data (admin JWT) |
| POST | `/api/admin/mcp/oauth/approve` | Issues single-use hashed code (10 min) |
| POST | `/api/mcp/oauth/token` | `authorization_code` (PKCE S256) / `refresh_token` (rotating) |
| POST | `/api/mcp/oauth/revoke` | RFC 7009 |
| GET/DELETE | `/api/admin/me/mcp-connections[/:id]` | List / revoke my connections |

Tokens: opaque 256-bit hex, stored as sha256. Access 1 h, refresh 30 d (rotated on
every use; replay of an old refresh token fails). Bearer fallback: an admin-panel
JWT is also accepted (verified with `JWT_SECRET` + DB revalidation).

Login: `/admin/mcp-consent` sends unauthenticated users to
`/admin/login?return=…`; `safeAdminReturnPath` (shared/mcp.ts) only allows
`/admin/mcp-consent…`.

## Tools

Read: `whoami`, `list_articles`, `get_article`, `search_published`,
`list_categories`, `list_authors`, `list_tags`, `get_article_revisions`,
`list_review_queue`*, `get_review_notes`, `list_comments`, `list_notifications`,
`get_dashboard_stats`, `get_audit_log`*, `check_slug`.

Write: `create_draft`, `update_article`, `submit_for_review`, `publish_article`,
`archive_article`, `restore_revision`, `upload_image_from_url`, `set_featured`*,
`approve_article`*, `return_article`*, `approve_pending_edit`*,
`reject_pending_edit`*, `moderate_comments`, `reply_to_comment`,
`mark_notifications_read`. (* admin only — hidden from authors' `tools/list`.)

Prompts: `redactar_nota`, `revisar_nota`, `moderar_comentarios`.

`upload_image_from_url`: https only, port 443, DNS resolved and **every** address
must be public (blocks private, loopback, link-local, CGNAT, metadata
169.254.169.254, ULA, mapped IPv6), connection pinned to the validated IP,
redirects re-validated (max 3), `image/*` (no SVG), ≤ 10 MB, then normalized with
sharp to ≤ 5 MB jpeg/png/webp and passed to the existing `handleAdminUpload`.

## Vercel runtime (CommonJS)

The API loads as CJS with `require(esm)` disabled. Verified compatible and
**pinned exactly**: `@modelcontextprotocol/sdk@1.31.0` (`exports.require` →
`dist/cjs/*`, pulls `@hono/node-server` CJS) and `markdown-it@14.3.3`
(`dist/index.cjs.js`). Before bumping either, run `npm run check:api-runtime`
*and* an end-to-end initialize/tools/call under
`node --no-experimental-require-module` (module load alone does not exercise
the transport).

## Tests

- `api/_lib/mcp.security.spec.ts` — no DB: redirect allowlist, PKCE, hashing,
  return-path allowlist, SSRF guard, Markdown sanitization, catalog/confirm.
- `api/_lib/mcp.integration.spec.ts` — skipped unless `MCP_INTEGRATION_URL` is set
  (`MCP_TEST_TOKEN` adds an authenticated read-only round trip).
