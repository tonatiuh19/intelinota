import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  MCP_SCOPE,
  auditResultJson,
  htmlToPlainText,
  mcpAuthorizationServerMetadata,
  mcpJsonSchemaToZod,
  mcpLimit,
  mcpProtectedResourceMetadata,
  mcpRedirectUriAllowed,
  mcpRedirectUriOkForRegistration,
  mcpReturnPathAllowed,
  mcpWriteConfirmed,
  mcpRandomSecret,
  parseBearerAuthorization,
  parseNewsroomDateTime,
  redactMcpArgs,
  sanitizeMcpJsonRpcForClaude,
  sha256Hex,
  verifyPkceS256,
  wordCount,
} from "./mcpOAuth";
import { assertPublicHttpsUrl, isBlockedIp, markdownToSafeHtml, SsrfError } from "./mcpContent";
import { MCP_TOOLS } from "./mcpTools";
import { safeAdminReturnPath } from "../../shared/mcp";

const challengeFor = (v: string) => crypto.createHash("sha256").update(v).digest("base64url");

describe("OAuth metadata", () => {
  it("uses /api/mcp as issuer and resource with the product scope", () => {
    const m = mcpAuthorizationServerMetadata("https://www.intelinota.com");
    expect(m.issuer).toBe("https://www.intelinota.com/api/mcp");
    expect(m.token_endpoint).toBe("https://www.intelinota.com/api/mcp/oauth/token");
    expect(m.code_challenge_methods_supported).toEqual(["S256"]);
    expect(m.scopes_supported).toEqual(["intelinota.newsroom"]);
    expect(MCP_SCOPE).not.toBe("mcp");
    const r = mcpProtectedResourceMetadata("https://www.intelinota.com");
    expect(r.resource).toBe(m.issuer);
    expect(r.authorization_servers).toEqual([m.issuer]);
  });
});

describe("redirect URI allowlist", () => {
  it.each([
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
    "cursor://anysphere.cursor-mcp/oauth/callback",
    "https://www.cursor.com/agents/mcp/oauth/callback",
    "http://localhost:6274/oauth/callback",
    "http://127.0.0.1:33418/callback",
  ])("accepts %s for registration", (u) => expect(mcpRedirectUriOkForRegistration(u)).toBe(true));

  it.each([
    "https://evil.com/api/mcp/auth_callback",
    "https://claude.ai.evil.com/api/mcp/auth_callback",
    "https://claude.ai/other",
    "https://claude.ai:8443/api/mcp/auth_callback",
    "https://user:pw@claude.ai/api/mcp/auth_callback",
    "http://claude.ai/api/mcp/auth_callback",
    "http://10.0.0.1/callback",
    "javascript:alert(1)",
    "cursor://evil/oauth/callback",
    "https://claude.ai/api/mcp/auth_callback#frag",
    "not a url",
  ])("rejects %s", (u) => expect(mcpRedirectUriOkForRegistration(u)).toBe(false));

  it("requires the redirect to be registered (loopback may vary port only)", () => {
    const reg = ["http://127.0.0.1:1111/callback", "https://claude.ai/api/mcp/auth_callback"];
    expect(mcpRedirectUriAllowed("https://claude.ai/api/mcp/auth_callback", reg)).toBe(true);
    expect(mcpRedirectUriAllowed("http://127.0.0.1:2222/callback", reg)).toBe(true);
    expect(mcpRedirectUriAllowed("http://127.0.0.1:2222/other", reg)).toBe(false);
    expect(mcpRedirectUriAllowed("https://claude.com/api/mcp/auth_callback", reg)).toBe(false);
    expect(mcpRedirectUriAllowed("", reg)).toBe(false);
  });
});

