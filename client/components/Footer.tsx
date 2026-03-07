import { Link } from "react-router-dom";
import { Twitter, Instagram, Linkedin, Github, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { name: "Deportes", href: "/category/sports" },
  { name: "Tecnología", href: "/category/technology" },
  { name: "Videojuegos", href: "/category/video-games" },
  { name: "Cine", href: "/category/cinema" },
  { name: "Mundo", href: "/category/world-news" },
];

export default function Footer() {
  return (
    <footer className="border-t bg-muted/30 pt-16 pb-8">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <Link to="/" className="text-2xl font-black italic tracking-tighter text-primary">
              INTELINOTA
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs">
              La revista digital inteligente para lectores modernos. Cobertura personalizada, rápida y completa de todo lo que importa.
            </p>
            <div className="flex gap-4">
              <Button variant="ghost" size="icon" className="hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="hover:text-primary transition-colors">
                <Github className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-lg font-bold">Categorías</h4>
            <ul className="space-y-2">
              {CATEGORIES.map((cat) => (
                <li key={cat.name}>
                  <Link to={cat.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-bold">Acerca de</h4>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">Nuestra Historia</Link></li>
              <li><Link to="/team" className="text-sm text-muted-foreground hover:text-primary transition-colors">El Equipo</Link></li>
              <li><Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contáctanos</Link></li>
              <li><Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Política de Privacidad</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-bold">Newsletter</h4>
            <p className="text-sm text-muted-foreground">Suscríbete para recibir las últimas noticias directamente en tu bandeja de entrada.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Correo electrónico"
                className="bg-muted px-4 py-2 rounded-md text-sm w-full border border-transparent focus:outline-none focus:border-primary"
              />
              <Button size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Unirse
              </Button>
            </div>
          </div>
        </div>
        
        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Intelinota. Todos los derechos reservados. Creado para mentes modernas.
        </div>
      </div>
    </footer>
  );
}
