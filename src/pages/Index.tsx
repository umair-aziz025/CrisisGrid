import {
  AlertTriangle,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Crosshair,
  Download,
  Siren,
  Droplets,
  Flag,
  HeartPulse,
  Home,
  KeyRound,
  LifeBuoy,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Navigation,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  User,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Socket } from "socket.io-client";
import GoogleMapView, { type GoogleMapHandle } from "@/components/crisis/GoogleMapView";
import AppFooter from "@/components/AppFooter";

import AdminDashboard from "@/components/crisis/AdminDashboard";
import PlacesSearch from "@/components/crisis/PlacesSearch";
import NotificationBell from "@/components/crisis/NotificationBell";
import ShiftSummaryPanel from "@/components/crisis/ShiftSummaryPanel";
import type { CrisisRequest, CrisisType } from "@/components/crisis/types";
import TaskChatPanel from "@/components/crisis/TaskChatPanel";
import VolunteerTasksSheet from "@/components/crisis/VolunteerTasksSheet";
import type { VolunteerAlert, VolunteerPosition, PriorityAlert, VolunteerAvailability, CoverageGap, CoverageGapUpdate, ChatMessage } from "@/hooks/use-socket";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api, setAuthToken, getAuthToken } from "@/lib/api";
import { useSocket } from "@/hooks/use-socket";

type Mode = "victim" | "volunteer";
type AccountRole = "civilian" | "volunteer" | "staff" | "admin" | "superadmin";

type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  role: AccountRole;
  token: string;
};

function loadAuthUser(): AuthUser | null {
  try {
    const token = getAuthToken();
    const stored = localStorage.getItem("crisisgrid_user");
    if (!token || !stored) return null;
    const user = JSON.parse(stored);
    const roleMap: Record<string, AccountRole> = { VICTIM: "civilian", VOLUNTEER: "volunteer", STAFF: "staff", ADMIN: "admin", SUPERADMIN: "superadmin" };
    return {
      id: user.id,
      fullName: user.name,
      email: user.email,
      role: roleMap[user.role] || "civilian",
      token,
    };
  } catch {
    return null;
  }
}


const TYPE_META: Record<
  CrisisType,
  { label: string; markerClass: string; icon: typeof HeartPulse; buttonClass: string; filterClass: string }
> = {
  medical: {
    label: "Medical",
    markerClass: "bg-[hsl(var(--crisis-medical))]",
    icon: HeartPulse,
    buttonClass: "border-[hsl(var(--crisis-medical))]/60 data-[selected=true]:bg-[hsl(var(--crisis-medical))]/20",
    filterClass:
      "border-[hsl(var(--crisis-medical))]/70 text-[hsl(var(--crisis-medical))] data-[active=true]:bg-[hsl(var(--crisis-medical))]/20",
  },
  food_water: {
    label: "Food / Water",
    markerClass: "bg-[hsl(var(--crisis-food-water))]",
    icon: Droplets,
    buttonClass:
      "border-[hsl(var(--crisis-food-water))]/60 data-[selected=true]:bg-[hsl(var(--crisis-food-water))]/20",
    filterClass:
      "border-[hsl(var(--crisis-food-water))]/70 text-[hsl(var(--crisis-food-water))] data-[active=true]:bg-[hsl(var(--crisis-food-water))]/20",
  },
  rescue: {
    label: "Rescue",
    markerClass: "bg-[hsl(var(--crisis-rescue))]",
    icon: LifeBuoy,
    buttonClass: "border-[hsl(var(--crisis-rescue))]/60 data-[selected=true]:bg-[hsl(var(--crisis-rescue))]/20",
    filterClass:
      "border-[hsl(var(--crisis-rescue))]/70 text-[hsl(var(--crisis-rescue))] data-[active=true]:bg-[hsl(var(--crisis-rescue))]/20",
  },
};

type SafeZoneType = "shelter" | "hospital" | "staging";

type SafeZone = {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  description: string | null;
  createdAt: string;
};

const ZONE_META: Record<SafeZoneType, { label: string; icon: typeof Home; bg: string }> = {
  shelter: { label: "Shelter", icon: Home, bg: "#10b981" },
  hospital: { label: "Hospital", icon: Building2, bg: "#ef4444" },
  staging: { label: "Staging Area", icon: Flag, bg: "#f59e0b" },
};

const ROLE_META: Record<AccountRole, { label: string; badgeClass: string }> = {
  civilian: { label: "Civilian (Victim)", badgeClass: "bg-secondary text-secondary-foreground" },
  volunteer: { label: "Volunteer", badgeClass: "bg-[hsl(var(--status-claimed))] text-primary-foreground" },
  staff: { label: "Staff", badgeClass: "bg-amber-500/80 text-white" },
  admin: { label: "NGO / Official Admin", badgeClass: "bg-destructive/80 text-destructive-foreground" },
  superadmin: { label: "Super Admin", badgeClass: "bg-purple-600 text-white" },
};

const chartData = [
  { day: "Mon", crises: 14 },
  { day: "Tue", crises: 18 },
  { day: "Wed", crises: 11 },
  { day: "Thu", crises: 21 },
  { day: "Fri", crises: 19 },
  { day: "Sat", crises: 25 },
  { day: "Sun", crises: 16 },
];

const formatTime = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
};

const haversineDist = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const FEED_PAGE_SIZE = 7;

const FeedList = ({
  requests,
  isVolunteerMode,
  onClaim,
  claimingId,
  userLocation,
}: {
  requests: CrisisRequest[];
  isVolunteerMode?: boolean;
  onClaim?: (requestId: string) => void;
  claimingId?: string | null;
  userLocation?: { lat: number; lng: number } | null;
}) => (
  <div className="space-y-3 overflow-y-auto pr-1" data-testid="feed-list">
    {requests.length === 0 ? (
      <div className="rounded-xl border border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <ShieldCheck className="h-6 w-6 opacity-40" />
          <p>No unclaimed requests matching this filter.</p>
        </div>
      </div>
    ) : (
      requests.map((request) => {
        const meta = TYPE_META[request.type];
        const Icon = meta.icon;
        const isClaiming = claimingId === request.id;
        const distKm = userLocation
          ? haversineDist(userLocation.lat, userLocation.lng, request.lat, request.lng)
          : null;
        const distLabel = distKm !== null
          ? distKm < 1 ? `${Math.round(distKm * 1000)}m away` : `${distKm.toFixed(1)}km away`
          : null;
        const submitterName = request.requester?.name || request.createdBy || "Anonymous";
        const submitterId = request.requester?.publicId ? ` · ${request.requester.publicId}` : "";

        return (
          <article
            key={request.id}
            data-testid={`feed-card-${request.id}`}
            className="rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.85] p-3 sm:p-4"
          >
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="shrink-0 border-border/80 bg-background/30">
                <Icon className="mr-1 h-3.5 w-3.5" />
                {meta.label}
              </Badge>
              {distLabel && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  📍 {distLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/90">{request.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              By {submitterName}{submitterId}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatTime(request.createdAt)}</p>
            {isVolunteerMode && onClaim && (
              <button
                type="button"
                onClick={() => onClaim(request.id)}
                disabled={isClaiming}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--status-claimed))/0.6] bg-[hsl(var(--status-claimed))/0.08] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--status-claimed))] transition-colors hover:bg-[hsl(var(--status-claimed))/0.15] disabled:opacity-50"
                data-testid={`feed-claim-${request.id}`}
              >
                {isClaiming ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Claiming...</>
                ) : (
                  <><Navigation className="h-3 w-3" /> Claim & Route</>
                )}
              </button>
            )}
          </article>
        );
      })
    )}
  </div>
);

