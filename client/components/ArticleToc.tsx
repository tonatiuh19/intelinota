import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function slug(text: string, used: Set<string>): string {
  const base =
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "seccion";
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  used.add(id);
  return id;
}

/** Collects h2/h3 inside `root`, assigns stable ids, tracks the active one. */
export function useArticleToc(rootSelector: string, deps: unknown[]) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const used = new Set<string>();
    const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2, h3"));
    const list = headings
      .filter((h) => h.textContent?.trim())
      .map((h) => {
        if (!h.id) h.id = slug(h.textContent!.trim(), used);
        h.classList.add("scroll-mt-28");
        return { id: h.id, text: h.textContent!.trim(), level: (h.tagName === "H3" ? 3 : 2) as 2 | 3 };
      });
    setItems(list);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -65% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items, activeId };
}

export default function ArticleToc({
  items,
  activeId,
  progress,
  minutesLeft,
}: {
  items: TocItem[];
  activeId: string | null;
  progress: number;
  minutesLeft: number;
}) {
  return (
    <nav aria-label="En este artículo" className="space-y-4">
      <div>
        <div className="space-y-0.5">
          <p className="kicker !text-muted-foreground">En este artículo</p>
          <span className="block font-sans text-[11px] tabular-nums text-muted-foreground">
            {progress >= 0.99 ? "Terminado" : `${minutesLeft} min restantes`}
          </span>
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
      {items.length > 0 && (
        <ol className="relative space-y-0.5 border-l">
          {items.map((it) => {
            const active = it.id === activeId;
            return (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    history.replaceState(null, "", `#${it.id}`);
                  }}
                  className={cn(
                    "-ml-px block border-l-2 py-1.5 font-sans text-[13px] leading-snug transition-colors",
                    it.level === 3 ? "pl-6" : "pl-3.5",
                    active
                      ? "border-brand font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {it.text}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
