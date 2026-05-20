import { Droplets, HeartPulse, LifeBuoy } from "lucide-react-native";
import { colors } from "@/theme";

/**
 * Server contract:
 *  - Request `type` is lowercase: "medical" | "food_water" | "rescue"
 *  - Request `status` is uppercase: "ACTIVE" | "CLAIMED" | "RESOLVED" | "CANCELLED"
 * Both the createRequest body and the list response follow this casing.
 */
export type CrisisType = "medical" | "food_water" | "rescue";
export type CrisisStatus = "ACTIVE" | "CLAIMED" | "QUEUED" | "RESOLVED" | "CANCELLED";

export const CRISIS_TYPES: CrisisType[] = ["medical", "food_water", "rescue"];

export const CRISIS_META: Record<
  CrisisType,
  { label: string; color: string; icon: typeof HeartPulse }
> = {
  medical: { label: "Medical", color: colors.crisisMedical, icon: HeartPulse },
  food_water: { label: "Food / Water", color: colors.crisisFoodWater, icon: Droplets },
  rescue: { label: "Rescue", color: colors.crisisRescue, icon: LifeBuoy },
};

export const STATUS_META: Record<
  CrisisStatus,
  { label: string; color: string }
> = {
  ACTIVE: { label: "Active", color: colors.destructive },
  CLAIMED: { label: "Claimed", color: colors.statusClaimed },
  QUEUED: { label: "Queued", color: colors.warning },
  RESOLVED: { label: "Resolved", color: colors.mutedForeground },
  CANCELLED: { label: "Cancelled", color: colors.mutedForeground },
};

export type CrisisRequest = {
  id: string;
  type: CrisisType;
  description: string;
  lat: number;
  lng: number;
  status: CrisisStatus;
  createdAt: string;
  claimed?: boolean;
  claimedBy?: string | null;
  createdBy?: string | null;
};

/**
 * Coerce an arbitrary server payload into the strict mobile shape — handles
 * the historical case where the same code path has been seen returning
 * uppercase types or numeric `lat`/`lng` strings.
 */
export function normalizeRequest(raw: any): CrisisRequest {
  const type = String(raw?.type ?? "rescue").toLowerCase().replace(/-/g, "_");
  const status = String(raw?.status ?? "ACTIVE").toUpperCase();
  return {
    id: String(raw?.id ?? ""),
    type: (CRISIS_TYPES.includes(type as CrisisType) ? type : "rescue") as CrisisType,
    description: String(raw?.description ?? ""),
    lat: Number(raw?.lat ?? 0),
    lng: Number(raw?.lng ?? 0),
    status: (["ACTIVE", "CLAIMED", "QUEUED", "RESOLVED", "CANCELLED"].includes(status)
      ? status
      : "QUEUED") as CrisisStatus,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    claimed: !!raw?.claimed,
    claimedBy: raw?.claimedBy ?? null,
    createdBy: raw?.createdBy ?? null,
  };
}

export function normalizeRequestList(data: any): CrisisRequest[] {
  const list = Array.isArray(data) ? data : data?.requests ?? [];
  return list.map(normalizeRequest);
}

export function formatRelative(dateString: string): string {
  const d = new Date(dateString);
  const diffMs = Date.now() - d.getTime();
  if (Number.isNaN(diffMs)) return "";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
