import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type VolunteerAlert = {
  id: string;
  type: "medical" | "food_water" | "rescue";
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
};

export type VolunteerPosition = {
  volunteerId: number;
  email: string;
  lat: number;
  lng: number;
  timestamp: string;
};

export type VolunteerAvailability = {
  email: string;
  isAvailable: boolean;
  timestamp: string;
};

export type PriorityAlert = {
  id: string;
  targetEmail: string;
  crisisId: string;
  crisisType: "medical" | "food_water" | "rescue";
  crisisLat: number;
  crisisLng: number;
  description: string;
  claimedBy: string;
  nearestVolunteerEmail: string;
  nearestVolunteerName: string;
  distanceKm: number;
  walkMinutes: number;
  driveMinutes: number;
  dispatchMessage: string;
  timestamp: string;
};

export type CoverageGap = {
  requestId: number;
  type: "MEDICAL" | "FOOD_WATER" | "RESCUE";
  lat: number;
  lng: number;
  description: string;
  closestVolunteerKm: number | null;
  createdAt: string;
};

export type CoverageGapUpdate = {
  gaps: CoverageGap[];
  checkedAt: string;
};

export type ChatMessage = {
  id: string;
  requestId: string;
  senderEmail: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  type?: "text" | "audio";
  audioBase64?: string;
  mimeType?: string;
  durationSec?: number;
};

export function useSocket(
  onNewCrisis: (data: any) => void,
  onCrisisClaimed: (data: any) => void,
  onCrisisResolved: (data: any) => void,
  handlers?: {
    onCrisisCancelled?: (data: any) => void;
    onCrisisPartialResolved?: (data: any) => void;
    onCrisisStatusChanged?: (data: any) => void;
    onSafeZoneAdded?: (data: any) => void;
    onSafeZoneRemoved?: (data: any) => void;
    onVolunteerAlert?: (data: VolunteerAlert) => void;
    onVolunteerLocation?: (data: VolunteerPosition) => void;
    onPriorityAlert?: (data: PriorityAlert) => void;
    onVolunteerAvailability?: (data: VolunteerAvailability) => void;
    onChatMessage?: (data: ChatMessage) => void;
    onCoverageGapUpdate?: (data: CoverageGapUpdate) => void;
    authToken?: string | null;
  }
): { socketRef: React.MutableRefObject<Socket | null>; socket: Socket | null; connected: boolean } {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Keep refs to all handlers so the socket always calls the latest version
  // without needing to re-register listeners on every render.
  const onNewCrisisRef = useRef(onNewCrisis);
  const onCrisisClaimedRef = useRef(onCrisisClaimed);
  const onCrisisResolvedRef = useRef(onCrisisResolved);
  const handlersRef = useRef(handlers);
  const authTokenRef = useRef(handlers?.authToken);

  // Sync refs on every render (useLayoutEffect runs before paint)
  useLayoutEffect(() => {
    onNewCrisisRef.current = onNewCrisis;
    onCrisisClaimedRef.current = onCrisisClaimed;
    onCrisisResolvedRef.current = onCrisisResolved;
    handlersRef.current = handlers;
    authTokenRef.current = handlers?.authToken;
  });

  useEffect(() => {
    // Start with polling (works through any HTTP proxy / nginx without WS config),
    // then upgrade to WebSocket if the server supports it.
    const s = io("/", { transports: ["polling", "websocket"], path: "/socket.io" });
    socketRef.current = s;
    setSocket(s);

    const tryAuthenticate = () => {
      const token = authTokenRef.current;
      if (token) s.emit("authenticate", token);
    };

    s.on("connect", () => {
      setConnected(true);
      tryAuthenticate();
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("reconnect", () => {
      tryAuthenticate();
    });

    // Use wrapper functions so refs are always called with the latest handler
    s.on("new_crisis", (data) => onNewCrisisRef.current(data));
    s.on("crisis_claimed", (data) => onCrisisClaimedRef.current(data));
    s.on("crisis_resolved", (data) => onCrisisResolvedRef.current(data));
    s.on("crisis_cancelled", (data) => handlersRef.current?.onCrisisCancelled?.(data));
    s.on("crisis_partial_resolved", (data) => handlersRef.current?.onCrisisPartialResolved?.(data));
    s.on("crisis_status_changed", (data) => handlersRef.current?.onCrisisStatusChanged?.(data));
    s.on("safe_zone_added", (data) => handlersRef.current?.onSafeZoneAdded?.(data));
    s.on("safe_zone_removed", (data) => handlersRef.current?.onSafeZoneRemoved?.(data));
    s.on("volunteer_alert", (data) => handlersRef.current?.onVolunteerAlert?.(data));
    s.on("volunteer_location", (data) => handlersRef.current?.onVolunteerLocation?.(data));
    s.on("priority_alert", (data) => handlersRef.current?.onPriorityAlert?.(data));
    s.on("volunteer_availability", (data) => handlersRef.current?.onVolunteerAvailability?.(data));
    s.on("chat_message", (data) => handlersRef.current?.onChatMessage?.(data));
    s.on("coverage_gap_update", (data) => handlersRef.current?.onCoverageGapUpdate?.(data));

    return () => {
      setConnected(false);
      s.disconnect();
    };
  }, []);

  // Re-authenticate whenever the auth token changes (e.g. user logs in/out)
  useEffect(() => {
    const token = handlers?.authToken;
    authTokenRef.current = token;
    if (socket && connected && token) {
      socket.emit("authenticate", token);
    }
  }, [socket, connected, handlers?.authToken]);

  return { socketRef, socket, connected };
}
