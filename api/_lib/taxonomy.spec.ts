import { describe, it, expect } from "vitest";
import {
  normalizeTaxonomySlug,
  validateReorder,
  validateSetting,
  normalizeBlocklist,
  csvField,
  fillDailySeries,
} from "./taxonomy";

describe("normalizeTaxonomySlug", () => {
  it("uses slug, falls back to name, rejects empty", () => {
    expect(normalizeTaxonomySlug("Ciencia Ficción", "x")).toBe("ciencia-ficcion");
    expect(normalizeTaxonomySlug("", "Política Global")).toBe("politica-global");
    expect(normalizeTaxonomySlug("日本", "")).toBeNull();
  });
});

describe("validateReorder", () => {
  it("accepts a permutation", () => expect(validateReorder([3, 1, 2], [1, 2, 3])).toBeNull());
  it.each([
    [[], "ids array required"],
    [[1, 1, 2], "duplicate ids"],
    [[1, 2], "ids must include every item exactly once"],
    [[1, 2, 9], "unknown id"],
    [[1, "x", 3], "ids must be positive integers"],
  ])("rejects %j", (ids, msg) => expect(validateReorder(ids, [1, 2, 3])).toBe(msg));
});

describe("validateSetting", () => {
  it("whitelists keys", () => expect(validateSetting("jwt_secret", "x")).toHaveProperty("error"));
  it("validates timezone", () => {
    expect(validateSetting("newsroom_timezone", "America/Bogota")).toEqual({ key: "newsroom_timezone", value: "America/Bogota" });
    expect(validateSetting("newsroom_timezone", "Mars/Olympus")).toHaveProperty("error");
  });
  it("validates version", () => {
    expect(validateSetting("app_version", " v1.2.3 ")).toEqual({ key: "app_version", value: "v1.2.3" });
    expect(validateSetting("app_version", "<script>")).toHaveProperty("error");
  });
  it("normalizes blocklist", () => {
    expect(normalizeBlocklist(" Casino, casino ,,  Viagra  Barato ")).toBe("casino,viagra barato");
  });
});

describe("csv", () => {
  it("escapes and neutralizes formulas", () => {
    expect(csvField("a@b.com")).toBe("a@b.com");
    expect(csvField('x,"y"')).toBe('"x,""y"""');
    expect(csvField("=HYPERLINK()")).toBe(`"'=HYPERLINK()"`);
    expect(csvField(null)).toBe("");
  });
});

describe("fillDailySeries", () => {
  it("fills missing days with zero", () => {
    const s = fillDailySeries([{ day: "2026-11-25", n: 3 }], 3, new Date("2026-11-26T10:00:00Z"));
    expect(s).toEqual([
      { date: "2026-11-24", count: 0 },
      { date: "2026-11-25", count: 3 },
      { date: "2026-11-26", count: 0 },
    ]);
  });
});
