import { describe, it, expect } from "vitest";
import { suggestSlug, snapshotPlainText, parseSnapshot, notificationEmailHtml } from "./workflow";

describe("suggestSlug", () => {
  it("returns base when free, else first free -n", () => {
    expect(suggestSlug("nota", new Set())).toBe("nota");
    expect(suggestSlug("nota", new Set(["nota", "nota-2"]))).toBe("nota-3");
  });
});

describe("snapshotPlainText", () => {
  it("joins legacy content and text-bearing blocks in order", () => {
    const snap = parseSnapshot(
      JSON.stringify({
        article: { content: "<p>Intro &amp; más</p>" },
        blocks: [
          { position: 2, type: "quote", data: { text: "Cita", author: "Ana" } },
          { position: 1, type: "html", data: { html: "<h2>Título</h2><p>Cuerpo</p>" } },
          { position: 3, type: "image", data: { url: "https://x/y.jpg", caption: "Foto" } },
        ],
      }),
    );
    expect(snapshotPlainText(snap)).toBe("Intro & más\nTítulo Cuerpo\nCita\nAna\nFoto");
  });
});

describe("notificationEmailHtml", () => {
  it("escapes user content", () => {
    const html = notificationEmailHtml(
      { type: "review.returned", title: "<script>x</script>", body: "a & b", link: "/admin/x" },
      "https://site.test/",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).toContain("https://site.test/admin/x");
  });
});
