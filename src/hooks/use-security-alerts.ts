import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "@/components/ui/sonner";

export type SecurityAlertPayload = {
  type: string;
  actorName: string;
  actorRole: string;
  targetName: string;
  targetRole: string;
  details: string;
  timestamp: string;
};

export function useSecurityAlerts() {
  const socketRef = useRef<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const clearAlerts = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    const socket = io("/", { transports: ["websocket", "polling"], path: "/socket.io" });
    socketRef.current = socket;

    const handleAlert = (payload: SecurityAlertPayload) => {
      const time = new Date(payload.timestamp).toLocaleTimeString();
      toast.warning("Security Alert — Permission Escalation Blocked", {
        description: `${payload.actorName} (${payload.actorRole}) tried to modify ${payload.targetName} (${payload.targetRole}) at ${time}`,
        duration: 12000,
        closeButton: true,
      });
      setUnreadCount((c) => c + 1);
    };

    socket.on("security_alert", handleAlert);

    return () => {
      socket.off("security_alert", handleAlert);
      socket.disconnect();
    };
  }, []);

  return { unreadCount, clearAlerts };
}
