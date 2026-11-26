import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAdminMe,
  logout,
  selectAdminUser,
  selectAdminToken,
} from "@/store/slices/adminAuthSlice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logo from "@/components/Logo";
import MetaHead from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  Pen,
  MessageSquare,
  FolderTree,
  Mail,
  Settings,
  Activity,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminSettings, selectAdminAppVersion } from "@/store/slices/adminSettingsSlice";
import { fetchNotifications } from "@/store/slices/notificationsSlice";
import { fetchReviewQueue, selectReviewCount } from "@/store/slices/adminReviewsSlice";
import NotificationBell from "@/components/admin/NotificationBell";

const POLL_MS = 60_000;

const ALL_NAV_ITEMS = [
  {
    to: "/admin/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    adminOnly: false,
  },
  {
    to: "/admin/articles",
    icon: FileText,
    label: "Artículos",
    adminOnly: false,
  },
  {
    to: "/admin/reviews",
    icon: ClipboardCheck,
    label: "Revisión",
    adminOnly: true,
  },
  { to: "/admin/authors", icon: Users, label: "Autores", adminOnly: true },
  {
    to: "/admin/comments",
    icon: MessageSquare,
    label: "Comentarios",
    adminOnly: true,
  },
  {
    to: "/admin/categories",
    icon: FolderTree,
    label: "Categorías",
    adminOnly: true,
  },
  {
    to: "/admin/newsletter",
    icon: Mail,
    label: "Newsletter",
    adminOnly: true,
  },
  {
    to: "/admin/activity",
    icon: Activity,
    label: "Actividad",
    adminOnly: true,
  },
  {
    to: "/admin/settings",
    icon: Settings,
    label: "Configuración",
    adminOnly: true,
  },
];

function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAdminToken);
  const user = useAppSelector(selectAdminUser);

  useEffect(() => {
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!user) {
      dispatch(fetchAdminMe())
        .unwrap()
        .catch(() => {
          navigate("/admin/login", { replace: true });
        });
    }
  }, [token, user, dispatch, navigate]);

  if (!token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector(selectAdminUser);
  const appVersion = useAppSelector(selectAdminAppVersion);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const reviewCount = useAppSelector(selectReviewCount);

  useEffect(() => {
    if (user?.role === "admin") {
      dispatch(fetchAdminSettings());
    }
  }, [dispatch, user?.role]);

  // Notifications (+ review queue badge for admins): every 60s while the
  // tab is visible, and immediately when the window regains focus
  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === "admin";
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      dispatch(fetchNotifications());
      if (isAdmin) dispatch(fetchReviewQueue());
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [dispatch, user?.id, user?.role]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/admin/login", { replace: true });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A";

  // Get page title from current route
  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin",
  );

  const currentNav = navItems.find((n) => location.pathname.startsWith(n.to));
  const pageTitle =
    location.pathname.includes("/profile")
      ? "Perfil"
      : location.pathname.includes("/articles/")
        ? "Editor"
        : (currentNav?.label ?? "Admin");

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full", mobile ? "p-4" : "p-6")}>
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/admin/dashboard"
          onClick={() => setSidebarOpen(false)}
          className="flex-1 min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Logo className="h-6" />
          <div className="kicker mt-1.5 text-muted-foreground">
            Redacción
          </div>
        </Link>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-10 w-10"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 min-h-10 py-2 rounded-lg text-sm font-medium transition-colors duration-150 border",
                isActive
                  ? "bg-brand/10 text-brand border-brand/20"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            {to === "/admin/reviews" && reviewCount > 0 && (
              <span className="ml-auto inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                {reviewCount > 99 ? "99+" : reviewCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="pt-4 border-t border-border mt-4">
        <div className="flex items-center gap-1">
          <Link
            to="/admin/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-2 py-2 rounded-lg flex-1 min-w-0 hover:bg-accent/60 transition-colors group"
          >
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage
                src={user?.avatar_url ?? undefined}
                alt={user?.name ?? ""}
              />
              <AvatarFallback className="bg-brand/15 text-brand text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate group-hover:text-brand transition-colors">
                {user?.name ?? user?.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {user?.role === "admin" ? (
                  <Shield className="w-3 h-3 text-brand" />
                ) : (
                  <Pen className="w-3 h-3 text-emerald-400" />
                )}
                <span className="capitalize">{user?.role}</span>
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="w-10 h-10 text-muted-foreground hover:text-foreground flex-shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        {appVersion && (
          <p className="text-[10px] text-muted-foreground/50 font-mono px-2 pb-2">
            {appVersion}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <AdminGuard>
      <MetaHead
        title={`Admin — ${pageTitle}`}
        description="Panel de administración de Intelinota."
        noIndex
        includeSiteOrganization={false}
      />
      {/*
        Layout: the window is the ONLY scroll container. The desktop sidebar
        and the top bar are `sticky`, so `position: sticky` elements inside
        pages keep working (offset them with `top-14` to clear the top bar).
      */}
      <div className="min-h-screen flex bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen border-r border-border bg-card/40 overflow-y-auto overscroll-contain">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] h-full overflow-y-auto overscroll-contain bg-card border-r border-border animate-in slide-in-from-left duration-200">
              <Sidebar mobile />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-2 sm:gap-4 px-4 sm:px-6 h-14 border-b border-border bg-background/80 backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 -ml-2"
              aria-label="Abrir menú"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="hidden sm:inline text-muted-foreground">
                Admin
              </span>
              <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium truncate">
                {pageTitle}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* header-actions */}
              <NotificationBell />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 min-w-0 px-4 py-4 sm:px-6 sm:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
