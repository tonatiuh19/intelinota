import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Undo2,
  Youtube,
  Instagram,
  AtSign,
} from "lucide-react";
import { Figure, Embed, youtubeId, instagramEmbedUrl } from "./extensions";
import { cn } from "@/lib/utils";

export interface StoryEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Uploads an image and resolves to its public URL. */
  onUploadImage: (file: File) => Promise<string>;
  placeholder?: string;
}

type Cmd = {
  key: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  run: (e: Editor) => void;
};

/** Strip Word/Docs cruft from pasted HTML (server sanitizes again). */
function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s(style|class|id|lang|dir)="[^"]*"/gi, "")
    .replace(/<\/?(span|font|o:p|meta|link)[^>]*>/gi, "")
    .replace(/<b\s+id="docs-internal[^>]*>([\s\S]*?)<\/b>/gi, "$1");
}

export default function StoryEditor({ value, onChange, onUploadImage, placeholder }: StoryEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [slash, setSlash] = useState<{ query: string; top: number; left: number; from: number } | null>(null);
  const [active, setActive] = useState(0);
  const lastHtml = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      Highlight,
      Figure,
      Embed,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Subtítulo" : placeholder ?? "Escribe tu historia… (escribe / para insertar)",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "article-content story-editor min-h-[50vh] outline-none focus:outline-none [&_.is-editor-empty:first-child]:before:pointer-events-none",
        spellcheck: "true",
        lang: "es",
      },
      transformPastedHTML: cleanPastedHtml,
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastHtml.current = html;
      onChange(html);
      updateSlash(editor);
    },
    onSelectionUpdate: ({ editor }) => updateSlash(editor),
  });

  // External value changes (load / recover / restore)
  useEffect(() => {
    if (editor && value !== lastHtml.current) {
      lastHtml.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  function updateSlash(ed: Editor) {
    const { $from, empty } = ed.state.selection;
    if (!empty || $from.parent.type.name !== "paragraph") return setSlash(null);
    const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
    const m = /^\/([\p{L}\d ]{0,20})$/u.exec(text);
    if (!m) return setSlash(null);
    const coords = ed.view.coordsAtPos($from.pos);
    const host = ed.view.dom.closest("[data-editor-root]")!.getBoundingClientRect();
    setSlash({ query: m[1].toLowerCase(), top: coords.bottom - host.top + 6, left: coords.left - host.left, from: $from.start() });
    setActive(0);
  }

  const pickImage = useCallback(() => fileRef.current?.click(), []);

  const insertEmbedFromPrompt = useCallback((ed: Editor, kind: "youtube" | "instagram" | "x") => {
    const url = window.prompt(
      kind === "youtube" ? "Pega el enlace de YouTube" : kind === "instagram" ? "Pega el enlace de la publicación de Instagram" : "Pega el enlace de la publicación de X",
    );
    if (!url) return;
    if (kind === "youtube") {
      const id = youtubeId(url);
      if (!id) return window.alert("Enlace de YouTube no válido");
      ed.chain().focus().insertContent({ type: "embed", attrs: { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` } }).run();
    } else if (kind === "instagram") {
      const src = instagramEmbedUrl(url);
      if (!src) return window.alert("Enlace de Instagram no válido");
      ed.chain().focus().insertContent({ type: "embed", attrs: { provider: "instagram", src } }).run();
    } else {
      if (!/^https:\/\/(x|twitter)\.com\//.test(url.trim())) return window.alert("Enlace de X no válido");
      ed.chain().focus().insertContent(`<p><a href="${url.trim()}">${url.trim()}</a></p>`).run();
    }
  }, []);

  const setLink = useCallback((ed: Editor) => {
    const prev = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enlace (deja vacío para quitar)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") ed.chain().focus().extendMarkRange("link").unsetLink().run();
    else ed.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, []);

  const commands: Cmd[] = useMemo(
    () => [
      { key: "p", label: "Texto", hint: "Párrafo normal", icon: Type, keywords: "texto parrafo", run: (e) => e.chain().focus().setParagraph().run() },
      { key: "h2", label: "Subtítulo", hint: "Sección (H2)", icon: Heading2, keywords: "titulo subtitulo h2 seccion", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
      { key: "h3", label: "Subtítulo menor", hint: "H3", icon: Heading3, keywords: "h3 subtitulo", run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
      { key: "img", label: "Imagen", hint: "Subir foto con pie", icon: ImageIcon, keywords: "imagen foto", run: () => pickImage() },
      { key: "quote", label: "Cita", hint: "Cita destacada", icon: Quote, keywords: "cita quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
      { key: "ul", label: "Lista", hint: "Viñetas", icon: List, keywords: "lista bullets", run: (e) => e.chain().focus().toggleBulletList().run() },
      { key: "ol", label: "Lista numerada", hint: "1, 2, 3", icon: ListOrdered, keywords: "lista numerada", run: (e) => e.chain().focus().toggleOrderedList().run() },
      { key: "yt", label: "YouTube", hint: "Insertar video", icon: Youtube, keywords: "youtube video", run: (e) => insertEmbedFromPrompt(e, "youtube") },
      { key: "ig", label: "Instagram", hint: "Insertar publicación", icon: Instagram, keywords: "instagram ig", run: (e) => insertEmbedFromPrompt(e, "instagram") },
      { key: "x", label: "Publicación de X", hint: "Enlace a post", icon: AtSign, keywords: "x twitter tweet", run: (e) => insertEmbedFromPrompt(e, "x") },
      { key: "hr", label: "Separador", hint: "◆ ◆ ◆", icon: Minus, keywords: "separador divisor linea", run: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
    [pickImage, insertEmbedFromPrompt],
  );

  const filtered = slash
    ? commands.filter((c) => !slash.query || `${c.label} ${c.keywords}`.toLowerCase().includes(slash.query))
    : [];

  const runSlash = useCallback(
    (cmd: Cmd) => {
      if (!editor || !slash) return;
      // Remove the "/query" text, then run the command
      editor.chain().focus().deleteRange({ from: slash.from, to: editor.state.selection.from }).run();
      setSlash(null);
      cmd.run(editor);
    },
    [editor, slash],
  );

  // Keyboard nav for slash menu
  useEffect(() => {
    if (!editor || !slash) return;
    const onKey = (e: KeyboardEvent) => {
      if (!filtered.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        runSlash(filtered[active]);
      } else if (e.key === "Escape") {
        setSlash(null);
      }
    };
    const dom = editor.view.dom;
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
  }, [editor, slash, filtered, active, runSlash]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    if (!file.type.startsWith("image/")) return window.alert("Selecciona una imagen");
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      const caption = window.prompt("Pie de foto (opcional)") ?? "";
      editor.chain().focus().insertContent({ type: "figure", attrs: { src: url, alt: caption, caption } }).run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  const tb = (on: boolean) =>
    cn(
      "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors",
      on ? "bg-foreground text-background" : "text-foreground/80 hover:bg-muted",
    );

  return (
    <div data-editor-root className="relative">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Selection formatting bubble */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: ed, state }) => !state.selection.empty && !ed.isActive("figure") && !ed.isActive("embed")}
        className="flex items-center gap-0.5 rounded-xl border bg-popover p-1 shadow-xl"
      >
        <button type="button" aria-label="Negrita" className={tb(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></button>
        <button type="button" aria-label="Cursiva" className={tb(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></button>
        <button type="button" aria-label="Tachado" className={tb(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></button>
        <button type="button" aria-label="Resaltar" className={tb(editor.isActive("highlight"))} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <button type="button" aria-label="Enlace" className={tb(editor.isActive("link"))} onClick={() => setLink(editor)}><LinkIcon className="h-4 w-4" /></button>
        <button type="button" aria-label="Subtítulo" className={tb(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></button>
        <button type="button" aria-label="Cita" className={tb(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></button>
      </BubbleMenu>

      {/* "+" on empty lines (desktop) */}
      <FloatingMenu
        editor={editor}
        shouldShow={({ state }) => {
          const { $from, empty } = state.selection;
          return empty && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
        }}
        className="hidden -translate-x-12 md:block"
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().insertContent("/").run()}
          aria-label="Insertar bloque"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:border-brand hover:text-brand"
        >
          <Plus className="h-4 w-4" />
        </button>
      </FloatingMenu>

      <EditorContent editor={editor} />

      {/* Slash command menu */}
      {slash && filtered.length > 0 && (
        <div
          role="listbox"
          aria-label="Insertar"
          className="absolute z-30 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover p-1 shadow-2xl"
          style={{ top: slash.top, left: Math.max(0, Math.min(slash.left, (editor.view.dom as HTMLElement).clientWidth - 288)) }}
        >
          <p className="px-2.5 pb-1 pt-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Insertar</p>
          {filtered.map((c, i) => (
            <button
              key={c.key}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                runSlash(c);
              }}
              className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === active ? "bg-muted" : "")}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                <c.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{c.label}</span>
                <span className="block text-xs text-muted-foreground">{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {uploading && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" /> Subiendo imagen…
        </div>
      )}

      {/* Mobile formatting bar (sits above the keyboard) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]">
          <button type="button" aria-label="Insertar" className={cn(tb(false), "bg-brand text-brand-foreground hover:bg-brand")} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().insertContent("/").run()}><Plus className="h-5 w-5" /></button>
          <button type="button" aria-label="Imagen" className={tb(false)} onMouseDown={(e) => e.preventDefault()} onClick={pickImage}><ImageIcon className="h-5 w-5" /></button>
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          <button type="button" aria-label="Negrita" className={tb(editor.isActive("bold"))} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-5 w-5" /></button>
          <button type="button" aria-label="Cursiva" className={tb(editor.isActive("italic"))} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-5 w-5" /></button>
          <button type="button" aria-label="Subtítulo" className={tb(editor.isActive("heading", { level: 2 }))} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-5 w-5" /></button>
          <button type="button" aria-label="Cita" className={tb(editor.isActive("blockquote"))} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-5 w-5" /></button>
          <button type="button" aria-label="Lista" className={tb(editor.isActive("bulletList"))} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-5 w-5" /></button>
          <button type="button" aria-label="Enlace" className={tb(editor.isActive("link"))} onMouseDown={(e) => e.preventDefault()} onClick={() => setLink(editor)}><LinkIcon className="h-5 w-5" /></button>
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          <button type="button" aria-label="Deshacer" className={tb(false)} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-5 w-5" /></button>
          <button type="button" aria-label="Rehacer" className={tb(false)} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
