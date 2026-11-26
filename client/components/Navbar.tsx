import { Link, NavLink, useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setCompact(y > 140));

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

      {/* Masthead (home only, desktop) */}
      {isHome && (
        <div className="hidden bg-background md:block">
          <div className="container flex flex-col items-center px-4 pb-4 pt-7 sm:px-6 lg:px-8">
            <Link to="/" aria-label="INTELINOTA — Inicio">
              <Logo className="h-12 lg:h-14" />
            </Link>
            <p className="mt-3 font-body text-sm italic text-muted-foreground">
              Noticias que piensan. Tecnología, deportes y cultura.
            </p>
          </div>
        </div>
      )}

      <nav
        aria-label="Principal"
        className={cn(
          "sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75",
          isHome && "md:border-t-2 md:border-t-rule",
        )}
      >
        <div className="container flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="INTELINOTA — Inicio"
            className={cn(
              "flex shrink-0 items-center transition-all duration-300 ease-editorial",
              isHome && !compact ? "md:pointer-events-none md:w-0 md:opacity-0" : "md:w-auto md:opacity-100",
            )}
          >
            <Logo className="h-5 sm:h-6" />
          </Link>

          {/* Sections */}
          <div className="mask-fade-x hidden min-w-0 flex-1 overflow-x-auto md:block">
            <ul className={cn("flex items-center gap-1 whitespace-nowrap px-6", isHome && !compact && "md:justify-center")}>
              {sectionLinks.map((s) => (
                <li key={s.id}>
                  <NavLink
                    to={s.to}
                    className={({ isActive }) =>
                      cn(
                        "relative inline-flex h-14 items-center px-3 text-[13px] font-semibold tracking-wide transition-colors hover:text-foreground",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {s.name}
                        {isActive && (
                          <motion.span
                            layoutId="nav-underline"
                            className="absolute inset-x-3 bottom-0 h-0.5 bg-brand"
                          />
                        )}
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
              className="hidden h-9 items-center gap-2 rounded-full border px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground lg:inline-flex"
            >
              <Search className="h-4 w-4" />
              Buscar
              <kbd className="ml-2 rounded border bg-muted px-1.5 font-sans text-[10px]">⌘K</kbd>
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
            <IconButton label="Abrir menú" onClick={() => setIsMenuOpen(true)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
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
