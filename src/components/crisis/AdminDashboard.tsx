import { ArrowLeft, ShieldCheck, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdminDashboardProps = {
  onBack: () => void;
  stats: {
    totalOpenRequests: number;
    activeVolunteers: number;
    resolvedToday: number;
    totalRequests: number;
  };
  chartData: Array<{ day: string; crises: number }>;
  activityLogs: Array<{ id: string; message: string; time: string; status: string }>;
  contentHeightClass?: string;
};

const AdminDashboard = ({ onBack, stats, chartData, activityLogs, contentHeightClass }: AdminDashboardProps) => {
  return (
    <section
      className={`relative z-10 overflow-y-auto px-4 py-4 md:px-6 md:py-6 ${contentHeightClass ?? "h-[calc(100vh-4rem)]"}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">NGO Command Center</h2>
          <p className="text-sm text-muted-foreground">Operational overview and live coordination metrics.</p>
        </div>
        <Button type="button" variant="outline" onClick={onBack} className="border-border/70 bg-background/40">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Map
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.86] backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Open Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalOpenRequests}</p>
          </CardContent>
        </Card>

        <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.86] backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Volunteers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.activeVolunteers}</p>
          </CardContent>
        </Card>

        <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.86] backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Resolved Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.resolvedToday}</p>
          </CardContent>
        </Card>

        <Card className="border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.86] backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Requests Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalRequests}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.86] backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Crises Reported - Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="h-64 min-w-[320px] w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line type="monotone" dataKey="crises" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5 border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.86] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity Logs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck className="h-6 w-6 opacity-40" />
                      No recent activity
                    </div>
                  </td>
                </tr>
              ) : (
                activityLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/30 last:border-none">
                    <td className="px-3 py-3 text-sm">{log.message}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{log.time}</td>
                    <td className="px-3 py-3 text-sm">
                      <Badge variant="outline" className="border-border/70 bg-background/40">
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
};

export default AdminDashboard;
