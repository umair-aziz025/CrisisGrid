import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Filter,
  HeartPulse,
  Loader2,
  MapPin,
  Navigation,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import AppFooter from "@/components/AppFooter";

type CrisisType = "medical" | "food_water" | "rescue";
type RequestStatus = "QUEUED" | "ACTIVE" | "CLAIMED" | "RESOLVED" | "CANCELLED";
type FilterKey = "ALL" | RequestStatus;

interface CrisisRequest {
  id: string;
  type: CrisisType;
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  claimed: boolean;
  claimedBy: string | null;
  createdBy: string | null;
  status: RequestStatus;
  requester?: { name: string | null; email: string | null; publicId: string | null } | null;
}

interface AuthUser {
  fullName: string;
  email: string;
  role: string;
}

function loadAuthUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem("crisisgrid_user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    const roleMap: Record<string, string> = {
      VICTIM: "civilian", VOLUNTEER: "volunteer", STAFF: "staff",
      ADMIN: "admin", SUPERADMIN: "superadmin",
    };
    const role = roleMap[user.role] ?? user.role ?? "civilian";
    return { fullName: user.name || user.fullName || "User", email: user.email, role };
  } catch { return null; }
}

const STATUS_META: Record<FilterKey, { label: string; icon: React.ReactNode; chip: string }> = {
  ALL: { label: "All", icon: <Filter className="h-3 w-3" />, chip: "bg-muted/40 text-muted-foreground border-border/60" },
  QUEUED: { label: "Queued", icon: <Clock className="h-3 w-3" />, chip: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  ACTIVE: { label: "Active", icon: <Navigation className="h-3 w-3" />, chip: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  CLAIMED: { label: "Claimed", icon: <ShieldCheck className="h-3 w-3" />, chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  RESOLVED: { label: "Resolved", icon: <CheckCircle2 className="h-3 w-3" />, chip: "bg-green-500/15 text-green-400 border-green-500/30" },
  CANCELLED: { label: "Cancelled", icon: <X className="h-3 w-3" />, chip: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const TYPE_META: Record<CrisisType, { label: string; color: string; icon: React.ReactNode }> = {
  medical: { label: "Medical", color: "bg-red-500/15 text-red-400", icon: <HeartPulse className="h-3.5 w-3.5" /> },
  food_water: { label: "Food / Water", color: "bg-blue-500/15 text-blue-400", icon: <Siren className="h-3.5 w-3.5" /> },
  rescue: { label: "Rescue", color: "bg-amber-500/15 text-amber-400", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

const formatTime = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
};

const PAGE_SIZE = 15;
const ALL_STATUSES: FilterKey[] = ["ALL", "QUEUED", "CLAIMED", "ACTIVE", "RESOLVED", "CANCELLED"];
const TYPE_KEYS: (CrisisType | "ALL")[] = ["ALL", "medical", "food_water", "rescue"];

export default function RequestsPage() {
  const navigate = useNavigate();
  const [user] = useState<AuthUser | null>(loadAuthUser);
  const [requests, setRequests] = useState<CrisisRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("ALL");
  const [typeFilter, setTypeFilter] = useState<CrisisType | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const isAllowed = user?.role === "admin" || user?.role === "superadmin" || user?.role === "staff";

  useEffect(() => {
    if (!user) { navigate("/signin"); return; }
    if (!isAllowed) { navigate("/dashboard"); return; }
  }, [user, isAllowed, navigate]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetRequests();
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAllowed) return;
    fetchRequests();
  }, [isAllowed, fetchRequests]);

  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: requests.length };
    for (const r of requests) {
      c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.description.toLowerCase().includes(q) ||
          (r.createdBy ?? "").toLowerCase().includes(q) ||
          (r.claimedBy ?? "").toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.requester?.name ?? "").toLowerCase().includes(q) ||
          (r.requester?.publicId ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, statusFilter, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!isAllowed) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.10),transparent_40%)]" />

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/40 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold tracking-tight">CrisisGrid</span>
        </div>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-medium">Requests Log</h1>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{filtered.length} results</Badge>
          <Button size="sm" variant="outline" onClick={fetchRequests} className="h-8 border-border/70 bg-background/40 px-3 text-xs">
            Refresh
          </Button>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6">

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">All Crisis Requests</h2>
          <p className="text-sm text-muted-foreground">Full system log — all users, all statuses. Visible to staff and above.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by description, reporter, volunteer, or ID…"
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/30"
              )}
            >
              {STATUS_META[s].icon}
              {STATUS_META[s].label}
              {counts[s] !== undefined && (
                <span className="ml-0.5 opacity-70">({counts[s] ?? 0})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPE_KEYS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/30"
              )}
            >
              {t === "ALL" ? <Filter className="h-3 w-3" /> : TYPE_META[t as CrisisType].icon}
              {t === "ALL" ? "All Types" : TYPE_META[t as CrisisType].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paged.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/20 py-16 text-center text-muted-foreground">
            <Siren className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-3 text-sm">No requests match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paged.map((req) => {
              const typeMeta = TYPE_META[req.type] ?? TYPE_META.rescue;
              const statusMeta = STATUS_META[req.status] ?? STATUS_META.ALL;
              const submitterName = req.requester?.name || req.createdBy || "Anonymous";
              const submitterId = req.requester?.publicId ? ` · ${req.requester.publicId}` : "";

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.7] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", typeMeta.color)}>
                          {typeMeta.icon}
                          {typeMeta.label}
                        </span>
                        <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusMeta.chip)}>
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">#{req.id.slice(-8)}</span>
                      </div>

                      <p className="text-sm">{req.description}</p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {req.lat.toFixed(4)}, {req.lng.toFixed(4)}
                        </span>
                        <span>
                          Reported by: <span className="font-medium text-foreground/80">{submitterName}{submitterId}</span>
                        </span>
                        {req.claimedBy && (
                          <span>
                            Claimed by: <span className="font-medium text-foreground/80">{req.claimedBy}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 text-xs text-muted-foreground">{formatTime(req.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  "flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
                  page === p
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 text-muted-foreground hover:bg-muted/30"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <AppFooter />
    </div>
  );
}
