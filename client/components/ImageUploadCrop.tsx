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
import { Loader2, Upload, ImageIcon, X, Crop as CropIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputMime = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      outputMime,
      quality,
    );
  });
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

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    setUploading(true);
    setUploadError(null);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const data_base64 = await blobToBase64(blob);

      const result = await dispatch(
        uploadMedia({
          data_base64,
          filename: `${uploadId.replace(/[^\w.\-]/g, "_")}.jpg`,
          mime_type: "image/jpeg",
        }),
      );
      if (uploadMedia.rejected.match(result)) {
        throw new Error(String(result.payload ?? "Upload error"));
      }

      onChange(result.payload.url);
      setDialogOpen(false);
      setSrcUrl(null);
    } catch (err: any) {
      setUploadError(
        err?.response?.data?.message ?? err?.message ?? "Upload error",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setDialogOpen(false);
    setSrcUrl(null);
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
            className="h-8 px-3 text-xs gap-1.5"
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
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
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
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-xl w-[calc(100vw-1rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <CropIcon className="w-4 h-4 text-blue-400" />
              Recortar imagen
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center min-h-[200px] max-h-[60vh] overflow-auto bg-black/30 rounded-lg">
            {srcUrl && (
              <ReactCrop
                crop={crop}
                onChange={(_, pct) => setCrop(pct)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatio}
                className="max-w-full"
              >
                <img
                  ref={imgRef}
                  src={srcUrl}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-h-[55vh] max-w-full"
                />
              </ReactCrop>
            )}
          </div>

          {uploadError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2 border border-destructive/30">
              {uploadError}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={uploading || !completedCrop}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
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
