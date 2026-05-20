import { Bell, CheckCheck, Droplets, HeartPulse, LifeBuoy, MapPin, X } from "lucide-react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { VolunteerAlert } from "@/hooks/use-socket";

type Notification = VolunteerAlert & { read: boolean };

const TYPE_META = {
  medical: { label: "Medical", icon: HeartPulse, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  food_water: { label: "Food / Water", icon: Droplets, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  rescue: { label: "Rescue", icon: LifeBuoy, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
};

const formatTime = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

type Props = {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onFlyTo?: (lat: number, lng: number) => void;
};

export default function NotificationBell({ notifications, onMarkAllRead, onDismiss, onFlyTo }: Props) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && unreadCount > 0) {
        onMarkAllRead();
      }
    },
    [unreadCount, onMarkAllRead]
  );

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 border-border/70 bg-background/40"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          data-testid="button-notifications"
        >
          <Bell className={cn("h-4 w-4", unreadCount > 0 && "animate-[wiggle_0.4s_ease-in-out]")} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 border-border/80 bg-popover/95 p-0 backdrop-blur"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Crisis Alerts</span>
            {notifications.length > 0 && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                {notifications.length}
              </Badge>
            )}
          </div>
          {notifications.some((n) => !n.read) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAllRead();
              }}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No crisis alerts yet</p>
              <p className="text-xs text-muted-foreground/60">New emergencies will appear here</p>
            </div>
          ) : (
            notifications.map((n) => {
              const meta = TYPE_META[n.type];
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "group relative border-b border-border/40 px-3 py-2.5 transition-colors last:border-0",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", meta.bg)}>
                      <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-semibold", meta.color)}>{meta.label} Emergency</span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{n.description}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{formatTime(n.createdAt)}</span>
                        {onFlyTo && (
                          <DropdownMenuItem
                            className="h-5 cursor-pointer gap-1 rounded px-1.5 py-0 text-[10px] text-primary hover:bg-primary/10"
                            onClick={() => onFlyTo(n.lat, n.lng)}
                          >
                            <MapPin className="h-2.5 w-2.5" />
                            View on map
                          </DropdownMenuItem>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(n.id);
                      }}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-border/60 px-3 py-2">
            <p className="text-center text-[10px] text-muted-foreground">
              Showing last {notifications.length} alert{notifications.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
