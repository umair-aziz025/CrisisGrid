import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  Lock,
  LockOpen,
  Search,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import AdminLayout from "./AdminLayout";

type UserRecord = {
  id: number;
  email: string;
  name: string;
  role: string;
  publicId: string | null;
  phone: string | null;
  address: string | null;
  banned: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  _count: { requests: number; tasks: number };
};

type TabKey = "all" | "VICTIM" | "VOLUNTEER" | "STAFF" | "ADMIN" | "SUPERADMIN" | "banned" | "locked";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Users" },
  { key: "VICTIM", label: "Civilians" },
  { key: "VOLUNTEER", label: "Volunteers" },
  { key: "STAFF", label: "Staff" },
  { key: "ADMIN", label: "Admins" },
  { key: "SUPERADMIN", label: "Super Admins" },
  { key: "banned", label: "Banned" },
  { key: "locked", label: "Locked" },
];

const ROLE_LEVEL: Record<string, number> = {
  VICTIM: 1,
  VOLUNTEER: 2,
  STAFF: 3,
  ADMIN: 4,
  SUPERADMIN: 5,
};

const ROLE_CONFIG: Record<string, { label: string; className: string; prefix: string; description: string }> = {
  VICTIM: {
    label: "Civilian",
    className: "bg-secondary text-secondary-foreground border-border/40",
    prefix: "USR",
    description: "Standard user — can report emergencies",
  },
  VOLUNTEER: {
    label: "Volunteer",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    prefix: "VOL",
    description: "Can respond to and claim crisis requests",
  },
  STAFF: {
    label: "Staff",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    prefix: "STA",
    description: "Staff member — access to admin portal and moderation",
  },
  ADMIN: {
    label: "Admin",
    className: "bg-destructive/20 text-destructive border-destructive/30",
    prefix: "ADM",
    description: "Administrator — full user & request management",
  },
  SUPERADMIN: {
    label: "Super Admin",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    prefix: "SUP",
    description: "Super Administrator — highest level of access",
  },
};

const ALL_ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "VICTIM", label: "Civilian", description: "Report emergencies" },
  { value: "VOLUNTEER", label: "Volunteer", description: "Respond to crises" },
  { value: "STAFF", label: "Staff", description: "Moderation & admin portal access" },
  { value: "ADMIN", label: "Admin", description: "Full user & request management" },
  { value: "SUPERADMIN", label: "Super Admin", description: "Highest level of access" },
];