const Index = () => {
  const initialUser = loadAuthUser();
  const isInitialResponder = initialUser?.role === "volunteer" || initialUser?.role === "staff" || initialUser?.role === "admin" || initialUser?.role === "superadmin";
  const [mode, setMode] = useState<Mode>(isInitialResponder ? "volunteer" : "victim");
  const [requests, setRequests] = useState<CrisisRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [selectedType, setSelectedType] = useState<CrisisType | null>(null);
  const [description, setDescription] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(loadAuthUser);
  const isResponder = authUser?.role === "volunteer" || authUser?.role === "staff" || authUser?.role === "admin" || authUser?.role === "superadmin";
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFABackupCount, setTwoFABackupCount] = useState(0);
  const [twoFASetupOpen, setTwoFASetupOpen] = useState(false);
  const [twoFASetupStep, setTwoFASetupStep] = useState<"qr" | "backup-codes">("qr");
  const [twoFAQrCode, setTwoFAQrCode] = useState("");
  const [twoFASecret, setTwoFASecret] = useState("");
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState("");
  const [twoFAVerifyLoading, setTwoFAVerifyLoading] = useState(false);
  const [twoFAVerifyError, setTwoFAVerifyError] = useState("");
  const [twoFABackupCodes, setTwoFABackupCodes] = useState<string[]>([]);
  const [twoFADisableOpen, setTwoFADisableOpen] = useState(false);
  const [twoFADisablePassword, setTwoFADisablePassword] = useState("");
  const [twoFADisableLoading, setTwoFADisableLoading] = useState(false);
  const [twoFADisableError, setTwoFADisableError] = useState("");
  const [twoFARegenOpen, setTwoFARegenOpen] = useState(false);
  const [twoFARegenCode, setTwoFARegenCode] = useState("");
  const [twoFARegenLoading, setTwoFARegenLoading] = useState(false);
  const [twoFARegenError, setTwoFARegenError] = useState("");
  const [twoFARegenNewCodes, setTwoFARegenNewCodes] = useState<string[]>([]);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ current: "", next: "", confirm: "" });
  const [changePwErrors, setChangePwErrors] = useState<Record<string, string>>({});
  const [changePwSubmitting, setChangePwSubmitting] = useState(false);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [gapRadiusKm, setGapRadiusKm] = useState(5);
  const [dismissedGapIds, setDismissedGapIds] = useState<Set<number>>(new Set());
  const [gapPanelOpen, setGapPanelOpen] = useState(true);
  const [victimStatusOpen, setVictimStatusOpen] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [sharePreciseLocation, setSharePreciseLocation] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilters, setActiveTypeFilters] = useState<CrisisType[]>(["medical", "food_water", "rescue"]);

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isClaimingTask, setIsClaimingTask] = useState(false);
  const [tasksDrawerOpen, setTasksDrawerOpen] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isResolvingTask, setIsResolvingTask] = useState(false);
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<Array<{ localId: string; type: CrisisType; description: string; lat: number; lng: number; queuedAt: string }>>(() => {
    try { const s = localStorage.getItem("crisisgrid_offline_queue"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<"combined" | "type">("combined");
  const [showClusters, setShowClusters] = useState(false);
  const [showVolunteerHeatmap, setShowVolunteerHeatmap] = useState(false);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [showZones, setShowZones] = useState(true);
  const [pinZoneMode, setPinZoneMode] = useState(false);
  const [pinZoneOpen, setPinZoneOpen] = useState(false);
  const [pinZonePending, setPinZonePending] = useState<{ lng: number; lat: number } | null>(null);
  const [pinZoneName, setPinZoneName] = useState("");
  const [pinZoneType, setPinZoneType] = useState<SafeZoneType>("shelter");
  const [pinZoneDesc, setPinZoneDesc] = useState("");
  const [isPinningZone, setIsPinningZone] = useState(false);
  const [zonePopup, setZonePopup] = useState<SafeZone | null>(null);
  const [deletingZoneId, setDeletingZoneId] = useState<number | null>(null);
  const [volunteerTasksList, setVolunteerTasksList] = useState<CrisisRequest[]>([]);
  const [notifications, setNotifications] = useState<Array<VolunteerAlert & { read: boolean }>>([]);
  const [volunteerPositions, setVolunteerPositions] = useState<Record<string, VolunteerPosition>>({});
  const [showVolunteers, setShowVolunteers] = useState(true);
  const [volunteerPopup, setVolunteerPopup] = useState<VolunteerPosition | null>(null);
  const [priorityAlerts, setPriorityAlerts] = useState<PriorityAlert[]>([]);
  const [isOnDuty, setIsOnDuty] = useState<boolean>(() => {
    try { return localStorage.getItem("crisisgrid_on_duty") !== "false"; } catch { return true; }
  });
  const [isTogglingDuty, setIsTogglingDuty] = useState(false);
  const [popupRequest, setPopupRequest] = useState<CrisisRequest | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<"granted" | "denied" | "prompt" | "unavailable">("prompt");
  const [volunteerLocation, setVolunteerLocation] = useState<{ lng: number; lat: number } | null>(null);
  const volunteerLocationWatchRef = useRef<number | null>(null);
  const mapRef = useRef<GoogleMapHandle>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const victimChatOpenRef = useRef(false);
  const authUserRef = useRef<AuthUser | null>(null);
  const [feedTab, setFeedTab] = useState<"feed" | "summary" | "requests">("feed");
  const [feedClaimingId, setFeedClaimingId] = useState<string | null>(null);
  const [feedPage, setFeedPage] = useState(1);
  const [myPastRequests, setMyPastRequests] = useState<Array<{ id: string; type: "medical" | "food_water" | "rescue"; description: string; lat: number; lng: number; createdAt: string; status: string; claimed: boolean; resolved: boolean; cancelled: boolean }>>([]);
  const [isLoadingMyRequests, setIsLoadingMyRequests] = useState(false);
  const [cancellingMyRequestId, setCancellingMyRequestId] = useState<string | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [volunteerChatUnread, setVolunteerChatUnread] = useState<Record<string, number>>({});

  const [activeClaimedTask, setActiveClaimedTask] = useState<{ requestId: string; crisisLat: number; crisisLng: number } | null>(null);
  const [routeAlternatives, setRouteAlternatives] = useState<Array<{ points: { lat: number; lng: number }[]; distanceM: number; durationSec: number }>>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ distanceM: number; durationSec: number } | null>(null);
  const [directionsResult, setDirectionsResult] = useState<any>(null);
  const routeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const volunteerLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [victimChatOpen, setVictimChatOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) return Notification.permission;
    return "default";
  });

  const contentHeightClass = "flex-1 min-h-0";

  const fetchRequests = useCallback(async () => {
    try {
      const data = await api.getRequests();
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchMyTasks = useCallback(async () => {
    const isResponderRole = authUser?.role === "volunteer" || authUser?.role === "staff" || authUser?.role === "admin" || authUser?.role === "superadmin";
    if (!authUser || !isResponderRole) return;
    try {
      const data = await api.getMyTasks();
      setVolunteerTasksList(data);
      // Restore active route on re-login: if activeClaimedTask is not set,
      // check the fetched tasks and restore it from the first active task.
      setActiveClaimedTask((current) => {
        if (current) return current;
        const active = (data as any[]).find((t) => t.lat != null && t.lng != null);
        return active ? { requestId: active.id, crisisLat: active.lat, crisisLng: active.lng } : null;
      });
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  }, [authUser]);

  const fetchMyRequests = useCallback(async () => {
    if (!authUser || authUser.role !== "civilian") return;
    setIsLoadingMyRequests(true);
    try {
      const data = await api.getMyRequests();
      setMyPastRequests(data);
    } catch (error) {
      console.error("Failed to fetch my requests:", error);
    } finally {
      setIsLoadingMyRequests(false);
    }
  }, [authUser]);

  const cancelMyRequest = useCallback(async (requestId: string) => {
    setCancellingMyRequestId(requestId);
    try {
      await api.cancelRequest(requestId);
      setMyPastRequests((prev) =>
        prev.map((r) => r.id === requestId ? { ...r, cancelled: true, status: "CANCELLED" } : r)
      );
      toast.success("Request cancelled");
    } catch {
      toast.error("Failed to cancel request");
    } finally {
      setCancellingMyRequestId(null);
    }
  }, []);

  const handleChatMessage = useCallback((msg: ChatMessage) => {
    const user = authUserRef.current;
    if (!user || msg.senderEmail === user.email) return;
    if (user.role === "civilian") {
      if (!victimChatOpenRef.current) {
        setChatUnreadCount((c) => c + 1);
      }
      toast(`New message from ${msg.senderName}`, {
        description: msg.type === "audio" ? "Voice note received" : (msg.text?.slice(0, 80) ?? ""),
        duration: 5000,
      });
    } else if (user.role === "volunteer") {
      setVolunteerChatUnread((prev) => ({
        ...prev,
        [msg.requestId]: (prev[msg.requestId] ?? 0) + 1,
      }));
      toast(`New message from ${msg.senderName}`, {
        description: msg.type === "audio" ? "Voice note received" : (msg.text?.slice(0, 80) ?? ""),
        duration: 5000,
      });
    }
  }, []);

  useEffect(() => { victimChatOpenRef.current = victimChatOpen; }, [victimChatOpen]);
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);
  useEffect(() => { if (victimChatOpen) setChatUnreadCount(0); }, [victimChatOpen]);

  useEffect(() => {
    const handler = () => setIsMapFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  // Polling fallback — keeps the map and feed in sync even if a socket event
  // is missed (e.g., during a brief disconnect / reconnect cycle).
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRequests();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  useEffect(() => {
    if (!authUser) return;
    const interval = setInterval(() => {
      fetchMyTasks();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchMyTasks, authUser]);

  // Reset feed to page 1 whenever search or type filters change
  useEffect(() => { setFeedPage(1); }, [searchQuery, activeTypeFilters]);

  const handleNewCrisis = useCallback((data: CrisisRequest) => {
    setRequests((prev) => {
      if (prev.some((r) => r.id === data.id)) return prev;
      return [data, ...prev];
    });
  }, []);

  const handleCrisisClaimed = useCallback((data: { requestId: string; claimedBy: string; agentDispatched?: boolean; taskId?: string; crisisLat?: number; crisisLng?: number; request?: CrisisRequest }) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === data.requestId ? { ...r, claimed: true, claimedBy: data.claimedBy, status: "CLAIMED" } : r
      )
    );
    setMyPastRequests((prev) =>
      prev.map((r) => r.id === data.requestId ? { ...r, claimed: true, status: "CLAIMED" } : r)
    );

    const currentUser = authUserRef.current;
    const currentEmail = currentUser?.email;

    // Show auto-dispatch toast for admins/staff watching the dashboard
    if (data.agentDispatched) {
      const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin" || currentUser?.role === "staff";
      if (isAdmin && currentEmail !== data.claimedBy) {
        toast(`⚡ Auto-Dispatched`, {
          description: `Request auto-assigned to ${data.claimedBy}`,
          duration: 6000,
          action: data.crisisLat != null && data.crisisLng != null ? {
            label: "Fly to",
            onClick: () => mapRef.current?.panTo(data.crisisLat!, data.crisisLng!, 14),
          } : undefined,
        });
      }
      // If this volunteer was auto-assigned to a task, refresh their task list
      if (currentEmail && data.claimedBy === currentEmail) {
        fetchMyTasks();
      }
    }

    // If current user manually claimed it, add to My Tasks list optimistically.
    if (currentEmail && data.claimedBy === currentEmail) {
      setVolunteerTasksList((prev) => {
        if (prev.some((t) => t.id === data.requestId)) return prev;
        const base = data.request ?? (prev.find(() => false) as any);
        if (base) {
          return [{ ...base, claimed: true, claimedBy: currentEmail, status: "CLAIMED", taskStatus: "CLAIMED" }, ...prev];
        }
        return prev;
      });
      fetchMyTasks();
    }
  }, [fetchMyTasks]);

  const handleCrisisResolved = useCallback((data: { requestId: string }) => {
    setRequests((prev) => prev.filter((r) => r.id !== data.requestId));
    setVolunteerTasksList((prev) =>
      prev.map((t) => t.id === data.requestId ? { ...t, status: "RESOLVED" } : t)
    );
    setMyPastRequests((prev) =>
      prev.map((r) => r.id === data.requestId ? { ...r, resolved: true, status: "RESOLVED" } : r)
    );
  }, []);

  const handleCrisisCancelled = useCallback((data: { requestId: string }) => {
    setRequests((prev) => prev.filter((r) => r.id !== data.requestId));
    setVolunteerTasksList((prev) =>
      prev.map((t) => t.id === data.requestId ? { ...t, status: "CANCELLED" } : t)
    );
    setMyPastRequests((prev) =>
      prev.map((r) => r.id === data.requestId ? { ...r, cancelled: true, status: "CANCELLED" } : r)
    );
  }, []);

  const handleCrisisPartialResolved = useCallback((data: { requestId: string; completedBy: string; remainingResponders: number }) => {
    // If no remaining responders, fully resolved
    if (data.remainingResponders === 0) {
      setRequests((prev) => prev.filter((r) => r.id !== data.requestId));
    }
    setVolunteerTasksList((prev) =>
      prev.map((t) => t.id === data.requestId ? { ...t, status: "RESOLVED" } : t)
    );
  }, []);

  const handleCrisisStatusChanged = useCallback((data: { requestId: string; status: string; [key: string]: any }) => {
    setRequests((prev) =>
      prev.map((r) => r.id === data.requestId ? { ...r, ...data } : r)
    );
    setVolunteerTasksList((prev) =>
      prev.map((t) => t.id === data.requestId ? { ...t, ...data } : t)
    );
    setMyPastRequests((prev) =>
      prev.map((r) => r.id === data.requestId ? { ...r, ...data } : r)
    );
  }, []);

  const fetchSafeZones = useCallback(async () => {
    try {
      const data = await api.getSafeZones();
      setSafeZones(data);
    } catch (error) {
      console.error("Failed to fetch safe zones:", error);
    }
  }, []);

  useEffect(() => {
    fetchSafeZones();
  }, [fetchSafeZones]);

  const handleSafeZoneAdded = useCallback((zone: SafeZone) => {
    setSafeZones((prev) => {
      if (prev.some((z) => z.id === zone.id)) return prev;
      return [zone, ...prev];
    });
  }, []);

  const handleSafeZoneRemoved = useCallback(({ id }: { id: number }) => {
    setSafeZones((prev) => prev.filter((z) => z.id !== id));
    setZonePopup((prev) => (prev?.id === id ? null : prev));
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { setNotifPermission("granted"); return; }
    if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } else {
      setNotifPermission("denied");
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/favicon.svg", tag: "crisisgrid-alert" });
    if (onClick) {
      n.onclick = () => { window.focus(); onClick(); };
    }
  }, []);

  const handleVolunteerAlert = useCallback((alert: VolunteerAlert) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === alert.id)) return prev;
      return [{ ...alert, read: false }, ...prev].slice(0, 20);
    });
    const typeLabel = alert.type === "medical" ? "Medical" : alert.type === "food_water" ? "Food / Water" : "Rescue";
    toast(`New ${typeLabel} Emergency`, {
      description: alert.description.length > 80 ? alert.description.slice(0, 80) + "…" : alert.description,
      duration: 8000,
      action: {
        label: "View on map",
        onClick: () => {
          mapRef.current?.panTo(alert.lat, alert.lng, 13);
        },
      },
    });
    showBrowserNotification(
      `🚨 New ${typeLabel} Emergency`,
      alert.description.length > 100 ? alert.description.slice(0, 100) + "…" : alert.description,
      () => mapRef.current?.panTo(alert.lat, alert.lng, 13),
    );
  }, [showBrowserNotification]);

  const handleCoverageGapUpdate = useCallback((data: CoverageGapUpdate) => {
    setCoverageGaps(data.gaps.filter((g) => g.closestVolunteerKm === null || g.closestVolunteerKm > gapRadiusKm));
    setGapPanelOpen(true);
  }, [gapRadiusKm]);

  const handleAdminExportCSV = useCallback(async () => {
    try {
      const data = await api.getAdminRequests();
      const headers = ["ID", "Type", "Status", "Description", "Lat", "Lng", "Reported By", "Claimed By", "Created At"];
      const rows = data.map((r: any) => [
        r.id,
        r.type,
        r.status,
        `"${String(r.description).replace(/"/g, '""')}"`,
        r.lat,
        r.lng,
        r.createdBy ?? "",
        r.claimedBy ?? "",
        r.createdAt,
      ]);
      const csv = [headers.join(","), ...rows.map((row: any[]) => row.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crisisgrid-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export data");
    }
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleDismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleFlyToAlert = useCallback((lat: number, lng: number) => {
    mapRef.current?.panTo(lat, lng, 13);
  }, []);

  const handleVolunteerLocation = useCallback((data: VolunteerPosition) => {
    setVolunteerPositions((prev) => ({ ...prev, [data.email]: data }));
  }, []);

  const handleVolunteerAvailability = useCallback((data: VolunteerAvailability) => {
    setVolunteerPositions((prev) => {
      const existing = prev[data.email];
      if (!existing) return prev;
      return { ...prev, [data.email]: { ...existing, _unavailable: !data.isAvailable } as any };
    });
    if (data.email === authUser?.email) return;
  }, [authUser?.email]);

  const handlePriorityAlert = useCallback((alert: PriorityAlert) => {
    if (alert.targetEmail !== authUser?.email) return;
    if (!isOnDuty) return;
    setPriorityAlerts((prev) => {
      if (prev.some((a) => a.id === alert.id)) return prev;
      return [alert, ...prev].slice(0, 5);
    });
    const distLabel = alert.distanceKm < 1
      ? `${Math.round(alert.distanceKm * 1000)}m`
      : `${alert.distanceKm.toFixed(1)}km`;
    const typeLabel = alert.crisisType === "medical" ? "Medical" : alert.crisisType === "food_water" ? "Food/Water" : "Rescue";
    toast(`⚡ Priority Dispatch: ${typeLabel}`, {
      description: `${distLabel} away — Walk ~${alert.walkMinutes}min / Drive ~${alert.driveMinutes}min`,
      duration: 12000,
      action: {
        label: "Fly to",
        onClick: () => mapRef.current?.panTo(alert.crisisLat, alert.crisisLng, 14),
      },
    });
    showBrowserNotification(
      `⚡ Priority Dispatch: ${typeLabel} — ${distLabel} away`,
      `Walk ~${alert.walkMinutes}min · Drive ~${alert.driveMinutes}min\n${alert.dispatchMessage.slice(0, 120)}`,
      () => mapRef.current?.panTo(alert.crisisLat, alert.crisisLng, 14),
    );
  }, [authUser?.email, showBrowserNotification]);

  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      setVolunteerPositions((prev) => {
        const pruned = Object.fromEntries(
          Object.entries(prev).filter(([, v]) => new Date(v.timestamp).getTime() >= cutoff)
        );
        return Object.keys(pruned).length === Object.keys(prev).length ? prev : pruned;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteZone = async (zoneId: number) => {
    setDeletingZoneId(zoneId);
    try {
      await api.adminDeleteSafeZone(zoneId);
      toast.success("Safe zone removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove safe zone");
    } finally {
      setDeletingZoneId(null);
    }
  };

  const handlePinZoneSubmit = async () => {
    if (!pinZonePending || !pinZoneName.trim()) {
      toast.error("Please enter a name for the safe zone");
      return;
    }
    setIsPinningZone(true);
    try {
      await api.adminCreateSafeZone({
        name: pinZoneName.trim(),
        type: pinZoneType,
        lat: pinZonePending.lat,
        lng: pinZonePending.lng,
        description: pinZoneDesc.trim() || undefined,
      });
      setPinZoneOpen(false);
      setPinZoneName("");
      setPinZoneDesc("");
      setPinZonePending(null);
      toast.success("Safe zone pinned successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pin safe zone");
    } finally {
      setIsPinningZone(false);
    }
  };

  const { socketRef, socket, connected: socketConnected } = useSocket(handleNewCrisis, handleCrisisClaimed, handleCrisisResolved, {
    onCrisisCancelled: handleCrisisCancelled,
    onCrisisPartialResolved: handleCrisisPartialResolved,
    onCrisisStatusChanged: handleCrisisStatusChanged,
    onSafeZoneAdded: handleSafeZoneAdded,
    onSafeZoneRemoved: handleSafeZoneRemoved,
    onVolunteerAlert: isResponder ? handleVolunteerAlert : undefined,
    onVolunteerLocation: (authUser?.role === "admin" || authUser?.role === "superadmin" || authUser?.role === "civilian") ? handleVolunteerLocation : undefined,
    onPriorityAlert: isResponder ? handlePriorityAlert : undefined,
    onVolunteerAvailability: (authUser?.role === "admin" || authUser?.role === "superadmin") ? handleVolunteerAvailability : undefined,
    onCoverageGapUpdate: (authUser?.role === "admin" || authUser?.role === "superadmin") ? handleCoverageGapUpdate : undefined,
    onChatMessage: (authUser?.role === "civilian" || isResponder) ? handleChatMessage : undefined,
    authToken: authUser?.token ?? null,
  });

  const fetchRoute = useCallback((volLat: number, volLng: number, crisisLat: number, crisisLng: number, retryCount = 0) => {
    if (typeof google === "undefined" || !google?.maps?.DirectionsService) {
      // Maps API not ready yet — retry up to 10× (5 seconds total)
      if (retryCount < 10) {
        setTimeout(() => fetchRoute(volLat, volLng, crisisLat, crisisLng, retryCount + 1), 500);
      }
      return;
    }
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: volLat, lng: volLng },
        destination: { lat: crisisLat, lng: crisisLng },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirectionsResult(result);
          const alternatives = result.routes.map((r: any) => ({
            points: (r.overview_path ?? []).map((ll: google.maps.LatLng) => ({ lat: ll.lat(), lng: ll.lng() })),
            distanceM: r.legs[0]?.distance?.value ?? 0,
            durationSec: r.legs[0]?.duration?.value ?? 0,
          }));
          setRouteAlternatives(alternatives);
          setSelectedRouteIdx((prev) => Math.min(prev, alternatives.length - 1));
          setRouteInfo({ distanceM: alternatives[0].distanceM, durationSec: alternatives[0].durationSec });
        }
      }
    );
  }, []);

  const openNavigationApp = useCallback(() => {
    if (!activeClaimedTask) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeClaimedTask.crisisLat},${activeClaimedTask.crisisLng}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [activeClaimedTask]);

  const filteredSortedRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...requests]
      .filter((request) => activeTypeFilters.includes(request.type))
      .filter((request) => (query ? request.description.toLowerCase().includes(query) : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchQuery, activeTypeFilters]);

  // Heatmap only shows QUEUED (unclaimed) requests
  const heatmapRequests = useMemo(() =>
    requests.filter((r) => r.status === "QUEUED" && activeTypeFilters.includes(r.type)),
    [requests, activeTypeFilters]
  );

  // Live Feed: QUEUED only, sorted nearest-first then newest-first
  const feedFilteredAll = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const userLat = volunteerLocation?.lat ?? gpsLocation?.lat ?? null;
    const userLng = volunteerLocation?.lng ?? gpsLocation?.lng ?? null;
    return [...requests]
      .filter((r) => r.status === "QUEUED" && activeTypeFilters.includes(r.type))
      .filter((r) => (query ? r.description.toLowerCase().includes(query) : true))
      .sort((a, b) => {
        if (userLat !== null && userLng !== null) {
          const dA = haversineDist(userLat, userLng, a.lat, a.lng);
          const dB = haversineDist(userLat, userLng, b.lat, b.lng);
          if (Math.abs(dA - dB) > 0.1) return dA - dB;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [requests, searchQuery, activeTypeFilters, volunteerLocation, gpsLocation]);

  const feedTotalPages = Math.max(1, Math.ceil(feedFilteredAll.length / FEED_PAGE_SIZE));
  const feedPagedRequests = useMemo(
    () => feedFilteredAll.slice((feedPage - 1) * FEED_PAGE_SIZE, feedPage * FEED_PAGE_SIZE),
    [feedFilteredAll, feedPage]
  );

  const typeCounts = useMemo(() => {
    const counts = { medical: 0, food_water: 0, rescue: 0, unclaimed: 0, claimed: 0 };
    for (const r of filteredSortedRequests) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
      if (r.claimed) counts.claimed++; else counts.unclaimed++;
    }
    return counts;
  }, [filteredSortedRequests]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const victimActiveRequest = useMemo(() => {
    if (!authUser || authUser.role !== "civilian") return null;

    return (
      [...requests]
        .filter((request) => request.createdBy === authUser.email)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    );
  }, [requests, authUser]);

  const victimProgress = victimActiveRequest?.claimed ? 100 : 34;

  const activityLogs = useMemo(
    () =>
      [...requests]
        .filter((request) => request.claimed)
        .slice(0, 4)
        .map((request, index) => ({
          id: `${request.id}-${index}`,
          message: `Volunteer ${["Jane", "Omar", "Lina", "David"][index % 4]} claimed ${TYPE_META[request.type].label} request #${request.id}`,
          time: formatTime(request.createdAt),
          status: "Claimed",
        })),
    [requests],
  );

  const adminStats = useMemo(
    () => ({
      totalOpenRequests: requests.filter((request) => !request.claimed).length,
      activeVolunteers: 18,
      resolvedToday: requests.filter((request) => request.claimed).length + 5,
      totalRequests: requests.length + 120,
    }),
    [requests],
  );

  const toggleTypeFilter = (type: CrisisType) => {
    setActiveTypeFilters((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  };

  const checkGpsPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setGpsPermission("unavailable");
      return;
    }
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      setGpsPermission(result.state as "granted" | "denied" | "prompt");
      result.addEventListener("change", () => {
        setGpsPermission(result.state as "granted" | "denied" | "prompt");
      });
    } catch {
      setGpsPermission("prompt");
    }
  }, []);

  useEffect(() => {
    checkGpsPermission();
  }, [checkGpsPermission]);

  const requestGpsLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setGpsPermission("unavailable");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        setGpsLocation(coords);
        setPendingCoords(coords);
        setGpsPermission("granted");
        setIsGettingLocation(false);
        toast.success("Location detected successfully");
      },
      (error) => {
        setIsGettingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsPermission("denied");
          toast.error("Location permission denied. Please enable it in your browser settings.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error("Location unavailable. Please try again or click on the map.");
        } else {
          toast.error("Location request timed out. Please try again or click on the map.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const startVolunteerLocationTracking = useCallback(() => {
    const isResponderRole = authUser?.role === "volunteer" || authUser?.role === "staff" || authUser?.role === "admin" || authUser?.role === "superadmin";
    if (!navigator.geolocation || !authUser || !isResponderRole) return;

    if (volunteerLocationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(volunteerLocationWatchRef.current);
    }

    volunteerLocationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        setVolunteerLocation(coords);
        volunteerLocationRef.current = coords;
        api.updateVolunteerLocation(coords.lat, coords.lng).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, [authUser]);

  const stopVolunteerLocationTracking = useCallback(() => {
    if (volunteerLocationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(volunteerLocationWatchRef.current);
      volunteerLocationWatchRef.current = null;
      setVolunteerLocation(null);
    }
  }, []);

  const handleToggleDuty = useCallback(async () => {
    const isResponderRole = authUser?.role === "volunteer" || authUser?.role === "staff" || authUser?.role === "admin" || authUser?.role === "superadmin";
    if (!authUser || !isResponderRole || isTogglingDuty) return;
    const next = !isOnDuty;
    setIsTogglingDuty(true);
    try {
      await api.setVolunteerAvailability(next);
      setIsOnDuty(next);
      try { localStorage.setItem("crisisgrid_on_duty", String(next)); } catch {}
      if (next) {
        startVolunteerLocationTracking();
        requestNotificationPermission();
        toast.success("You are now On Duty — GPS tracking resumed");
      } else {
        stopVolunteerLocationTracking();
        toast("You are now Off Duty", {
          description: "GPS tracking paused. You won't receive proximity alerts.",
          duration: 6000,
        });
      }
    } catch {
      toast.error("Failed to update duty status. Please try again.");
    } finally {
      setIsTogglingDuty(false);
    }
  }, [authUser, isOnDuty, isTogglingDuty, startVolunteerLocationTracking, stopVolunteerLocationTracking, requestNotificationPermission]);

  useEffect(() => {
    if (isResponder && "Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "default") {
        requestNotificationPermission();
      }
    }
  }, [isResponder, requestNotificationPermission]);

  useEffect(() => {
    return () => {
      if (volunteerLocationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(volunteerLocationWatchRef.current);
      }
    };
  }, []);

  const handleMapClick = (lat: number, lng: number) => {
    if (pinZoneMode && authUser?.role === "admin") {
      setPinZonePending({ lng, lat });
      setPinZoneName("");
      setPinZoneType("shelter");
      setPinZoneDesc("");
      setPinZoneOpen(true);
      return;
    }
    if (mode !== "victim") return;

    setPendingCoords({ lng, lat });
    setSelectedType(null);
    setDescription("");
    setNewRequestOpen(true);
  };

  const enqueueOfflineRequest = useCallback((item: { localId: string; type: CrisisType; description: string; lat: number; lng: number; queuedAt: string }) => {
    setOfflineQueue((prev) => {
      const next = [...prev, item];
      try { localStorage.setItem("crisisgrid_offline_queue", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const syncOfflineQueue = useCallback(async (queue?: Array<{ localId: string; type: CrisisType; description: string; lat: number; lng: number; queuedAt: string }>) => {
    const pending = queue ?? offlineQueue;
    if (pending.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const results = await Promise.allSettled(
      pending.map(async (item) => {
        await api.createRequest({ type: item.type, description: item.description, lat: item.lat, lng: item.lng });
        return item.localId;
      })
    );
    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);
    if (succeeded.length > 0) {
      setOfflineQueue((prev) => {
        const next = prev.filter((item) => !succeeded.includes(item.localId));
        try { localStorage.setItem("crisisgrid_offline_queue", JSON.stringify(next)); } catch {}
        return next;
      });
      toast.success(`${succeeded.length} queued request${succeeded.length > 1 ? "s" : ""} submitted successfully`);
    }
    setIsSyncing(false);
  }, [offlineQueue, isSyncing]);

  useEffect(() => {
    if (routeIntervalRef.current) {
      clearInterval(routeIntervalRef.current);
      routeIntervalRef.current = null;
    }
    if (!activeClaimedTask) return;
    const { crisisLat, crisisLng } = activeClaimedTask;

    // Track last position used for routing — only re-fetch when volunteer
    // moves more than ~80 m (0.0007 degrees) to avoid excessive API calls.
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    const doFetch = (lat: number, lng: number) => {
      if (lastLat !== null && lastLng !== null) {
        if (Math.abs(lat - lastLat) < 0.0007 && Math.abs(lng - lastLng) < 0.0007) return;
      }
      lastLat = lat;
      lastLng = lng;
      fetchRoute(lat, lng, crisisLat, crisisLng);
    };

    if (volunteerLocationRef.current) {
      doFetch(volunteerLocationRef.current.lat, volunteerLocationRef.current.lng);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          volunteerLocationRef.current = coords;
          doFetch(coords.lat, coords.lng);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }

    // Poll every 45 s — the position-change check above prevents redundant fetches
    routeIntervalRef.current = setInterval(() => {
      if (volunteerLocationRef.current) {
        doFetch(volunteerLocationRef.current.lat, volunteerLocationRef.current.lng);
      }
    }, 45000);
    return () => {
      if (routeIntervalRef.current) { clearInterval(routeIntervalRef.current); routeIntervalRef.current = null; }
    };
  }, [activeClaimedTask, fetchRoute]);

  // Victim route: when a civilian's request gets claimed, compute the route
  // from the responder's current GPS position → to the crisis location so
  // both parties see the same blue line on the map.
  useEffect(() => {
    if (authUser?.role !== "civilian") return;
    if (!victimActiveRequest?.claimed || !victimActiveRequest.claimedBy) return;
    const vol = volunteerPositions[victimActiveRequest.claimedBy];
    if (!vol) return;
    fetchRoute(vol.lat, vol.lng, victimActiveRequest.lat, victimActiveRequest.lng);
  }, [
    authUser?.role,
    victimActiveRequest?.claimed,
    victimActiveRequest?.claimedBy,
    victimActiveRequest?.lat,
    victimActiveRequest?.lng,
    volunteerPositions,
    fetchRoute,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      setOfflineMode(false);
      setOfflineQueue((current) => {
        if (current.length > 0) syncOfflineQueue(current);
        return current;
      });
    };
    const handleOffline = () => setOfflineMode(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  const submitRequest = async () => {
    if (!pendingCoords || !selectedType || !description.trim()) {
      toast.error("Please fill out all required fields");
      return;
    }

    const item = {
      localId: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: selectedType,
      description: description.trim(),
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      queuedAt: new Date().toISOString(),
    };

    if (offlineMode || !navigator.onLine) {
      enqueueOfflineRequest(item);
      setNewRequestOpen(false);
      setPendingCoords(null);
      setSelectedType(null);
      setDescription("");
      toast("Request Queued Offline", {
        description: "Will be submitted automatically when connection is restored.",
        duration: 8000,
      });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await api.createRequest({ type: item.type, description: item.description, lat: item.lat, lng: item.lng });
      setNewRequestOpen(false);
      setPendingCoords(null);
      setSelectedType(null);
      setDescription("");
      toast.success("Request Broadcasted Successfully");
      fetchMyRequests();
    } catch (error) {
      if (!navigator.onLine) {
        enqueueOfflineRequest(item);
        setNewRequestOpen(false);
        setPendingCoords(null);
        setSelectedType(null);
        setDescription("");
        toast("Request Queued Offline", {
          description: "Connection lost. Will retry automatically when you're back online.",
          duration: 8000,
        });
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to submit request");
      }
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const openDetails = (requestId: string) => {
    if (mode !== "volunteer") return;
    setSelectedRequestId(requestId);
    setDetailsOpen(true);
  };

  const claimRequest = async () => {
    if (!selectedRequestId || !selectedRequest || selectedRequest.claimed) return;
    const isResponderRole = authUser?.role === "volunteer" || authUser?.role === "staff" || authUser?.role === "admin" || authUser?.role === "superadmin";
    if (!authUser || !isResponderRole) {
      toast.error("You must be logged in as a responder to claim tasks");
      return;
    }

    setIsClaimingTask(true);
    try {
      await api.claimRequest(selectedRequestId);
      setDetailsOpen(false);
      toast.success("Task Claimed. AI Routing Initialized.");
      fetchMyTasks();
      startVolunteerLocationTracking();
      if (volunteerLocation && !volunteerLocationRef.current) {
        volunteerLocationRef.current = volunteerLocation;
      }
      if (selectedRequest) {
        setActiveClaimedTask({ requestId: selectedRequestId, crisisLat: selectedRequest.lat, crisisLng: selectedRequest.lng });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to claim task");
    } finally {
      setIsClaimingTask(false);
    }
  };

  const claimFromFeed = async (requestId: string) => {
    const isResponderRole = authUser?.role === "volunteer" || authUser?.role === "staff" || authUser?.role === "admin" || authUser?.role === "superadmin";
    if (!authUser || !isResponderRole) {
      toast.error("You must be logged in as a responder to claim tasks");
      return;
    }
    const request = requests.find((r) => r.id === requestId);
    if (!request || request.claimed) return;

    setFeedClaimingId(requestId);
    try {
      await api.claimRequest(requestId);
      toast.success("Task Claimed. AI Routing Initialized.");
      fetchMyTasks();
      startVolunteerLocationTracking();
      if (volunteerLocation && !volunteerLocationRef.current) {
        volunteerLocationRef.current = volunteerLocation;
      }
      setActiveClaimedTask({ requestId, crisisLat: request.lat, crisisLng: request.lng });
      setFeedTab("summary");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to claim task");
    } finally {
      setFeedClaimingId(null);
    }
  };

  const resolveTask = async (taskId: string) => {
    setIsResolvingTask(true);
    setResolvingTaskId(taskId);

    try {
      await api.resolveRequest(taskId);
      setExpandedTaskId((prev) => (prev === taskId ? null : prev));
      toast.success("Crisis Resolved. Great work.");
      setActiveClaimedTask((prev) => (prev?.requestId === taskId ? null : prev));
      if (activeClaimedTask?.requestId === taskId) {
        setRouteAlternatives([]);
        setSelectedRouteIdx(0);
        setRouteInfo(null);
        setDirectionsResult(null);
        if (routeIntervalRef.current) { clearInterval(routeIntervalRef.current); routeIntervalRef.current = null; }
      }
      fetchMyTasks();
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve task");
    } finally {
      setResolvingTaskId(null);
      setIsResolvingTask(false);
    }
  };

  const cancelVictimRequest = async () => {
    if (!authUser?.email || !victimActiveRequest) return;

    try {
      await api.cancelRequest(victimActiveRequest.id);
      setVictimStatusOpen(false);
      toast.success("Emergency Request Cancelled. Glad you are safe.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel request");
    }
  };

  const handleGeocodeSelect = useCallback(
    (center: [number, number]) => {
      mapRef.current?.panTo(center[1], center[0], 12);
    },
    [],
  );

  const handleSignOut = () => {
    stopVolunteerLocationTracking();
    setAuthUser(null);
    setAuthToken(null);
    localStorage.removeItem("crisisgrid_user");
    setDashboardOpen(false);
    setTasksDrawerOpen(false);
    setVictimStatusOpen(false);
    setSettingsOpen(false);
    setExpandedTaskId(null);
    setVolunteerTasksList([]);
    navigate("/");
  };

  const isVolunteer = authUser?.role === "volunteer";
  const isCivilian = authUser?.role === "civilian";

  const feedPanelContent = (
    <>
      {feedTab === "feed" && (
        <>
          <div className="space-y-3 pb-4">
            <div>
              <h2 className="mb-1 text-lg font-semibold" data-testid="text-feed-title">Live Crisis Feed</h2>
              <p className="text-xs text-muted-foreground">
                {feedFilteredAll.length} unclaimed request{feedFilteredAll.length !== 1 ? "s" : ""} — nearest first.
              </p>
            </div>

            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by description..."
              className="border-border/70 bg-background/40"
              aria-label="Search crisis requests"
              data-testid="input-search"
            />

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TYPE_META) as CrisisType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  data-active={activeTypeFilters.includes(type)}
                  onClick={() => toggleTypeFilter(type)}
                  className={cn("flex-1 min-w-[80px] px-2 text-xs truncate", TYPE_META[type].filterClass)}
                  data-testid={`filter-${type}`}
                  title={TYPE_META[type].label}
                >
                  {TYPE_META[type].label}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingRequests ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <FeedList
                requests={feedPagedRequests}
                isVolunteerMode={isResponder && mode === "volunteer"}
                onClaim={claimFromFeed}
                claimingId={feedClaimingId}
                userLocation={volunteerLocation ?? gpsLocation}
              />
              {feedTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-3">
                  {Array.from({ length: feedTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFeedPage(p)}
                      className={cn(
                        "flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
                        feedPage === p
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/60 text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {isResponder && feedTab === "summary" && (
        <MyTasksPanel
          tasks={volunteerTasksList}
          onResolve={resolveTask}
          onFetch={fetchMyTasks}
          socket={socket}
          myEmail={authUser?.email ?? ""}
          myName={authUser?.fullName ?? ""}
          isResolvingId={resolvingTaskId}
        />
      )}

      {isCivilian && feedTab === "requests" && (
        <div className="space-y-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold">My Requests</h2>
            <p className="text-xs text-muted-foreground">Your submitted emergency requests.</p>
          </div>
          {isLoadingMyRequests ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : myPastRequests.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <ShieldCheck className="h-6 w-6 opacity-40" />
                <p>You have not submitted any requests yet.</p>
              </div>
            </div>
          ) : (
            myPastRequests.map((req) => {
              const meta = TYPE_META[req.type];
              const Icon = meta.icon;
              const statusColor = req.resolved
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : req.cancelled
                  ? "bg-muted/40 text-muted-foreground border-border/40"
                  : req.claimed
                    ? "bg-[hsl(var(--status-claimed))/0.15] text-[hsl(var(--status-claimed))] border-[hsl(var(--status-claimed))/0.3]"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30";
              const statusLabel = req.resolved ? "Resolved" : req.cancelled ? "Cancelled" : req.claimed ? "In Progress" : "Pending";

              return (
                <article
                  key={req.id}
                  className="rounded-xl border border-[hsl(var(--surface-glass-border))] bg-[hsl(var(--surface-glass))/0.85] p-3"
                >
                  <div className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="shrink-0 border-border/80 bg-background/30">
                      <Icon className="mr-1 h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                    <span className={cn("ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusColor)}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90">{req.description}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{formatTime(req.createdAt)}</p>
                    {!req.resolved && !req.cancelled && !req.claimed && (
                      <button
                        type="button"
                        disabled={cancellingMyRequestId === req.id}
                        onClick={() => cancelMyRequest(req.id)}
                        className="flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                      >
                        {cancellingMyRequestId === req.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <X className="h-3 w-3" />}
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.22),transparent_45%),radial-gradient(circle_at_85%_15%,hsl(var(--crisis-rescue)/0.17),transparent_30%)]" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-border/60 bg-[hsl(var(--surface-glass))/0.9] px-3 backdrop-blur sm:px-4 md:px-6">
        <div className="min-w-0 shrink">
          <h1 className="flex items-center gap-1.5 text-base font-semibold tracking-wide sm:gap-2 sm:text-lg md:text-xl" data-testid="text-app-title">
            <Radio className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
            <span className="truncate">CrisisGrid</span>
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block">Real-time emergency coordination</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          {isResponder && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/40 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
              <span className={cn("hidden text-sm sm:block", mode === "victim" ? "text-foreground" : "text-muted-foreground")}>Victim</span>
              <Switch
                aria-label="Switch between victim and responder mode"
                checked={mode === "volunteer"}
                onCheckedChange={(checked) => setMode(checked ? "volunteer" : "victim")}
                data-testid="switch-mode"
              />
              <span className={cn("hidden text-sm sm:block", mode === "volunteer" ? "text-foreground" : "text-muted-foreground")}>
                Responder
              </span>
            </div>
          )}

          {authUser?.role === "civilian" && victimActiveRequest && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVictimStatusOpen(true)}
              className="animate-pulse border-destructive/70 bg-destructive/10 px-2.5 text-destructive sm:px-3"
              data-testid="button-my-status"
            >
              My Status
            </Button>
          )}


          {/* Requests Log — admin, superadmin, staff only */}
          {authUser && (authUser.role === "admin" || authUser.role === "superadmin" || authUser.role === "staff") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate("/requests")}
              className="border-border/70 bg-background/40 px-2.5 sm:px-3"
            >
              <Siren className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Requests</span>
            </Button>
          )}

          {/* CIRO Link — available to all authenticated users */}
          {authUser && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate("/ciro")}
              className="border-border/70 bg-background/40 px-2.5 sm:px-3"
            >
              <BrainCircuit className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">CIRO</span>
            </Button>
          )}

          {authUser?.role === "admin" && (
            <>
              <Button
                type="button"
                size="sm"
                variant={dashboardOpen ? "default" : "outline"}
                onClick={() => setDashboardOpen(true)}
                className={cn("relative px-2.5 sm:px-3", !dashboardOpen && "border-border/70 bg-background/40")}
                data-testid="button-command-center"
              >
                <span className="hidden sm:inline">Command Center</span>
                <span className="sm:hidden">HQ</span>
                {coverageGaps.filter((g) => !dismissedGapIds.has(g.requestId)).length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                    {coverageGaps.filter((g) => !dismissedGapIds.has(g.requestId)).length}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAdminExportCSV}
                className="border-border/70 bg-background/40 gap-1.5"
                title="Export all requests as CSV"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </>
          )}

          {isResponder && notifPermission !== "granted" && (
            <button
              type="button"
              onClick={requestNotificationPermission}
              title={notifPermission === "denied" ? "Notifications blocked — enable in browser settings" : "Enable push notifications for crisis alerts"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border text-xs transition-colors",
                notifPermission === "denied"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "animate-pulse border-amber-500/60 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              )}
            >
              🔔
            </button>
          )}

          {isResponder && (
            <NotificationBell
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onDismiss={handleDismissNotification}
              onFlyTo={handleFlyToAlert}
            />
          )}

          {authUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 border-border/70 bg-background/40 px-2.5" data-testid="button-user-menu">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{getInitials(authUser.fullName)}</AvatarFallback>
                  </Avatar>
                  <Badge className={cn("hidden sm:inline-flex", ROLE_META[authUser.role].badgeClass)}>
                    {ROLE_META[authUser.role].label}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-border/80 bg-popover/95 backdrop-blur">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium" data-testid="text-username">{authUser.fullName}</p>
                  <p className="text-xs text-muted-foreground">{authUser.email}</p>
                </div>
                <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setChangePwForm({ current: "", next: "", confirm: "" }); setChangePwErrors({}); setChangePasswordOpen(true); }} className="cursor-pointer">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer" data-testid="button-sign-out">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/signin")}
              className="border-border/70 bg-background/40"
              data-testid="button-sign-in"
            >
              Sign In / Register
            </Button>
          )}
        </div>
      </header>

      {(offlineMode || (!offlineMode && offlineQueue.length > 0)) && (
        <div className={`pointer-events-none absolute inset-x-0 top-16 z-20 border-y px-4 py-2 text-sm font-medium leading-snug md:px-6 ${offlineMode ? "border-destructive/60 bg-destructive/25 text-destructive" : "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            {offlineMode ? (
              <>
                <span>⚠️ No Internet Connection — Offline Mode.</span>
                {offlineQueue.length > 0 && (
                  <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs">
                    {offlineQueue.length} request{offlineQueue.length > 1 ? "s" : ""} queued
                  </span>
                )}
                <span className="text-xs opacity-70">Will sync automatically when restored.</span>
              </>
            ) : (
              <>
                <span>{isSyncing ? "⏳ Syncing" : "✓ Back Online — Submitting"}</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">
                  {offlineQueue.length} pending request{offlineQueue.length > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <VolunteerTasksSheet
        open={tasksDrawerOpen}
        onOpenChange={setTasksDrawerOpen}
        tasks={volunteerTasksList}
        expandedTaskId={expandedTaskId}
        onToggleTask={(taskId) => setExpandedTaskId((prev) => (prev === taskId ? null : taskId))}
        onResolveTask={resolveTask}
        isResolvingTask={isResolvingTask}
        resolvingTaskId={resolvingTaskId}
        typeMeta={TYPE_META}
        socket={socket}
        authUserEmail={authUser?.email ?? ""}
        authUserName={authUser?.fullName ?? ""}
        chatUnread={volunteerChatUnread}
        onClearChatUnread={(requestId) =>
          setVolunteerChatUnread((prev) => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          })
        }
      />

      {dashboardOpen ? (
        <AdminDashboard
          onBack={() => setDashboardOpen(false)}
          stats={adminStats}
          chartData={chartData}
          activityLogs={activityLogs}
          contentHeightClass={contentHeightClass}
        />
      ) : (
        <main className="relative z-10 flex-1 min-h-0 md:grid md:grid-cols-4">
          <section ref={mapSectionRef} className={cn("relative min-h-0 md:h-full", isMapFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "md:col-span-3")}>
            <div className="h-full min-h-0">
                <GoogleMapView
                  ref={mapRef}
                  filteredSortedRequests={filteredSortedRequests}
                  heatmapRequests={heatmapRequests}
                  safeZones={safeZones}
                  volunteerPositions={volunteerPositions}
                  volunteerLocation={volunteerLocation}
                  pendingCoords={pendingCoords}
                  routeAlternatives={routeAlternatives}
                  selectedRouteIdx={selectedRouteIdx}
                  activeClaimedTask={activeClaimedTask}
                  directionsResult={directionsResult}
                  mapLayer={mapLayer}
                  showHeatmap={showHeatmap}
                  heatmapMode={heatmapMode}
                  showClusters={showClusters}
                  showVolunteerHeatmap={showVolunteerHeatmap}
                  showVolunteers={showVolunteers}
                  showZones={showZones}
                  mode={mode}
                  authUser={authUser}
                  pinZoneMode={pinZoneMode}
                  isOnDuty={isOnDuty}
                  deletingZoneId={deletingZoneId}
                  popupRequest={popupRequest}
                  volunteerPopup={volunteerPopup}
                  zonePopup={zonePopup}
                  onMapClick={handleMapClick}
                  onMarkerClick={setPopupRequest}
                  onVolunteerMarkerClick={setVolunteerPopup}
                  onZoneMarkerClick={setZonePopup}
                  onClosePopup={() => setPopupRequest(null)}
                  onCloseVolunteerPopup={() => setVolunteerPopup(null)}
                  onCloseZonePopup={() => setZonePopup(null)}
                  onSelectRoute={setSelectedRouteIdx}
                  onDeleteZone={handleDeleteZone}
                  openDetails={openDetails}
                  onClaimRequest={claimFromFeed}
                  claimingId={feedClaimingId}
                  showRoute={
                    authUser?.role === "civilian" &&
                    !!victimActiveRequest?.claimed &&
                    routeAlternatives.length > 0
                  }
                />
            </div>

            {/* Stats Widgets — floating overlay on map, below search bar */}
            {authUser && (
              <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 overflow-x-auto px-1 pt-1">
                <DashboardStat
                  label="Total"
                  value={requests.filter((r) => r.taskStatus !== "CANCELLED").length}
                  icon={<Siren className="h-3 w-3" />}
                  color="bg-slate-500/10 text-slate-600 dark:text-slate-400"
                />
                <DashboardStat
                  label="Queued"
                  value={requests.filter((r) => !r.claimed && r.taskStatus !== "RESOLVED" && r.taskStatus !== "CANCELLED").length}
                  icon={<Loader2 className="h-3 w-3" />}
                  color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                />
                <DashboardStat
                  label="Claimed"
                  value={requests.filter((r) => r.claimed && r.taskStatus !== "RESOLVED" && r.taskStatus !== "CANCELLED").length}
                  icon={<ShieldCheck className="h-3 w-3" />}
                  color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                />
                <DashboardStat
                  label="Resolved"
                  value={requests.filter((r) => r.taskStatus === "RESOLVED").length}
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                />
              </div>
            )}

              {(showHeatmap || showClusters || showVolunteers || showVolunteerHeatmap) && (
                <div className="absolute bottom-20 left-3 z-10 min-w-[170px] rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-14">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Incident Breakdown
                  </p>

                  {showHeatmap && heatmapMode === "type" && (
                    <div className="mb-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                          <HeartPulse className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Medical</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums">{typeCounts.medical}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          <Droplets className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Food / Water</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums">{typeCounts.food_water}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="block h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                          <LifeBuoy className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Rescue</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums">{typeCounts.rescue}</span>
                      </div>
                    </div>
                  )}

                  {showHeatmap && heatmapMode === "combined" && (
                    <div className="mb-2 space-y-1.5">
                      {(Object.keys(TYPE_META) as CrisisType[]).map((type) => {
                        const meta = TYPE_META[type];
                        const Icon = meta.icon;
                        return (
                          <div key={type} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("block h-2 w-2 shrink-0 rounded-full", meta.markerClass)} />
                              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{meta.label}</span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums">{typeCounts[type]}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showClusters && (
                    <>
                      {showHeatmap && <div className="my-2 border-t border-border/50" />}
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cluster Size</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">1</span>
                          <span className="text-xs text-muted-foreground">1–4 incidents</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">5</span>
                          <span className="text-xs text-muted-foreground">5–9 incidents</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">10</span>
                          <span className="text-xs text-muted-foreground">10+ incidents</span>
                        </div>
                      </div>
                    </>
                  )}

                  {showVolunteerHeatmap && authUser?.role === "admin" && (
                    <>
                      <div className="my-2 border-t border-border/50" />
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Volunteer Coverage</p>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="h-2 w-24 shrink-0 rounded-full" style={{ background: "linear-gradient(to right, rgba(167,243,208,0.3), rgba(52,211,153,0.7), rgba(4,120,87,1))" }} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="block h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                          <span className="text-xs text-muted-foreground">Active volunteers</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-emerald-500">
                          {Object.keys(volunteerPositions).length}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground/60 leading-tight">
                        Brighter = higher concentration
                      </p>
                    </>
                  )}

                  {showVolunteers && (authUser?.role === "admin" || authUser?.role === "volunteer") && (
                    <>
                      <div className="my-2 border-t border-border/50" />
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Volunteers</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            </span>
                            <span className="text-xs text-muted-foreground">Active</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-emerald-500">
                            {Object.keys(volunteerPositions).length}
                          </span>
                        </div>
                        {authUser?.role === "volunteer" && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              {isOnDuty && volunteerLocation ? (
                                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                                </span>
                              ) : (
                                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-400 bg-transparent" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {isOnDuty ? "You (broadcasting)" : "You (off duty)"}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-semibold",
                              isOnDuty ? "text-emerald-500" : "text-slate-400"
                            )}>
                              {isOnDuty ? "On Duty" : "Off Duty"}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="my-2 border-t border-border/50" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[hsl(var(--crisis-medical))]">Unclaimed</span>
                      <span className="text-xs font-bold tabular-nums text-[hsl(var(--crisis-medical))]">{typeCounts.unclaimed}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[hsl(var(--status-claimed))]">Claimed</span>
                      <span className="text-xs font-bold tabular-nums text-[hsl(var(--status-claimed))]">{typeCounts.claimed}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 right-3 z-10 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowZones((v) => !v)}
                  className={cn(
                    "overflow-hidden rounded-lg border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors",
                    showZones
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Toggle safe zones"
                >
                  Zones
                </button>
                {(authUser?.role === "admin" || authUser?.role === "volunteer") && (
                  <button
                    type="button"
                    onClick={() => setShowVolunteers((v) => !v)}
                    className={cn(
                      "overflow-hidden rounded-lg border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors",
                      showVolunteers
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Toggle volunteer positions"
                  >
                    Volunteers{Object.keys(volunteerPositions).length > 0 && (
                      <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                        {Object.keys(volunteerPositions).length}
                      </span>
                    )}
                  </button>
                )}
                {authUser?.role === "volunteer" && (
                  <button
                    type="button"
                    onClick={handleToggleDuty}
                    disabled={isTogglingDuty}
                    className={cn(
                      "overflow-hidden rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors disabled:opacity-50",
                      isOnDuty
                        ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                        : "border-slate-500/60 bg-slate-500/10 text-slate-400 hover:bg-slate-500/15"
                    )}
                    title={isOnDuty ? "Go off duty (pause GPS & alerts)" : "Go on duty (resume GPS & alerts)"}
                  >
                    {isTogglingDuty ? (
                      <Loader2 className="inline h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", isOnDuty ? "bg-emerald-400" : "bg-slate-400")} />
                        {isOnDuty ? "On Duty" : "Off Duty"}
                      </>
                    )}
                  </button>
                )}
                {authUser?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setPinZoneMode((v) => !v)}
                    className={cn(
                      "flex items-center gap-1 overflow-hidden rounded-lg border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors",
                      pinZoneMode
                        ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Pin a safe zone on the map"
                  >
                    <Plus className="h-3 w-3" />
                    Pin Zone
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowClusters((v) => !v)}
                  className={cn(
                    "overflow-hidden rounded-lg border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors",
                    showClusters
                      ? "border-blue-500/60 bg-blue-500/10 text-blue-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Toggle crisis clusters"
                >
                  Cluster
                </button>
                {authUser?.role === "admin" && (
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-background/95 shadow-lg backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setShowVolunteerHeatmap((v) => !v)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        showVolunteerHeatmap
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Toggle volunteer coverage heatmap"
                    >
                      Vol. Heat
                    </button>
                  </div>
                )}

                <div className="overflow-hidden rounded-lg border border-border/70 bg-background/95 shadow-lg backdrop-blur">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => setShowHeatmap((v) => !v)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        showHeatmap
                          ? "bg-orange-500/15 text-orange-400"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Toggle incident heatmap"
                    >
                      Heat
                    </button>
                    {showHeatmap && (
                      <button
                        type="button"
                        onClick={() => setHeatmapMode((m) => m === "combined" ? "type" : "combined")}
                        className={cn(
                          "border-l border-border/50 px-2 py-1.5 text-[11px] font-medium transition-colors",
                          heatmapMode === "type"
                            ? "text-violet-400 bg-violet-500/10"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Toggle combined vs per-type heatmap"
                      >
                        {heatmapMode === "type" ? "By Type" : "Combined"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/70 bg-background/95 shadow-lg backdrop-blur">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => setMapLayer("streets")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        mapLayer === "streets"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapLayer("satellite")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        mapLayer === "satellite"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Satellite
                    </button>
                  </div>
                </div>
              </div>

            {/* Search + Fullscreen — top-right */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <div className="w-48 sm:w-56 md:w-64">
                <PlacesSearch onSelect={(center, _name) => handleGeocodeSelect(center)} />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isMapFullscreen) {
                    mapSectionRef.current?.requestFullscreen?.();
                    setIsMapFullscreen(true);
                  } else {
                    document.exitFullscreen?.();
                    setIsMapFullscreen(false);
                  }
                }}
                title={isMapFullscreen ? "Exit fullscreen" : "Fullscreen map"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/95 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground"
              >
                {isMapFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                )}
              </button>
            </div>

            {authUser?.role === "admin" && coverageGaps.filter((g) => !dismissedGapIds.has(g.requestId)).length > 0 && gapPanelOpen && (
              <div className="absolute left-3 z-30 md:left-auto md:right-3" style={{ top: "calc(3rem + 0.75rem + 2.5rem + 0.5rem)", maxWidth: "320px", width: "calc(100vw - 1.5rem)" }}>
                <div className="rounded-xl border border-destructive/40 bg-background/97 shadow-xl backdrop-blur overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border/40 bg-destructive/10 px-3 py-2">
                    <Siren className="h-3.5 w-3.5 text-destructive animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-destructive">Coverage Gaps Detected</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Radius:</span>
                        <select
                          value={gapRadiusKm}
                          onChange={(e) => setGapRadiusKm(Number(e.target.value))}
                          className="h-5 rounded border border-border/50 bg-background/60 px-1 text-[10px] text-foreground"
                        >
                          {[1, 2, 5, 10, 20, 50].map((v) => (
                            <option key={v} value={v}>{v} km</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGapPanelOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Collapse"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-border/30 max-h-60 overflow-y-auto">
                    {coverageGaps
                      .filter((g) => !dismissedGapIds.has(g.requestId))
                      .slice(0, 6)
                      .map((gap) => {
                        const typeLabel = gap.type === "MEDICAL" ? "Medical" : gap.type === "FOOD_WATER" ? "Food/Water" : "Rescue";
                        const typeColor = gap.type === "MEDICAL" ? "text-red-400" : gap.type === "FOOD_WATER" ? "text-blue-400" : "text-amber-400";
                        const typeDot = gap.type === "MEDICAL" ? "bg-red-500" : gap.type === "FOOD_WATER" ? "bg-blue-500" : "bg-amber-500";
                        const distLabel = gap.closestVolunteerKm === null
                          ? "No volunteers online"
                          : `Nearest: ${gap.closestVolunteerKm} km away`;
                        return (
                          <div key={gap.requestId} className="flex items-start gap-2 px-3 py-2">
                            <span className={cn("mt-1 block h-2 w-2 shrink-0 rounded-full", typeDot)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-[10px] font-bold uppercase", typeColor)}>{typeLabel}</span>
                                <span className="text-[10px] text-muted-foreground">#{gap.requestId}</span>
                              </div>
                              <p className="text-[11px] text-foreground truncate">{gap.description}</p>
                              <p className="text-[10px] text-destructive/80">{distLabel}</p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => mapRef.current?.panTo(gap.lat, gap.lng, 14)}
                                className="text-[9px] font-medium text-primary hover:underline"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => setDismissedGapIds((prev) => new Set([...prev, gap.requestId]))}
                                className="text-[9px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {coverageGaps.filter((g) => !dismissedGapIds.has(g.requestId)).length > 6 && (
                    <div className="border-t border-border/30 px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                      +{coverageGaps.filter((g) => !dismissedGapIds.has(g.requestId)).length - 6} more gaps
                    </div>
                  )}
                  <div className="border-t border-border/30 flex gap-0 divide-x divide-border/30">
                    <button
                      type="button"
                      className="flex-1 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setDismissedGapIds(new Set(coverageGaps.map((g) => g.requestId)))}
                    >
                      Dismiss All
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-1.5 text-[10px] font-medium text-primary hover:underline transition-colors"
                      onClick={() => { setDismissedGapIds(new Set()); }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}

            {priorityAlerts.length > 0 && authUser?.role === "volunteer" && (
              <div className="absolute left-3 right-3 z-20 md:left-14 md:right-auto md:max-w-sm" style={{ top: "calc(3rem + 0.75rem + 2.5rem + 0.5rem + 2.5rem + 0.5rem)" }}>
                <div className="flex flex-col gap-1.5">
                  {priorityAlerts.map((alert) => {
                    const typeLabel = alert.crisisType === "medical" ? "Medical" : alert.crisisType === "food_water" ? "Food / Water" : "Rescue";
                    const typeColor = alert.crisisType === "medical" ? "border-red-500/60 bg-red-500/10" : alert.crisisType === "food_water" ? "border-blue-500/60 bg-blue-500/10" : "border-amber-500/60 bg-amber-500/10";
                    const typeTextColor = alert.crisisType === "medical" ? "text-red-400" : alert.crisisType === "food_water" ? "text-blue-400" : "text-amber-400";
                    const distLabel = alert.distanceKm < 1 ? `${Math.round(alert.distanceKm * 1000)}m` : `${alert.distanceKm.toFixed(1)}km`;
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur",
                          typeColor
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="relative mt-0.5 flex h-2.5 w-2.5 shrink-0">
                            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", alert.crisisType === "medical" ? "bg-red-400" : alert.crisisType === "food_water" ? "bg-blue-400" : "bg-amber-400")} />
                            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", alert.crisisType === "medical" ? "bg-red-500" : alert.crisisType === "food_water" ? "bg-blue-500" : "bg-amber-500")} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn("text-xs font-bold", typeTextColor)}>⚡ PRIORITY DISPATCH</span>
                              <Badge variant="outline" className={cn("h-4 px-1 text-[10px]", typeTextColor)}>{typeLabel}</Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">{distLabel} away</span>
                            </div>
                            <p className="mt-0.5 text-xs leading-snug text-foreground/90 line-clamp-2">{alert.dispatchMessage}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">Walk ~{alert.walkMinutes}min · Drive ~{alert.driveMinutes}min</span>
                              <div className="ml-auto flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => mapRef.current?.panTo(alert.crisisLat, alert.crisisLng, 14)}
                                >
                                  Fly to
                                </Button>
                                <button
                                  type="button"
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                  onClick={() => setPriorityAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
              {pinZoneMode && authUser?.role === "admin"
                ? "Admin: tap map to pin a safe zone"
                : mode === "victim"
                  ? "Victim Mode: tap map to create a request"
                  : "Volunteer Mode: tap a marker to claim & route"}
            </div>

            {/* Victim: responder en-route info overlay */}
            {authUser?.role === "civilian" && victimActiveRequest?.claimed && routeAlternatives.length > 0 && (
              <div className="absolute right-3 z-20 md:top-3" style={{ top: "calc(3rem + 0.75rem + 2.5rem + 0.5rem)" }}>
                <div className="rounded-xl border border-emerald-500/60 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Navigation className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Responder En Route</p>
                      <p className="text-xs font-medium text-foreground">
                        {routeAlternatives[selectedRouteIdx]?.distanceM >= 1000
                          ? `${(routeAlternatives[selectedRouteIdx].distanceM / 1000).toFixed(1)} km away`
                          : `${Math.round(routeAlternatives[selectedRouteIdx]?.distanceM ?? 0)} m away`}
                        <span className="mx-1 text-muted-foreground">·</span>
                        {Math.ceil((routeAlternatives[selectedRouteIdx]?.durationSec ?? 0) / 60)} min
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isResponder && activeClaimedTask && routeAlternatives.length > 0 && (
              <div className="absolute right-3 z-20 md:top-3" style={{ top: "calc(3rem + 0.75rem + 2.5rem + 0.5rem)" }}>
                <div className="rounded-xl border border-blue-500/60 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                      <Navigation className="h-3.5 w-3.5 animate-pulse text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-400">En Route</p>
                      <p className="text-xs font-medium text-foreground">
                        {routeAlternatives[selectedRouteIdx]?.distanceM >= 1000
                          ? `${(routeAlternatives[selectedRouteIdx].distanceM / 1000).toFixed(1)} km`
                          : `${Math.round(routeAlternatives[selectedRouteIdx]?.distanceM ?? 0)} m`}
                        <span className="mx-1 text-muted-foreground">·</span>
                        {Math.ceil((routeAlternatives[selectedRouteIdx]?.durationSec ?? 0) / 60)} min
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 w-full border-blue-500/40 text-[10px] font-semibold text-blue-500 hover:bg-blue-500/10"
                    onClick={openNavigationApp}
                  >
                    Open Navigation
                  </Button>
                  {routeAlternatives.length > 1 && (
                    <div className="mt-2 flex gap-1">
                      {routeAlternatives.map((route, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedRouteIdx(idx);
                            setRouteInfo({ distanceM: route.distanceM, durationSec: route.durationSec });
                          }}
                          className={cn(
                            "flex-1 rounded-lg px-1.5 py-1 text-[10px] font-medium transition-colors leading-tight",
                            idx === selectedRouteIdx
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          {idx === 0 ? "Fastest" : `Alt ${idx}`}
                          <br />
                          <span className="opacity-75">{Math.ceil(route.durationSec / 60)}m</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="absolute bottom-3 right-3 md:hidden">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button size="sm" className="bg-primary/90" data-testid="button-mobile-feed">
                    Live Crisis Feed
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[82vh]">
                  <DrawerHeader>
                    <DrawerTitle>Live Crisis Feed</DrawerTitle>
                    <DrawerDescription>Newest alerts appear first.</DrawerDescription>
                  </DrawerHeader>
                  <div className="px-4 pb-5">{feedPanelContent}</div>
                </DrawerContent>
              </Drawer>
            </div>
          </section>

          {/* Horizontal Tabs + Feed Panel — replaces old sidebar */}
          <aside className="hidden h-full min-h-0 border-l border-border/60 bg-[hsl(var(--surface-glass))/0.85] backdrop-blur md:flex md:flex-col">
            {/* Tab Bar */}
            <div className="flex shrink-0 border-b border-border/60">
              <button
                type="button"
                onClick={() => setFeedTab("feed")}
                className={cn(
                  "flex-1 px-3 py-2.5 text-xs font-medium transition-colors",
                  feedTab === "feed"
                    ? "border-b-2 border-primary bg-background/50 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                Live Feed
              </button>
              {isResponder && (
                <button
                  type="button"
                  onClick={() => setFeedTab("summary")}
                  className={cn(
                    "flex-1 px-3 py-2.5 text-xs font-medium transition-colors",
                    feedTab === "summary"
                      ? "border-b-2 border-primary bg-background/50 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  My Tasks
                </button>
              )}
              {isCivilian && (
                <button
                  type="button"
                  onClick={() => { setFeedTab("requests"); fetchMyRequests(); }}
                  className={cn(
                    "flex-1 px-3 py-2.5 text-xs font-medium transition-colors",
                    feedTab === "requests"
                      ? "border-b-2 border-primary bg-background/50 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  My Requests
                </button>
              )}
            </div>

            {/* Panel Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{feedPanelContent}</div>
          </aside>
        </main>
      )}

      {/* Footer */}
      <AppFooter />

      <Dialog open={victimStatusOpen} onOpenChange={setVictimStatusOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Your Active Request</DialogTitle>
            <DialogDescription>Track your emergency progress in real time.</DialogDescription>
          </DialogHeader>

          {victimActiveRequest ? (
            <div className="space-y-4 pb-1">
              <div className="rounded-lg border border-border/60 bg-background/35 p-4">
                <p className="text-sm font-medium">{victimActiveRequest.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">Reported {formatTime(victimActiveRequest.createdAt)}</p>
              </div>

              <div className="space-y-3 rounded-lg border border-border/60 bg-background/35 p-4">
                <Progress value={victimProgress} />
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
                  <span className="rounded-md border border-border/50 px-2 py-1">Request Broadcasted</span>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1",
                      victimActiveRequest.claimed
                        ? "border-[hsl(var(--status-claimed))/0.7] text-[hsl(var(--status-claimed))]"
                        : "border-border/50",
                    )}
                  >
                    Volunteer Assigned
                  </span>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1",
                      victimActiveRequest.claimed
                        ? "border-[hsl(var(--status-claimed))/0.7] text-[hsl(var(--status-claimed))]"
                        : "border-border/50",
                    )}
                  >
                    En Route
                  </span>
                </div>
              </div>

              {victimActiveRequest.claimed && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setVictimChatOpen((v) => !v)}
                    className={cn(
                      "relative flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                      victimChatOpen
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/60 bg-background/35 text-foreground hover:bg-muted/30"
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {victimChatOpen ? "Hide Chat" : "Chat with Volunteer"}
                    {!victimChatOpen && chatUnreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                      </span>
                    )}
                  </button>
                  {victimChatOpen && (
                    <TaskChatPanel
                      requestId={victimActiveRequest.id}
                      myEmail={authUser?.email ?? ""}
                      myName={authUser?.fullName ?? ""}
                      socket={socket}
                    />
                  )}
                </div>
              )}

              <DialogFooter className="sticky bottom-0 bg-background/95 pt-2 backdrop-blur">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={cancelVictimRequest}
                  className="h-11 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-cancel-request"
                >
                  Cancel Request / I am Safe Now
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-background/35 p-4 text-sm text-muted-foreground">
              You currently have no active request.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Request</DialogTitle>
            <DialogDescription>What type of assistance is needed?</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Location</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  requestGpsLocation();
                  if (!newRequestOpen) {
                    setSelectedType(null);
                    setDescription("");
                    setNewRequestOpen(true);
                  }
                }}
                disabled={isGettingLocation || gpsPermission === "unavailable"}
                className="flex-1"
                data-testid="button-use-my-location"
              >
                {isGettingLocation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Crosshair className="mr-2 h-4 w-4" />
                    Use My Location
                  </>
                )}
              </Button>
            </div>
            {pendingCoords && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-coordinates">
                <Navigation className="h-3 w-3" />
                {pendingCoords.lat.toFixed(4)}, {pendingCoords.lng.toFixed(4)}
              </p>
            )}
            {gpsPermission === "denied" && (
              <p className="text-xs text-destructive" data-testid="text-gps-denied">
                Location access denied. You can click on the map to set coordinates instead.
              </p>
            )}
            {!pendingCoords && gpsPermission !== "denied" && (
              <p className="text-xs text-muted-foreground">
                Or click on the map to set the location manually.
              </p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TYPE_META) as CrisisType[]).map((type) => {
              const meta = TYPE_META[type];
              const Icon = meta.icon;

              return (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  data-selected={selectedType === type}
                  onClick={() => setSelectedType(type)}
                  className={cn("justify-start", meta.buttonClass)}
                  data-testid={`select-type-${type}`}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                </Button>
              );
            })}
          </div>

          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe immediate needs and nearby landmarks"
            rows={4}
            data-testid="input-description"
          />

          {(offlineMode || !navigator.onLine) && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              📶 You're offline — your request will be saved locally and submitted automatically when you reconnect.
            </p>
          )}

          <DialogFooter>
            <Button type="button" onClick={submitRequest} disabled={isSubmittingRequest || !pendingCoords} data-testid="button-submit-request">
              {isSubmittingRequest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Broadcasting...
                </>
              ) : offlineMode || !navigator.onLine ? (
                "Queue Offline"
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Crisis Details</DialogTitle>
            <DialogDescription>Review details before claiming this request.</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{TYPE_META[selectedRequest.type].label}</Badge>
                {selectedRequest.claimed && (
                  <Badge className="bg-[hsl(var(--status-claimed))] text-primary-foreground">Already claimed</Badge>
                )}
              </div>
              <p className="text-sm">{selectedRequest.description}</p>
              <p className="text-xs text-muted-foreground">{formatTime(selectedRequest.createdAt)}</p>
              <p className="text-xs text-muted-foreground">
                Coordinates: {selectedRequest.lat.toFixed(4)}, {selectedRequest.lng.toFixed(4)}
              </p>
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background/95 pt-2 backdrop-blur">
            <Button
              type="button"
              onClick={claimRequest}
              disabled={!selectedRequest || selectedRequest.claimed || isClaimingTask}
              className="h-11 bg-[hsl(var(--status-claimed))] text-primary-foreground hover:bg-[hsl(var(--status-claimed))/0.85]"
              data-testid="button-claim-request"
            >
              {isClaimingTask ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                "Claim & Route"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pinZoneOpen}
        onOpenChange={(open) => {
          setPinZoneOpen(open);
          if (!open) setPinZonePending(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pin Safe Zone</DialogTitle>
            <DialogDescription>
              Mark this location as a safe zone — shelters, hospitals, or staging areas for responders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Name *</Label>
              <Input
                id="zone-name"
                value={pinZoneName}
                onChange={(e) => setPinZoneName(e.target.value)}
                placeholder="e.g. City Hall Shelter"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Zone Type *</Label>
              <RadioGroup
                value={pinZoneType}
                onValueChange={(v) => setPinZoneType(v as SafeZoneType)}
                className="grid grid-cols-3 gap-2"
              >
                {(Object.keys(ZONE_META) as SafeZoneType[]).map((type) => {
                  const meta = ZONE_META[type];
                  const Icon = meta.icon;
                  return (
                    <div key={type}>
                      <RadioGroupItem value={type} id={`zone-type-${type}`} className="peer sr-only" />
                      <Label
                        htmlFor={`zone-type-${type}`}
                        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-background/30 px-3 py-3 text-center text-xs font-medium transition-colors peer-data-[state=checked]:border-emerald-500/60 peer-data-[state=checked]:bg-emerald-500/10 peer-data-[state=checked]:text-emerald-400 hover:border-border"
                      >
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zone-desc">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="zone-desc"
                value={pinZoneDesc}
                onChange={(e) => setPinZoneDesc(e.target.value)}
                placeholder="e.g. Capacity 200, medical staff on site"
                className="resize-none"
                rows={2}
              />
            </div>

            {pinZonePending && (
              <p className="text-[11px] text-muted-foreground">
                Location: {pinZonePending.lat.toFixed(5)}, {pinZonePending.lng.toFixed(5)}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPinZoneOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePinZoneSubmit}
              disabled={isPinningZone || !pinZoneName.trim()}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isPinningZone ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pinning…
                </>
              ) : (
                "Pin Zone"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePasswordOpen} onOpenChange={(open) => { setChangePasswordOpen(open); if (!open) { setChangePwForm({ current: "", next: "", confirm: "" }); setChangePwErrors({}); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Change Password
            </DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Current Password</Label>
              <Input
                id="cp-current"
                type="password"
                value={changePwForm.current}
                onChange={(e) => { setChangePwForm((f) => ({ ...f, current: e.target.value })); setChangePwErrors((er) => ({ ...er, current: "" })); }}
                placeholder="Your current password"
                className={cn("h-11", changePwErrors.current && "border-destructive")}
              />
              {changePwErrors.current && <p className="text-xs text-destructive">{changePwErrors.current}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-new">New Password</Label>
              <Input
                id="cp-new"
                type="password"
                value={changePwForm.next}
                onChange={(e) => { setChangePwForm((f) => ({ ...f, next: e.target.value })); setChangePwErrors((er) => ({ ...er, next: "" })); }}
                placeholder="Min 6 characters"
                className={cn("h-11", changePwErrors.next && "border-destructive")}
              />
              {changePwErrors.next && <p className="text-xs text-destructive">{changePwErrors.next}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">Confirm New Password</Label>
              <Input
                id="cp-confirm"
                type="password"
                value={changePwForm.confirm}
                onChange={(e) => { setChangePwForm((f) => ({ ...f, confirm: e.target.value })); setChangePwErrors((er) => ({ ...er, confirm: "" })); }}
                placeholder="Re-enter new password"
                className={cn("h-11", changePwErrors.confirm && "border-destructive")}
              />
              {changePwErrors.confirm && <p className="text-xs text-destructive">{changePwErrors.confirm}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)} className="h-11" disabled={changePwSubmitting}>
              Cancel
            </Button>
            <Button
              className="h-11"
              disabled={changePwSubmitting}
              onClick={async () => {
                const e: Record<string, string> = {};
                if (!changePwForm.current) e.current = "Current password is required";
                if (!changePwForm.next) e.next = "New password is required";
                else if (changePwForm.next.length < 6) e.next = "Must be at least 6 characters";
                else if (changePwForm.next === changePwForm.current) e.next = "New password must differ from current";
                if (changePwForm.next && changePwForm.next !== changePwForm.confirm) e.confirm = "Passwords do not match";
                setChangePwErrors(e);
                if (Object.keys(e).length > 0) return;
                setChangePwSubmitting(true);
                try {
                  await api.changePassword(changePwForm.current, changePwForm.next);
                  toast.success("Password changed successfully");
                  setChangePasswordOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to change password");
                } finally {
                  setChangePwSubmitting(false);
                }
              }}
            >
              {changePwSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (open) {
            api.get2FAStatus().then((r) => { setTwoFAEnabled(r.twoFactorEnabled); setTwoFABackupCount(r.backupCodesRemaining ?? 0); }).catch(() => {});
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Update your profile preferences.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency-contact">Emergency Contact</Label>
              <Input
                id="emergency-contact"
                value={emergencyContact}
                onChange={(event) => setEmergencyContact(event.target.value)}
                className="h-11"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Share precise GPS location</p>
                <p className="text-xs text-muted-foreground">Improves route accuracy for responders.</p>
              </div>
              <Switch checked={sharePreciseLocation} onCheckedChange={setSharePreciseLocation} />
            </div>

            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">
                    {twoFAEnabled ? "Your account is protected with 2FA." : "Add an extra layer of login security."}
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", twoFAEnabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                  {twoFAEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {twoFAEnabled && (
                <p className="text-xs text-muted-foreground">
                  {twoFABackupCount > 0 ? `${twoFABackupCount} backup code${twoFABackupCount !== 1 ? "s" : ""} remaining` : "No backup codes remaining — regenerate them below"}
                </p>
              )}
              {twoFAEnabled ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setTwoFARegenCode(""); setTwoFARegenError(""); setTwoFARegenNewCodes([]); setTwoFARegenOpen(true); }}
                  >
                    Regenerate codes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => { setTwoFADisablePassword(""); setTwoFADisableError(""); setTwoFADisableOpen(true); }}
                  >
                    Remove 2FA
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={twoFALoading}
                  onClick={async () => {
                    setTwoFALoading(true);
                    try {
                      const result = await api.setup2FA();
                      setTwoFAQrCode(result.qrCodeDataUrl);
                      setTwoFASecret(result.secret);
                      setTwoFAVerifyCode("");
                      setTwoFAVerifyError("");
                      setTwoFASetupOpen(true);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to start 2FA setup");
                    } finally {
                      setTwoFALoading(false);
                    }
                  }}
                >
                  {twoFALoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Set Up 2FA
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setSettingsOpen(false)} className="h-11">
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={twoFASetupOpen} onOpenChange={(open) => { setTwoFASetupOpen(open); if (!open) { setTwoFAVerifyCode(""); setTwoFAVerifyError(""); setTwoFASetupStep("qr"); setTwoFABackupCodes([]); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md p-4 sm:p-6">
          {twoFASetupStep === "qr" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Set Up Two-Factor Authentication
                </DialogTitle>
                <DialogDescription>Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                {twoFAQrCode && (
                  <div className="flex justify-center">
                    <img src={twoFAQrCode} alt="2FA QR Code" className="h-44 w-44 rounded-lg border border-border" />
                  </div>
                )}
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-center">
                  <p className="mb-1 text-xs text-muted-foreground">Manual entry code</p>
                  <p className="font-mono text-sm tracking-widest break-all select-all">{twoFASecret}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="2fa-verify-code">Verification Code</Label>
                  <Input
                    id="2fa-verify-code"
                    value={twoFAVerifyCode}
                    onChange={(e) => { setTwoFAVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTwoFAVerifyError(""); }}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={cn("h-12 text-center text-xl font-mono tracking-widest", twoFAVerifyError && "border-destructive")}
                  />
                  {twoFAVerifyError && <p className="text-xs text-destructive">{twoFAVerifyError}</p>}
                  <p className="text-xs text-muted-foreground">Use Google Authenticator, Authy, or any TOTP app.</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setTwoFASetupOpen(false)} disabled={twoFAVerifyLoading} className="h-11">Cancel</Button>
                <Button
                  className="h-11"
                  disabled={twoFAVerifyLoading || twoFAVerifyCode.length !== 6}
                  onClick={async () => {
                    setTwoFAVerifyLoading(true);
                    try {
                      const result = await api.enable2FA(twoFAVerifyCode);
                      setTwoFAEnabled(true);
                      setTwoFABackupCount(result.backupCodes?.length ?? 8);
                      setTwoFABackupCodes(result.backupCodes ?? []);
                      setTwoFASetupStep("backup-codes");
                    } catch (err) {
                      setTwoFAVerifyError(err instanceof Error ? err.message : "Invalid code");
                    } finally {
                      setTwoFAVerifyLoading(false);
                    }
                  }}
                >
                  {twoFAVerifyLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Enable 2FA"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Save Your Backup Codes
                </DialogTitle>
                <DialogDescription>
                  2FA is now enabled! Store these backup codes somewhere safe. Each code can only be used once if you lose access to your authenticator app.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  {twoFABackupCodes.map((c) => (
                    <span key={c} className="font-mono text-sm tracking-widest text-center select-all py-0.5">{c}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => { navigator.clipboard.writeText(twoFABackupCodes.join("\n")); toast.success("Copied to clipboard"); }}
                  >
                    Copy all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      const blob = new Blob([`CrisisGrid Backup Codes\n\n${twoFABackupCodes.join("\n")}\n\nStore these codes securely. Each code can only be used once.`], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "crisisgrid-backup-codes.txt"; a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button className="h-11 w-full" onClick={() => { setTwoFASetupOpen(false); toast.success("2FA setup complete!"); }}>
                  Done, I've saved my codes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={twoFARegenOpen} onOpenChange={(open) => { setTwoFARegenOpen(open); if (!open) { setTwoFARegenCode(""); setTwoFARegenError(""); setTwoFARegenNewCodes([]); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md p-4 sm:p-6">
          {twoFARegenNewCodes.length > 0 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  New Backup Codes Generated
                </DialogTitle>
                <DialogDescription>Your old codes are now invalid. Save these new codes somewhere safe — each can only be used once.</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  {twoFARegenNewCodes.map((c) => (
                    <span key={c} className="font-mono text-sm tracking-widest text-center select-all py-0.5">{c}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => { navigator.clipboard.writeText(twoFARegenNewCodes.join("\n")); toast.success("Copied to clipboard"); }}
                  >
                    Copy all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      const blob = new Blob([`CrisisGrid Backup Codes\n\n${twoFARegenNewCodes.join("\n")}\n\nStore these codes securely. Each code can only be used once.`], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = "crisisgrid-backup-codes.txt"; a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button className="h-11 w-full" onClick={() => { setTwoFARegenOpen(false); setTwoFABackupCount(twoFARegenNewCodes.length); }}>
                  Done, I've saved my codes
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Regenerate Backup Codes</DialogTitle>
                <DialogDescription>Enter your current authenticator code to generate a fresh set of 8 backup codes. Your existing codes will be invalidated.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-1">
                <Label htmlFor="2fa-regen-code">Authenticator Code</Label>
                <Input
                  id="2fa-regen-code"
                  value={twoFARegenCode}
                  onChange={(e) => { setTwoFARegenCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTwoFARegenError(""); }}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={cn("h-12 text-center text-xl font-mono tracking-widest", twoFARegenError && "border-destructive")}
                  autoFocus
                />
                {twoFARegenError && <p className="text-xs text-destructive">{twoFARegenError}</p>}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setTwoFARegenOpen(false)} disabled={twoFARegenLoading} className="h-11">Cancel</Button>
                <Button
                  className="h-11"
                  disabled={twoFARegenLoading || twoFARegenCode.length !== 6}
                  onClick={async () => {
                    setTwoFARegenLoading(true);
                    try {
                      const result = await api.regenerateBackupCodes(twoFARegenCode);
                      setTwoFARegenNewCodes(result.backupCodes);
                    } catch (err) {
                      setTwoFARegenError(err instanceof Error ? err.message : "Failed to regenerate codes");
                    } finally {
                      setTwoFARegenLoading(false);
                    }
                  }}
                >
                  {twoFARegenLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : "Generate New Codes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={twoFADisableOpen} onOpenChange={(open) => { setTwoFADisableOpen(open); if (!open) { setTwoFADisablePassword(""); setTwoFADisableError(""); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Remove Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enter your password to confirm disabling 2FA.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="2fa-disable-password">Current Password</Label>
            <Input
              id="2fa-disable-password"
              type="password"
              value={twoFADisablePassword}
              onChange={(e) => { setTwoFADisablePassword(e.target.value); setTwoFADisableError(""); }}
              placeholder="Your password"
              className={cn("h-11", twoFADisableError && "border-destructive")}
            />
            {twoFADisableError && <p className="text-xs text-destructive">{twoFADisableError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTwoFADisableOpen(false)} disabled={twoFADisableLoading} className="h-11">Cancel</Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={twoFADisableLoading || !twoFADisablePassword}
              onClick={async () => {
                setTwoFADisableLoading(true);
                try {
                  await api.disable2FA(twoFADisablePassword);
                  setTwoFAEnabled(false);
                  setTwoFADisableOpen(false);
                  toast.success("Two-factor authentication removed.");
                } catch (err) {
                  setTwoFADisableError(err instanceof Error ? err.message : "Failed to disable 2FA");
                } finally {
                  setTwoFADisableLoading(false);
                }
              }}
            >
              {twoFADisableLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing...</> : "Remove 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

// ─── Dashboard Stat Widget ────────────────────────────────────────────────────

function DashboardStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-background/90 px-3 py-2 shadow-sm backdrop-blur">
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold leading-tight">{value}</p>
        <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}
export default Index;

// ─── My Tasks Panel ───────────────────────────────────────────────────────────

const TASK_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  medical: { label: "Medical", icon: <span className="text-base">🏥</span>, color: "bg-red-500/10 text-red-500" },
  food_water: { label: "Food / Water", icon: <span className="text-base">🥤</span>, color: "bg-blue-500/10 text-blue-500" },
  rescue: { label: "Rescue", icon: <span className="text-base">🚨</span>, color: "bg-amber-500/10 text-amber-500" },
};

function MyTasksPanel({
  tasks,
  onResolve,
  onFetch,
  socket,
  myEmail,
  myName,
  isResolvingId,
}: {
  tasks: CrisisRequest[];
  onResolve: (id: string) => void;
  onFetch: () => void;
  socket: Socket | null;
  myEmail: string;
  myName: string;
  isResolvingId: string | null;
}) {
  const [filter, setFilter] = useState<"active" | "resolved">("active");
  const [chatOpenId, setChatOpenId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resolvedHistory, setResolvedHistory] = useState<any[]>([]);
  const [resolvedLoading, setResolvedLoading] = useState(false);
  const [resolvedFetched, setResolvedFetched] = useState(false);

  useEffect(() => { onFetch(); }, []);

  useEffect(() => {
    if (filter !== "resolved" || resolvedFetched) return;
    setResolvedLoading(true);
    api.getTaskHistory()
      .then((data: any) => {
        setResolvedHistory(Array.isArray(data) ? data : []);
        setResolvedFetched(true);
      })
      .catch(() => {})
      .finally(() => setResolvedLoading(false));
  }, [filter, resolvedFetched]);

  // Check both taskStatus (API) and status (socket events)
  const getStatus = (t: CrisisRequest) => t.taskStatus ?? t.status;
  const active = tasks.filter((t) => {
    const s = getStatus(t);
    return s !== "RESOLVED" && s !== "CANCELLED";
  });

  const displayed = filter === "active" ? active : resolvedHistory;

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelRequest(id);
      toast.success("Task cancelled.");
      onFetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  const formatResolvedTime = (iso?: string) => {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold">My Tasks</h2>
        <p className="text-xs text-muted-foreground">Your personally claimed crisis tasks.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex overflow-hidden rounded-lg border border-border/60">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={cn(
            "flex-1 py-2 text-xs font-medium transition-colors",
            filter === "active"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Active ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("resolved")}
          className={cn(
            "flex-1 border-l border-border/60 py-2 text-xs font-medium transition-colors",
            filter === "resolved"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Resolved {resolvedFetched ? `(${resolvedHistory.length})` : ""}
        </button>
      </div>

      {/* Resolved — loading state */}
      {filter === "resolved" && resolvedLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Task list */}
      {!resolvedLoading && displayed.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            {filter === "active" ? "No active tasks right now." : "No resolved tasks yet."}
          </p>
        </div>
      ) : !resolvedLoading && (
        <div className="space-y-3">
          {displayed.map((task) => {
            const meta = TASK_TYPE_META[task.type] ?? TASK_TYPE_META["rescue"];
            const isResolving = isResolvingId === task.id;
            const isCancelling = cancellingId === task.id;
            const chatOpen = chatOpenId === task.id;
            const taskStatus = task.taskStatus ?? task.status ?? "RESOLVED";
            const isActive = filter === "active" && taskStatus !== "RESOLVED" && taskStatus !== "CANCELLED";
            return (
              <div
                key={task.taskId ?? task.id}
                className="overflow-hidden rounded-xl border border-border/40 bg-[hsl(var(--surface-glass))/0.85]"
              >
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Type icon */}
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.color)}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Heading row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          isActive
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-border/50 bg-muted/30 text-muted-foreground"
                        )}>
                          {isActive ? (taskStatus ?? "Active") : "Resolved"}
                        </span>
                      </div>
                      {/* Description */}
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      {/* Meta */}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {task.lat?.toFixed(4)}, {task.lng?.toFixed(4)}
                        {task.requester?.name && <> · Requester: {task.requester.name}</>}
                        {task.resolvedAt && <> · Resolved {formatResolvedTime(task.resolvedAt)}</>}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons — only for active tasks */}
                  {isActive && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* Live Chat */}
                      <button
                        type="button"
                        onClick={() => setChatOpenId(chatOpen ? null : task.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          chatOpen
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-primary"
                        )}
                      >
                        💬 {chatOpen ? "Hide Chat" : "Live Chat"}
                      </button>

                      {/* Resolve */}
                      <button
                        type="button"
                        onClick={() => onResolve(task.id)}
                        disabled={isResolving}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        {isResolving ? <><Loader2 className="h-3 w-3 animate-spin" /> Resolving…</> : <>✅ Resolve</>}
                      </button>

                      {/* Cancel */}
                      <button
                        type="button"
                        onClick={() => handleCancel(task.id)}
                        disabled={isCancelling}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                      >
                        {isCancelling ? <><Loader2 className="h-3 w-3 animate-spin" /> Cancelling…</> : <>✕ Cancel</>}
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline chat — active tasks only */}
                {chatOpen && isActive && (
                  <div className="border-t border-border/30 p-3 pt-0">
                    <TaskChatPanel
                      requestId={task.id}
                      myEmail={myEmail}
                      myName={myName}
                      socket={socket}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
