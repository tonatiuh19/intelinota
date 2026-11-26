import { Node, mergeAttributes } from "@tiptap/core";

/** <figure><img><figcaption> — image with optional caption/credit. */
export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const img = node.querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            caption: node.querySelector("figcaption")?.textContent ?? "",
          };
        },
      },
      // Bare <img> (pasted content / legacy HTML)
      {
        tag: "img[src]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          alt: (el as HTMLElement).getAttribute("alt") ?? "",
          caption: "",
        }),
      },
    ];
  },
  renderHTML({ node }) {
    const children: unknown[] = [["img", mergeAttributes({ src: node.attrs.src, alt: node.attrs.alt || "" })]];
    if (node.attrs.caption) children.push(["figcaption", {}, node.attrs.caption]);
    return ["figure", {}, ...children] as never;
  },
});

export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12) || null;
    if (u.hostname.includes("youtube")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v")!.slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function instagramEmbedUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(p|reel)\/([\w-]+)/);
    return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed` : null;
  } catch {
    return null;
  }
}

/** Embedded iframe (YouTube nocookie / Instagram) — whitelisted server-side. */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, title: { default: "" }, provider: { default: "youtube" } };
  },
  parseHTML() {
    return [
      {
        tag: "iframe[src]",
        getAttrs: (el) => {
          const src = (el as HTMLElement).getAttribute("src") ?? "";
          if (src.includes("youtube")) return { src, provider: "youtube", title: (el as HTMLElement).getAttribute("title") ?? "" };
          if (src.includes("instagram.com")) return { src, provider: "instagram", title: "" };
          return false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "iframe",
      {
        src: node.attrs.src,
        title: node.attrs.title || (node.attrs.provider === "instagram" ? "Publicación de Instagram" : "Video"),
        allowfullscreen: "true",
        ...(node.attrs.provider === "instagram" ? { height: "640" } : {}),
      },
    ];
  },
});
