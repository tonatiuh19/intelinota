import { Link, NavLink } from "react-router-dom";
import { Search, Menu, Bookmark, Mail } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCategories } from "@/store/slices/categoriesSlice";
import { fetchHome } from "@/store/slices/homeSlice";
import { setSearchOpen } from "@/store/slices/uiSlice";
import { DB_SLUG_TO_URL } from "@/lib/categorySlugs";
import { BOOKMARKS_CHANGED, getBookmarkCount } from "@/lib/share";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import SearchOverlay from "@/components/SearchOverlay";

const todayLabel = () => {
  const label = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(() => getBookmarkCount());
  const [compact, setCompact] = useState(false);
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectCategories);
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  // Compact as soon as the reader scrolls into the hero / content
  useMotionValueEvent(scrollY, "change", (y) => setCompact(y > 48));

  useEffect(() => {
    dispatch(fetchHome());
  }, [dispatch]);

  useEffect(() => {
    function refresh() {
      setBookmarkCount(getBookmarkCount());
    }
    window.addEventListener("storage", refresh);
    window.addEventListener(BOOKMARKS_CHANGED, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BOOKMARKS_CHANGED, refresh);
    };
  }, []);

  const openSearch = () => {
    setIsMenuOpen(false);
    dispatch(setSearchOpen(true));
  };

  const sectionLinks = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    to: `/categoria/${DB_SLUG_TO_URL[cat.slug] ?? cat.slug}`,
  }));

  return (
    <>
      {/* Utility strip — desktop only */}
      <div className="hidden border-b bg-background md:block">
        <div className="container flex h-9 items-center justify-between px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span>{todayLabel()}</span>
          <div className="flex items-center gap-5">
            <Link to="/#newsletter" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> Boletín
            </Link>
            <Link to="/autores" className="hover:text-foreground">Autores</Link>
            <Link to="/about" className="hover:text-foreground">Nosotros</Link>
          </div>
        </div>
      </div>

      <nav
        aria-label="Principal"
        className={cn(
          "sticky top-0 z-50 w-full border-b transition-[background-color,box-shadow,border-color] duration-300 ease-editorial",
          compact
            ? "border-border/80 bg-background/95 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85"
            : "border-transparent bg-background",
        )}
      >
        <div
          className={cn(
            "container flex items-center gap-4 px-4 transition-[height] duration-300 ease-editorial sm:px-6 lg:gap-8 lg:px-8",
            compact ? "h-14" : "h-16 md:h-[76px]",
          )}
        >
          {/* Logo — always visible, scales down in compact mode */}
          <Link
            to="/"
            aria-label="INTELINOTA — Inicio"
            className="group relative flex shrink-0 items-center"
          >
            <span
              className={cn(
                "block origin-left transition-transform duration-300 ease-editorial",
                compact ? "scale-[0.82]" : "scale-100",
              )}
            >
              <Logo className="h-6 md:h-7" />
            </span>
            <span
              aria-hidden
              className="absolute -bottom-1.5 left-0 h-[3px] w-0 bg-brand transition-all duration-300 ease-editorial group-hover:w-8"
            />
          </Link>

          <span aria-hidden className="hidden h-6 w-px bg-border md:block" />

          {/* Sections */}
          <div className="mask-fade-r hidden min-w-0 flex-1 overflow-x-auto md:block">
            <ul className="flex items-center gap-0.5 whitespace-nowrap pr-6">
              {sectionLinks.map((s) => (
                <li key={s.id}>
                  <NavLink
                    to={s.to}
                    className={({ isActive }) =>
                      cn(
                        "relative inline-flex h-10 items-center rounded-full px-3.5 text-[13px] font-semibold tracking-wide transition-colors",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="nav-pill"
                            className="absolute inset-0 rounded-full bg-brand/10 ring-1 ring-brand/25"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span className="relative">{s.name}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={openSearch}
              className="hidden h-10 items-center gap-2 rounded-full border bg-muted/40 px-3.5 text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground lg:inline-flex"
            >
              <Search className="h-4 w-4" />
              Buscar
              <kbd className="ml-3 rounded border bg-background px-1.5 font-sans text-[10px]">⌘K</kbd>
            </button>
            <IconButton label="Buscar" onClick={openSearch} className="lg:hidden">
              <Search className="h-5 w-5" />
            </IconButton>
            <Link
              to="/favoritos"
              className="relative hidden h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
              aria-label={bookmarkCount > 0 ? `Favoritos (${bookmarkCount})` : "Favoritos"}
            >
              <Bookmark className="h-5 w-5" />
              {bookmarkCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
                  {bookmarkCount > 9 ? "9+" : bookmarkCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
            <Link
              to="/#newsletter"
              className="ml-2 hidden h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-brand hover:text-brand-foreground xl:inline-flex"
            >
              Suscríbete
            </Link>
            <IconButton label="Abrir menú" onClick={() => setIsMenuOpen(true)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
        {/* Reading-line accent that appears in compact mode */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 -bottom-px h-px origin-left bg-gradient-to-r from-brand via-brand/40 to-transparent transition-transform duration-500 ease-editorial",
            compact ? "scale-x-100" : "scale-x-0",
          )}
        />
      </nav>

      <SearchOverlay />

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="right" className="w-[85vw] sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-left">
              <Logo className="h-5" />
            </SheetTitle>
          </SheetHeader>
          <button
            type="button"
            onClick={openSearch}
            className="mt-6 flex h-11 w-full items-center gap-2 rounded-full border px-4 text-sm text-muted-foreground"
          >
            <Search className="h-4 w-4" /> Buscar noticias…
          </button>
          <motion.nav
            aria-label="Secciones"
            className="mt-6 flex flex-col"
            initial={reduced ? false : "hidden"}
            animate="visible"
            variants={staggerContainer}
          >
            <p className="kicker mb-2">Secciones</p>
            {sectionLinks.map((s) => (
              <motion.div key={s.id} variants={reduced ? undefined : fadeUp}>
                <Link
                  to={s.to}
                  className="block border-b py-3 font-display text-xl font-semibold hover:text-brand"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {s.name}
                </Link>
              </motion.div>
            ))}
            <motion.div variants={reduced ? undefined : fadeUp}>
              <Link
                to="/favoritos"
                className="flex items-center gap-2 border-b py-3 text-base font-medium hover:text-brand"
                onClick={() => setIsMenuOpen(false)}
              >
                <Bookmark className="h-4 w-4" />
                Favoritos
                {bookmarkCount > 0 && (
                  <span className="text-xs font-bold text-brand">({bookmarkCount})</span>
                )}
              </Link>
            </motion.div>
          </motion.nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
