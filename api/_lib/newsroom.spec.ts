import { describe, it, expect } from "vitest";
import { slugify, setArticleTags } from "./newsroom";

describe("slugify", () => {
  it.each([
    ["Inteligencia Artificial", "inteligencia-artificial"],
    ["Fútbol & Pasión!!", "futbol-pasion"],
    ["  --Ñandú--  ", "nandu"],
    ["日本", ""],
    ["a".repeat(200), "a".repeat(100)],
  ])("%s → %s", (input, out) => {
    expect(slugify(input)).toBe(out);
  });
});

describe("setArticleTags", () => {
  function pool() {
    const calls: Array<{ sql: string; params: unknown }> = [];
    return {
      calls,
      query: async (sql: string, params?: unknown) => {
        calls.push({ sql, params });
        if (sql.startsWith("SELECT id FROM tags")) return [[{ id: 1 }, { id: 2 }]];
        return [[]];
      },
    } as any;
  }

  it("dedupes by slug, drops empty/unsluggable, caps at 12", async () => {
    const p = pool();
    await setArticleTags(p, 9, ["IA", "ia", " ", "日本", ...Array.from({ length: 20 }, (_, i) => `t${i}`)]);
    const insert = p.calls.find((c: any) => c.sql.startsWith("INSERT INTO tags"));
    const params = insert.params as string[];
    expect(params.length / 2).toBe(12);
    const slugs = params.filter((_, i) => i % 2 === 1);
    expect(slugs.filter((x) => x === "ia")).toHaveLength(1);
  });

  it("empty list only clears tags", async () => {
    const p = pool();
    await setArticleTags(p, 9, []);
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].sql).toContain("DELETE FROM article_tags");
  });
});
