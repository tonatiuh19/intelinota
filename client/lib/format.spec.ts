import { describe, it, expect } from "vitest";
import { formatDate, formatRelative } from "./format";

describe("format", () => {
  it("handles empty and invalid dates", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("nope")).toBe("");
    expect(formatRelative(undefined)).toBe("");
    expect(formatRelative("nope")).toBe("");
  });
  it("relative time buckets", () => {
    const now = Date.now();
    expect(formatRelative(new Date(now - 10_000))).toBe("ahora");
    expect(formatRelative(new Date(now - 5 * 60_000))).toMatch(/5 min/);
    expect(formatRelative(new Date(now - 3 * 3600_000))).toMatch(/3 h/);
    expect(formatRelative(new Date(now - 86400_000))).toBe("ayer");
  });
  it("es-MX long date", () => {
    expect(formatDate("2026-03-09T12:00:00Z")).toBe("9 de marzo de 2026");
  });
});
