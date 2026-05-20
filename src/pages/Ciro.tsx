import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Play,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Siren,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/api";
import AppFooter from "@/components/AppFooter";

// ── Types ─────────────────────────────────────────────────────────────────────

type SignalSource = {
  id: string;
  type: "social" | "weather" | "traffic" | "sensor" | "field_report" | "emergency_call";
  label: string;
  content: string;
  location: string;
  lat: number;
  lng: number;
  timestamp: string;
  credibilityScore: number;
};

type AgentTraceEntry = {
  agent: "Sentinel" | "Analyst" | "Strategist" | "Executor";
  step: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  type: "info" | "decision" | "tool_call" | "warning" | "success" | "error";
};

type Scenario = { id: string; name: string; description: string; signalCount: number };

type CIROResult = {
  scenarioId: string;
  scenarioName: string;
  completedAt: string;
  antigravityTrace: AgentTraceEntry[];
  sentinel: {
    filteredSignals: SignalSource[];
    noiseSignals: SignalSource[];
    contradictions: { signalIds: string[]; explanation: string }[];
    dominantLocation: { lat: number; lng: number; name: string };
    crisisType: string;
    fusedSummary: string;
  };
  analyst: {
    severityTier: number;
    severityLabel: string;
    confidenceScore: number;
    affectedRadiusKm: number;
    estimatedPopulationAtRisk: number;
    peakImpactTime: string;
    expectedDurationHrs: number;
    uncertaintyRange: string;
    spreadRisk: string;
    keyRisks: string[];
    temporalAnalysis: string;
  };
  strategist: {
    allocations: {
      crisisLabel: string;
      ambulances: number;
      rescueTeams: number;
      trafficPolice: number;
      medics: number;
      priority: string;
      tradeoffReasoning: string;
    }[];
    actionChain: {
      step: number;
      action: string;
      agent: string;
      constraint: string;
      feasible: boolean;
      estimatedMinutes: number;
    }[];
    infeasibleActions: { action: string; reason: string }[];
    budgetConstraints: string;
  };
  executor: {
    simulatedActions: {
      action: string;
      toolCall: string;
      status: "success" | "failed" | "retried";
      result: string;
      latencyMs: number;
      sideEffects: string[];
    }[];
    beforeState: {
      responseTimeMin: number;
      congestionLevel: string;
      populationExposed: number;
      resourcesDeployed: number;
    };
    afterState: {
      responseTimeMin: number;
      congestionLevel: string;
      populationExposed: number;
      estimatedLivesSaved: number;
      resourcesDeployed: number;
    };
    stakeholderAlerts: {
      audience: string;
      channel: string;
      message: string;
      sent: boolean;
    }[];
    costSummary: {
      totalUnitsDeployed: number;
      estimatedCostPKR: number;
      totalLatencyMs: number;
    };
    fallbacksUsed: string[];
    mapVisualization?: {
      incidentCenter: { lat: number; lng: number };
      beforeRoute: { lat: number; lng: number }[];
      afterRoute: { lat: number; lng: number }[];
      safeZones: { lat: number; lng: number; label: string }[];
      evacuationRoutes: { lat: number; lng: number }[][];
      affectedRadiusKm: number;
    };
  };
};

type ChatMsg = { role: "user" | "assistant"; text: string; timestamp: string };

const TABS = ["Signals", "Trace", "Outcome", "Alerts"] as const;
type Tab = typeof TABS[number];

// ── Constants ────────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  Sentinel: "text-sky-400 border-sky-400/60 bg-sky-400/10",
  Analyst: "text-violet-400 border-violet-400/60 bg-violet-400/10",
  Strategist: "text-orange-400 border-orange-400/60 bg-orange-400/10",
  Executor: "text-emerald-400 border-emerald-400/60 bg-emerald-400/10",
};

const AGENT_DOT: Record<string, string> = {
  Sentinel: "bg-sky-400",
  Analyst: "bg-violet-400",
  Strategist: "bg-orange-400",
  Executor: "bg-emerald-400",
};

