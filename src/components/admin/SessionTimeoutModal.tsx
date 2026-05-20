import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  secondsLeft: number;
  onExtend: () => void;
  onSignOut: () => void;
};

export function SessionTimeoutModal({ open, secondsLeft, onExtend, onSignOut }: Props) {
  const pct = Math.round((secondsLeft / 60) * 100);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm border-orange-500/40 bg-[hsl(var(--surface-glass))] shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 ring-2 ring-orange-500/30">
            <Clock className="h-7 w-7 text-orange-400" />
          </div>
          <DialogTitle className="text-lg">Session Expiring Soon</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your admin session has been idle for 14 minutes. For security, you will be signed out automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex flex-col items-center gap-3">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={secondsLeft <= 10 ? "#ef4444" : "#f97316"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
              />
            </svg>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: secondsLeft <= 10 ? "#ef4444" : "#f97316" }}
            >
              {secondsLeft}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">seconds remaining</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onExtend}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Stay Logged In
          </Button>
          <Button
            variant="outline"
            onClick={onSignOut}
            className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sign Out Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
