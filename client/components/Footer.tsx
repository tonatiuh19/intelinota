import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Twitter, Instagram, Linkedin, Github, Facebook, Rss } from "lucide-react";
import NewsletterForm from "@/components/NewsletterForm";
import Logo from "@/components/Logo";
import { SITE_SOCIAL } from "@/lib/socialLinks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchHome, selectHomeMeta } from "@/store/slices/homeSlice";
import { selectCategories } from "@/store/slices/categoriesSlice";
import { categoryUrlPath } from "@/lib/categorySlugs";

const SOCIAL_LINKS = [
  { href: SITE_SOCIAL.facebook, icon: Facebook, label: "Facebook" },
  { href: SITE_SOCIAL.twitter, icon: Twitter, label: "X / Twitter" },
  { href: SITE_SOCIAL.instagram, icon: Instagram, label: "Instagram" },
  { href: SITE_SOCIAL.linkedin, icon: Linkedin, label: "LinkedIn" },
  { href: SITE_SOCIAL.github, icon: Github, label: "GitHub" },
] as const;

const ABOUT_LINKS = [
  { to: "/about", label: "Nuestra historia" },
  { to: "/autores", label: "Autores" },
  { to: "/team", label: "El equipo" },
  { to: "/favoritos", label: "Favoritos" },
  { to: "/contact", label: "Contacto" },
  { to: "/privacy", label: "Privacidad" },
];

const linkCls = "inline-flex min-h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground";

export default function Footer() {
  const dispatch = useAppDispatch();
  const meta = useAppSelector(selectHomeMeta);
  const categories = useAppSelector(selectCategories);

  useEffect(() => {
    dispatch(fetchHome());
  }, [dispatch]);

  const appVersion = meta?.app_version?.trim();

  return (
    <footer className="mt-12 border-t-2 border-rule bg-background">
      <div className="container px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b pb-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Link to="/" aria-label="INTELINOTA — Inicio" className="inline-flex">
              <Logo className="h-7" />
            </Link>
            <p className="max-w-xs font-body text-[15px] leading-relaxed text-muted-foreground">
              Noticias que piensan. Cobertura rigurosa de tecnología, deportes y cultura para lectores curiosos.
            </p>
            <div className="flex flex-wrap gap-1">
              {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
              <a
                href="/rss.xml"
                aria-label="Feed RSS"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-brand"
              >
                <Rss className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>

          <nav aria-label="Secciones" className="lg:col-span-2">
            <h2 className="kicker mb-3 !text-foreground">Secciones</h2>
            <ul className="space-y-1">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link to={categoryUrlPath(cat.slug)} className={linkCls}>
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="INTELINOTA" className="lg:col-span-2">
            <h2 className="kicker mb-3 !text-foreground">INTELINOTA</h2>
            <ul className="space-y-1">
              {ABOUT_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="/rss.xml" className={linkCls}>
                  RSS
                </a>
              </li>
            </ul>
          </nav>

          <div className="space-y-3 sm:col-span-2 lg:col-span-4">
            <h2 className="font-display text-xl font-bold">El boletín de la mañana</h2>
            <p className="font-body text-[15px] text-muted-foreground">
              Lo esencial del día en tu correo. Gratis, sin spam.
            </p>
            <NewsletterForm variant="footer" source="footer" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
            <span>© {new Date().getFullYear()} INTELINOTA. Todos los derechos reservados.</span>
            {appVersion && (
              <span className="font-mono opacity-60" title="Versión desplegada">
                {appVersion}
              </span>
            )}
          </div>
          <Link to="/admin/login" className="opacity-50 transition-opacity hover:opacity-100">
            Acceso redacción
          </Link>
        </div>
      </div>
    </footer>
  );
}