function getCurrentUser(): { role: string } | null {
  try {
    const raw = localStorage.getItem("crisisgrid_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function LockoutCountdown({ lockedUntil, onExpired }: { lockedUntil: string; onExpired?: () => void }) {
  const calc = () => Math.max(0, new Date(lockedUntil).getTime() - Date.now());
  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    if (remaining <= 0) { onExpired?.(); return; }
    const id = setInterval(() => {
      const ms = calc();
      setRemaining(ms);
      if (ms <= 0) { clearInterval(id); onExpired?.(); }
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedUntil]);

  if (remaining <= 0) {
    return <span className="text-[10px] text-muted-foreground italic">Expiring…</span>;
  }

  const totalSecs = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const urgent = mins === 0;

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-mono tabular-nums",
      urgent ? "text-destructive" : "text-orange-400"
    )}>
      <Clock className="h-2.5 w-2.5 shrink-0" />
      {mins > 0 ? `${mins}m ${String(secs).padStart(2, "0")}s` : `${secs}s`}
    </span>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-border accent-orange-500"
    />
  );
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [newRole, setNewRole] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkUnlocking, setIsBulkUnlocking] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const actorRole = currentUser?.role ?? "STAFF";
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  const isSuperAdmin = actorRole === "SUPERADMIN";

  const canManageUser = (targetRole: string) => {
    if (isSuperAdmin) return true;
    return (ROLE_LEVEL[targetRole] ?? 0) < actorLevel;
  };

  const assignableRoles = useMemo(() =>
    ALL_ROLE_OPTIONS.filter((opt) =>
      isSuperAdmin ? true : (ROLE_LEVEL[opt.value] ?? 0) <= actorLevel
    ),
    [actorLevel, isSuperAdmin]
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const roleFilter = activeTab !== "all" && activeTab !== "banned" && activeTab !== "locked" ? activeTab : undefined;
      const bannedFilter = activeTab === "banned" ? true : undefined;
      const lockedFilter = activeTab === "locked" ? true : undefined;

      const data = await api.adminGetUsers({
        search: searchQuery || undefined,
        role: roleFilter,
        banned: bannedFilter,
        locked: lockedFilter,
        page,
        limit: pageSize,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchQuery, activeTab]);

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    setIsUpdating(true);
    try {
      const result = await api.adminChangeRole(selectedUser.id, newRole);
      toast.success(`Role updated to ${ROLE_CONFIG[newRole]?.label ?? newRole}. New ID: ${result.publicId}`);
      setRoleDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBanToggle = async (user: UserRecord) => {
    try {
      await api.adminToggleBan(user.id, !user.banned);
      toast.success(user.banned ? `${user.name} unbanned` : `${user.name} banned`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ban status");
    }
  };

  const handleUnlock = async (user: UserRecord) => {
    try {
      await api.adminUnlockUser(user.id);
      toast.success(`${user.name}'s account has been unlocked`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlock account");
    }
  };

  const isLocked = (user: UserRecord) =>
    !!user.lockedUntil && new Date(user.lockedUntil) > new Date();

  const selectableLockedUsers = users.filter(u => isLocked(u) && canManageUser(u.role));
  const allSelected = selectableLockedUsers.length > 0 && selectableLockedUsers.every(u => selectedIds.has(u.id));
  const someSelected = selectableLockedUsers.some(u => selectedIds.has(u.id));

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(selectableLockedUsers.map(u => u.id)));

  const handleExportCSV = () => {
    const headers = ["ID", "Public ID", "Name", "Email", "Role", "Status", "Joined"];
    const rows = users.map((u) => [
      u.id,
      u.publicId ?? "",
      `"${u.name.replace(/"/g, '""')}"`,
      u.email,
      u.role,
      u.banned ? "Banned" : isLocked(u) ? "Locked" : "Active",
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${users.length} users`);
  };

  const handleBulkUnlock = async () => {
    setIsBulkUnlocking(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => api.adminUnlockUser(id)));
      toast.success(`${ids.length} account${ids.length !== 1 ? "s" : ""} unlocked`);
      setSelectedIds(new Set());
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlock accounts");
    } finally {
      setIsBulkUnlocking(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const getInitials = (name: string) =>
    name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

  const selectedRoleConfig = newRole ? ROLE_CONFIG[newRole] : null;

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-users-title">
              User Management
            </h1>
            <Badge className={cn("text-xs border", ROLE_CONFIG[actorRole]?.className)}>
              {ROLE_CONFIG[actorRole]?.label ?? actorRole}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} total users registered
            {!isSuperAdmin && (
              <span className="ml-2 text-muted-foreground/70">
                · You can manage users below the <span className="font-medium">{ROLE_CONFIG[actorRole]?.label}</span> level
              </span>
            )}
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "whitespace-nowrap",
                  tab.key === "locked" && activeTab === "locked" && "bg-orange-500 text-white hover:bg-orange-600 border-orange-500",
                  tab.key === "locked" && activeTab !== "locked" && "border-orange-500/40 text-orange-400 hover:bg-orange-500/10",
                  activeTab !== tab.key && tab.key !== "locked" && "border-border/60 bg-background/30"
                )}
                data-testid={`tab-${tab.key}`}
              >
                {tab.key === "locked" && <Lock className="mr-1.5 h-3 w-3" />}
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="h-10 pl-9"
                data-testid="input-user-search"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={users.length === 0}
              className="h-10 shrink-0 gap-1.5 border-border/60 bg-background/30"
              title="Export current view as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2.5">
            <span className="text-sm font-medium text-orange-400">
              {selectedIds.size} account{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <Button
                size="sm"
                onClick={handleBulkUnlock}
                disabled={isBulkUnlocking}
                className="h-8 bg-orange-500 text-white hover:bg-orange-600"
              >
                {isBulkUnlocking
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <LockOpen className="mr-1.5 h-3.5 w-3.5" />
                }
                Unlock {selectedIds.size} Account{selectedIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/20 p-12 text-center text-muted-foreground">
            No users found matching your criteria.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.6] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 w-10">
                        {selectableLockedUsers.length > 0 && (
                          <SelectAllCheckbox
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onChange={toggleSelectAll}
                          />
                        )}
                      </th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Activity</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {users.map((user) => {
                      const roleInfo = ROLE_CONFIG[user.role];
                      const manageable = canManageUser(user.role);
                      const lockReason = !manageable
                        ? `You cannot manage ${roleInfo?.label ?? user.role} users — they are at or above your role level`
                        : null;

                      return (
                        <tr
                          key={user.id}
                          className={cn("hover:bg-background/20", !manageable && "opacity-60")}
                          data-testid={`user-row-${user.id}`}
                        >
                          <td className="px-4 py-3 w-10">
                            {isLocked(user) && manageable && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(user.id)}
                                onChange={() => toggleSelect(user.id)}
                                className="h-4 w-4 cursor-pointer rounded border-border accent-orange-500"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-medium">{user.name}</p>
                                  {!manageable && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground">{user.publicId || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn("text-xs border", roleInfo?.className)}>{roleInfo?.label ?? user.role}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {user.banned ? (
                                <Badge variant="destructive" className="text-xs">Banned</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500">Active</Badge>
                              )}
                              {isLocked(user) && (
                                <>
                                  <Badge variant="outline" className="text-xs border-orange-500/40 text-orange-400">
                                    <Lock className="mr-1 h-2.5 w-2.5" />Locked
                                  </Badge>
                                  <LockoutCountdown lockedUntil={user.lockedUntil!} onExpired={fetchUsers} />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {user._count.requests} requests, {user._count.tasks} tasks
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {manageable ? (
                                <>
                                  {isLocked(user) && (
                                    <Button variant="ghost" size="sm" onClick={() => handleUnlock(user)} className="h-8 px-2 text-xs text-orange-400 hover:text-orange-300" data-testid={`unlock-${user.id}`}>
                                      <LockOpen className="mr-1 h-3.5 w-3.5" />Unlock
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(user); setNewRole(user.role); setRoleDialogOpen(true); }} className="h-8 px-2 text-xs" data-testid={`change-role-${user.id}`}>
                                    <Shield className="mr-1 h-3.5 w-3.5" />Role
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleBanToggle(user)} className={cn("h-8 px-2 text-xs", user.banned ? "text-emerald-500" : "text-destructive")} data-testid={`ban-toggle-${user.id}`}>
                                    {user.banned ? <><UserCheck className="mr-1 h-3.5 w-3.5" />Unban</> : <><UserX className="mr-1 h-3.5 w-3.5" />Ban</>}
                                  </Button>
                                </>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground/50 cursor-not-allowed">
                                      <Lock className="h-3.5 w-3.5" />Protected
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-56 text-xs">{lockReason}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {users.map((user) => {
                const roleInfo = ROLE_CONFIG[user.role];
                const manageable = canManageUser(user.role);
                return (
                  <div
                    key={user.id}
                    className={cn(
                      "rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.6] p-4",
                      !manageable && "opacity-60"
                    )}
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isLocked(user) && manageable && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={() => toggleSelect(user.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-orange-500"
                          />
                        )}
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="text-sm">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-semibold text-sm">{user.name}</p>
                            {!manageable && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          {user.publicId && <p className="font-mono text-[10px] text-muted-foreground/70">{user.publicId}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge className={cn("text-xs border", roleInfo?.className)}>{roleInfo?.label ?? user.role}</Badge>
                        {user.banned ? (
                          <Badge variant="destructive" className="text-xs">Banned</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500">Active</Badge>
                        )}
                        {isLocked(user) && (
                          <>
                            <Badge variant="outline" className="text-xs border-orange-500/40 text-orange-400">
                              <Lock className="mr-1 h-2.5 w-2.5" />Locked
                            </Badge>
                            <LockoutCountdown lockedUntil={user.lockedUntil!} onExpired={fetchUsers} />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/30 pt-3">
                      <div className="text-xs text-muted-foreground">
                        <span>{user._count.requests} requests · {user._count.tasks} tasks</span>
                        <span className="ml-2">· Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                        {manageable ? (
                          <>
                            {isLocked(user) && (
                              <Button variant="outline" size="sm" onClick={() => handleUnlock(user)} className="h-7 px-2 text-xs text-orange-400 border-orange-500/40" data-testid={`unlock-${user.id}`}>
                                <LockOpen className="h-3 w-3 mr-1" />Unlock
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setNewRole(user.role); setRoleDialogOpen(true); }} className="h-7 px-2 text-xs" data-testid={`change-role-${user.id}`}>
                              <Shield className="h-3 w-3 mr-1" />Role
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleBanToggle(user)} className={cn("h-7 px-2 text-xs", user.banned ? "text-emerald-500 border-emerald-500/40" : "text-destructive border-destructive/40")} data-testid={`ban-toggle-${user.id}`}>
                              {user.banned ? <><UserCheck className="h-3 w-3 mr-1" />Unban</> : <><UserX className="h-3 w-3 mr-1" />Ban</>}
                            </Button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
                            <Lock className="h-3 w-3" />Protected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} ({total} users)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Changing role for{" "}
                  <span className="font-medium">{selectedUser.name}</span> ({selectedUser.email}).
                  Current ID: <span className="font-mono">{selectedUser.publicId || "None"}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isSuperAdmin && (
                <p className="text-[11px] text-muted-foreground/70">
                  You can assign roles up to <span className="font-medium">{ROLE_CONFIG[actorRole]?.label}</span> level.
                </p>
              )}
            </div>

            {selectedRoleConfig && (
              <div className="rounded-lg border border-border/50 bg-background/30 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs border", selectedRoleConfig.className)}>
                    {selectedRoleConfig.label}
                  </Badge>
                  {newRole !== selectedUser?.role && (
                    <span className="text-xs text-muted-foreground">
                      → New ID: <span className="font-mono">{selectedRoleConfig.prefix}-XXXX</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selectedRoleConfig.description}</p>
                {newRole === selectedUser?.role && (
                  <p className="text-xs text-amber-500">User already has this role — no change will be made.</p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-border/40 bg-background/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Role Hierarchy</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLE_OPTIONS.map((opt, i) => {
                  const assignable = isSuperAdmin || (ROLE_LEVEL[opt.value] ?? 0) <= actorLevel;
                  return (
                    <span key={opt.value} className="flex items-center gap-1">
                      <Badge
                        className={cn(
                          "text-[10px] border",
                          ROLE_CONFIG[opt.value]?.className,
                          !assignable && "opacity-40"
                        )}
                      >
                        {assignable ? null : <Lock className="h-2.5 w-2.5 mr-0.5" />}
                        {opt.label}
                      </Badge>
                      {i < ALL_ROLE_OPTIONS.length - 1 && (
                        <span className="text-muted-foreground text-xs">→</span>
                      )}
                    </span>
                  );
                })}
              </div>
              {!isSuperAdmin && (
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  Locked roles require a higher access level to assign.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRoleChange}
              disabled={isUpdating || newRole === selectedUser?.role}
              data-testid="button-confirm-role-change"
            >
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default UsersPage;
