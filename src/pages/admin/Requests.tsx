import {
  CheckCircle2,
  Droplets,
  HeartPulse,
  LifeBuoy,
  Loader2,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import AdminLayout from "./AdminLayout";

type RequestRecord = {
  id: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
  status: string;
  createdAt: string;
  claimed: boolean;
  claimedBy: string | null;
  createdBy: string | null;
};

const TYPE_META: Record<string, { label: string; icon: typeof HeartPulse; className: string }> = {
  medical: { label: "Medical", icon: HeartPulse, className: "text-[hsl(var(--crisis-medical))]" },
  food_water: { label: "Food/Water", icon: Droplets, className: "text-[hsl(var(--crisis-food-water))]" },
  rescue: { label: "Rescue", icon: LifeBuoy, className: "text-[hsl(var(--crisis-rescue))]" },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "border-[hsl(var(--crisis-medical))]/50 text-[hsl(var(--crisis-medical))]" },
  CLAIMED: { label: "Claimed", className: "bg-[hsl(var(--status-claimed))] text-primary-foreground" },
  RESOLVED: { label: "Resolved", className: "bg-secondary text-secondary-foreground" },
};

type FilterTab = "all" | "active" | "claimed" | "resolved";

const RequestsPage = () => {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetRequests();
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filtered = requests.filter((r) => {
    if (activeTab === "active" && r.status !== "ACTIVE") return false;
    if (activeTab === "claimed" && r.status !== "CLAIMED") return false;
    if (activeTab === "resolved" && r.status !== "RESOLVED") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.description.toLowerCase().includes(q) || r.createdBy?.toLowerCase().includes(q) || r.id.includes(q);
    }
    return true;
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${requests.length})` },
    { key: "active", label: `Active (${requests.filter(r => r.status === "ACTIVE").length})` },
    { key: "claimed", label: `Claimed (${requests.filter(r => r.status === "CLAIMED").length})` },
    { key: "resolved", label: `Resolved (${requests.filter(r => r.status === "RESOLVED").length})` },
  ];

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-requests-title">Crisis Requests</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage all emergency requests</p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
                className={cn(activeTab !== tab.key && "border-border/60 bg-background/30")}
                data-testid={`tab-requests-${tab.key}`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by description or reporter..."
              className="h-10 pl-9"
              data-testid="input-request-search"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/20 p-12 text-center text-muted-foreground">
            No requests found.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const meta = TYPE_META[req.type] || TYPE_META.medical;
              const Icon = meta.icon;
              const status = STATUS_BADGE[req.status] || STATUS_BADGE.ACTIVE;

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.6] p-4"
                  data-testid={`request-card-${req.id}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Icon className={cn("mr-1 h-3 w-3", meta.className)} />
                          {meta.label}
                        </Badge>
                        <Badge className={cn("text-xs", status.className)}>
                          {req.status === "CLAIMED" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {status.label}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">#{req.id}</span>
                      </div>
                      <p className="text-sm">{req.description}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Reported by: {req.createdBy || "Anonymous"}</span>
                        {req.claimedBy && <span>Claimed by: {req.claimedBy}</span>}
                        <span>Coords: {req.lat.toFixed(4)}, {req.lng.toFixed(4)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default RequestsPage;
