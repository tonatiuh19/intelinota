import { describe, it, expect } from "vitest";
import { slugify, moveItem, orderChanged, parseChips } from "./taxonomy";

describe("taxonomy helpers", () => {
  it("slugifies Spanish names", () => {
    expect(slugify("Economía y Negocios")).toBe("economia-y-negocios");
    expect(slugify("  ¡Fútbol!  ")).toBe("futbol");
  });
  it("moves items immutably", () => {
    const a = [1, 2, 3, 4];
    expect(moveItem(a, 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem(a, 3, -5)).toEqual([4, 1, 2, 3]);
    expect(moveItem(a, 9, 0)).toEqual(a);
    expect(a).toEqual([1, 2, 3, 4]);
  });
  it("detects order changes", () => {
    expect(orderChanged([1, 2], [1, 2])).toBe(false);
    expect(orderChanged([1, 2], [2, 1])).toBe(true);
  });
  it("parses chips", () => expect(parseChips(" Casino,casino, ,spam ")).toEqual(["casino", "spam"]));
});
