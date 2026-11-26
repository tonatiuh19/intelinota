import { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import type { ContentBlock } from "@shared/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const YT_ID = /^[\w-]{6,20}$/;
const INSTAGRAM = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?$/;
const HTTPS = /^https:\/\//;

function Caption({ caption, credit }: { caption?: string; credit?: string }) {
  if (!caption && !credit) return null;
  return (
    <figcaption className="mt-2.5 border-l-2 border-brand pl-3 text-[13px] leading-snug text-muted-foreground">
      {caption}
      {credit && <span className="ml-1.5 text-xs uppercase tracking-wide opacity-70">{credit}</span>}
    </figcaption>
  );
}

export default function ArticleBlock({
  block,
  dropCap = false,
}: {
  block: ContentBlock;
  dropCap?: boolean;
}) {
  const data = block.data as Record<string, string>;
  const [zoomed, setZoomed] = useState(false);

  switch (block.type) {
    case "html":
      // Server-sanitized (api/_lib/security.ts → sanitizeRichHtml)
      return (
        <div
          className={cn("article-content", dropCap && "has-dropcap")}
          dangerouslySetInnerHTML={{ __html: data.html ?? "" }}
        />
      );

    case "image":
      if (!data.url || !/^(https?:)?\//.test(data.url)) return null;
      return (
        <figure className="w-full">
          <button
            type="button"
            className="group relative block w-full cursor-zoom-in overflow-hidden bg-muted"
            onClick={() => setZoomed(true)}
            aria-label="Ampliar imagen"
          >
            <img
              src={data.url}
              alt={data.alt ?? ""}
              loading="lazy"
              decoding="async"
              className="w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" />
            </span>
          </button>
          <Caption caption={data.caption} credit={data.credit} />
          <Dialog open={zoomed} onOpenChange={setZoomed}>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl border-0 bg-transparent p-0 shadow-none sm:w-full [&>button]:hidden">
              <DialogTitle className="sr-only">{data.alt || "Imagen ampliada"}</DialogTitle>
              <img src={data.url} alt={data.alt ?? ""} className="max-h-[88vh] w-full object-contain" />
              <button
                type="button"
                onClick={() => setZoomed(false)}
                aria-label="Cerrar"
                className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogContent>
          </Dialog>
        </figure>
      );

    case "youtube":
      if (!data.video_id || !YT_ID.test(data.video_id)) return null;
      return (
        <figure className="w-full">
          <div className="aspect-video overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${data.video_id}`}
              className="h-full w-full"
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={data.caption ?? "Video"}
            />
          </div>
          <Caption caption={data.caption} />
        </figure>
      );

    case "twitter":
      if (!data.tweet_url || !HTTPS.test(data.tweet_url)) return null;
      return (
        <figure className="w-full border-y py-5">
          <p className="kicker !text-muted-foreground">Publicación en X</p>
          <a
            href={data.tweet_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 block break-all font-body text-base underline decoration-brand decoration-2 underline-offset-4"
          >
            {data.tweet_url}
          </a>
        </figure>
      );

    case "instagram":
      if (!data.post_url || !INSTAGRAM.test(data.post_url)) return null;
      return (
        <figure className="mx-auto max-w-lg">
          <iframe
            src={`${data.post_url.replace(/\/$/, "")}/embed`}
            className="min-h-[560px] w-full border"
            loading="lazy"
            title="Publicación de Instagram"
            allowFullScreen
          />
        </figure>
      );

    case "quote":
      return (
        <blockquote className="w-full border-t-2 border-rule py-6">
          <span aria-hidden className="block font-display text-6xl leading-[0.5] text-brand">
            “
          </span>
          <p className="mt-2 font-display text-2xl font-semibold italic leading-snug text-balance sm:text-3xl">
            {data.text}
          </p>
          {data.attribution && (
            <footer className="mt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              — {data.attribution}
            </footer>
          )}
        </blockquote>
      );

    case "divider":
      return (
        <div aria-hidden className="w-full py-4 text-center text-[10px] tracking-[1em] text-muted-foreground">
          ◆ ◆ ◆
        </div>
      );

    default:
      return null;
  }
}
