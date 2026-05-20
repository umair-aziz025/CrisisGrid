import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Clock, MapPin, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type ShiftData = {
  email: string;
  name: string;
  onDurationMs: number;
  tasksResolved: number;
  distanceTraveledKm: number;
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatBadge({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 min-w-0">
      <Icon className={cn("h-3 w-3 shrink-0", accent)} />
      <span className="text-[11px] font-semibold tabular-nums leading-tight">{value}</span>
      <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

type Props = {
  role: "volunteer" | "admin";
  isOnDuty?: boolean;
};

export default function ShiftSummaryPanel({ role, isOnDuty }: Props) {
  const [myShift, setMyShift] = useState<ShiftData | null>(null);
  const [allShifts, setAllShifts] = useState<ShiftData[]>([]);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (role === "volunteer") {
        const data = await api.getMyShift();
        setMyShift(data ?? null);
      } else {
        const data = await api.adminGetVolunteerShifts();
        setAllShifts(data ?? []);
      }
    } catch {
    }
  }, [role]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30_000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [isOnDuty, fetchData]);

  if (role === "volunteer") {
    if (!myShift) return null;
    const liveMs = myShift.onDurationMs + (isOnDuty ? (now - Date.now() + now - now) : 0);
    const distLabel =
      myShift.distanceTraveledKm < 1
        ? `${Math.round(myShift.distanceTraveledKm * 1000)}m`
        : `${myShift.distanceTraveledKm.toFixed(2)}km`;

    return (
      <div className="mt-3 border-t border-border/30 pt-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            My Shift
          </span>
          {isOnDuty && (
            <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatBadge
            icon={Clock}
            label="On Duty"
            value={formatDuration(myShift.onDurationMs)}
            accent="text-blue-400"
          />
          <StatBadge
            icon={CheckCircle2}
            label="Resolved"
            value={String(myShift.tasksResolved)}
            accent="text-emerald-400"
          />
          <StatBadge
            icon={MapPin}
            label="Traveled"
            value={distLabel}
            accent="text-amber-400"
          />
        </div>
      </div>
    );
  }

  if (allShifts.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/30 pt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Users className="h-3 w-3 text-blue-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Volunteer Shifts
        </span>
        <span className="ml-auto rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
          {allShifts.length} active
        </span>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
        {allShifts.map((s) => {
          const distLabel =
            s.distanceTraveledKm < 1
              ? `${Math.round(s.distanceTraveledKm * 1000)}m`
              : `${s.distanceTraveledKm.toFixed(1)}km`;
          return (
            <div
              key={s.email}
              className="rounded-lg border border-border/40 bg-background/30 px-2.5 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-[11px] font-medium">{s.name}</span>
                <span className="ml-2 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatDuration(s.onDurationMs)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                  {s.tasksResolved} resolved
                </span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5 text-amber-400" />
                  {distLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
