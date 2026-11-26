import { describe, it, expect } from "vitest";
import { buildRss, buildSitemap, buildNewsSitemap } from "./feeds";

function fakePool(results: unknown[][]) {
  let i = 0;
  const calls: Array<{ sql: string; params: unknown }> = [];
  return {
    calls,
    query: async (sql: string, params?: unknown) => {
      calls.push({ sql, params });
      return [results[i++] ?? []];
    },
  } as any;
}

const evil = {
  slug: 'a"><script>x</script>',
  title: "Tom & Jerry <b>",
  excerpt: "</description><x>",
  image_url: 'https://x.com/i.png?a=1&b="2"',
  published_at: "2026-11-25T10:00:00Z",
  category_name: "C&C",
  author_name: "<Ana>",
};

describe("feeds escape untrusted content", () => {
  it("RSS output contains no raw tags from data", async () => {
    const xml = await buildRss(fakePool([[evil]]), "https://site.com");
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("<b>");
    expect(xml).not.toContain("</description><x>");
    expect(xml).toContain("Tom &amp; Jerry &lt;b&gt;");
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("RSS category filter is parameterized, not interpolated", async () => {
    const pool = fakePool([[]]);
    await buildRss(pool, "https://site.com", "x' OR 1=1 --");
    expect(pool.calls[0].sql).not.toContain("OR 1=1");
    expect(pool.calls[0].params).toEqual(["x' OR 1=1 --"]);
  });

  it("sitemap escapes slugs and survives invalid dates", async () => {
    const xml = await buildSitemap(
      fakePool([[{ ...evil, lastmod: "not-a-date" }], [{ slug: "tech" }], [{ slug: "ana" }]]),
      "https://site.com",
    );
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("/categoria/tech");
    expect(xml).toContain("/autor/ana");
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
  });

  it("news sitemap handles empty result", async () => {
    const xml = await buildNewsSitemap(fakePool([[]]), "https://site.com");
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<url>");
  });
});
