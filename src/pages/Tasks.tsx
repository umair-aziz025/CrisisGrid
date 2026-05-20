import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HeartPulse,
  LifeBuoy,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type CrisisType = "medical" | "food_water" | "rescue";
type TaskStatus = "QUEUED" | "CLAIMED" | "RESOLVED" | "CANCELLED";

interface VolunteerTask {
  id: string;
  type: CrisisType;
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  claimed: boolean;
  claimedBy: string | null;
  createdBy: string;
  status: TaskStatus;
}

interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

function loadAuthUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem("crisisgrid_user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    return { id: user.id, fullName: user.name || user.fullName, email: user.email, role: user.role };
  } catch { return null; }
}

const STATUS_META: Record<TaskStatus | "ALL", { label: string; color: string; icon: React.ReactNode }> = {
  ALL: { label: "All", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400", icon: <Siren className="h-3 w-3" /> },
  QUEUED: { label: "Queued", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  CLAIMED: { label: "Active", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: <ShieldCheck className="h-3 w-3" /> },
  RESOLVED: { label: "Resolved", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/15 text-red-600 dark:text-red-400", icon: <X className="h-3 w-3" /> },
};

const TYPE_META: Record<CrisisType, { label: string; color: string; icon: React.ReactNode }> = {
  medical: { label: "Medical", color: "bg-red-500/15 text-red-600 dark:text-red-400", icon: <HeartPulse className="h-3 w-3" /> },
  food_water: { label: "Food / Water", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: <LifeBuoy className="h-3 w-3" /> },
  rescue: { label: "Rescue", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: <Siren className="h-3 w-3" /> },
};

export default function TasksPage() {
  const navigate = useNavigate();
  const [user] = useState<AuthUser | null>(loadAuthUser);
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<CrisisType | "ALL">("ALL");

  useEffect(() => {
    if (!user) { navigate("/signin"); return; }
    loadTasks();
  }, [user, navigate]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await api.getMyTasks();
      setTasks(data);
    } catch (err) {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.description.toLowerCase().includes(q) ||
          t.createdBy.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, statusFilter, typeFilter, search]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      active: tasks.filter((t) => t.status === "CLAIMED").length,
      resolved: tasks.filter((t) => t.status === "RESOLVED").length,
      queued: tasks.filter((t) => t.status === "QUEUED").length,
    };
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">My Tasks</h1>
          <Badge variant="outline" className="ml-auto text-xs">{filtered.length}</Badge>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 p-4 pb-20">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Total" value={stats.total} icon={<Siren className="h-3 w-3" />} color="bg-slate-500/10 text-slate-600" />
          <StatCard label="Active" value={stats.active} icon={<ShieldCheck className="h-3 w-3" />} color="bg-blue-500/10 text-blue-600" />
          <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle2 className="h-3 w-3" />} color="bg-emerald-500/10 text-emerald-600" />
          <StatCard label="Queued" value={stats.queued} icon={<Clock className="h-3 w-3" />} color="bg-amber-500/10 text-amber-600" />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(STATUS_META) as Array<TaskStatus | "ALL">).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {STATUS_META[s].icon}
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setTypeFilter("ALL")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              typeFilter === "ALL" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
            )}
          >
            All Types
          </button>
          {(Object.keys(TYPE_META) as CrisisType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
              )}
            >
              {TYPE_META[t].icon}
              {TYPE_META[t].label}
            </button>
          ))}
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto h-8 w-8 opacity-40" />
            <p className="mt-2 text-sm">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-2 text-center">
      <div className={cn("mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full", color)}>
        {icon}
      </div>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function TaskCard({ task }: { task: VolunteerTask }) {
  const typeMeta = TYPE_META[task.type];
  const statusMeta = STATUS_META[task.status];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", typeMeta.color)}>
            {typeMeta.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium capitalize">{task.type === "food_water" ? "Food / Water" : task.type}</p>
              <Badge className={cn("text-[10px]", statusMeta.color)}>{statusMeta.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {task.lat.toFixed(4)}, {task.lng.toFixed(4)}
              </span>
              <span>{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
            {task.createdBy && (
              <p className="mt-1 text-xs text-muted-foreground">From: {task.createdBy}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
