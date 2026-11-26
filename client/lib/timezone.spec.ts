import { describe, it, expect } from "vitest";
import { zonedLocalToIso, isoToZonedLocal } from "./timezone";

describe("newsroom timezone", () => {
  it("Mexico City wall time → UTC (UTC-6, no DST since 2022)", () => {
    expect(zonedLocalToIso("2026-11-26T09:30")).toBe("2026-11-26T15:30:00.000Z");
    expect(zonedLocalToIso("2026-07-01T00:00")).toBe("2026-07-01T06:00:00.000Z");
  });
  it("round-trips", () => {
    expect(isoToZonedLocal("2026-11-26T15:30:00.000Z")).toBe("2026-11-26T09:30");
    expect(isoToZonedLocal(zonedLocalToIso("2026-12-31T23:59"))).toBe("2026-12-31T23:59");
  });
  it("handles DST zones (Madrid) and bad input", () => {
    expect(zonedLocalToIso("2026-07-01T12:00", "Europe/Madrid")).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedLocalToIso("2026-01-01T12:00", "Europe/Madrid")).toBe("2026-01-01T11:00:00.000Z");
    expect(zonedLocalToIso("nope")).toBeNull();
    expect(isoToZonedLocal(null)).toBe("");
  });
});