describe("PKCE S256", () => {
  const verifier = crypto.randomBytes(48).toString("base64url");
  it("verifies the matching challenge", () => expect(verifyPkceS256(verifier, challengeFor(verifier))).toBe(true));
  it("rejects wrong verifier, plain method and short verifiers", () => {
    expect(verifyPkceS256(`${verifier}x`, challengeFor(verifier))).toBe(false);
    expect(verifyPkceS256(verifier, verifier)).toBe(false);
    expect(verifyPkceS256("short", challengeFor("short"))).toBe(false);
    expect(verifyPkceS256("", "")).toBe(false);
  });
});

describe("token hashing", () => {
  it("stores sha256 hex, never the secret", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const a = mcpRandomSecret();
    const b = mcpRandomSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(sha256Hex(a)).not.toContain(a);
  });
  it("parses only well-formed bearer headers", () => {
    expect(parseBearerAuthorization("Bearer abc")).toBe("abc");
    expect(parseBearerAuthorization("bearer  abc ")).toBe("abc");
    expect(parseBearerAuthorization("Basic abc")).toBeNull();
    expect(parseBearerAuthorization("Bearer undefined")).toBeNull();
    expect(parseBearerAuthorization("Bearer a b")).toBeNull();
  });
});

describe("post-login return path allowlist", () => {
  const ok = "/admin/mcp-consent?client_id=mcp_x&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback";
  it.each([ok, "/admin/mcp-consent"])("allows %s", (p) => {
    expect(mcpReturnPathAllowed(p)).toBe(true);
    expect(safeAdminReturnPath(p)).toBe(p);
  });
  it.each([
    "https://evil.com/admin/mcp-consent",
    "//evil.com/admin/mcp-consent",
    "/admin/mcp-consent/../dashboard",
    "/admin/mcp-consentx",
    "/admin/dashboard",
    "/\\evil.com",
    "/admin/mcp-consent\\@evil.com",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (p) => {
    expect(mcpReturnPathAllowed(p)).toBe(false);
    expect(safeAdminReturnPath(p)).toBeNull();
  });
});

describe("SSRF guard", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1",
    "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "64:ff9b::a00:1",
    "fd00:ec2::254", "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "151.101.1.69", "172.32.0.1", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );

  const lookup = (map: Record<string, string[]>) => async (h: string) =>
    (map[h] ?? []).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

  it("requires https, default port, no credentials", async () => {
    const l = lookup({ "img.example.com": ["93.184.216.34"] });
    await expect(assertPublicHttpsUrl("http://img.example.com/a.jpg", l)).rejects.toThrow("https_only");
    await expect(assertPublicHttpsUrl("https://img.example.com:8443/a.jpg", l)).rejects.toThrow("port_not_allowed");
    await expect(assertPublicHttpsUrl("https://u:p@img.example.com/a.jpg", l)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpsUrl("https://localhost/a.jpg", l)).rejects.toThrow("host_not_allowed");
    const ok = await assertPublicHttpsUrl("https://img.example.com/a.jpg", l);
    expect(ok.address).toBe("93.184.216.34");
  });

  it("rejects hostnames resolving to private or metadata IPs (any record)", async () => {
    const l = lookup({ "rebind.example": ["93.184.216.34", "169.254.169.254"], "int.example": ["10.0.0.5"] });
    await expect(assertPublicHttpsUrl("https://rebind.example/x.png", l)).rejects.toThrow("private_address");
    await expect(assertPublicHttpsUrl("https://int.example/x.png", l)).rejects.toThrow("private_address");
    await expect(assertPublicHttpsUrl("https://[::1]/x.png", l)).rejects.toThrow("private_address");
    await expect(assertPublicHttpsUrl("https://nxdomain.example/x.png", l)).rejects.toThrow("dns_failed");
  });
});

