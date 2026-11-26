import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Globe,
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAuthor,
  clearAuthor,
  selectAuthor,
  selectAuthorLoading,
  selectAuthorError,
} from "@/store/slices/authorsSlice";
import { parseSocialLinks } from "@/lib/socialLinks";
import MetaHead from "@/components/MetaHead";
import ArticleCard from "@/components/ArticleCard";
import StaggerGrid, { StaggerItem } from "@/components/motion/StaggerGrid";
import {
  buildBreadcrumbJsonLd,
  buildPersonJsonLd,
  canonicalUrl,
  mergeJsonLd,
  twitterHandle,
} from "@/lib/seo";

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const dispatch = useAppDispatch();
  const author = useAppSelector(selectAuthor);
  const loading = useAppSelector(selectAuthorLoading);
  const error = useAppSelector(selectAuthorError);

  useEffect(() => {
    if (slug) dispatch(fetchAuthor(slug));
    return () => {
      dispatch(clearAuthor());
    };
  }, [dispatch, slug]);

  if (loading) {
    return (
      <div className="container max-w-4xl space-y-6 px-4 py-14 sm:px-6 lg:px-8">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="container px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="kicker">Autor</p>
        <h1 className="mt-3 font-display text-display-lg font-bold">
          {error ?? "Autor no encontrado"}
        </h1>
        <Button asChild variant="outline" className="mt-8 h-11">
          <Link to="/autores">Ver todos los autores</Link>
        </Button>
      </div>
    );
  }

  const social = parseSocialLinks(author.social_links);
  const socialLinks = [
    author.twitter_handle && {
      href: `https://twitter.com/${author.twitter_handle.replace(/^@/, "")}`,
      icon: Twitter,
      label: "X",
    },
    social.facebook && { href: social.facebook, icon: Facebook, label: "Facebook" },
    social.instagram && {
      href: social.instagram,
      icon: Instagram,
      label: "Instagram",
    },
    social.linkedin && {
      href: social.linkedin,
      icon: Linkedin,
      label: "LinkedIn",
    },
    social.youtube && { href: social.youtube, icon: Youtube, label: "YouTube" },
    social.tiktok && { href: social.tiktok, icon: FaTiktok, label: "TikTok" },
    social.website && { href: social.website, icon: Globe, label: "Web" },
  ].filter(Boolean) as Array<{
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }>;

  return (
    <div className="pb-24">
      <MetaHead
        title={author.name}
        description={author.bio ?? `Artículos de ${author.name} en Intelinota`}
        ogType="profile"
        ogImage={author.avatar_url ?? undefined}
        canonical={canonicalUrl(`/autor/${author.slug}`)}
        author={author.name}
        twitterCreator={twitterHandle(author.twitter_handle)}
        jsonLd={mergeJsonLd(
          buildPersonJsonLd({
            name: author.name,
            description: author.bio ?? `Autor en Intelinota`,
            url: `/autor/${author.slug}`,
            imageUrl: author.avatar_url,
          }),
          buildBreadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Autores", path: "/autores" },
            { name: author.name, path: `/autor/${author.slug}` },
          ]),
        )}
      />

      <header className="container px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="flex flex-col gap-6 border-b-2 border-rule pb-8 sm:flex-row sm:items-end">
          <Avatar className="h-24 w-24 shrink-0 sm:h-28 sm:w-28">
            <AvatarImage src={author.avatar_url ?? undefined} alt={author.name} />
            <AvatarFallback className="font-display text-3xl font-bold">
              {author.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="kicker">Autor</p>
            <h1 className="font-display text-display-xl font-bold">{author.name}</h1>
            {author.bio && (
              <p className="max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
                {author.bio}
              </p>
            )}
          </div>
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="container mt-10 px-4 sm:px-6 lg:px-8" aria-labelledby="author-stories">
        <h2 id="author-stories" className="mb-8 font-display text-2xl font-bold">
          Historias <span className="text-base font-normal text-muted-foreground">({author.articles.length})</span>
        </h2>

        {author.articles.length === 0 ? (
          <p className="py-12 text-center font-body text-muted-foreground">
            Este autor aún no tiene artículos publicados.
          </p>
        ) : (
          <StaggerGrid className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {author.articles.map((article) => (
              <StaggerItem key={article.id}>
                <ArticleCard article={article} variant="grid" />
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </section>
    </div>
  );
}
