import { Link } from "react-router-dom";
import { Search, Menu, User, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCategories } from "@/store/slices/categoriesSlice";
import { fetchHome } from "@/store/slices/homeSlice";

// Maps DB category slugs (Spanish) to the English URL slugs used by the router
const DB_SLUG_TO_URL: Record<string, string> = {
  deportes: "sports",
  tecnologia: "technology",
  videojuegos: "video-games",
  cine: "cinema",
  mundo: "world-news",
};

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectCategories);

  // Always dispatch fetchHome — its built-in condition guard skips the
  // network call if home data is already loaded or in-flight.
  // Categories are populated as a side-effect via the extraReducer.
  useEffect(() => {
    dispatch(fetchHome());
  }, [dispatch]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-black tracking-tighter text-primary italic">
              INTELINOTA
            </span>
          </Link>
          <div className="hidden lg:flex items-center space-x-6 text-sm font-medium">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${DB_SLUG_TO_URL[cat.slug] ?? cat.slug}`}
                className="transition-colors hover:text-primary text-muted-foreground"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar noticias..."
              className="pl-8 bg-muted/50 border-none focus-visible:ring-1"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden border-t bg-background p-4 space-y-4">
          <div className="flex flex-col space-y-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${DB_SLUG_TO_URL[cat.slug] ?? cat.slug}`}
                className="text-lg font-medium hover:text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                {cat.name}
              </Link>
            ))}
          </div>
          <div className="relative pt-2">
            <Search className="absolute left-2 top-4.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar noticias..."
              className="pl-8 bg-muted/50 border-none"
            />
          </div>
        </div>
      )}
    </nav>
  );
}