describe("Markdown → sanitized HTML", () => {
  it("renders Markdown with H2 sections and demotes H1", () => {
    const html = markdownToSafeHtml("# Título\n\n## Sección\n\nTexto **fuerte** y [enlace](https://example.com).");
    expect(html).toContain("<h2>Título</h2>");
    expect(html).toContain("<h2>Sección</h2>");
    expect(html).toContain("<strong>fuerte</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain("<h1>");
  });
  it("never passes raw HTML or dangerous URLs through", () => {
    const html = markdownToSafeHtml(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![i](data:text/html;base64,AAAA)',
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/src="data:text\/html/i);
  });
});

describe("tool framework", () => {
  it("writes need confirm=true AND confirm_phrase=CONFIRM", () => {
    expect(mcpWriteConfirmed({ confirm: true, confirm_phrase: "CONFIRM" })).toBe(true);
    expect(mcpWriteConfirmed({ confirm: "true", confirm_phrase: " CONFIRM " })).toBe(true);
    expect(mcpWriteConfirmed({ confirm_phrase: "CONFIRM" })).toBe(false);
    expect(mcpWriteConfirmed({ confirm: true })).toBe(false);
    expect(mcpWriteConfirmed({ confirm: true, confirm_phrase: "confirm" })).toBe(false);
  });
  it("caps page size at 50 (default 20)", () => {
    expect(mcpLimit({})).toBe(20);
    expect(mcpLimit({ limit: 500 })).toBe(50);
    expect(mcpLimit({ limit: -1 })).toBe(20);
  });
  it("catalog: unique snake_case names; every write exposes confirm + confirm_phrase", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of MCP_TOOLS) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]*$/);
      const props = (t.inputSchema.properties ?? {}) as Record<string, unknown>;
      if (!t.readOnly) {
        expect(props.confirm).toBeTruthy();
        expect(props.confirm_phrase).toBeTruthy();
      } else {
        expect(props.confirm).toBeUndefined();
      }
      expect(() => mcpJsonSchemaToZod(t.inputSchema)).not.toThrow();
    }
  });
  it("zod conversion enforces required + coerces", () => {
    const tool = MCP_TOOLS.find((t) => t.name === "get_article")!;
    const schema = mcpJsonSchemaToZod(tool.inputSchema);
    expect(schema.safeParse({ article_id: "12" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
  it("strips Claude-hostile fields from tools/list and initialize", () => {
    const raw = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [{ name: "a", description: "d", title: "T", annotations: {}, outputSchema: {}, inputSchema: { $schema: "x", type: "object", properties: {}, additionalProperties: {} } }],
      },
    });
    const out = JSON.parse(sanitizeMcpJsonRpcForClaude(raw));
    expect(out.result.tools[0]).toEqual({ name: "a", description: "d", inputSchema: { type: "object", properties: {} } });
    const init = JSON.parse(
      sanitizeMcpJsonRpcForClaude(JSON.stringify({ result: { capabilities: { tools: { listChanged: true } }, instructions: "x" } })),
    );
    expect(init.result.capabilities.tools).toEqual({});
    expect(init.result.instructions).toBeUndefined();
  });
  it("redacts secrets and truncates audit payloads", () => {
    const r = redactMcpArgs({ refresh_token: "s", data_base64: "x", content: "a".repeat(2000), title: "ok" });
    expect(r.refresh_token).toBe("[redacted]");
    expect(r.data_base64).toBe("[redacted]");
    expect(String(r.content)).toContain("omitted");
    expect(r.title).toBe("ok");
    expect(JSON.parse(auditResultJson({ big: "x".repeat(20000) })).truncated).toBe(true);
  });
});

describe("content helpers", () => {
  it("plain text + word count", () => {
    const t = htmlToPlainText("<h2>Hola</h2><p>Uno dos&nbsp;tres</p>");
    expect(t).toContain("Hola");
    expect(wordCount(t)).toBe(4);
  });
  it("parses naive times in the newsroom timezone", () => {
    expect(parseNewsroomDateTime("2026-12-01T08:00", "America/Mexico_City")?.toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(parseNewsroomDateTime("2026-12-01T08:00:00Z", "America/Mexico_City")?.toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(parseNewsroomDateTime("mañana", "America/Mexico_City")).toBeNull();
  });
});
