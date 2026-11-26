import type { ContentBlock } from "@shared/api";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Converts the old multi-block article format into one HTML document for
 * the continuous editor. Already-single html block → returned as-is.
 */
export function blocksToHtml(blocks: Array<Pick<ContentBlock, "type" | "data">>): string {
  return blocks
    .map((b) => {
      const d = (b.data ?? {}) as Record<string, string>;
      switch (b.type) {
        case "html":
          return d.html ?? "";
        case "image": {
          if (!d.url) return "";
          const cap = [d.caption, d.credit].filter(Boolean).join(" — ");
          return `<figure><img src="${esc(d.url)}" alt="${esc(d.alt)}">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
        }
        case "youtube":
          return d.video_id && /^[\w-]{6,20}$/.test(d.video_id)
            ? `<iframe src="https://www.youtube-nocookie.com/embed/${d.video_id}" title="${esc(d.caption || "Video")}"></iframe>`
            : "";
        case "instagram": {
          const m = d.post_url?.match(/instagram\.com\/(p|reel)\/([\w-]+)/);
          return m ? `<iframe src="https://www.instagram.com/${m[1]}/${m[2]}/embed" title="Publicación de Instagram"></iframe>` : "";
        }
        case "twitter":
          return d.tweet_url ? `<p><a href="${esc(d.tweet_url)}">${esc(d.tweet_url)}</a></p>` : "";
        case "quote":
          return d.text
            ? `<blockquote><p>${esc(d.text)}</p>${d.attribution ? `<p>— ${esc(d.attribution)}</p>` : ""}</blockquote>`
            : "";
        case "divider":
          return "<hr>";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

/** Plain-text word count of an HTML string. */
export function countWords(html: string): number {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
  return (text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).length;
}
