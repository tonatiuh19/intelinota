import crypto from "crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";

/** Widths generated for every upload. Keep in sync with client/lib/images.ts */
export const IMAGE_WIDTHS = [480, 960, 1600] as const;

export interface ProcessedImage {
  width: number;
  height: number;
  /** Largest rendition URL (canonical url stored on articles) */
  url: string;
  variants: Array<{ width: number; url: string }>;
  sizeBytes: number;
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Decodes the buffer with sharp (rejects anything that is not a real image,
 * regardless of the client-declared mime type), strips EXIF/GPS metadata,
 * and uploads WebP renditions to Vercel Blob as
 *   media/<hash>-w<width>.webp
 */
export async function processAndStoreImage(
  buffer: Buffer,
): Promise<ProcessedImage> {
  const image = sharp(buffer, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("INVALID_IMAGE");
  }
  if (!["jpeg", "png", "webp", "avif"].includes(meta.format)) {
    throw new Error("INVALID_IMAGE");
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 20);
  const original = meta.width;
  const maxWidth = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
  const targetWidths: number[] = IMAGE_WIDTHS.filter((w) => w < original);
  if (original <= maxWidth) targetWidths.push(original);
  if (!targetWidths.length) targetWidths.push(original);
  targetWidths.sort((a, b) => a - b);

  let total = 0;
  const variants = await Promise.all(
    targetWidths.map(async (width) => {
      const out = await sharp(buffer)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      total += out.length;
      const blob = await put(`media/${hash}-w${width}.webp`, out, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31536000,
      });
      return { width, url: blob.url };
    }),
  );

  const largest = variants[variants.length - 1];
  const scale = largest.width / meta.width;
  return {
    width: largest.width,
    height: Math.round(meta.height * scale),
    url: largest.url,
    variants,
    sizeBytes: total,
  };
}
