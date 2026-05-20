import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sun,
  User,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api, getAuthToken } from "@/lib/api";
import { cn } from "@/lib/utils";

type AccountRole = "civilian" | "volunteer" | "staff" | "admin" | "superadmin";

interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: AccountRole;
  publicId?: string;
  token: string;
}

interface ShiftData {
  email: string;
  name: string;
  onDurationMs: number;
  tasksResolved: number;
  distanceTraveledKm: number;
}

function loadAuthUser(): AuthUser | null {
  try {
    const token = getAuthToken();
    const stored = localStorage.getItem("crisisgrid_user");
    if (!token || !stored) return null;
    const user = JSON.parse(stored);
    const roleMap: Record<string, AccountRole> = {
      VICTIM: "civilian",
      VOLUNTEER: "volunteer",
      STAFF: "staff",
      ADMIN: "admin",
      SUPERADMIN: "superadmin",
    };
    return {
      id: user.id,
      fullName: user.name || user.fullName || "User",
      email: user.email,
      role: roleMap[user.role] || "civilian",
      publicId: user.publicId,
      token,
    };
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(loadAuthUser);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });
  const [onDuty, setOnDuty] = useState(() => {
    try { return localStorage.getItem("crisisgrid_on_duty") !== "false"; } catch { return true; }
  });
  const [dutyLoading, setDutyLoading] = useState(false);
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);

  const isVolunteer = user?.role === "volunteer" || user?.role === "staff" || user?.role === "admin" || user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin" || user?.role === "staff";

  useEffect(() => {
    if (!user) {
      navigate("/signin");
      return;
    }
    // Load shift data for volunteers
    if (isVolunteer) {
      setShiftLoading(true);
      api.getMyShift()
        .then((data) => setShift(data))
        .catch(() => {})
        .finally(() => setShiftLoading(false));
    }
  }, [user, navigate, isVolunteer]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("crisisgrid_theme", next);
    toast.success(`${next === "dark" ? "Dark" : "Light"} mode enabled`);
  };

  const toggleDuty = async () => {
    if (!user) return;
    const next = !onDuty;
    setDutyLoading(true);
    try {
      await api.setVolunteerAvailability(next);
      setOnDuty(next);
      localStorage.setItem("crisisgrid_on_duty", JSON.stringify(next));
      toast.success(next ? "You're now on duty" : "Marked unavailable");
      // Refresh shift data
      const data = await api.getMyShift();
      setShift(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setDutyLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("crisisgrid_token");
    localStorage.removeItem("crisisgrid_user");
    toast.info("Signed out");
    navigate("/signin");
  };

  const roleLabel = user?.role?.toUpperCase() || "USER";
  const roleColor: Record<string, string> = {
    civilian: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    volunteer: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    staff: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    admin: "bg-red-500/15 text-red-600 dark:text-red-400",
    superadmin: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-20">
        {/* User Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-xl font-bold">{getInitials(user.fullName)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{user.fullName}</h2>
                  <Badge className={cn("text-xs", roleColor[user.role] || roleColor.civilian)}>
                    {roleLabel}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.publicId && (
                  <p className="mt-0.5 text-xs text-muted-foreground">ID: {user.publicId}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  {theme === "light" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-400" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">
                    {theme === "light" ? "Light mode" : "Dark mode"}
                  </p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </CardContent>
        </Card>

        {/* Volunteer Section */}
        {isVolunteer && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Volunteer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* On Duty Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">On Duty</p>
                    <p className="text-xs text-muted-foreground">
                      Share live location for dispatch routing
                    </p>
                  </div>
                </div>
                <Switch
                  checked={onDuty}
                  onCheckedChange={toggleDuty}
                  disabled={dutyLoading}
                />
              </div>

              {/* Shift Stats */}
              {shiftLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : shift ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
                    <p className="mt-1 text-sm font-semibold">{formatDuration(shift.onDurationMs)}</p>
                    <p className="text-[10px] text-muted-foreground">On duty</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    <p className="mt-1 text-sm font-semibold">{shift.tasksResolved}</p>
                    <p className="text-[10px] text-muted-foreground">Resolved</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <Navigation className="mx-auto h-4 w-4 text-blue-500" />
                    <p className="mt-1 text-sm font-semibold">{shift.distanceTraveledKm.toFixed(1)} km</p>
                    <p className="text-[10px] text-muted-foreground">Distance</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Account & Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account & Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            <ProfileLink
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Two-Factor Authentication"
              description="Manage 2FA settings and backup codes"
              onClick={() => {
                toast.info("Use the Settings panel on the Dashboard for 2FA management");
                navigate("/dashboard");
              }}
            />
            <Separator />
            <ProfileLink
              icon={<User className="h-4 w-4" />}
              label="Change Password"
              description="Update your account password"
              onClick={() => {
                toast.info("Use the Settings panel on the Dashboard to change password");
                navigate("/dashboard");
              }}
            />
            <Separator />
            <ProfileLink
              icon={<MapPin className="h-4 w-4" />}
              label="Safe Zones"
              description="View shelters and safe locations"
              onClick={() => navigate("/dashboard")}
            />
            <Separator />
            <ProfileLink
              icon={<MessageSquare className="h-4 w-4" />}
              label="Contact CrisisGrid"
              description="Get help or report an issue"
              onClick={() => navigate("/contact")}
            />
          </CardContent>
        </Card>

        {/* Admin Link */}
        {isAdmin && (
          <Card>
            <CardContent className="py-4">
              <ProfileLink
                icon={<ShieldCheck className="h-4 w-4 text-red-500" />}
                label="Admin Dashboard"
                description="Manage users, requests, and view logs"
                onClick={() => navigate("/admin")}
              />
            </CardContent>
          </Card>
        )}

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function ProfileLink({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
