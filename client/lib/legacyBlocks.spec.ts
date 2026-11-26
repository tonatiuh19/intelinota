import { describe, it, expect } from "vitest";
import { blocksToHtml, countWords } from "./legacyBlocks";

describe("blocksToHtml", () => {
  it("converts every legacy block type in order", () => {
    const html = blocksToHtml([
      { type: "html", data: { html: "<p>Hola</p>" } },
      { type: "image", data: { url: "https://x/a.jpg", alt: "A", caption: "Foto", credit: "AP" } },
      { type: "youtube", data: { video_id: "dQw4w9WgXcQ" } },
      { type: "quote", data: { text: "Cita <b>", attribution: "Ana" } },
      { type: "divider", data: {} },
      { type: "instagram", data: { post_url: "https://www.instagram.com/p/ABC123/" } },
      { type: "twitter", data: { tweet_url: "https://x.com/a/status/1" } },
    ] as any);
    expect(html).toContain("<p>Hola</p>");
    expect(html).toContain('<figure><img src="https://x/a.jpg" alt="A"><figcaption>Foto — AP</figcaption></figure>');
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("Cita &lt;b");
    expect(html).toContain("<hr>");
    expect(html).toContain("instagram.com/p/ABC123/embed");
    expect(html).toContain('href="https://x.com/a/status/1"');
    expect(html.indexOf("Hola")).toBeLessThan(html.indexOf("figure"));
  });

  it("drops invalid/empty blocks safely", () => {
    expect(blocksToHtml([
      { type: "youtube", data: { video_id: '"><script>' } },
      { type: "image", data: {} },
      { type: "unknown", data: {} },
    ] as any)).toBe("");
  });
});

describe("countWords", () => {
  it("counts words, ignoring tags and entities", () => {
    expect(countWords("<p>Hola <b>mundo</b>&nbsp;¿qué tal?</p>")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("<p>Fútbol-mexicano 2026, rojiblancos’ día</p>")).toBe(4);
  });
});
