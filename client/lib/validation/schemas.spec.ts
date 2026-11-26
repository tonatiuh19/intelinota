import { describe, it, expect } from "vitest";
import { newsletterSchema, commentSchema, adminCodeSchema } from "./schemas";

describe("schemas", () => {
  it("newsletter: valid email, honeypot must be empty", () => {
    expect(newsletterSchema.isValidSync({ email: "a@b.co", website: "" })).toBe(true);
    expect(newsletterSchema.isValidSync({ email: "a@b", website: "" })).toBe(false);
    expect(newsletterSchema.isValidSync({ email: "", website: "" })).toBe(false);
    expect(newsletterSchema.isValidSync({ email: "a@b.co", website: "spam" })).toBe(false);
  });
  it("comment: limits and optional email", () => {
    const ok = { author_name: "Ana", author_email: "", content: "hola", website: "" };
    expect(commentSchema.isValidSync(ok)).toBe(true);
    expect(commentSchema.isValidSync({ ...ok, content: "hi" })).toBe(false);
    expect(commentSchema.isValidSync({ ...ok, content: "x".repeat(5001) })).toBe(false);
    expect(commentSchema.isValidSync({ ...ok, author_email: "bad" })).toBe(false);
    expect(commentSchema.isValidSync({ ...ok, author_name: " " })).toBe(false);
  });
  it("admin code: exactly 6 digits", () => {
    expect(adminCodeSchema.isValidSync({ code: "123456" })).toBe(true);
    expect(adminCodeSchema.isValidSync({ code: "12345" })).toBe(false);
    expect(adminCodeSchema.isValidSync({ code: "12345a" })).toBe(false);
  });
});
