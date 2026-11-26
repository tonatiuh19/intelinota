export const ARTICLE_PLACEHOLDER = "/placeholder.svg";

export function articleImageUrl(url: string | null | undefined): string {
  return url?.trim() ? url : ARTICLE_PLACEHOLDER;
}

/** Must match IMAGE_WIDTHS in api/_lib/media.ts */
const BLOB_VARIANT_RE = /^(.*)-w(\d+)\.webp$/;
const VARIANT_WIDTHS = [480, 960, 1600];

/**
 * Builds a srcset for images uploaded through the Blob pipeline
 * (`…/media/<hash>-w1600.webp`). Returns undefined for any other URL.
 */
export function articleImageSrcSet(
  url: string | null | undefined,
): string | undefined {
  const match = url ? BLOB_VARIANT_RE.exec(url) : null;
  if (!match) return undefined;
  const [, base, maxStr] = match;
  const max = Number(maxStr);
  const widths = VARIANT_WIDTHS.filter((w) => w < max).concat(max);
  return widths.map((w) => `${base}-w${w}.webp ${w}w`).join(", ");
}

/** Common `sizes` presets for editorial layouts */
export const IMAGE_SIZES = {
  hero: "(min-width: 1280px) 1200px, 100vw",
  lead: "(min-width: 1024px) 66vw, 100vw",
  card: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  thumb: "(min-width: 640px) 160px, 33vw",
} as const;
