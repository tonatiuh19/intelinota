import { describe, it, expect } from "vitest";
import { articleImageSrcSet, articleImageUrl } from "./images";

describe("articleImageSrcSet", () => {
  it("builds srcset for blob variant URLs", () => {
    expect(articleImageSrcSet("https://b.vercel-storage.com/media/abc-w1600.webp")).toBe(
      "https://b.vercel-storage.com/media/abc-w480.webp 480w, https://b.vercel-storage.com/media/abc-w960.webp 960w, https://b.vercel-storage.com/media/abc-w1600.webp 1600w",
    );
  });
  it("handles originals narrower than the largest preset", () => {
    expect(articleImageSrcSet("https://b/media/x-w700.webp")).toBe(
      "https://b/media/x-w480.webp 480w, https://b/media/x-w700.webp 700w",
    );
    expect(articleImageSrcSet("https://b/media/x-w300.webp")).toBe("https://b/media/x-w300.webp 300w");
  });
  it("returns undefined for legacy/external URLs", () => {
    expect(articleImageSrcSet("https://cdn.com/photo.jpg")).toBeUndefined();
    expect(articleImageSrcSet(null)).toBeUndefined();
    expect(articleImageSrcSet("")).toBeUndefined();
  });
  it("falls back to placeholder", () => {
    expect(articleImageUrl("  ")).toBe("/placeholder.svg");
  });
});
