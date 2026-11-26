/**
 * Downscales an image file in the browser (max side, WebP/JPEG) so phone
 * photos stay well under Vercel's 4.5MB request limit after base64.
 */
export async function resizeImageFile(
  file: File,
  maxSide = 2000,
  quality = 0.82,
): Promise<{ base64: string; mime: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const w0 = "width" in bitmap ? bitmap.width : 0;
  const h0 = "height" in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  const webp = canvas.toDataURL("image/webp", quality);
  const useWebp = webp.startsWith("data:image/webp");
  const dataUrl = useWebp ? webp : canvas.toDataURL("image/jpeg", quality);
  return {
    base64: dataUrl.split(",")[1],
    mime: useWebp ? "image/webp" : "image/jpeg",
    width: w,
    height: h,
  };
}
