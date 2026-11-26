import { Link } from "react-router-dom";
import { MoveLeft } from "lucide-react";
import MetaHead from "@/components/MetaHead";
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
  canonicalUrl,
  mergeJsonLd,
  type BreadcrumbItem,
} from "@/lib/seo";

interface StaticPageLayoutProps {
  title: string;
  description: string;
  /** URL path segment, e.g. `/about` */
  path?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
}

export function StaticPageLayout({
  title,
  description,
  path,
  breadcrumbs,
  children,
}: StaticPageLayoutProps) {
  const pagePath = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const crumbItems: BreadcrumbItem[] = breadcrumbs ?? [
    { name: "Inicio", path: "/" },
    { name: title, path: pagePath },
  ];

  return (
    <div className="pb-24">
      <MetaHead
        title={title}
        description={description}
        canonical={canonicalUrl(pagePath)}
        jsonLd={mergeJsonLd(
          buildWebPageJsonLd({ name: title, description, url: pagePath }),
          buildBreadcrumbJsonLd(crumbItems),
        )}
      />
      <div className="container max-w-3xl px-4 py-12 sm:px-6 sm:py-16 md:py-20 lg:px-8">
        <Link
          to="/"
          className="group mb-8 inline-flex h-10 items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <MoveLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Portada
        </Link>
        <p className="kicker">INTELINOTA</p>
        <h1 className="mt-2 border-b-2 border-rule pb-6 font-display text-display-lg font-bold text-balance">
          {title}
        </h1>
        <div className="article-content mt-8 space-y-6">{children}</div>
      </div>
    </div>
  );
}
