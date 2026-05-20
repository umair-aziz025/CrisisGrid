import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getAuthToken } from "@/api/client";

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

export type PriorityAlert = {
  id: string;
  targetEmail: string;
  crisisId: string;
  crisisType: "medical" | "food_water" | "rescue";
  crisisLat: number;
  crisisLng: number;
  description: string;
  claimedBy: string;
  nearestVolunteerName: string;
  distanceKm: number;
  walkMinutes: number;
  driveMinutes: number;
  dispatchMessage: string;
  timestamp: string;
};

export type ChatMessage = {
  id: string;
  requestId: string;
  senderEmail: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  /** "audio" for voice notes, "text" otherwise (default). */
  type?: "text" | "audio";
  audioBase64?: string;
  mimeType?: string;
  durationSec?: number;
};

export type ChatHistoryPayload = { requestId: string; messages: ChatMessage[] };

type SocketHandlers = {
  onNewCrisis?: (data: any) => void;
  onCrisisClaimed?: (data: any) => void;
  onCrisisResolved?: (data: any) => void;
  onCrisisCancelled?: (data: any) => void;
  onTaskCancelledByRequester?: (data: any) => void;
  onSafeZoneAdded?: (data: any) => void;
  onSafeZoneRemoved?: (data: any) => void;
  onVolunteerAlert?: (data: VolunteerAlert) => void;
  onVolunteerLocation?: (data: VolunteerPosition) => void;
  onPriorityAlert?: (data: PriorityAlert) => void;
  onChatMessage?: (data: ChatMessage) => void;
  onChatHistory?: (data: ChatHistoryPayload) => void;
  onSecurityAlert?: (data: any) => void;
};

/**
 * Socket.IO bridge for the mobile app. Mirrors the web `useSocket` hook,
 * but connects to the absolute API base URL (not "/" since RN has no origin)
 * and authenticates with the persisted Bearer token.
 */
export function useSocket(handlers: SocketHandlers, enabled: boolean = true) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const token = getAuthToken();
      if (token) socket.emit("authenticate", token);
    });

    const wire = <T,>(event: string, key: keyof SocketHandlers) => {
      const fn = (data: T) => {
        const cb = handlersRef.current[key] as ((d: T) => void) | undefined;
        cb?.(data);
      };
      socket.on(event, fn);
      return fn;
    };

    const handlersAttached: Array<[string, (...args: any[]) => void]> = [
      ["new_crisis", wire("new_crisis", "onNewCrisis")],
      ["crisis_claimed", wire("crisis_claimed", "onCrisisClaimed")],
      ["crisis_resolved", wire("crisis_resolved", "onCrisisResolved")],
      ["crisis_cancelled", wire("crisis_cancelled", "onCrisisCancelled")],
      ["task_cancelled_by_requester", wire("task_cancelled_by_requester", "onTaskCancelledByRequester")],
      ["safe_zone_added", wire("safe_zone_added", "onSafeZoneAdded")],
      ["safe_zone_removed", wire("safe_zone_removed", "onSafeZoneRemoved")],
      ["volunteer_alert", wire("volunteer_alert", "onVolunteerAlert")],
      ["volunteer_location", wire("volunteer_location", "onVolunteerLocation")],
      ["priority_alert", wire("priority_alert", "onPriorityAlert")],
      ["chat_message", wire("chat_message", "onChatMessage")],
      ["chat_history", wire("chat_history", "onChatHistory")],
      ["security_alert", wire("security_alert", "onSecurityAlert")],
    ];

    return () => {
      handlersAttached.forEach(([evt, fn]) => socket.off(evt, fn));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  return socketRef;
}
