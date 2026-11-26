import { useState, useRef, useCallback } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useAppDispatch } from "@/store/hooks";
import { uploadMedia } from "@/store/slices/adminMediaSlice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Upload,
  ImageIcon,
  X,
  Crop as CropIcon,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

const MAX_EDGE = 2000;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/**
 * Crops, downscales so the longest side is ≤ MAX_EDGE, and encodes as WebP
 * (falls back to JPEG when the browser can't encode WebP, e.g. old Safari).
 * Keeps phone photos well below Vercel's 4.5MB request body limit.
 */
async function getCroppedImage(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<{ blob: Blob; mime: string; ext: string }> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const srcW = crop.width * scaleX;
  const srcH = crop.height * scaleY;
  const ratio = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * ratio));
  canvas.height = Math.max(1, Math.round(srcH * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    srcW,
    srcH,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  // Browsers without WebP encoding silently return PNG instead.
  if (webp && webp.type === "image/webp") {
    return { blob: webp, mime: "image/webp", ext: "webp" };
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!jpeg) throw new Error("Canvas is empty");
  return { blob: jpeg, mime: "image/jpeg", ext: "jpg" };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Could not read image data"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

interface ImageUploadCropProps {
  /** Current image URL value (shown as preview) */
  value: string;
  /** Called with the new public URL after upload */
  onChange: (url: string) => void;
  /**
   * Used in the uploaded filename (e.g. "author_1", "article_42").
   */
  uploadId: string;
  /** Desired crop aspect ratio. 1 = square, 16/9 = landscape, undefined = free */
  aspectRatio?: number;
  /** Optional label shown above the control */
  label?: string;
  className?: string;
  /** Shape of the preview thumbnail */
  previewShape?: "circle" | "rect";
}

export default function ImageUploadCrop({
  value,
  onChange,
  uploadId,
  aspectRatio,
  label,
  className,
  previewShape = "rect",
}: ImageUploadCropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const dispatch = useAppDispatch();
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  /** Encoded image kept so "Reintentar" doesn't re-encode. */
  const preparedRef = useRef<{
    data_base64: string;
    filename: string;
    mime_type: string;
  } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setSrcUrl(reader.result as string);
        setCrop(undefined);
        setCompletedCrop(undefined);
        setUploadError(null);
        setDialogOpen(true);
      });
      reader.readAsDataURL(file);
    },
    [],
  );

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const defaultCrop = aspectRatio
        ? centerAspectCrop(width, height, aspectRatio)
        : centerCrop(
            makeAspectCrop(
              { unit: "%", width: 90 },
              width / height,
              width,
              height,
            ),
            width,
            height,
          );
      setCrop(defaultCrop);
    },
    [aspectRatio],
  );

  const doUpload = async (prepared: {
    data_base64: string;
    filename: string;
    mime_type: string;
  }) => {
    setProgress(0);
    const result = await dispatch(
      uploadMedia({ ...prepared, onProgress: (p) => setProgress(p) }),
    );
    if (uploadMedia.rejected.match(result)) {
      throw new Error(String(result.payload ?? "Error al subir"));
    }
    onChange(result.payload.url);
    preparedRef.current = null;
    setDialogOpen(false);
    setSrcUrl(null);
  };

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { blob, mime, ext } = await getCroppedImage(
        imgRef.current,
        completedCrop,
      );
      const data_base64 = await blobToBase64(blob);
      preparedRef.current = {
        data_base64,
        filename: `${uploadId.replace(/[^\w.\-]/g, "_")}.${ext}`,
        mime_type: mime,
      };
      await doUpload(preparedRef.current);
    } catch (err: any) {
      logger.error("ImageUploadCrop upload failed", err);
      setUploadError(err?.message ?? "Error al subir");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleRetry = async () => {
    if (!preparedRef.current) return handleConfirm();
    setUploading(true);
    setUploadError(null);
    try {
      await doUpload(preparedRef.current);
    } catch (err: any) {
      logger.error("ImageUploadCrop retry failed", err);
      setUploadError(err?.message ?? "Error al subir");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setDialogOpen(false);
    setSrcUrl(null);
    preparedRef.current = null;
    setUploadError(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex-shrink-0 bg-accent/40 border border-border overflow-hidden flex items-center justify-center",
            previewShape === "circle"
              ? "w-16 h-16 rounded-full"
              : "w-20 h-14 rounded-lg",
          )}
        >
          {value ? (
            <img
              src={value}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 px-4 text-sm gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? "Cambiar imagen" : "Subir imagen"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 px-3 text-sm text-muted-foreground hover:text-destructive gap-1.5"
              onClick={() => onChange("")}
            >
              <X className="w-3 h-3" />
              Quitar
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent
          className={cn(
            // Mobile: full-screen sheet. Desktop: centered dialog.
            "flex flex-col gap-3 p-4 w-screen max-w-none h-[100dvh] rounded-none border-0",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            "sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-xl sm:rounded-xl sm:border sm:p-6",
          )}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <CropIcon className="w-4 h-4 text-brand" />
              Recortar imagen
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto bg-black/80 rounded-lg sm:flex-none sm:min-h-[200px] sm:max-h-[60vh]">
            {srcUrl && (
              <ReactCrop
                crop={crop}
                onChange={(_, pct) => setCrop(pct)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatio}
                className="max-w-full"
                disabled={uploading}
              >
                <img
                  ref={imgRef}
                  src={srcUrl}
                  alt="Vista previa del recorte"
                  onLoad={onImageLoad}
                  className="max-h-[calc(100dvh-14rem)] sm:max-h-[55vh] max-w-full"
                />
              </ReactCrop>
            )}
          </div>

          {progress != null && (
            <div className="space-y-1" aria-live="polite">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress < 100 ? "Subiendo…" : "Procesando…"}</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/30">
              <span className="flex-1 min-w-0">{uploadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-1.5"
                onClick={handleRetry}
                disabled={uploading}
              >
                <RotateCcw className="w-4 h-4" />
                Reintentar
              </Button>
            </div>
          )}

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 sm:flex-none"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={uploading || !completedCrop}
              className="h-10 flex-1 sm:flex-none bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Aplicar y subir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
