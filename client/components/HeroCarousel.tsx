import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Article } from "@shared/api";
import { ARTICLE_PLACEHOLDER, articleImageSrcSet, articleImageUrl, IMAGE_SIZES } from "@/lib/images";
import { formatRelative } from "@/lib/format";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 7000;

function fallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.removeAttribute("srcset");
  img.src = ARTICLE_PLACEHOLDER;
}

/**
 * Cinematic hero: big slide with overlaid headline + "mini views" rail
 * (vertical on desktop, swipeable strip on mobile) with per-slide progress.
 * Auto-advances, pauses on hover/focus/hidden tab, supports keyboard + swipe,
 * and respects prefers-reduced-motion.
 */
export default function HeroCarousel({ articles }: { articles: Article[] }) {
  const slides = articles.slice(0, 5);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const reduced = useReducedMotion();
  const touchX = useRef<number | null>(null);
  const railRef = useRef<HTMLOListElement>(null);

  const count = slides.length;
  const go = useCallback(
    (next: number, dir?: number) => {
      if (!count) return;
      const target = (next + count) % count;
      setDirection(dir ?? (target > index ? 1 : -1));
      setIndex(target);
      setProgress(0);
    },
    [count, index],
  );

  // Progress clock (drives the mini-view bars and auto-advance)
  const running = !paused && !userPaused && !reduced && count > 1;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / INTERVAL_MS;
        if (np >= 1) {
          setDirection(1);
          setIndex((i) => (i + 1) % count);
          return 0;
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, count]);

  // Pause when tab is hidden
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Keep active mini view in view on mobile strip
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
  }, [index, reduced]);

  if (!count) return null;
  const a = slides[index];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1, 1);
    if (e.key === "ArrowLeft") go(index - 1, -1);
  };

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Historias destacadas"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKey}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* ── Main slide ─────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-xl bg-neutral-950 lg:col-span-8"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto lg:h-[min(72vh,640px)]">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={a.id}
                custom={direction}
                className="absolute inset-0"
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 60, scale: 1.04 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -60, scale: 0.98 }}
                transition={{ duration: reduced ? 0.2 : 0.75, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.img
                  src={articleImageUrl(a.image_url)}
                  srcSet={articleImageSrcSet(a.image_url)}
                  sizes={IMAGE_SIZES.lead}
                  alt=""
                  onError={fallback}
                  data-no-dim
                  // @ts-expect-error — valid HTML attribute
                  fetchpriority={index === 0 ? "high" : "auto"}
                  className="h-full w-full object-cover"
                  initial={{ scale: 1 }}
                  animate={reduced ? undefined : { scale: 1.08 }}
                  transition={{ duration: INTERVAL_MS / 1000 + 1, ease: "linear" }}
                />
              </motion.div>
            </AnimatePresence>

            {/* Legibility gradients */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

            {/* Slide counter */}
            <div className="absolute left-4 top-4 flex items-center gap-2 sm:left-6 sm:top-6">
              <span className="rounded-full bg-black/50 px-3 py-1 font-sans text-xs font-semibold tabular-nums text-white backdrop-blur">
                {String(index + 1).padStart(2, "0")}
                <span className="text-white/50"> / {String(count).padStart(2, "0")}</span>
              </span>
            </div>

            {/* Copy */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`copy-${a.id}`}
                className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0, transition: { delay: reduced ? 0 : 0.2, duration: 0.5 } }}
                exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-foreground">
                  {a.category_name}
                </span>
                <h2 className="mt-4 max-w-3xl font-display text-[1.75rem] font-bold leading-[1.05] tracking-tight text-white text-balance sm:text-4xl lg:text-5xl">
                  <Link to={`/articulo/${a.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {a.title}
                  </Link>
                </h2>
                {a.excerpt && (
                  <p className="mt-3 hidden max-w-2xl font-body text-base leading-relaxed text-white/80 sm:line-clamp-2 sm:text-lg">
                    {a.excerpt}
                  </p>
                )}
                <p className="mt-4 flex flex-wrap items-center gap-x-2 font-sans text-xs text-white/70 sm:text-sm">
                  <span className="font-semibold text-white">{a.author_name}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={a.published_at ?? undefined}>{formatRelative(a.published_at)}</time>
                  <span aria-hidden>·</span>
                  <span>{a.read_time_minutes} min</span>
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Controls */}
            {count > 1 && (
              <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 sm:right-6 sm:top-6">
                <button
                  type="button"
                  onClick={() => setUserPaused((p) => !p)}
                  aria-label={userPaused ? "Reanudar carrusel" : "Pausar carrusel"}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-white hover:text-black"
                >
                  {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => go(index - 1, -1)}
                  aria-label="Anterior"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-white hover:text-black"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1, 1)}
                  aria-label="Siguiente"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-white hover:text-black"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Mobile segmented progress */}
            <div className="absolute inset-x-5 top-[4.25rem] flex gap-1 sm:hidden" aria-hidden>
              {slides.map((s, i) => (
                <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    className="block h-full bg-white"
                    style={{ width: i < index ? "100%" : i === index ? `${(reduced ? 1 : progress) * 100}%` : "0%" }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Mini views ─────────────────────────────────────── */}
        <ol
          ref={railRef}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:col-span-4 lg:mx-0 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0"
          aria-label="Vistas previas"
        >
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <li key={s.id} data-idx={i} className="w-[72%] shrink-0 snap-start sm:w-[42%] lg:w-auto lg:flex-1">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={active ? "true" : undefined}
                  aria-label={`Ver: ${s.title}`}
                  className={cn(
                    "group relative flex h-full w-full items-center gap-3 overflow-hidden rounded-lg border p-2 text-left transition-all duration-300 lg:p-2.5",
                    active
                      ? "border-brand/40 bg-brand/[0.06] shadow-sm"
                      : "border-border bg-card hover:border-foreground/20 hover:bg-muted/60",
                  )}
                >
                  <span className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:w-24">
                    <img
                      src={articleImageUrl(s.image_url)}
                      srcSet={articleImageSrcSet(s.image_url)}
                      sizes="96px"
                      alt=""
                      loading="lazy"
                      onError={fallback}
                      className={cn(
                        "h-full w-full object-cover transition duration-500",
                        active ? "scale-105" : "grayscale-[35%] group-hover:grayscale-0",
                      )}
                    />
                    <span
                      className={cn(
                        "absolute left-1 top-1 rounded bg-black/60 px-1.5 font-sans text-[10px] font-bold tabular-nums text-white",
                        active && "bg-brand",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("kicker block", !active && "!text-muted-foreground")}>{s.category_name}</span>
                    <span className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug">
                      {s.title}
                    </span>
                  </span>
                  {/* Progress bar */}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent">
                    <span
                      className="block h-full bg-brand"
                      style={{
                        width: active ? `${(running ? progress : userPaused || reduced ? 1 : progress) * 100}%` : "0%",
                        transition: active && running ? "none" : "width 300ms",
                      }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
