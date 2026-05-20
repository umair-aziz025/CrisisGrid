import { AlertTriangle, Bot, Flag, Loader2, Mail, MapPin, MessageSquare, Phone, Route, User } from "lucide-react";
import { useState } from "react";
import type { Socket } from "socket.io-client";

import type { CrisisRequest, CrisisType } from "@/components/crisis/types";
import TaskChatPanel from "@/components/crisis/TaskChatPanel";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

type VolunteerTasksSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: CrisisRequest[];
  expandedTaskId: string | null;
  onToggleTask: (taskId: string) => void;
  onResolveTask: (taskId: string) => void;
  isResolvingTask: boolean;
  resolvingTaskId: string | null;
  typeMeta: Record<CrisisType, { label: string }>;
  socket: Socket | null;
  authUserEmail: string;
  authUserName: string;
  chatUnread: Record<string, number>;
  onClearChatUnread: (requestId: string) => void;
};

const VolunteerTasksSheet = ({
  open,
  onOpenChange,
  tasks,
  expandedTaskId,
  onToggleTask,
  onResolveTask,
  isResolvingTask,
  resolvingTaskId,
  typeMeta,
  socket,
  authUserEmail,
  authUserName,
  chatUnread,
  onClearChatUnread,
}: VolunteerTasksSheetProps) => {
  const [fraudDialogOpen, setFraudDialogOpen] = useState(false);
  const [fraudRequestId, setFraudRequestId] = useState<string | null>(null);
  const [fraudReason, setFraudReason] = useState("");
  const [isReportingFraud, setIsReportingFraud] = useState(false);
  const [chatOpenForTask, setChatOpenForTask] = useState<string | null>(null);

  const openFraudDialog = (requestId: string) => {
    setFraudRequestId(requestId);
    setFraudReason("");
    setFraudDialogOpen(true);
  };

  const submitFraudReport = async () => {
    if (!fraudRequestId) return;

    setIsReportingFraud(true);
    try {
      await api.reportFraud(fraudRequestId, fraudReason.trim());
      toast.success("Fraud report submitted for admin review");
      setFraudDialogOpen(false);
      setFraudRequestId(null);
      setFraudReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to report fraud");
    } finally {
      setIsReportingFraud(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-screen max-w-none border-border bg-background p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b border-border/50 px-6 py-5">
            <SheetTitle>My Active Tasks</SheetTitle>
            <SheetDescription>Tasks claimed by you in Volunteer mode.</SheetDescription>
          </SheetHeader>

          <div className="h-[calc(100%-5rem)] space-y-3 overflow-y-auto p-4">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                No active tasks yet — claim a crisis marker to add one.
              </div>
            ) : (
              tasks.map((task) => {
                const isExpanded = expandedTaskId === task.id;
                const isResolvingCurrent = isResolvingTask && resolvingTaskId === task.id;
                const isChatOpen = chatOpenForTask === task.id;

                return (
                  <article
                    key={task.id}
                    data-testid={`task-card-${task.id}`}
                    className="rounded-xl border border-border/60 bg-card p-4"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className="w-full text-left"
                      aria-expanded={isExpanded}
                      data-testid={`toggle-task-${task.id}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Badge variant="outline" className="border-border/70 bg-muted/40">
                          {typeMeta[task.type].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Tap for details</span>
                      </div>
                      <p className="text-sm text-foreground/90">{task.description}</p>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        {task.requester && (
                          <div
                            className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2"
                            data-testid={`requester-details-${task.id}`}
                          >
                            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              Requester Details
                            </p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex items-center gap-2" data-testid={`requester-name-${task.id}`}>
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-foreground/90">{task.requester.name}</span>
                              </div>
                              <div className="flex items-center gap-2" data-testid={`requester-email-${task.id}`}>
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-foreground/80">{task.requester.email}</span>
                              </div>
                              {task.requester.phone && (
                                <div className="flex items-center gap-2" data-testid={`requester-phone-${task.id}`}>
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-foreground/80">{task.requester.phone}</span>
                                </div>
                              )}
                              {task.requester.address && (
                                <div className="flex items-center gap-2" data-testid={`requester-address-${task.id}`}>
                                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-foreground/80">{task.requester.address}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div
                          className={cn(
                            "rounded-lg border p-3 font-mono text-sm leading-relaxed break-words whitespace-normal",
                            "border-[hsl(var(--status-claimed))/0.5] bg-background text-[hsl(var(--status-claimed))]",
                            "shadow-[0_0_0_1px_hsl(var(--status-claimed)/0.25)]",
                          )}
                          data-testid={`ai-route-plan-${task.id}`}
                        >
                          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--status-claimed))/0.9]">
                            <Bot className="h-3.5 w-3.5" />
                            AI Logistics Plan
                          </p>
                          <p>
                            {task.aiRoutePlan ||
                              "Optimal Route Calculated: Avoid Highway 4 due to flooding. ETA: 14 mins. Required Gear: First Aid Kit, Flashlight."}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const opening = !isChatOpen;
                            setChatOpenForTask(opening ? task.id : null);
                            if (opening) onClearChatUnread(task.id);
                          }}
                          className={cn(
                            "relative w-full gap-2 border-border/60",
                            isChatOpen && "bg-primary/10 border-primary/50 text-primary"
                          )}
                        >
                          <MessageSquare className="h-4 w-4" />
                          {isChatOpen ? "Hide Chat" : "Chat with Requester"}
                          {!isChatOpen && (chatUnread[task.id] ?? 0) > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                              {(chatUnread[task.id] ?? 0) > 9 ? "9+" : chatUnread[task.id]}
                            </span>
                          )}
                        </Button>

                        {isChatOpen && (
                          <TaskChatPanel
                            requestId={task.id}
                            myEmail={authUserEmail}
                            myName={authUserName}
                            socket={socket}
                          />
                        )}

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => onResolveTask(task.id)}
                            disabled={isResolvingCurrent}
                            data-testid={`resolve-task-${task.id}`}
                            className="flex-1 bg-[hsl(var(--status-claimed))] text-primary-foreground hover:bg-[hsl(var(--status-claimed))/0.85]"
                          >
                            {isResolvingCurrent ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resolving...
                              </>
                            ) : (
                              <>
                                <Route className="mr-2 h-4 w-4" />
                                Mark as Resolved
                              </>
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openFraudDialog(task.id)}
                            data-testid={`report-fraud-${task.id}`}
                            className="border-destructive/50 text-destructive"
                          >
                            <Flag className="mr-2 h-4 w-4" />
                            Report Fraud
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={fraudDialogOpen} onOpenChange={setFraudDialogOpen}>
        <DialogContent className="border border-border/70 bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Report Fraud
            </DialogTitle>
            <DialogDescription>
              Flag this request for admin review. Provide details about why you believe this is fraudulent.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={fraudReason}
            onChange={(e) => setFraudReason(e.target.value)}
            placeholder="Describe why you believe this request is fraudulent..."
            className="border-border/70 bg-background/40"
            data-testid="input-fraud-reason"
          />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFraudDialogOpen(false)}
              data-testid="button-cancel-fraud"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submitFraudReport}
              disabled={isReportingFraud}
              data-testid="button-submit-fraud"
            >
              {isReportingFraud ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="mr-2 h-4 w-4" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VolunteerTasksSheet;