const TRACE_TYPE_COLORS: Record<string, string> = {
  info: "bg-slate-400",
  decision: "bg-amber-400",
  tool_call: "bg-sky-400",
  warning: "bg-orange-400",
  success: "bg-emerald-400",
  error: "bg-red-400",
};

const SIGNAL_TYPE_ICONS: Record<string, string> = {
  social: "📱",
  weather: "🌧️",
  traffic: "🚦",
  sensor: "📡",
  field_report: "📋",
  emergency_call: "📞",
};

// ── Helper components ────────────────────────────────────────────────────────

function AgentBadge({ agent }: { agent: string }) {
  const cls = AGENT_COLORS[agent] || "text-slate-400 border-slate-400/60 bg-slate-400/10";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide", cls)}>
      {agent}
    </span>
  );
}

function SeverityBar({ tier }: { tier: number }) {
  const colors = ["bg-emerald-400", "bg-lime-400", "bg-amber-400", "bg-orange-400", "bg-red-400"];
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((t) => (
        <div
          key={t}
          className={cn("h-2 flex-1 rounded-full transition-colors", t <= tier ? colors[t - 1] : "bg-white/10")}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border border-border/40 bg-muted/20 p-3">
      <span className={cn("text-xl font-bold tabular-nums", color ?? "text-foreground")}>{value}</span>
      <span className="text-center text-[10px] font-semibold text-muted-foreground">{label}</span>
      {sub && <span className="text-center text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function TraceEntry({ entry }: { entry: AgentTraceEntry }) {
  const typeColor = TRACE_TYPE_COLORS[entry.type] || "bg-slate-400";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const renderWithArrows = (text: string, cls: string) => {
    const parts = text.split("→");
    if (parts.length === 1) return <span className={cls}>{text.trim()}</span>;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={cls}>{p.trim()}</span>
            {i < parts.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="flex gap-3 border-b border-border/10 py-2.5">
      <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", typeColor)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <AgentBadge agent={entry.agent} />
          {renderWithArrows(entry.step, "text-[10px] text-muted-foreground font-medium")}
          <span className="ml-auto shrink-0 text-[9px] text-muted-foreground/60">{time}</span>
        </div>
        {renderWithArrows(String(entry.message), "text-xs text-foreground/80 leading-relaxed")}
      </div>
    </div>
  );
}

function LiveTraceEntry({ entry }: { entry: AgentTraceEntry }) {
  const typeColor = TRACE_TYPE_COLORS[entry.type] || "bg-slate-400";
  const agentDot = AGENT_DOT[entry.agent] || "bg-slate-400";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex animate-in slide-in-from-bottom-2 gap-2 border-b border-border/10 py-2 duration-300">
      <div className={cn("mt-1 h-1 w-1 shrink-0 rounded-full", typeColor)} style={{ minWidth: "4px" }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("flex h-3 w-3 shrink-0 items-center justify-center rounded-full", agentDot)} />
          <span className="text-[10px] font-semibold text-foreground">{entry.agent}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="truncate text-[10px] text-muted-foreground">{entry.step}</span>
          <span className="ml-auto shrink-0 text-[9px] text-muted-foreground/50">{time}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{String(entry.message)}</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CiroPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<"idle" | "pending" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<CIROResult | null>(null);
  const [liveTraces, setLiveTraces] = useState<AgentTraceEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Signals");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const traceScrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const jobIdRef = useRef<string>("");
  const sessionId = useRef(`web-${Date.now()}`);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedScenarioData = scenarios.find((s) => s.id === selectedScenario);

  useEffect(() => {
    apiFetch("/api/ciro/scenarios")
      .then((data) => {
        setScenarios(data.scenarios || []);
        if (data.scenarios?.length > 0) setSelectedScenario(data.scenarios[0].id);
      })
      .catch(() => toast.error("Failed to load CIRO scenarios"))
      .finally(() => setLoadingScenarios(false));
  }, []);

  useEffect(() => {
    const socket = io("/", { transports: ["websocket", "polling"], path: "/socket.io" });
    socketRef.current = socket;
    const sid = sessionId.current;

    socket.on("connect", () => {
      socket.emit("authenticate", getAuthToken());
      socket.emit("join_ciro", sid);
    });

    socket.on("ciro_trace_entry", (entry: AgentTraceEntry) => {
      setLiveTraces((prev) => [...prev.slice(-11), entry]);
    });

    socket.on("ciro_complete", () => {
      const jid = jobIdRef.current;
      if (jid) fetchResult(jid);
    });

    socket.on("ciro_error", (data: { message: string }) => {
      setJobStatus("error");
      toast.error(`CIRO pipeline error: ${data.message}`);
      clearPoll();
    });

    return () => { socket.disconnect(); clearPoll(); };
  }, []);

  useEffect(() => {
    if (traceScrollRef.current) {
      traceScrollRef.current.scrollTop = traceScrollRef.current.scrollHeight;
    }
  }, [liveTraces]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const clearPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const fetchResult = async (jid: string) => {
    try {
      const data = await apiFetch(`/api/ciro/job/${jid}`);
      if (data.status === "done" && data.result) {
        setResult(data.result);
        setJobStatus("done");
        clearPoll();
        setRunning(false);
        setLiveTraces([]);
      } else if (data.status === "error") {
        setJobStatus("error");
        toast.error(data.error || "Analysis failed");
        clearPoll();
        setRunning(false);
      }
    } catch {
      // silent
    }
  };

  const runAnalysis = async () => {
    if (!selectedScenario) return;
    setRunning(true);
    setJobStatus("pending");
    setLiveTraces([]);
    setResult(null);
    setActiveTab("Signals");
    setChatMessages([]);

    try {
      const data = await apiFetch("/api/ciro/analyze", {
        method: "POST",
        body: JSON.stringify({ scenarioId: selectedScenario, sessionId: sessionId.current }),
      });
      setJobId(data.jobId);
      jobIdRef.current = data.jobId;
      setJobStatus("processing");
      toast.success("CIRO analysis running — watch live traces");
      pollRef.current = setInterval(() => fetchResult(data.jobId), 4000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start analysis");
      setJobStatus("error");
      setRunning(false);
    }
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg) return;
    const userMsg: ChatMsg = { role: "user", text: msg, timestamp: new Date().toISOString() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const data = await apiFetch("/api/ciro/chat", {
        method: "POST",
        body: JSON.stringify({ message: msg, scenarioId: selectedScenario, result }),
      });
      setChatMessages((prev) => [...prev, { role: "assistant", text: data.response, timestamp: new Date().toISOString() }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatLoading(false);
    }
  };

  const isProcessing = jobStatus === "processing" || jobStatus === "pending";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.08),transparent_40%)]" />

      {/* Header */}
      <div className="sticky top-0 z-30 w-full border-b bg-background/90 backdrop-blur-md">
        <div className="flex h-14 w-full items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/40 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <span className="text-base font-bold tracking-tight">CIRO</span>
          </div>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-muted-foreground">Crisis Intelligence</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                chatOpen ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ask CIRO AI</span>
            </button>
            {result && (
              <button
                type="button"
                onClick={() => { setResult(null); setLiveTraces([]); setJobStatus("idle"); setChatMessages([]); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:text-foreground"
                title="Reset analysis"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full flex-1 space-y-6 px-4 sm:px-6 md:px-8 py-6">
        {/* Scenario cards (mobile-style like the native app) */}
        <div className="w-full">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Crisis Scenario</p>
          {loadingScenarios ? (
            <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading scenarios…
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scenarios.map((s) => {
                const isActive = selectedScenario === s.id;
                const scenarioIcons: Record<string, string> = { flood: "🌊", multi_crisis: "⚡", false_alarm: "🔔", degraded: "📡" };
                const scenarioColors: Record<string, string> = {
                  flood: "border-blue-500/40 bg-blue-500/5 data-[active=true]:border-blue-500 data-[active=true]:bg-blue-500/15",
                  multi_crisis: "border-orange-500/40 bg-orange-500/5 data-[active=true]:border-orange-500 data-[active=true]:bg-orange-500/15",
                  false_alarm: "border-amber-500/40 bg-amber-500/5 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500/15",
                  degraded: "border-red-500/40 bg-red-500/5 data-[active=true]:border-red-500 data-[active=true]:bg-red-500/15",
                };
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-active={isActive}
                    onClick={() => { if (!isProcessing) { setSelectedScenario(s.id); setResult(null); setLiveTraces([]); setJobStatus("idle"); } }}
                    disabled={isProcessing}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 w-full",
                      scenarioColors[s.id] ?? "border-border/40 bg-muted/10 data-[active=true]:border-primary data-[active=true]:bg-primary/10"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xl">{scenarioIcons[s.id] ?? "🚨"}</span>
                      {isActive && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className={cn("text-sm font-semibold", isActive ? "text-foreground" : "text-foreground/80")}>{s.name}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{s.description}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Radio className="h-2.5 w-2.5" />
                      <span>{s.signalCount} signals</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Run button */}
        {selectedScenario && (
          <Button
            onClick={runAnalysis}
            disabled={isProcessing || !selectedScenario || loadingScenarios}
            className="w-full sm:w-auto"
            size="lg"
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running Antigravity Agents…</>
            ) : result ? (
              <><RefreshCw className="mr-2 h-4 w-4" />Re-run Analysis</>
            ) : (
              <><Play className="mr-2 h-4 w-4" />Run CIRO Analysis</>
            )}
          </Button>
        )}

        {/* Live trace feed during processing */}
        {isProcessing && (
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-muted/10">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-2.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-semibold">Live Agent Trace</span>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3 animate-spin" /> Pipeline running…
              </span>
            </div>
            <div
              ref={traceScrollRef}
              className="max-h-52 overflow-y-auto px-4 py-2"
            >
              {liveTraces.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Waiting for agents to start…</p>
              ) : (
                liveTraces.map((e, i) => <LiveTraceEntry key={i} entry={e} />)
              )}
            </div>
            {/* Agent legend */}
            <div className="flex flex-wrap gap-3 border-t border-border/20 px-4 py-2">
              {Object.entries(AGENT_DOT).map(([agent, dot]) => (
                <span key={agent} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", dot)} />
                  {agent}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Idle / intro state */}
        {!result && !isProcessing && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Shield className="h-5 w-5 text-sky-400" />, title: "Sentinel", desc: "Fuses multi-source signals, filters noise, detects contradictions" },
              { icon: <BrainCircuit className="h-5 w-5 text-violet-400" />, title: "Analyst", desc: "Assesses severity tier, confidence score, spread risk & key threats" },
              { icon: <Users className="h-5 w-5 text-orange-400" />, title: "Strategist", desc: "Balances constrained resources across simultaneous crises" },
              { icon: <Zap className="h-5 w-5 text-emerald-400" />, title: "Executor", desc: "Simulates tool calls, shows before/after state with side-effects" },
            ].map((c) => (
              <div key={c.title} className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-muted/10 p-4">
                {c.icon}
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Severity"
                value={result.analyst.severityLabel.split("—")[0].trim()}
                color={(result.analyst.severityTier ?? 0) >= 4 ? "text-red-400" : (result.analyst.severityTier ?? 0) >= 3 ? "text-orange-400" : "text-emerald-400"}
              />
              <StatCard
                label="Signals"
                value={result.sentinel.filteredSignals.length}
                color="text-red-400"
                sub={`${result.sentinel.noiseSignals.length} noise filtered`}
              />
              <StatCard
                label="Trace Steps"
                value={result.antigravityTrace.length}
                color="text-emerald-400"
              />
              <StatCard
                label="Confidence"
                value={`${(result.analyst.confidenceScore * 100).toFixed(0)}%`}
                color="text-orange-400"
                sub={`±${result.analyst.uncertaintyRange ?? "—"}`}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-0 overflow-hidden rounded-xl border border-border/40 bg-muted/10">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 px-3 py-2.5 text-xs font-medium transition-colors",
                    activeTab === tab
                      ? "border-b-2 border-primary bg-background/60 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── Signals Tab ── */}
            {activeTab === "Signals" && (
              <div className="space-y-4">
                {/* Fused summary */}
                <div className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fused Crisis Picture</span>
                    <span className="rounded border border-sky-400/50 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                      {result.sentinel.crisisType.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/80">{result.sentinel.fusedSummary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{result.sentinel.dominantLocation.name}</span>
                    <span>{result.sentinel.dominantLocation.lat.toFixed(4)}, {result.sentinel.dominantLocation.lng.toFixed(4)}</span>
                  </div>
                </div>

                {/* Contradictions */}
                {result.sentinel.contradictions.length > 0 && (
                  <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                      <span className="text-sm font-semibold text-orange-400">
                        {result.sentinel.contradictions.length} Contradiction(s) Detected
                      </span>
                    </div>
                    {result.sentinel.contradictions.map((c, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {c.explanation}</p>
                    ))}
                  </div>
                )}

                {/* Active signals */}
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Active Signals ({result.sentinel.filteredSignals.length})
                </p>
                <div className="space-y-2">
                  {result.sentinel.filteredSignals.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{SIGNAL_TYPE_ICONS[s.type] || "📌"}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{s.label}</p>
                            <span className={cn(
                              "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                              s.credibilityScore > 0.8 ? "bg-emerald-400/15 text-emerald-400" :
                              s.credibilityScore > 0.5 ? "bg-orange-400/15 text-orange-400" :
                              "bg-red-400/15 text-red-400"
                            )}>
                              {(s.credibilityScore * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" />
                            <span>{s.location}</span>
                          </div>
                          <p className="mt-2 text-xs text-foreground/70">{s.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Noise signals */}
                {result.sentinel.noiseSignals.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                      Filtered Out — Noise / Stale ({result.sentinel.noiseSignals.length})
                    </p>
                    <div className="space-y-2">
                      {result.sentinel.noiseSignals.map((s) => (
                        <div key={s.id} className="rounded-2xl border border-border/20 bg-muted/5 p-3 opacity-60">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{SIGNAL_TYPE_ICONS[s.type] || "📌"}</span>
                            <p className="text-sm">{s.label}</p>
                            <WifiOff className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">{s.content}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Trace Tab ── */}
            {activeTab === "Trace" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold">Antigravity Agent Trace</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{result.antigravityTrace.length} steps</Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(AGENT_DOT).map(([agent, dot]) => (
                    <span key={agent} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", dot)} />{agent}
                    </span>
                  ))}
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                  {result.antigravityTrace.map((e, i) => <TraceEntry key={i} entry={e} />)}
                </div>
              </div>
            )}

            {/* ── Outcome Tab ── */}
            {activeTab === "Outcome" && (
              <div className="space-y-4">
                {/* Before / After */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Before</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">After State</span>
                </div>
                <div className="flex items-stretch gap-3">
                  <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">BEFORE</p>
                    <p className="text-xl font-bold">{result.executor.beforeState?.responseTimeMin ?? "—"} min</p>
                    <p className="text-[10px] text-muted-foreground">Response Time</p>
                    <p className="mt-1 text-xl font-bold">{result.executor.beforeState?.congestionLevel ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Congestion</p>
                    <p className="mt-1 text-xl font-bold">{typeof result.executor.beforeState?.populationExposed === "number" ? result.executor.beforeState.populationExposed.toLocaleString() : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Exposed</p>
                  </div>
                  <ChevronRight className="self-center h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">AFTER</p>
                    <p className="text-xl font-bold text-emerald-400">{result.executor.afterState?.responseTimeMin ?? "—"} min</p>
                    <p className="text-[10px] text-muted-foreground">Response Time</p>
                    <p className="mt-1 text-xl font-bold text-emerald-400">{result.executor.afterState?.congestionLevel ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Congestion</p>
                    <p className="mt-1 text-xl font-bold text-emerald-400">{typeof result.executor.afterState?.populationExposed === "number" ? result.executor.afterState.populationExposed.toLocaleString() : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Exposed</p>
                  </div>
                </div>

                {/* Severity section */}
                <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Severity Assessment</p>
                  <p className={cn("text-lg font-bold",
                    (result.analyst?.severityTier ?? 0) >= 4 ? "text-red-400" :
                    (result.analyst?.severityTier ?? 0) >= 3 ? "text-orange-400" : "text-emerald-400"
                  )}>{result.analyst?.severityLabel ?? "—"}</p>
                  <SeverityBar tier={result.analyst?.severityTier ?? 1} />
                  <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                    <StatCard label="Population at Risk" value={(() => { const v = result.analyst?.estimatedPopulationAtRisk; if (!v || v <= 0) return "—"; return v.toLocaleString(); })()} />
                    <StatCard label="Peak Impact" value={result.analyst?.peakImpactTime ?? "—"} />
                    <StatCard label="Est. Duration" value={(() => { const v = result.analyst?.expectedDurationHrs; if (!v || v <= 0) return "—"; return `${v}h`; })()} />
                    <StatCard label="Spread Risk" value={result.analyst?.spreadRisk?.toUpperCase() ?? "—"} color={result.analyst?.spreadRisk === "critical" ? "text-red-400" : result.analyst?.spreadRisk === "high" ? "text-orange-400" : "text-emerald-400"} />
                    <StatCard label="Lives Protected" value={typeof result.executor?.afterState?.estimatedLivesSaved === "number" ? `~${result.executor.afterState.estimatedLivesSaved}` : "—"} color="text-emerald-400" />
                    <StatCard label="Confidence" value={`${(result.analyst.confidenceScore * 100).toFixed(0)}%`} color="text-orange-400" />
                  </div>
                  {result.analyst?.keyRisks && result.analyst.keyRisks.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Key Risks</p>
                      <ul className="space-y-1">
                        {result.analyst.keyRisks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action chain */}
                {result.executor?.simulatedActions && result.executor.simulatedActions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action Chain Execution</p>
                    {result.executor.simulatedActions.map((a, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-2xl border p-4",
                          a.status === "success" ? "border-emerald-500/30 bg-emerald-500/5" :
                          a.status === "failed" ? "border-red-500/30 bg-red-500/5" :
                          "border-orange-500/30 bg-orange-500/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold",
                            a.status === "success" ? "bg-emerald-400/15 text-emerald-400" :
                            a.status === "failed" ? "bg-red-400/15 text-red-400" :
                            "bg-orange-400/15 text-orange-400"
                          )}>{a.status.toUpperCase()}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">{a.latencyMs}ms</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium">{a.action}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{a.toolCall}</p>
                        <p className="mt-1 text-xs text-foreground/70">{a.result}</p>
                        {a.sideEffects && a.sideEffects.length > 0 && (
                          <div className="mt-2 rounded-lg border border-orange-400/30 bg-orange-400/5 p-2">
                            <p className="text-[10px] font-bold text-orange-400">⚠ Side Effects</p>
                            {a.sideEffects.map((se, j) => (
                              <p key={j} className="text-[10px] text-muted-foreground">• {se}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Fallbacks */}
                {result.executor?.fallbacksUsed && result.executor.fallbacksUsed.length > 0 && (
                  <div className="flex items-start gap-2 rounded-2xl border border-border/40 bg-muted/10 p-3">
                    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                    <p className="text-xs text-muted-foreground">Fallbacks used: {result.executor.fallbacksUsed.join(", ")}</p>
                  </div>
                )}

                {/* Cost summary */}
                {result.executor?.costSummary && (
                  <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-sky-400" />
                      <p className="text-sm font-semibold">Cost / Latency Summary</p>
                    </div>
                    <div className="flex gap-2">
                      <StatCard label="Units Deployed" value={result.executor.costSummary.totalUnitsDeployed ?? "—"} />
                      <StatCard label="Est. Cost (PKR)" value={typeof result.executor.costSummary.estimatedCostPKR === "number" ? result.executor.costSummary.estimatedCostPKR.toLocaleString() : "—"} />
                      <StatCard label="Total Latency" value={`${result.executor.costSummary.totalLatencyMs ?? "—"}ms`} />
                    </div>
                  </div>
                )}

                {/* Infeasible actions */}
                {result.strategist?.infeasibleActions && result.strategist.infeasibleActions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rejected Actions (Infeasible)</p>
                    {result.strategist.infeasibleActions.map((a, i) => (
                      <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3">
                        <p className="text-xs font-medium text-red-400">✗ {a.action}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Alerts Tab ── */}
            {activeTab === "Alerts" && (
              <div className="space-y-4">
                {/* Stakeholder alerts */}
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stakeholder Notifications</p>
                <p className="text-xs text-muted-foreground">Auto-generated by Executor Agent and dispatched via simulated channels.</p>
                <div className="space-y-2">
                  {result.executor.stakeholderAlerts.map((a, i) => (
                    <div key={i} className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Bell className={cn("h-3.5 w-3.5 shrink-0", a.sent ? "text-emerald-400" : "text-red-400")} />
                        <span className="text-sm font-semibold">{a.audience}</span>
                        <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{a.channel}</span>
                        <span className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
                          a.sent ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"
                        )}>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {a.sent ? "Sent" : "Failed"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-foreground/80">{a.message}</p>
                    </div>
                  ))}
                </div>

                {/* Resource allocation */}
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resource Allocation</p>
                <div className="space-y-2">
                  {result.strategist.allocations.map((alloc, i) => (
                    <div key={i} className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Siren className="h-3.5 w-3.5 text-red-400" />
                        <span className="text-sm font-semibold">{alloc.crisisLabel}</span>
                        <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold",
                          alloc.priority === "critical" ? "bg-red-400/15 text-red-400" : "bg-orange-400/15 text-orange-400"
                        )}>{alloc.priority?.toUpperCase()}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {[
                          { label: "Ambulances", val: alloc.ambulances, icon: "🚑" },
                          { label: "Rescue", val: alloc.rescueTeams, icon: "🦺" },
                          { label: "Traffic", val: alloc.trafficPolice, icon: "🚔" },
                          { label: "Medics", val: alloc.medics, icon: "👨‍⚕️" },
                        ].map((r) => (
                          <div key={r.label} className="flex flex-col items-center gap-1 rounded-lg border border-border/30 bg-muted/20 p-2">
                            <span className="text-lg">{r.icon}</span>
                            <span className="text-base font-bold">{r.val}</span>
                            <span className="text-center text-[9px] text-muted-foreground">{r.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{alloc.tradeoffReasoning}</p>
                    </div>
                  ))}
                </div>

                {result.strategist.budgetConstraints && (
                  <div className="flex items-start gap-2 rounded-2xl border border-border/40 bg-muted/10 p-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{result.strategist.budgetConstraints}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating CIRO Chat — always available */}
      {chatOpen && (
        <div className="fixed bottom-20 right-4 z-40 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl sm:right-6 sm:w-96">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2.5">
            <Brain className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-semibold">CIRO AI Assistant</span>
            {!result && <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-500">No scenario loaded</span>}
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 p-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Brain className="h-7 w-7 text-sky-400/60" />
                <p className="text-xs text-muted-foreground">
                  {result
                    ? "Ask about this scenario, analysis results, or response strategies…"
                    : "Select and run a scenario first for analysis-specific answers. You can still ask general CIRO questions."}
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs",
                    msg.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />Thinking…
                </div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-border/40 bg-background p-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder={result ? "Ask about the scenario…" : "Ask a general CIRO question…"}
              className="flex-1 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={chatLoading}
            />
            <button
              type="button"
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <AppFooter />
    </div>
  );
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}
