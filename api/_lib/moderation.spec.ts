import { describe, it, expect } from "vitest";
import { scoreComment, type ModerationInput } from "./moderation";

const base: ModerationInput = {
  content: "Muy buen análisis del clásico, coincido con la mayoría de los puntos.",
  authorName: "Ana",
  authorEmail: "ana@x.com",
  blocklist: ["casino", "viagra", "idiota"],
  duplicateCount: 0,
  recentFromIp: 0,
  approvedBefore: 0,
  spamBefore: 0,
};

describe("scoreComment", () => {
  it("normal comment is low risk with no flags", () => {
    expect(scoreComment(base)).toEqual({ score: 0, flags: [] });
  });
  it("links + blocked word → high risk", () => {
    const r = scoreComment({ ...base, content: "Gana dinero en el CASINO https://spam.xyz ya" });
    expect(r.flags).toEqual(expect.arrayContaining(["links", "blocked_word"]));
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
  it("blocked words match whole words, accent/case-insensitive, also in name", () => {
    expect(scoreComment({ ...base, content: "Eres un IDIOTA" }).flags).toContain("blocked_word");
    expect(scoreComment({ ...base, authorName: "Casino Royale" }).flags).toContain("blocked_word");
    expect(scoreComment({ ...base, content: "La casinoteca del barrio" }).flags).not.toContain("blocked_word");
  });
  it("shouting, repeated chars, duplicates, bursts", () => {
    expect(scoreComment({ ...base, content: "ESTO ES UNA VERGÜENZA TOTAL PARA EL EQUIPO" }).flags).toContain("shouting");
    expect(scoreComment({ ...base, content: "noooooooooo puede ser" }).flags).toContain("repeated_chars");
    expect(scoreComment({ ...base, duplicateCount: 1 }).flags).toContain("duplicate");
    expect(scoreComment({ ...base, recentFromIp: 4 }).flags).toContain("burst");
  });
  it("history: trusted lowers risk, known spammer raises it", () => {
    const linky = { ...base, content: "Fuente: https://www.eluniversal.com.mx/nota" };
    expect(scoreComment({ ...linky, approvedBefore: 3 }).score).toBeLessThan(scoreComment(linky).score);
    expect(scoreComment({ ...linky, approvedBefore: 3 }).flags).toContain("trusted");
    expect(scoreComment({ ...base, spamBefore: 2 }).score).toBeGreaterThanOrEqual(50);
    expect(scoreComment({ ...base, approvedBefore: 5, spamBefore: 1 }).flags).not.toContain("trusted");
  });
  it("score is clamped 0..100 and blocklist ignores tiny/empty words", () => {
    const r = scoreComment({ ...base, content: "CASINO https://a.ru https://b.ru https://c.ru VIAGRA!!!!!!!!", duplicateCount: 3, recentFromIp: 9, spamBefore: 5 });
    expect(r.score).toBe(100);
    expect(scoreComment({ ...base, blocklist: ["", "a", "  "] }).flags).not.toContain("blocked_word");
  });
});
