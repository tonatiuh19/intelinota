import { describe, it, expect } from "vitest";
import { tokenizeWords, wordDiffSummary } from "./wordDiff";

describe("wordDiffSummary", () => {
  it("counts added and removed words", () => {
    expect(wordDiffSummary("El gato negro duerme", "El gato blanco duerme mucho")).toEqual({
      added: 2,
      removed: 1,
      before: 4,
      after: 5,
    });
  });
  it("is case-insensitive and handles accents", () => {
    expect(tokenizeWords("Canción ÉXITO año-2026")).toEqual(["canción", "éxito", "año-2026"]);
    expect(wordDiffSummary("Hola Mundo", "hola mundo")).toMatchObject({ added: 0, removed: 0 });
  });
  it("handles empty texts", () => {
    expect(wordDiffSummary("", "uno dos")).toMatchObject({ added: 2, removed: 0 });
  });
});
