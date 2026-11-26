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
import { SITE_LOGO } from "@/lib/branding";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminSettings, selectAdminAppVersion } from "@/store/slices/adminSettingsSlice";

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
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
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

  useEffect(() => {
    if (user?.role === "admin") {
      dispatch(fetchAdminSettings());
    }
  }, [dispatch, user?.role]);

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
        <div className="flex-1 min-w-0">
          <img
            src={SITE_LOGO}
            alt="INTELINOTA"
            className="h-6 w-auto object-contain"
          />
          <div className="text-xs text-muted-foreground mt-0.5">
            Panel Admin
          </div>
        </div>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
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
              <AvatarFallback className="bg-blue-600/20 text-blue-400 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">
                {user?.name ?? user?.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {user?.role === "admin" ? (
                  <Shield className="w-3 h-3 text-blue-400" />
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
            className="w-8 h-8 text-muted-foreground hover:text-foreground flex-shrink-0"
            title="Cerrar sesión"
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
      <div className="h-screen flex bg-background overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card/40 flex-shrink-0 overflow-y-auto">
          <Sidebar />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-10 w-72 bg-card border-r border-border">
              <Sidebar mobile />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="flex items-center gap-4 px-4 sm:px-6 h-14 border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-30">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Admin</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">{pageTitle}</span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
