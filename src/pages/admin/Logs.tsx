import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import AdminLayout from "./AdminLayout";

type LogRecord = {
  id: number;
  action: string;
  details: string | null;
  createdAt: string;
  performedBy: { name: string; email: string; publicId: string | null } | null;
  targetUser: { name: string; email: string; publicId: string | null } | null;
};

const ACTION_COLORS: Record<string, string> = {
  ACCOUNT_LOCKED: "bg-destructive/30 text-destructive border border-destructive/50 font-semibold",
  ACCOUNT_UNLOCKED: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  LOGIN_FAILED: "bg-destructive/20 text-destructive border border-destructive/30",
  USER_LOGIN: "bg-secondary text-secondary-foreground",
  HELP_REQUEST_SUBMITTED: "bg-[hsl(var(--crisis-medical))]/15 text-[hsl(var(--crisis-medical))]",
  TASK_CLAIMED: "bg-[hsl(var(--status-claimed))]/20 text-[hsl(var(--status-claimed))]",
  TASK_RESOLVED: "bg-emerald-500/20 text-emerald-400",
  REQUEST_CANCELLED: "bg-muted text-muted-foreground",
  ADMIN_VIEWED_USERS: "bg-primary/10 text-primary/70",
  ROLE_CHANGE: "bg-primary/20 text-primary",
  ROLE_CHANGE_BLOCKED: "bg-orange-500/20 text-orange-400 border border-orange-500/40",
  BAN_USER: "bg-destructive/20 text-destructive",
  UNBAN_USER: "bg-[hsl(var(--status-claimed))]/20 text-[hsl(var(--status-claimed))]",
  REPORT_FRAUD: "bg-[hsl(var(--crisis-medical))]/20 text-[hsl(var(--crisis-medical))]",
  USER_REGISTER: "bg-secondary text-secondary-foreground",
  PASSWORD_RESET: "bg-[hsl(var(--crisis-food-water))]/20 text-[hsl(var(--crisis-food-water))]",
};

const LogsPage = () => {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetLogs({
        search: searchQuery || undefined,
        action: actionFilter || undefined,
        page,
        limit: 30,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, actionFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter]);

  const actions = [
    "ACCOUNT_LOCKED",
    "ACCOUNT_UNLOCKED",
    "LOGIN_FAILED",
    "USER_LOGIN",
    "HELP_REQUEST_SUBMITTED",
    "TASK_CLAIMED",
    "TASK_RESOLVED",
    "REQUEST_CANCELLED",
    "ADMIN_VIEWED_USERS",
    "ROLE_CHANGE",
    "ROLE_CHANGE_BLOCKED",
    "BAN_USER",
    "UNBAN_USER",
    "REPORT_FRAUD",
    "USER_REGISTER",
    "PASSWORD_RESET",
  ];

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-logs-title">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">Audit trail of all system actions</p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={actionFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setActionFilter("")}
              className={cn(actionFilter !== "" && "border-border/60 bg-background/30")}
            >
              All
            </Button>
            {actions.map((action) => (
              <Button
                key={action}
                variant={actionFilter === action ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter(action)}
                className={cn(actionFilter !== action && "border-border/60 bg-background/30")}
                data-testid={`filter-action-${action.toLowerCase()}`}
              >
                {action.replace(/_/g, " ")}
              </Button>
            ))}
          </div>

          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="h-10 pl-9"
              data-testid="input-log-search"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/20 p-12 text-center text-muted-foreground">
            No activity logs found.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.5] p-4"
                data-testid={`log-row-${log.id}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge className={cn("text-xs", ACTION_COLORS[log.action] || "bg-secondary text-secondary-foreground")}>
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                      {log.performedBy && (
                        <span className="text-xs text-muted-foreground">
                          by <span className="font-medium text-foreground">{log.performedBy.name}</span>
                          {log.performedBy.publicId && (
                            <span className="ml-1 font-mono text-[10px]">({log.performedBy.publicId})</span>
                          )}
                        </span>
                      )}
                      {log.targetUser && (
                        <span className="text-xs text-muted-foreground">
                          on <span className="font-medium text-foreground">{log.targetUser.name}</span>
                          {log.targetUser.publicId && (
                            <span className="ml-1 font-mono text-[10px]">({log.targetUser.publicId})</span>
                          )}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-sm text-muted-foreground">{log.details}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > 30 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button variant="outline" size="sm" disabled={logs.length < 30} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default LogsPage;
