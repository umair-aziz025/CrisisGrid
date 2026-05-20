import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  Radio,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import AdminLayout from "./AdminLayout";

type AdminStats = {
  totalUsers: number;
  totalVolunteers: number;
  totalRequests: number;
  activeRequests: number;
  resolvedRequests: number;
  bannedUsers: number;
  lockedUsers: number;
};

type SecuritySummary = {
  blocked24h: number;
  blocked7d: number;
  recentBlocked: {
    id: number;
    details: string | null;
    createdAt: string;
    performedBy: { name: string; email: string; publicId: string | null; role: string } | null;
    targetUser: { name: string; email: string; publicId: string | null; role: string } | null;
  }[];
  recentAdminLogins: {
    id: number;
    details: string | null;
    createdAt: string;
    performedBy: { name: string; email: string; publicId: string | null; role: string } | null;
  }[];
};

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: "bg-destructive/20 text-destructive",
  ADMIN: "bg-primary/20 text-primary",
  STAFF: "bg-orange-500/20 text-orange-400",
  VOLUNTEER: "bg-[hsl(var(--status-claimed))]/20 text-[hsl(var(--status-claimed))]",
  VICTIM: "bg-secondary text-secondary-foreground",
};

const QUICK_LINKS = [
  { label: "User Management", href: "/admin/users", icon: Users, color: "text-primary" },
  { label: "Crisis Requests", href: "/admin/requests", icon: AlertTriangle, color: "text-[hsl(var(--crisis-medical))]" },
  { label: "Activity Logs", href: "/admin/logs", icon: FileText, color: "text-[hsl(var(--status-claimed))]" },
];

const Dashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [security, setSecurity] = useState<SecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, logsData, secData] = await Promise.all([
        api.adminGetStats(),
        api.adminGetLogs({ limit: 8 }),
        api.adminGetSecuritySummary(),
      ]);
      setStats(statsData);
      setRecentLogs(logsData.logs || []);
      setSecurity(secData);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Volunteers", value: stats?.totalVolunteers ?? 0, icon: Radio, color: "text-[hsl(var(--status-claimed))]", bg: "bg-[hsl(var(--status-claimed))]/10" },
    { label: "Active Crises", value: stats?.activeRequests ?? 0, icon: AlertTriangle, color: "text-[hsl(var(--crisis-medical))]", bg: "bg-[hsl(var(--crisis-medical))]/10" },
    { label: "Resolved", value: stats?.resolvedRequests ?? 0, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Locked Accounts", value: stats?.lockedUsers ?? 0, icon: Lock, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  const pendingRequests = Math.max(0, (stats?.totalRequests ?? 0) - (stats?.activeRequests ?? 0) - (stats?.resolvedRequests ?? 0));
  const crisisBreakdown = [
    { name: "Active", value: stats?.activeRequests ?? 0, color: "hsl(var(--crisis-medical))" },
    { name: "Resolved", value: stats?.resolvedRequests ?? 0, color: "#34d399" },
    { name: "Other", value: pendingRequests, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0);

  const userBreakdown = [
    { name: "Active", value: Math.max(0, (stats?.totalUsers ?? 0) - (stats?.bannedUsers ?? 0) - (stats?.lockedUsers ?? 0)), color: "hsl(var(--primary))" },
    { name: "Locked", value: stats?.lockedUsers ?? 0, color: "#f97316" },
    { name: "Banned", value: stats?.bannedUsers ?? 0, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-admin-title">Command Center</h1>
            <p className="text-sm text-muted-foreground">Live overview of CrisisGrid operations</p>
          </div>
          <div className="flex items-center gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  <Icon className={`h-3.5 w-3.5 ${link.color}`} />
                  {link.label}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold" data-testid={`stat-${card.label.toLowerCase().replace(/\s/g, "-")}`}>
                        {card.value}
                      </p>
                    </div>
                    <div className={`rounded-lg p-2 ${card.bg}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Crisis Request Status</CardTitle>
            </CardHeader>
            <CardContent>
              {crisisBreakdown.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No crisis data yet.
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={crisisBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {crisisBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="shrink-0 space-y-3 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{stats?.totalRequests ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resolution Rate</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {stats?.totalRequests
                          ? Math.round(((stats.resolvedRequests) / stats.totalRequests) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">User Account Health</CardTitle>
            </CardHeader>
            <CardContent>
              {userBreakdown.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No user data yet.
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={userBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {userBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="shrink-0 space-y-3 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                      <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Volunteers</p>
                      <p className="text-lg font-semibold text-[hsl(var(--status-claimed))]">
                        {stats?.totalVolunteers ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-400" />
                Security Alerts
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
                  {security?.blocked24h ?? 0} blocked (24h)
                </span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {security?.blocked7d ?? 0} this week
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {!security?.recentBlocked?.length ? (
                <p className="text-sm text-muted-foreground">No blocked attempts — all clear.</p>
              ) : (
                <div className="space-y-2">
                  {security.recentBlocked.map((log) => (
                    <div key={log.id} className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-orange-400">Blocked</span>
                            {log.performedBy && (
                              <span className="text-xs text-muted-foreground">
                                by <span className="font-medium text-foreground">{log.performedBy.name}</span>
                                <span className={`ml-1 rounded px-1 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[log.performedBy.role] ?? ""}`}>
                                  {log.performedBy.role}
                                </span>
                              </span>
                            )}
                          </div>
                          {log.details && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{log.details}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Staff / Admin Logins</CardTitle>
            </CardHeader>
            <CardContent>
              {!security?.recentAdminLogins?.length ? (
                <p className="text-sm text-muted-foreground">No elevated-role logins recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {security.recentAdminLogins.map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/20 p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {log.performedBy && (
                          <>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${ROLE_BADGE[log.performedBy.role] ?? "bg-secondary text-secondary-foreground"}`}>
                              {log.performedBy.role}
                            </span>
                            <span className="text-sm font-medium truncate">{log.performedBy.name}</span>
                            {log.performedBy.publicId && (
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {log.performedBy.publicId}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Link
              to="/admin/logs"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ExternalLink className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/20 p-3"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          by {log.performedBy?.name || "System"}
                        </span>
                      </div>
                      {log.details && (
                        <p className="mt-1 text-sm text-muted-foreground truncate">{log.details}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
