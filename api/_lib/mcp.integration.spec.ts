/**
 * Live-server MCP checks. Skipped unless MCP_INTEGRATION_URL is set, e.g.
 *   MCP_INTEGRATION_URL=http://localhost:8080 npm test -- mcp.integration
 * Optional MCP_TEST_TOKEN (OAuth access token or admin JWT) runs the
 * authenticated initialize + tools/list + whoami round trip (read-only).
 */
import { describe, expect, it } from "vitest";

const BASE = process.env.MCP_INTEGRATION_URL?.replace(/\/+$/, "");
const TOKEN = process.env.MCP_TEST_TOKEN;
const live = BASE ? describe : describe.skip;

const rpc = async (body: unknown, token?: string) =>
  fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

live("MCP OAuth (live server)", () => {
  it("serves discovery metadata", async () => {
    const as = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
    expect(as.scopes_supported).toContain("intelinota.newsroom");
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    const pr = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`)).json();
    expect(pr.resource).toMatch(/\/api\/mcp$/);
  });

  it("challenges unauthenticated MCP calls", async () => {
    const r = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain("resource_metadata=");
    const bad = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "deadbeef");
    expect(bad.status).toBe(401);
  });

  it("rejects DCR with arbitrary redirect URIs", async () => {
    const r = await fetch(`${BASE}/api/mcp/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "x", redirect_uris: ["https://evil.example/cb"] }),
    });
    expect(r.status).toBe(400);
  });

  it("rejects unknown codes at the token endpoint", async () => {
    const r = await fetch(`${BASE}/api/mcp/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: "nope", code: "x", redirect_uri: "x", code_verifier: "x" }),
    });
    expect([400, 401]).toContain(r.status);
  });

  (TOKEN ? it : it.skip)("initialize + tools/list + whoami", async () => {
    const init = await rpc(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "it", version: "1" } } },
      TOKEN,
    );
    expect(init.status).toBe(200);
    const list = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, TOKEN)).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("whoami");
    for (const t of list.result.tools) expect(Object.keys(t).sort()).toEqual(["description", "inputSchema", "name"]);
    const who = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whoami", arguments: {} } }, TOKEN)).json();
    expect(JSON.parse(who.result.content[0].text).rights).toBeTruthy();
  });
});
