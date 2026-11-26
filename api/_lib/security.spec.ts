import { describe, it, expect, beforeAll } from "vitest";
import {
  sanitizeRichHtml,
  sanitizePlainText,
  sanitizeBlockData,
  generateOtp,
  hashOtp,
  safeEqual,
  getRequestIp,
  escapeHtml,
  memoryRateLimit,
} from "./security";

beforeAll(() => {
  process.env.OTP_SECRET = "test-secret";
  process.env.VISITORS_SALT = "test-salt";
});

describe("sanitizeRichHtml", () => {
  it.each([
    ["<script>alert(1)</script><p>ok</p>", "<p>ok</p>"],
    ['<img src="x" onerror="alert(1)">', '<img src="x" />'],
    ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="JaVaScRiPt:alert(1)">x</a>', "<a>x</a>"],
    ['<svg onload="alert(1)"></svg>', ""],
    ['<iframe src="https://evil.com/x"></iframe>', ""],
    ['<p style="background:url(javascript:alert(1))">x</p>', "<p>x</p>"],
    ["<style>body{}</style>", ""],
    ['<form action="x"><input></form>', ""],
  ])("strips dangerous markup: %s", (input, expected) => {
    expect(sanitizeRichHtml(input)).toBe(expected);
  });

  it("keeps editorial markup", () => {
    const html = '<h2>T</h2><p><strong>b</strong> <a href="https://x.com">l</a></p><blockquote>q</blockquote>';
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it("allows whitelisted embeds", () => {
    const yt = '<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>';
    expect(sanitizeRichHtml(yt)).toContain("youtube-nocookie");
  });

  it("adds rel to target=_blank links", () => {
    expect(sanitizeRichHtml('<a href="https://a.com" target="_blank">x</a>')).toContain(
      'rel="noopener noreferrer nofollow"',
    );
  });

  it("handles non-string / empty input", () => {
    expect(sanitizeRichHtml(null)).toBe("");
    expect(sanitizeRichHtml(42)).toBe("");
    expect(sanitizeRichHtml("")).toBe("");
  });
});

describe("sanitizePlainText", () => {
  it("strips all tags and trims to max length", () => {
    expect(sanitizePlainText("<b>hola</b> <script>x</script>")).toBe("hola");
    expect(sanitizePlainText("a".repeat(50), 10)).toHaveLength(10);
    expect(sanitizePlainText(undefined)).toBe("");
  });
});

describe("sanitizeBlockData", () => {
  it("rejects javascript: and protocol-relative URLs in url keys", () => {
    expect(sanitizeBlockData("image", { url: "javascript:alert(1)" }).url).toBe("");
    expect(sanitizeBlockData("image", { url: "//evil.com/x.png" }).url).toBe("");
    expect(sanitizeBlockData("instagram", { post_url: "javascript:x" }).post_url).toBe("");
    expect(sanitizeBlockData("image", { url: "https://cdn.x/a.png" }).url).toBe("https://cdn.x/a.png");
    expect(sanitizeBlockData("image", { url: "/api/media/1" }).url).toBe("/api/media/1");
  });

  it("validates youtube ids", () => {
    expect(sanitizeBlockData("youtube", { video_id: "dQw4w9WgXcQ" }).video_id).toBe("dQw4w9WgXcQ");
    expect(sanitizeBlockData("youtube", { video_id: '"><script>' }).video_id).toBe("");
    expect(sanitizeBlockData("youtube", { video_id: "../../x" }).video_id).toBe("");
  });

  it("sanitizes html blocks and strips tags from captions", () => {
    const out = sanitizeBlockData("html", { html: "<p onclick='x'>a</p>" });
    expect(out.html).toBe("<p>a</p>");
    expect(sanitizeBlockData("image", { caption: "<img src=x onerror=1>hi" }).caption).toBe("hi");
  });

  it("passes non-string values and handles garbage input", () => {
    expect(sanitizeBlockData("x", { n: 3 })).toEqual({ n: 3 });
    expect(sanitizeBlockData("x", null)).toEqual({});
    expect(sanitizeBlockData("x", "str")).toEqual({});
  });
});

describe("OTP", () => {
  it("generates 6-digit codes in range", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateOtp();
      expect(c).toMatch(/^\d{6}$/);
      expect(Number(c)).toBeGreaterThanOrEqual(100000);
    }
  });

  it("hash is keyed by email, case/space-insensitive", () => {
    expect(hashOtp("123456", "A@b.com ")).toBe(hashOtp(" 123456", "a@b.com"));
    expect(hashOtp("123456", "a@b.com")).not.toBe(hashOtp("123456", "c@b.com"));
    expect(hashOtp("123456", "a@b.com")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is not a plain sha256 of the code", async () => {
    const crypto = await import("crypto");
    const plain = crypto.createHash("sha256").update("123456").digest("hex");
    expect(hashOtp("123456", "a@b.com")).not.toBe(plain);
  });
});

describe("safeEqual", () => {
  it("compares safely, including different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("getRequestIp", () => {
  const req = (headers: Record<string, string>) =>
    ({ headers, socket: { remoteAddress: "10.0.0.1" } }) as any;

  it("prefers Vercel/edge headers over spoofable X-Forwarded-For", () => {
    expect(getRequestIp(req({ "x-forwarded-for": "6.6.6.6, 1.1.1.1", "x-real-ip": "1.1.1.1" }))).toBe("1.1.1.1");
    expect(getRequestIp(req({ "x-vercel-forwarded-for": "2.2.2.2", "x-real-ip": "1.1.1.1" }))).toBe("2.2.2.2");
  });

  it("uses the LAST forwarded hop, never the client-supplied first", () => {
    expect(getRequestIp(req({ "x-forwarded-for": "6.6.6.6, 3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("falls back to socket address", () => {
    expect(getRequestIp(req({}))).toBe("10.0.0.1");
  });
});

describe("escapeHtml", () => {
  it("escapes all significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("memoryRateLimit", () => {
  it("allows up to the limit then blocks, per key", () => {
    const key = `t-${Math.random()}`;
    expect(memoryRateLimit(key, 2, 60000)).toBe(false);
    expect(memoryRateLimit(key, 2, 60000)).toBe(false);
    expect(memoryRateLimit(key, 2, 60000)).toBe(true);
    expect(memoryRateLimit(`${key}-other`, 2, 60000)).toBe(false);
  });

  it("window expires", () => {
    const key = `w-${Math.random()}`;
    expect(memoryRateLimit(key, 1, 1)).toBe(false);
    const until = Date.now() + 5;
    while (Date.now() < until) {
      /* spin */
    }
    expect(memoryRateLimit(key, 1, 1)).toBe(false);
  });
});

describe("review regressions", () => {
  it("plain-text fields are not double-escaped (R&D stays R&D)", () => {
    expect(sanitizePlainText(`R&D "hoy" 5 < 6`)).toBe(`R&D "hoy" 5 < 6`);
    expect(sanitizeBlockData("quote", { text: "Tom & Jerry" }).text).toBe("Tom & Jerry");
    // still strips tags
    expect(sanitizePlainText("<img src=x onerror=alert(1)>hola")).toBe("hola");
  });

  it("sanitizes nested arrays/objects", () => {
    const out = sanitizeBlockData("gallery", {
      images: [{ url: "javascript:alert(1)", caption: "<b>x</b>" }, "<i>y</i>"],
      meta: { html: "<script>1</script>", url: "https://ok.com" },
    }) as any;
    expect(out.images[0].url).toBe("");
    expect(out.images[0].caption).toBe("x");
    expect(out.images[1]).toBe("y");
    expect(out.meta.url).toBe("https://ok.com");
    expect(out.meta.html).toBe("");
  });

  it("drops arbitrary classes that could restyle the site", () => {
    expect(sanitizeRichHtml('<p class="fixed inset-0 z-50 text-center">x</p>')).toBe(
      '<p class="text-center">x</p>',
    );
  });
});
