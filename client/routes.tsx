import { Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import Index from "@/pages/Index";
import Article from "@/pages/Article";
import Category from "@/pages/Category";
import Placeholder from "@/pages/Placeholder";
import Layout from "@/components/Layout";
import NotFound from "@/pages/NotFound";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Articles from "@/pages/admin/Articles";
import ArticleEditor from "@/pages/admin/ArticleEditor";
import Authors from "@/pages/admin/Authors";

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
    <Routes>
      {/* Admin standalone page — no site Layout */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin panel — uses AdminLayout with Outlet */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="articles" element={<Articles />} />
        <Route path="articles/new" element={<ArticleEditor />} />
        <Route path="articles/:id/edit" element={<ArticleEditor />} />
        <Route path="authors" element={<Authors />} />
      </Route>

      {/* Legacy English URL redirects */}
      <Route path="/article/:slug" element={<RedirectArticle />} />
      <Route path="/article" element={<Navigate to="/" replace />} />
      <Route path="/category/:category" element={<RedirectCategory />} />
      <Route path="/category" element={<Navigate to="/" replace />} />
      <Route path="/author/:slug" element={<RedirectAuthor />} />

      {/* Public site — uses site Layout with Navbar/Footer */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Index />} />
        <Route path="/articulo/:slug" element={<Article />} />
        <Route path="/articulo" element={<Navigate to="/" replace />} />
        <Route path="/categoria/:category" element={<Category />} />
        <Route path="/categoria" element={<Navigate to="/" replace />} />
        <Route path="/about" element={<Placeholder title="Our Story" />} />
        <Route path="/team" element={<Placeholder title="The Team" />} />
        <Route path="/contact" element={<Placeholder title="Contact Us" />} />
        <Route
          path="/privacy"
          element={<Placeholder title="Privacy Policy" />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
