import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  LogOut,
  Menu,
  Radio,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { setAuthToken } from "@/lib/api";
import { useSecurityAlerts } from "@/hooks/use-security-alerts";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutModal } from "@/components/admin/SessionTimeoutModal";

const NAV_ITEMS = [
  { path: "/admin", label: "Dashboard", icon: BarChart3, badge: false },
  { path: "/admin/users", label: "User Management", icon: Users, badge: false },
  { path: "/admin/requests", label: "Crisis Requests", icon: FileText, badge: false },
  { path: "/admin/logs", label: "Activity Logs", icon: Activity, badge: true },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { unreadCount, clearAlerts } = useSecurityAlerts();

  const handleExpire = () => {
    setAuthToken(null);
    localStorage.removeItem("crisisgrid_user");
    navigate("/admin-login?reason=timeout");
  };

  const { showWarning, secondsLeft, extendSession } = useSessionTimeout(handleExpire);

  useEffect(() => {
    if (location.pathname === "/admin/logs") clearAlerts();
    setSidebarOpen(false);
  }, [location.pathname, clearAlerts]);

  const handleSignOut = () => {
    setAuthToken(null);
    localStorage.removeItem("crisisgrid_user");
    navigate("/");
  };

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5">
        <ShieldCheck className="h-5 w-5 text-destructive shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-wide">CrisisGrid</h1>
          <p className="text-[10px] text-muted-foreground">Command Center</p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const showBadge = item.badge && unreadCount > 0 && !isActive;
          return (
            <Link key={item.path} to={item.path}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {showBadge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3 space-y-2">
        <Link to="/dashboard">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            data-testid="nav-map-view"
          >
            <Radio className="h-4 w-4" />
            Map View
          </button>
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-destructive"
          data-testid="button-admin-signout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border/60 bg-[hsl(var(--surface-glass))/0.97] backdrop-blur transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <SidebarContent />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-[hsl(var(--surface-glass))/0.95] px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-destructive" />
            <span className="text-sm font-bold tracking-wide">CrisisGrid</span>
          </div>
          {unreadCount > 0 && (
            <Link to="/admin/logs" className="ml-auto flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-400">
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 99 ? "99+" : unreadCount}
            </Link>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <SessionTimeoutModal
        open={showWarning}
        secondsLeft={secondsLeft}
        onExtend={extendSession}
        onSignOut={handleSignOut}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
};

export default AdminLayout;
