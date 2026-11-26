import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import PageLoader from "@/components/PageLoader";
import Layout from "@/components/Layout";
import NotFound from "@/pages/NotFound";

const Index = lazy(() => import("@/pages/Index"));
const Article = lazy(() => import("@/pages/Article"));
const Category = lazy(() => import("@/pages/Category"));
const AuthorPage = lazy(() => import("@/pages/Author"));
const AuthorsIndex = lazy(() => import("@/pages/AuthorsIndex"));
const Bookmarks = lazy(() => import("@/pages/Bookmarks"));
const SearchPage = lazy(() => import("@/pages/Search"));
const About = lazy(() => import("@/pages/About"));
const Team = lazy(() => import("@/pages/Team"));
const Contact = lazy(() => import("@/pages/Contact"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const NewsletterStatus = lazy(() => import("@/pages/NewsletterStatus"));
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const McpConsent = lazy(() => import("@/pages/admin/McpConsent"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Articles = lazy(() => import("@/pages/admin/Articles"));
const ArticleEditor = lazy(() => import("@/pages/admin/ArticleEditor"));
const Authors = lazy(() => import("@/pages/admin/Authors"));
const Profile = lazy(() => import("@/pages/admin/Profile"));
const AdminComments = lazy(() => import("@/pages/admin/Comments"));
const AdminCategories = lazy(() => import("@/pages/admin/Categories"));
const AdminNewsletter = lazy(() => import("@/pages/admin/Newsletter"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminActivity = lazy(() => import("@/pages/admin/Activity"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const TagPage = lazy(() => import("@/pages/Tag"));

function PublicLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function RedirectArticle() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/articulo/${slug}`} replace />;
}

function RedirectCategory() {
  const { category } = useParams<{ category: string }>();
  return <Navigate to={`/categoria/${category}`} replace />;
}

function RedirectAuthor() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/autor/${slug}`} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/mcp-consent" element={<McpConsent />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="articles" element={<Articles />} />
          <Route path="articles/new" element={<ArticleEditor />} />
          <Route path="articles/:id/edit" element={<ArticleEditor />} />
          <Route path="authors" element={<Authors />} />
          <Route path="comments" element={<AdminComments />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="newsletter" element={<AdminNewsletter />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/article/:slug" element={<RedirectArticle />} />
        <Route path="/article" element={<Navigate to="/" replace />} />
        <Route path="/category/:category" element={<RedirectCategory />} />
        <Route path="/category" element={<Navigate to="/" replace />} />
        <Route path="/author/:slug" element={<RedirectAuthor />} />

        <Route element={<PublicLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/articulo/:slug" element={<Article />} />
          <Route path="/articulo" element={<Navigate to="/" replace />} />
          <Route path="/categoria/:category" element={<Category />} />
          <Route path="/categoria" element={<Navigate to="/" replace />} />
          <Route path="/autor/:slug" element={<AuthorPage />} />
          <Route path="/autores" element={<AuthorsIndex />} />
          <Route path="/favoritos" element={<Bookmarks />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/newsletter" element={<NewsletterStatus />} />
          <Route path="/tema/:slug" element={<TagPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
