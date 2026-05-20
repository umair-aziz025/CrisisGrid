import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { io as ioConnect, type Socket } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Siren,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react-native";
import { useTheme, useStyles } from "@/theme/ThemeProvider";
import { spacing, radius } from "@/theme";
import { api, API_BASE_URL } from "@/api/client";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_LIVE_ENTRIES = 12;

// ── Types ────────────────────────────────────────────────────────────────────

type SignalSource = {
  id: string;
  type: string;
  label: string;
  content: string;
  location: string;
  lat: number;
  lng: number;
  timestamp: string;
  credibilityScore: number;
};

type AgentLogEntry = {
  agent: "Sentinel" | "Analyst" | "Strategist" | "Executor";
  step: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  type: "info" | "decision" | "tool_call" | "warning" | "success" | "error";
};

type LiveEntry = AgentLogEntry & { _id: string };

type ScenarioMeta = {
  id: string;
  name: string;
  description: string;
  signalCount: number;
};

type CIROResult = {
  scenarioId: string;
  scenarioName: string;
  antigravityTrace: AgentLogEntry[];
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
  completedAt: string;
};

const TABS = ["Signals", "Trace", "Outcome", "Alerts"] as const;
type Tab = typeof TABS[number];

const AGENT_COLORS: Record<string, string> = {
  Sentinel: "#38bdf8",
  Analyst: "#a78bfa",
  Strategist: "#fb923c",
  Executor: "#4ade80",
};

const TRACE_TYPE_COLORS: Record<string, string> = {
  info: "#94a3b8",
  decision: "#f59e0b",
  tool_call: "#38bdf8",
  warning: "#fb923c",
  success: "#4ade80",
  error: "#f87171",
};

const SIGNAL_TYPE_ICONS: Record<string, string> = {
  social: "📱",
  weather: "🌧️",
  traffic: "🚦",
  sensor: "📡",
  field_report: "📋",
  emergency_call: "📞",
};

// ── Sub-components ───────────────────────────────────────────────────────────

function AgentBadge({ agent }: { agent: string }) {
  const color = AGENT_COLORS[agent] || "#94a3b8";
  return (
    <View style={[agentBadgeStyles.badge, { borderColor: color }]}>
      <Text style={[agentBadgeStyles.text, { color }]}>{agent}</Text>
    </View>
  );
}

const agentBadgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 4 },
  text: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});

function TraceEntry({ entry }: { entry: AgentLogEntry }) {
  const { palette } = useTheme();
  const typeColor = TRACE_TYPE_COLORS[entry.type] || "#94a3b8";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const renderWithArrows = (text: string, textStyle: any) => {
    if (!text) return null;
    const parts = text.split("→");
    if (parts.length === 1) return <Text style={textStyle}>{text.trim()}</Text>;
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <Text style={textStyle}>{p.trim()}</Text>
            {i < parts.length - 1 && <ChevronRight size={12} color={palette.mutedForeground} />}
          </React.Fragment>
        ))}
      </View>
    );
  };

  return (
    <View style={traceStyles.entry}>
      <View style={[traceStyles.dot, { backgroundColor: typeColor }]} />
      <View style={traceStyles.content}>
        <View style={traceStyles.header}>
          <AgentBadge agent={entry.agent} />
          <View style={{ flex: 1 }}>{renderWithArrows(entry.step, traceStyles.step)}</View>
          <Text style={traceStyles.time}>{time}</Text>
        </View>
        {renderWithArrows(String(entry.message), traceStyles.message)}
      </View>
    </View>
  );
}

const traceStyles = StyleSheet.create({
  entry: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  content: { flex: 1, gap: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  step: { fontSize: 10, color: "#64748b", fontWeight: "600", flex: 1 },
  time: { fontSize: 10, color: "#475569" },
  message: { fontSize: 12, color: "#cbd5e1", lineHeight: 18 },
});

function SeverityBar({ tier }: { tier: number }) {
  const colors = ["#4ade80", "#a3e635", "#facc15", "#fb923c", "#f87171"];
  return (
    <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
      {[1, 2, 3, 4, 5].map((t) => (
        <View key={t} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t <= tier ? colors[t - 1] : "rgba(255,255,255,0.1)" }} />
      ))}
    </View>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  const { palette, mode } = useTheme();
  return (
    <View style={[statStyles.card, { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }]}>
      <Text style={[statStyles.value, { color: color || palette.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: palette.mutedForeground }]}>{label}</Text>
      {sub ? <Text style={[statStyles.sub, { color: palette.mutedForeground }]}>{sub}</Text> : null}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 2 },
  value: { fontSize: 22, fontWeight: "700" },
  label: { fontSize: 11, textAlign: "center", fontWeight: "600" },
  sub: { fontSize: 10, textAlign: "center" },
});

// ── Live feed entry (animated slide-in) ──────────────────────────────────────

function LiveFeedEntry({ entry, finalOpacity }: { entry: LiveEntry; finalOpacity: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 9,
    }).start();
  }, []);

  const agentColor = AGENT_COLORS[entry.agent] || "#94a3b8";
  const typeColor = TRACE_TYPE_COLORS[entry.type] || "#94a3b8";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <Animated.View
      style={[
        liveFeedStyles.entry,
        {
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, finalOpacity] }),
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      <View style={[liveFeedStyles.typeBar, { backgroundColor: typeColor }]} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <View style={[liveFeedStyles.agentBadge, { borderColor: agentColor }]}>
            <Text style={[liveFeedStyles.agentText, { color: agentColor }]}>{entry.agent}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", flex: 1, alignItems: "center" }}>
            {entry.step.split("→").map((part, idx, arr) => (
              <React.Fragment key={idx}>
                <Text style={liveFeedStyles.stepText} numberOfLines={1}>{part.trim()}</Text>
                {idx < arr.length - 1 && <ChevronRight size={10} color="#475569" style={{ marginHorizontal: 2 }} />}
              </React.Fragment>
            ))}
          </View>
          <Text style={liveFeedStyles.timeText}>{time}</Text>
        </View>
        {/* Render arrows as icons to avoid glyph issues in some fonts */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          {String(entry.message).split("→").map((part, idx, arr) => (
            <React.Fragment key={idx}>
              <Text style={liveFeedStyles.msgText} numberOfLines={idx === arr.length - 1 ? 2 : 1}>{part.trim()}</Text>
              {idx < arr.length - 1 && <ChevronRight size={12} color="#64748b" style={{ marginHorizontal: 4 }} />}
            </React.Fragment>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const liveFeedStyles = StyleSheet.create({
  entry: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  typeBar: { width: 3, borderRadius: 2, alignSelf: "stretch", minHeight: 16 },
  agentBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  agentText: { fontSize: 9, fontWeight: "700" },
  stepText: { fontSize: 10, color: "#475569", flex: 1 },
  timeText: { fontSize: 9, color: "#334155" },
  msgText: { fontSize: 11, color: "#94a3b8", lineHeight: 16 },
});

// ── Map helpers ───────────────────────────────────────────────────────────────

function buildCongestedRoute(lat: number, lng: number) {
  const d = 0.018;
  return [
    { latitude: lat - d, longitude: lng - d },
    { latitude: lat - d * 0.4, longitude: lng - d * 0.3 },
    { latitude: lat + d * 0.1, longitude: lng + d * 0.1 },
    { latitude: lat + d * 0.5, longitude: lng + d * 0.4 },
    { latitude: lat + d, longitude: lng + d },
  ];
}

function buildClearedRoute(lat: number, lng: number) {
  const d = 0.018;
  return [
    { latitude: lat - d, longitude: lng - d },
    { latitude: lat - d * 1.4, longitude: lng - d * 0.1 },
    { latitude: lat - d * 1.2, longitude: lng + d * 0.8 },
    { latitude: lat + d * 0.3, longitude: lng + d * 1.3 },
    { latitude: lat + d, longitude: lng + d },
  ];
}

/* darkMapStyle removed — Google Maps now renders native road network
 * so users can see actual streets, terrain, and landmarks clearly. */

function OutcomeMap({
  result,
  mapType,
  onChangeMapType,
}: {
  result: CIROResult;
  mapType: "standard" | "satellite" | "hybrid" | "terrain";
  onChangeMapType: (t: "standard" | "satellite" | "hybrid" | "terrain") => void;
}) {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState({
    latitude: result.sentinel.dominantLocation.lat,
    longitude: result.sentinel.dominantLocation.lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  });

  const zoomBy = (factor: number) => {
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: Math.max(0.001, Math.min(170, region.latitudeDelta * factor)),
        longitudeDelta: Math.max(0.001, Math.min(170, region.longitudeDelta * factor)),
      },
      250,
    );
  };

  const cycleType = () => {
    const next =
      mapType === "standard"
        ? "satellite"
        : mapType === "satellite"
        ? "hybrid"
        : mapType === "hybrid"
        ? "terrain"
        : "standard";
    onChangeMapType(next);
  };

  const typeLabel =
    mapType === "satellite" ? "Satellite" : mapType === "hybrid" ? "Hybrid" : mapType === "terrain" ? "Terrain" : "Map";

  const beforeRadius = (result.analyst?.affectedRadiusKm ?? 2) * 1000;
  const afterRadius = beforeRadius * 0.45;

  return (
    <View style={outcomeMapStyles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={outcomeMapStyles.map}
        mapType={mapType}
        region={region}
        onRegionChangeComplete={(r) => setRegion(r)}
      >
        {result.sentinel.filteredSignals.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.label}
            description={s.content?.slice(0, 80) ?? ""}
            pinColor={s.credibilityScore > 0.8 ? "#4ade80" : "#fb923c"}
          />
        ))}

        {/* Real before route (congested/dangerous) */}
        {result.executor.mapVisualization?.beforeRoute && result.executor.mapVisualization.beforeRoute.length > 0 && (
          <Polyline
            coordinates={result.executor.mapVisualization.beforeRoute.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor="rgba(248,113,113,0.85)"
            strokeWidth={4}
            lineDashPattern={[6, 4]}
          />
        )}

        {/* Real after route (detour/safe) */}
        {result.executor.mapVisualization?.afterRoute && result.executor.mapVisualization.afterRoute.length > 0 && (
          <Polyline
            coordinates={result.executor.mapVisualization.afterRoute.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor="rgba(74,222,128,0.9)"
            strokeWidth={4}
          />
        )}

        {/* Evacuation routes */}
        {result.executor.mapVisualization?.evacuationRoutes?.map((route, idx) => (
          <Polyline
            key={`evac-${idx}`}
            coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor="rgba(56,189,248,0.7)"
            strokeWidth={3}
            lineDashPattern={[4, 4]}
          />
        ))}

        {/* Safe zones */}
        {result.executor.mapVisualization?.safeZones?.map((sz, idx) => (
          <Marker
            key={`safe-${idx}`}
            coordinate={{ latitude: sz.lat, longitude: sz.lng }}
            title={sz.label}
            description="Designated safe zone / shelter"
            pinColor="#38bdf8"
          />
        ))}

        {/* Before impact zone (larger, red) */}
        <Circle
          center={{ latitude: result.sentinel.dominantLocation.lat, longitude: result.sentinel.dominantLocation.lng }}
          radius={beforeRadius}
          fillColor="rgba(248,113,113,0.10)"
          strokeColor="rgba(248,113,113,0.55)"
          strokeWidth={2}
        />
        {/* After impact zone (smaller, green) */}
        <Circle
          center={{ latitude: result.sentinel.dominantLocation.lat, longitude: result.sentinel.dominantLocation.lng }}
          radius={afterRadius}
          fillColor="rgba(74,222,128,0.12)"
          strokeColor="rgba(74,222,128,0.65)"
          strokeWidth={2}
        />
      </MapView>

      {/* Map type toggle */}
      <Pressable onPress={cycleType} style={outcomeMapStyles.typeBtn} hitSlop={6}>
        <Layers size={14} color="#f1f5f9" />
        <Text style={outcomeMapStyles.typeText}>{typeLabel}</Text>
      </Pressable>

      {/* Zoom controls */}
      <View style={outcomeMapStyles.zoomControls}>
        <Pressable onPress={() => zoomBy(0.6)} style={outcomeMapStyles.zoomBtn} hitSlop={6}>
          <Plus size={16} color="#f1f5f9" />
        </Pressable>
        <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
        <Pressable onPress={() => zoomBy(1.6)} style={outcomeMapStyles.zoomBtn} hitSlop={6}>
          <Minus size={16} color="#f1f5f9" />
        </Pressable>
      </View>

      {/* Location overlay */}
      <View style={outcomeMapStyles.overlay}>
        <Text style={outcomeMapStyles.overlayText}>📍 {result.sentinel.dominantLocation.name}</Text>
        <Text style={outcomeMapStyles.overlaySub}>{result.analyst?.affectedRadiusKm ?? "—"}km radius</Text>
      </View>

      {/* Legend */}
      <View style={outcomeMapStyles.legend}>
        <View style={outcomeMapStyles.legendItem}>
          <View style={[outcomeMapStyles.legendLine, { backgroundColor: "rgba(248,113,113,0.85)" }]} />
          <Text style={outcomeMapStyles.legendText}>Before (congested)</Text>
        </View>
        <View style={outcomeMapStyles.legendItem}>
          <View style={[outcomeMapStyles.legendLine, { backgroundColor: "rgba(74,222,128,0.9)" }]} />
          <Text style={outcomeMapStyles.legendText}>After (detour)</Text>
        </View>
        <View style={outcomeMapStyles.legendItem}>
          <View style={[outcomeMapStyles.legendLine, { backgroundColor: "rgba(56,189,248,0.7)" }]} />
          <Text style={outcomeMapStyles.legendText}>Evacuation routes</Text>
        </View>
        <View style={outcomeMapStyles.legendItem}>
          <View style={[outcomeMapStyles.legendDot, { backgroundColor: "#38bdf8" }]} />
          <Text style={outcomeMapStyles.legendText}>Safe zones</Text>
        </View>
      </View>
    </View>
  );
}

const outcomeMapStyles = StyleSheet.create({
  container: { height: 260, borderRadius: 16, overflow: "hidden", position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  typeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeText: { fontSize: 11, color: "#f1f5f9", fontWeight: "600" },
  zoomControls: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    overflow: "hidden",
  },
  zoomBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  overlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  overlayText: { fontSize: 11, color: "#f1f5f9", fontWeight: "600" },
  overlaySub: { fontSize: 10, color: "#94a3b8" },
  legend: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendText: { fontSize: 10, color: "#e2e8f0" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CIROScreen() {
  const { palette, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles((c) => makeStyles(c, mode));

  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [result, setResult] = useState<CIROResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Signals");
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [outcomeMapType, setOutcomeMapType] = useState<"standard" | "satellite" | "hybrid" | "terrain">("standard");

  // CIRO Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const socketRef = useRef<Socket | null>(null);
  const liveScrollRef = useRef<ScrollView>(null);

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const loadScenarios = useCallback(async () => {
    setScenariosLoading(true);
    try {
      const data = await api.getCIROScenarios();
      setScenarios(data.scenarios || []);
    } catch (e) {
      setError("Failed to load scenarios — check backend connection");
    } finally {
      setScenariosLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!selectedScenario) return;

    // Generate a unique session ID so the server can emit to our specific socket room
    const sessionId = `ciro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setLoading(true);
    setError(null);
    setResult(null);
    setLiveEntries([]);
    setActiveTab("Signals");
    startPulse();

    // Connect to Socket.IO and join our session room for live trace streaming
    const socket = ioConnect(API_BASE_URL, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: false,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_ciro_session", sessionId);
    });

    socket.on("ciro_trace_entry", (entry: AgentLogEntry) => {
      LayoutAnimation.configureNext({
        duration: 280,
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
      setLiveEntries((prev) => {
        const next: LiveEntry[] = [
          ...prev,
          { ...entry, _id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 5)}` },
        ];
        // Keep only last MAX_LIVE_ENTRIES entries; oldest fade out automatically via opacity
        return next.slice(-MAX_LIVE_ENTRIES);
      });
      // Auto-scroll to bottom
      setTimeout(() => liveScrollRef.current?.scrollToEnd({ animated: true }), 50);
    });

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Analysis timed out (90s) — please try again.")), 90000)
      );
      const data = await Promise.race([
        api.runCIROAnalysis(selectedScenario, sessionId),
        timeout,
      ]) as CIROResult;
      setResult(data);
      setActiveTab("Trace");
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
      stopPulse();
      socket.disconnect();
      socketRef.current = null;
    }
  }, [selectedScenario, startPulse, stopPulse]);

  const currentScenario = scenarios.find((s) => s.id === selectedScenario);

  const sendChatMessage = useCallback(async () => {
    const text = chatDraft.trim();
    if (!text || chatLoading) return;
    setChatDraft("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    try {
      const res: any = await api.askCIRO(text, {
        scenarioId: selectedScenario || undefined,
        result: result || undefined,
      });
      setChatMessages((prev) => [...prev, { role: "assistant", text: res?.answer || "No response." }]);
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I couldn't answer that right now." }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatDraft, chatLoading, selectedScenario, result]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── CIRO Chat Button ───────────────────────────────────────────────── */}
      {!chatOpen && (
        <Pressable
          onPress={() => setChatOpen(true)}
          style={[styles.chatFab, { bottom: insets.bottom + 16 }]}
          hitSlop={8}
        >
          <MessageCircle size={20} color="#0f172a" />
          <Text style={styles.chatFabText}>Ask CIRO AI</Text>
        </Pressable>
      )}

      {/* ── Chat Panel ───────────────────────────────────────────────────────── */}
      {chatOpen && (
        <View style={[styles.chatPanel, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.chatHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Brain size={16} color="#38bdf8" />
              <Text style={styles.chatTitle}>CIRO AI Assistant</Text>
            </View>
            <Pressable onPress={() => setChatOpen(false)} hitSlop={8}>
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
            {chatMessages.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20, gap: 8 }}>
                <Brain size={28} color="#38bdf8" />
                <Text style={styles.chatEmptyText}>
                  Ask me anything about crisis scenarios, incident data, or response analytics.
                </Text>
              </View>
            ) : (
              chatMessages.map((m, i) => (
                <View
                  key={i}
                  style={[
                    styles.chatBubble,
                    m.role === "user" ? styles.chatBubbleUser : styles.chatBubbleBot,
                  ]}
                >
                  <Text style={m.role === "user" ? styles.chatTextUser : styles.chatTextBot}>
                    {m.text}
                  </Text>
                </View>
              ))
            )}
            {chatLoading && (
              <View style={[styles.chatBubble, styles.chatBubbleBot]}>
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            )}
          </ScrollView>
          <View style={styles.chatComposer}>
            <View style={styles.chatInputWrap}>
              <TextInput
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder="Ask about incidents, scenarios..."
                placeholderTextColor="#64748b"
                style={styles.chatInput}
                multiline
                onSubmitEditing={sendChatMessage}
                blurOnSubmit={false}
              />
            </View>
            <Pressable onPress={sendChatMessage} style={styles.chatSendBtn} disabled={chatLoading}>
              <Send size={16} color="#0f172a" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <View style={styles.poweredBadge}>
              <Zap size={10} color="#4ade80" />
              <Text style={styles.poweredText}>Google Antigravity</Text>
            </View>
            <Text style={styles.logoText}>CIRO</Text>
          </View>
          <Text style={styles.headerSub}>Crisis Intelligence & Response Orchestrator</Text>
        </View>
        {result && (
          <Pressable
            onPress={() => { setResult(null); setSelectedScenario(null); setLiveEntries([]); }}
            style={styles.resetBtn}
          >
            <RefreshCw size={16} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* ── Selector section (hidden once result is available) ──────────────── */}
      {!result && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.selectorSection}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>SELECT SCENARIO</Text>

          {scenariosLoading ? (
            <ActivityIndicator color="#38bdf8" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.scenarioGrid}>
              {scenarios.map((s) => {
                const isActive = selectedScenario === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => !loading && setSelectedScenario(s.id)}
                    style={[styles.scenarioCard, isActive && styles.scenarioCardActive]}
                  >
                    <Text style={[styles.scenarioName, isActive && styles.scenarioNameActive]}>
                      {s.name}
                    </Text>
                    <Text style={styles.scenarioDesc} numberOfLines={2}>{s.description}</Text>
                    <View style={styles.scenarioMeta}>
                      <Radio size={10} color="#38bdf8" />
                      <Text style={styles.scenarioMetaText}>{s.signalCount} signals</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {selectedScenario && (
            <Pressable
              onPress={runAnalysis}
              disabled={loading}
              style={[styles.runBtn, loading && { opacity: 0.75 }]}
            >
              {loading ? (
                <>
                  <Animated.View style={{ opacity: pulseAnim }}>
                    <Activity size={18} color="#0f172a" />
                  </Animated.View>
                  <Text style={styles.runBtnText}>Running Antigravity Agents…</Text>
                </>
              ) : (
                <>
                  <Brain size={18} color="#0f172a" />
                  <Text style={styles.runBtnText}>Run CIRO Analysis</Text>
                </>
              )}
            </Pressable>
          )}

          {error && (
            <View style={styles.errorBox}>
              <AlertTriangle size={14} color="#f87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Live feed: shown while analysis is running ─────────────────── */}
          {loading && (
            <View style={styles.liveFeedContainer}>
              <View style={styles.liveFeedHeader}>
                <Animated.View style={{ opacity: pulseAnim }}>
                  <View style={styles.liveDot} />
                </Animated.View>
                <Text style={styles.liveFeedTitle}>LIVE ANTIGRAVITY TRACE</Text>
                <Text style={styles.liveFeedCount}>{liveEntries.length} events</Text>
              </View>

              {/* Agent legend */}
              <View style={styles.liveFeedLegend}>
                {Object.entries(AGENT_COLORS).map(([agent, color]) => (
                  <View key={agent} style={styles.liveLegendItem}>
                    <View style={[styles.liveLegendDot, { backgroundColor: color }]} />
                    <Text style={styles.liveLegendText}>{agent}</Text>
                  </View>
                ))}
              </View>

              <ScrollView
                ref={liveScrollRef}
                style={styles.liveFeedScroll}
                contentContainerStyle={styles.liveFeedList}
                showsVerticalScrollIndicator={false}
              >
                {liveEntries.length === 0 ? (
                  <View style={styles.liveFeedEmpty}>
                    <ActivityIndicator size="small" color="#38bdf8" />
                    <Text style={styles.liveFeedEmptyText}>Connecting to agent pipeline…</Text>
                  </View>
                ) : (
                  liveEntries.map((entry, i) => {
                    // Older entries (lower index) fade out; newest always at full opacity
                    const age = liveEntries.length - 1 - i;
                    const finalOpacity = age === 0 ? 1.0 : age < 3 ? 0.75 : age < 6 ? 0.5 : 0.28;
                    return (
                      <LiveFeedEntry key={entry._id} entry={entry} finalOpacity={finalOpacity} />
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.liveFeedFooter}>
                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <Text style={styles.liveFeedFooterText}>Sentinel</Text>
                  <ChevronRight size={12} color={palette.mutedForeground} />
                  <Text style={styles.liveFeedFooterText}>Analyst</Text>
                  <ChevronRight size={12} color={palette.mutedForeground} />
                  <Text style={styles.liveFeedFooterText}>Strategist</Text>
                  <ChevronRight size={12} color={palette.mutedForeground} />
                  <Text style={styles.liveFeedFooterText}>Executor</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Intro feature cards: visible when idle (no result, not loading) */}
          {!loading && (
            <View style={styles.introGrid}>
              {[
                { icon: <Radio size={20} color="#38bdf8" />, title: "Signal Fusion", desc: "Sentinel ingests 5+ live API sources and filters noise in real time" },
                { icon: <Brain size={20} color="#a78bfa" />, title: "Severity AI", desc: "Analyst predicts tier, population risk, spread velocity & uncertainty" },
                { icon: <Shield size={20} color="#fb923c" />, title: "Resource Allocation", desc: "Strategist balances constrained units across simultaneous crises" },
                { icon: <Zap size={20} color="#4ade80" />, title: "Action Simulation", desc: "Executor runs tool calls and shows before/after state with side-effects" },
              ].map((c) => (
                <View key={c.title} style={styles.introCard}>
                  {c.icon}
                  <Text style={styles.introCardTitle}>{c.title}</Text>
                  <Text style={styles.introCardDesc}>{c.desc}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Result view ────────────────────────────────────────────────────── */}
      {result && (
        <View style={{ flex: 1 }}>
          {/* Summary bar */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{result.analyst.severityLabel.split("—")[0].trim()}</Text>
              <Text style={styles.summaryKey}>Severity</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: "#f87171" }]}>
                {result.sentinel.filteredSignals.length}
              </Text>
              <Text style={styles.summaryKey}>Signals</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: "#4ade80" }]}>
                {result.antigravityTrace.length}
              </Text>
              <Text style={styles.summaryKey}>Trace Steps</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: "#fb923c" }]}>
                {(result.analyst.confidenceScore * 100).toFixed(0)}%
              </Text>
              <Text style={styles.summaryKey}>Confidence</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {TABS.map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab content */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

            {/* ── SIGNALS ── */}
            {activeTab === "Signals" && (
              <View style={{ gap: 12 }}>
                <Text style={styles.tabSectionTitle}>Fused Crisis Picture</Text>
                <View style={styles.fusedBox}>
                  <Text style={styles.fusedText}>{result.sentinel.fusedSummary}</Text>
                  <View style={styles.crisisTypeBadge}>
                    <Text style={styles.crisisTypeText}>
                      {result.sentinel.crisisType.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                {result.sentinel.contradictions.length > 0 && (
                  <View style={styles.contradictionBox}>
                    <View style={styles.rowGap}>
                      <AlertTriangle size={14} color="#fb923c" />
                      <Text style={styles.contradictionTitle}>
                        {result.sentinel.contradictions.length} Contradiction(s) Detected
                      </Text>
                    </View>
                    {result.sentinel.contradictions.map((c, i) => (
                      <Text key={i} style={styles.contradictionText}>• {c.explanation}</Text>
                    ))}
                  </View>
                )}

                <Text style={styles.tabSectionTitle}>
                  Active Signals ({result.sentinel.filteredSignals.length})
                </Text>
                {result.sentinel.filteredSignals.map((s) => (
                  <View key={s.id} style={styles.signalCard}>
                    <View style={styles.signalHeader}>
                      <Text style={styles.signalIcon}>{SIGNAL_TYPE_ICONS[s.type] || "📌"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.signalLabel}>{s.label}</Text>
                        <View style={styles.rowGap}>
                          <MapPin size={10} color="#64748b" />
                          <Text style={styles.signalLocation}>{s.location}</Text>
                        </View>
                      </View>
                      <View style={[styles.credBadge, {
                        backgroundColor: s.credibilityScore > 0.8 ? "rgba(74,222,128,0.15)" : s.credibilityScore > 0.5 ? "rgba(251,146,60,0.15)" : "rgba(248,113,113,0.15)"
                      }]}>
                        <Text style={[styles.credText, {
                          color: s.credibilityScore > 0.8 ? "#4ade80" : s.credibilityScore > 0.5 ? "#fb923c" : "#f87171"
                        }]}>
                          {(s.credibilityScore * 100).toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.signalContent}>{s.content}</Text>
                  </View>
                ))}

                {result.sentinel.noiseSignals.length > 0 && (
                  <>
                    <Text style={[styles.tabSectionTitle, { color: "#f87171" }]}>
                      Filtered Out — Noise / Stale ({result.sentinel.noiseSignals.length})
                    </Text>
                    {result.sentinel.noiseSignals.map((s) => (
                      <View key={s.id} style={[styles.signalCard, styles.signalCardNoise]}>
                        <View style={styles.signalHeader}>
                          <Text style={styles.signalIcon}>{SIGNAL_TYPE_ICONS[s.type] || "📌"}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.signalLabel, { color: "#475569" }]}>{s.label}</Text>
                          </View>
                          <WifiOff size={12} color="#475569" />
                        </View>
                        <Text style={[styles.signalContent, { color: "#475569" }]}>{s.content}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── TRACE ── */}
            {activeTab === "Trace" && (
              <View style={{ gap: 4 }}>
                <View style={styles.traceHeader}>
                  <View style={styles.rowGap}>
                    <Activity size={14} color="#4ade80" />
                    <Text style={styles.tabSectionTitle}>Antigravity Agent Trace</Text>
                  </View>
                  <Text style={styles.traceCount}>{result.antigravityTrace.length} steps</Text>
                </View>
                <View style={styles.agentLegend}>
                  {Object.entries(AGENT_COLORS).map(([agent, color]) => (
                    <View key={agent} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={styles.legendText}>{agent}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.traceContainer}>
                  {result.antigravityTrace.map((entry, i) => (
                    <TraceEntry key={i} entry={entry} />
                  ))}
                </View>
              </View>
            )}

            {/* ── OUTCOME ── */}
            {activeTab === "Outcome" && (
              <View style={{ gap: 16 }}>
                <OutcomeMap
                  result={result}
                  mapType={outcomeMapType}
                  onChangeMapType={setOutcomeMapType}
                />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Text style={styles.tabSectionTitle}>Before</Text>
                  <ChevronRight size={14} color={palette.mutedForeground} />
                  <Text style={styles.tabSectionTitle}>After State</Text>
                </View>
                <View style={styles.beforeAfterRow}>
                  <View style={[styles.stateCard, styles.beforeCard]}>
                    <Text style={styles.stateCardLabel}>BEFORE</Text>
                    <Text style={styles.stateCardVal}>{result.executor.beforeState?.responseTimeMin ?? "—"} min</Text>
                    <Text style={styles.stateCardSub}>Response Time</Text>
                    <Text style={styles.stateCardVal}>{result.executor.beforeState?.congestionLevel ?? "—"}</Text>
                    <Text style={styles.stateCardSub}>Congestion</Text>
                    <Text style={styles.stateCardVal}>
                      {typeof result.executor.beforeState?.populationExposed === "number"
                        ? result.executor.beforeState.populationExposed.toLocaleString()
                        : "—"}
                    </Text>
                    <Text style={styles.stateCardSub}>Exposed</Text>
                  </View>
                  <ChevronRight size={24} color="#64748b" />
                  <View style={[styles.stateCard, styles.afterCard]}>
                    <Text style={styles.stateCardLabel}>AFTER</Text>
                    <Text style={[styles.stateCardVal, { color: "#4ade80" }]}>{result.executor.afterState?.responseTimeMin ?? "—"} min</Text>
                    <Text style={styles.stateCardSub}>Response Time</Text>
                    <Text style={[styles.stateCardVal, { color: "#4ade80" }]}>{result.executor.afterState?.congestionLevel ?? "—"}</Text>
                    <Text style={styles.stateCardSub}>Congestion</Text>
                    <Text style={[styles.stateCardVal, { color: "#4ade80" }]}>
                      {typeof result.executor.afterState?.populationExposed === "number"
                        ? result.executor.afterState.populationExposed.toLocaleString()
                        : "—"}
                    </Text>
                    <Text style={styles.stateCardSub}>Exposed</Text>
                  </View>
                </View>

                <View style={styles.severitySection}>
                  <Text style={styles.tabSectionTitle}>Severity Assessment</Text>
                  <Text style={[styles.severityLabel, {
                    color: (result.analyst?.severityTier ?? 0) >= 4 ? "#f87171" : (result.analyst?.severityTier ?? 0) >= 3 ? "#fb923c" : "#4ade80"
                  }]}>
                    {result.analyst?.severityLabel ?? "—"}
                  </Text>
                  <SeverityBar tier={result.analyst?.severityTier ?? 1} />
                  <View style={styles.statsRow}>
                    <StatCard
                      label="Population at Risk"
                      value={(() => {
                        const v = result.analyst?.estimatedPopulationAtRisk as any;
                        if (v == null || v === "" || v === 0) return "—";
                        const n = typeof v === "string" ? parseInt(v, 10) : v;
                        if (isNaN(n) || n <= 0) return "—";
                        return n.toLocaleString();
                      })()}
                    />
                    <StatCard
                      label="Peak Impact"
                      value={(() => {
                        const v = result.analyst?.peakImpactTime;
                        if (v == null || v === "") return "—";
                        return String(v);
                      })()}
                    />
                  </View>
                  <View style={styles.statsRow}>
                    <StatCard
                      label="Est. Duration"
                      value={(() => {
                        const v = result.analyst?.expectedDurationHrs as any;
                        if (v == null || v === "" || v === 0) return "—";
                        const n = typeof v === "string" ? parseFloat(v) : v;
                        if (isNaN(n) || n <= 0) return "—";
                        return `${n}h`;
                      })()}
                    />
                    <StatCard
                      label="Uncertainty"
                      value={(() => {
                        const v = result.analyst?.uncertaintyRange;
                        if (v == null || v === "") return "—";
                        return String(v);
                      })()}
                    />
                  </View>
                  <View style={styles.statsRow}>
                    <StatCard
                      label="Spread Risk"
                      value={result.analyst?.spreadRisk ? result.analyst.spreadRisk.toUpperCase() : "—"}
                      color={result.analyst?.spreadRisk === "critical" ? "#f87171" : result.analyst?.spreadRisk === "high" ? "#fb923c" : "#4ade80"}
                    />
                    <StatCard
                      label="Lives Protected"
                      value={typeof result.executor?.afterState?.estimatedLivesSaved === "number" ? `~${result.executor.afterState.estimatedLivesSaved}` : "—"}
                      color="#4ade80"
                    />
                  </View>
                </View>

                {result.executor?.simulatedActions && result.executor.simulatedActions.length > 0 && (
                  <>
                    <Text style={styles.tabSectionTitle}>Action Chain Execution</Text>
                    {result.executor.simulatedActions.map((a, i) => (
                      <View key={i} style={[
                        styles.actionCard,
                        a.status === "success" && styles.actionSuccess,
                        a.status === "failed" && styles.actionFailed,
                        a.status === "retried" && styles.actionRetried,
                      ]}>
                        <View style={styles.actionHeader}>
                          <View style={styles.actionHeaderLeft}>
                            <Text style={styles.actionStep}>Step {i + 1}</Text>
                            <View style={[styles.actionStatusBadge, {
                              backgroundColor: a.status === "success" ? "rgba(74,222,128,0.15)" : a.status === "failed" ? "rgba(248,113,113,0.15)" : "rgba(251,146,60,0.15)"
                            }]}>
                              <Text style={[styles.actionStatusText, {
                                color: a.status === "success" ? "#4ade80" : a.status === "failed" ? "#f87171" : "#fb923c"
                              }]}>{a.status.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={styles.actionLatency}>{a.latencyMs}ms</Text>
                        </View>
                        <Text style={styles.actionTitle}>{a.action}</Text>
                        <Text style={styles.actionToolCall}>{a.toolCall}</Text>
                        <Text style={styles.actionResult}>{a.result}</Text>
                        {a.sideEffects && a.sideEffects.length > 0 && (
                          <View style={styles.sideEffectsBox}>
                            <Text style={styles.sideEffectsTitle}>⚠ Side Effects</Text>
                            {a.sideEffects.map((se, j) => (
                              <Text key={j} style={styles.sideEffectItem}>• {se}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {result.executor?.fallbacksUsed && result.executor.fallbacksUsed.length > 0 && (
                  <View style={styles.fallbackBox}>
                    <WifiOff size={12} color="#fb923c" />
                    <Text style={styles.fallbackText}>
                      Fallbacks used: {result.executor.fallbacksUsed.join(", ")}
                    </Text>
                  </View>
                )}

                {result.executor?.costSummary && (
                  <View style={styles.costCard}>
                    <BarChart3 size={16} color="#38bdf8" />
                    <Text style={styles.costTitle}>Cost / Latency Summary</Text>
                    <View style={styles.statsRow}>
                      <StatCard label="Units Deployed" value={result.executor.costSummary.totalUnitsDeployed ?? "—"} />
                      <StatCard label="Est. Cost (PKR)" value={typeof result.executor.costSummary.estimatedCostPKR === "number" ? result.executor.costSummary.estimatedCostPKR.toLocaleString() : "—"} />
                      <StatCard label="Total Latency" value={`${result.executor.costSummary.totalLatencyMs ?? "—"}ms`} />
                    </View>
                  </View>
                )}

                {result.strategist?.infeasibleActions && result.strategist.infeasibleActions.length > 0 && (
                  <>
                    <Text style={styles.tabSectionTitle}>Rejected Actions (Infeasible)</Text>
                    {result.strategist.infeasibleActions.map((a, i) => (
                      <View key={i} style={styles.infeasibleCard}>
                        <Text style={styles.infeasibleAction}>✗ {a.action}</Text>
                        <Text style={styles.infeasibleReason}>{a.reason}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── ALERTS ── */}
            {activeTab === "Alerts" && (
              <View style={{ gap: 12 }}>
                <Text style={styles.tabSectionTitle}>Stakeholder Notifications</Text>
                <Text style={styles.alertsSubtitle}>
                  Auto-generated by Executor Agent and dispatched via simulated channels
                </Text>
                {result.executor.stakeholderAlerts.map((a, i) => (
                  <View key={i} style={styles.alertCard}>
                    <View style={styles.alertHeader}>
                      <Bell size={14} color={a.sent ? "#4ade80" : "#f87171"} />
                      <Text style={styles.alertAudience}>{a.audience}</Text>
                      <View style={styles.alertChannelBadge}>
                        <Text style={styles.alertChannelText}>{a.channel}</Text>
                      </View>
                      <View style={[styles.alertSentBadge, { backgroundColor: a.sent ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)" }]}>
                        <CheckCircle2 size={10} color={a.sent ? "#4ade80" : "#f87171"} />
                        <Text style={[styles.alertSentText, { color: a.sent ? "#4ade80" : "#f87171" }]}>
                          {a.sent ? "Sent" : "Failed"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.alertMessage}>{a.message}</Text>
                  </View>
                ))}

                <Text style={styles.tabSectionTitle}>Resource Allocation</Text>
                {result.strategist.allocations.map((alloc, i) => (
                  <View key={i} style={styles.allocCard}>
                    <View style={styles.allocHeader}>
                      <Siren size={14} color="#f87171" />
                      <Text style={styles.allocLabel}>{alloc.crisisLabel}</Text>
                      <View style={[styles.priorityBadge, {
                        backgroundColor: alloc.priority === "critical" ? "rgba(248,113,113,0.2)" : "rgba(251,146,60,0.2)"
                      }]}>
                        <Text style={[styles.priorityText, {
                          color: alloc.priority === "critical" ? "#f87171" : "#fb923c"
                        }]}>{alloc.priority.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.allocGrid}>
                      {[
                        { label: "Ambulances", val: alloc.ambulances, icon: "🚑" },
                        { label: "Rescue", val: alloc.rescueTeams, icon: "🦺" },
                        { label: "Traffic Police", val: alloc.trafficPolice, icon: "🚔" },
                        { label: "Medics", val: alloc.medics, icon: "👨‍⚕️" },
                      ].map((r) => (
                        <View key={r.label} style={styles.allocItem}>
                          <Text style={styles.allocIcon}>{r.icon}</Text>
                          <Text style={styles.allocVal}>{r.val}</Text>
                          <Text style={styles.allocItemLabel}>{r.label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.tradeoffText}>{alloc.tradeoffReasoning}</Text>
                  </View>
                ))}

                {result.strategist.budgetConstraints && (
                  <View style={styles.constraintBox}>
                    <Clock size={12} color="#64748b" />
                    <Text style={styles.constraintText}>{result.strategist.budgetConstraints}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: import("@/theme").ColorPalette, mode?: string) {
  const isLight = mode === "light";
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerLeft: { gap: 2 },
    logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#f87171" },
    logoText: { fontSize: 20, fontWeight: "800", color: "#f1f5f9", letterSpacing: -0.5 },
    poweredBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(74,222,128,0.1)",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: "rgba(74,222,128,0.25)",
    },
    poweredText: { fontSize: 9, color: "#4ade80", fontWeight: "700" },
    headerSub: { fontSize: 11, color: c.mutedForeground },
    resetBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },

    // Selector section
    selectorSection: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
    sectionLabel: { fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 1 },
    scenarioGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },

    scenarioCard: {
      width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      gap: 6,
    },
    // Active card: theme-aware so light mode stays white, dark mode uses a dark navy
    scenarioCardActive: {
      borderColor: "#38bdf8",
      backgroundColor: isLight ? c.surfaceElevated : "#071828",
      borderWidth: 2,
    },
    scenarioName: { fontSize: 13, fontWeight: "700", color: c.foreground },
    // Active name: contrast with active card
    scenarioNameActive: { color: isLight ? c.foreground : "#f1f5f9" },
    scenarioDesc: { fontSize: 11, color: c.mutedForeground, lineHeight: 16 },
    scenarioMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
    scenarioMetaText: { fontSize: 10, color: "#38bdf8" },

    runBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#38bdf8",
      borderRadius: radius.md,
      paddingVertical: 14,
      marginTop: 4,
    },
    runBtnText: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(248,113,113,0.1)",
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.25)",
    },
    errorText: { fontSize: 12, color: "#f87171", flex: 1 },

    // Intro cards
    introGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
    introCard: {
      width: (SCREEN_WIDTH - spacing.lg * 2 - 10) / 2,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    introCardTitle: { fontSize: 13, fontWeight: "700", color: c.foreground },
    introCardDesc: { fontSize: 11, color: c.mutedForeground, lineHeight: 16 },

    // ── Live feed panel ──────────────────────────────────────────────────────
    liveFeedContainer: {
      backgroundColor: isLight ? c.surfaceElevated : "#080f1c",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: "rgba(56,189,248,0.25)",
      overflow: "hidden",
    },
    liveFeedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: "rgba(56,189,248,0.07)",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(56,189,248,0.15)",
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#38bdf8" },
    liveFeedTitle: { fontSize: 10, fontWeight: "700", color: "#38bdf8", letterSpacing: 1, flex: 1 },
    liveFeedCount: { fontSize: 10, color: "#475569" },
    liveFeedLegend: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexWrap: "wrap",
    },
    liveLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    liveLegendDot: { width: 6, height: 6, borderRadius: 3 },
    liveLegendText: { fontSize: 10, color: "#475569" },
    liveFeedScroll: { maxHeight: 320 },
    liveFeedList: { padding: 10, gap: 0 },
    liveFeedEmpty: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 20,
      justifyContent: "center",
    },
    liveFeedEmptyText: { fontSize: 12, color: "#475569" },
    liveFeedFooter: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.04)",
    },
    liveFeedFooterText: { fontSize: 10, color: c.mutedForeground, textAlign: "center", letterSpacing: 0.3 },

    // ── Summary bar ──────────────────────────────────────────────────────────
    summaryBar: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      backgroundColor: c.surfaceElevated,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
    summaryItem: { flex: 1, alignItems: "center", gap: 2 },
    summaryVal: { fontSize: 16, fontWeight: "700", color: c.foreground },
    summaryKey: { fontSize: 9, color: c.mutedForeground, fontWeight: "600" },
    summaryDivider: { width: 1, backgroundColor: c.border },

    // ── Tabs ─────────────────────────────────────────────────────────────────
    tabBar: { flexDirection: "row", backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
    tabActive: { borderBottomWidth: 2, borderBottomColor: "#38bdf8" },
    tabText: { fontSize: 12, fontWeight: "600", color: c.mutedForeground },
    tabTextActive: { color: "#38bdf8" },
    tabContent: { padding: spacing.lg, paddingBottom: 80 },
    tabSectionTitle: { fontSize: 12, fontWeight: "700", color: c.mutedForeground, letterSpacing: 0.5, marginBottom: 4 },

    // ── Signals tab ──────────────────────────────────────────────────────────
    fusedBox: {
      backgroundColor: "rgba(56,189,248,0.08)",
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(56,189,248,0.25)",
      gap: 8,
    },
    fusedText: { fontSize: 13, color: c.foreground, lineHeight: 20 },
    crisisTypeBadge: { alignSelf: "flex-start", backgroundColor: "rgba(248,113,113,0.15)", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    crisisTypeText: { fontSize: 10, color: "#f87171", fontWeight: "700", letterSpacing: 1 },
    contradictionBox: {
      backgroundColor: "rgba(251,146,60,0.08)",
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(251,146,60,0.25)",
      gap: 6,
    },
    contradictionTitle: { fontSize: 12, color: "#fb923c", fontWeight: "700" },
    contradictionText: { fontSize: 12, color: "#fed7aa", lineHeight: 18 },
    signalCard: {
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    signalCardNoise: { opacity: 0.55 },
    signalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    signalIcon: { fontSize: 20 },
    signalLabel: { fontSize: 12, fontWeight: "700", color: c.foreground },
    signalLocation: { fontSize: 10, color: c.mutedForeground },
    credBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
    credText: { fontSize: 11, fontWeight: "700" },
    signalContent: { fontSize: 12, color: c.mutedForeground, lineHeight: 18 },
    rowGap: { flexDirection: "row", alignItems: "center", gap: 4 },

    // ── Trace tab ────────────────────────────────────────────────────────────
    traceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    traceCount: { fontSize: 11, color: c.mutedForeground },
    agentLegend: { flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: c.mutedForeground },
    traceContainer: {
      backgroundColor: isLight ? c.surface : c.surfaceGlass,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },

    // ── Outcome tab ──────────────────────────────────────────────────────────
    mapContainer: { height: 220, borderRadius: radius.lg, overflow: "hidden", position: "relative" },
    map: { flex: 1 },
    mapOverlay: {
      position: "absolute",
      bottom: 8,
      left: 8,
      backgroundColor: isLight ? c.surfaceElevated : "rgba(0,0,0,0.7)",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    mapOverlayText: { fontSize: 11, color: isLight ? c.foreground : "#f1f5f9", fontWeight: "600" },
    mapOverlayRadius: { fontSize: 10, color: c.mutedForeground },
    mapLegend: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: isLight ? c.surfaceElevated : "rgba(0,0,0,0.72)",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
    },
    mapLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    mapLegendLine: { width: 20, height: 3, borderRadius: 2 },
    mapLegendText: { fontSize: 10, color: isLight ? c.foreground : "#e2e8f0" },
    beforeAfterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stateCard: { flex: 1, borderRadius: radius.md, padding: spacing.md, gap: 2, borderWidth: 1, alignItems: "center" },
    beforeCard: { backgroundColor: "rgba(248,113,113,0.07)", borderColor: "rgba(248,113,113,0.2)" },
    afterCard: { backgroundColor: "rgba(74,222,128,0.07)", borderColor: "rgba(74,222,128,0.2)" },
    stateCardLabel: { fontSize: 9, fontWeight: "700", color: c.mutedForeground, letterSpacing: 1, marginBottom: 4 },
    stateCardVal: { fontSize: 16, fontWeight: "700", color: "#f87171" },
    stateCardSub: { fontSize: 10, color: c.mutedForeground, marginBottom: 6 },
    severitySection: { gap: 10 },
    severityLabel: { fontSize: 18, fontWeight: "800" },
    statsRow: { flexDirection: "row", gap: 8 },
    actionCard: {
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
      gap: 6,
    },
    actionSuccess: { borderColor: "rgba(74,222,128,0.3)" },
    actionFailed: { borderColor: "rgba(248,113,113,0.3)" },
    actionRetried: { borderColor: "rgba(251,146,60,0.3)" },
    actionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    actionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionStep: { fontSize: 10, color: c.mutedForeground, fontWeight: "600" },
    actionStatusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    actionStatusText: { fontSize: 10, fontWeight: "700" },
    actionLatency: { fontSize: 10, color: c.mutedForeground },
    actionTitle: { fontSize: 13, fontWeight: "600", color: c.foreground },
    actionToolCall: {
      fontSize: 11,
      color: "#38bdf8",
      fontFamily: "monospace",
      backgroundColor: "rgba(56,189,248,0.08)",
      padding: 6,
      borderRadius: 4,
    },
    actionResult: { fontSize: 12, color: c.mutedForeground, lineHeight: 18 },
    sideEffectsBox: {
      backgroundColor: "rgba(251,146,60,0.07)",
      borderRadius: 6,
      padding: 8,
      gap: 3,
      borderWidth: 1,
      borderColor: "rgba(251,146,60,0.2)",
    },
    sideEffectsTitle: { fontSize: 10, color: "#fb923c", fontWeight: "700", letterSpacing: 0.5 },
    sideEffectItem: { fontSize: 11, color: "#fed7aa", lineHeight: 17 },
    fallbackBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(251,146,60,0.08)",
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: "rgba(251,146,60,0.2)",
    },
    fallbackText: { fontSize: 12, color: "#fb923c", flex: 1 },
    costCard: {
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    costTitle: { fontSize: 13, fontWeight: "700", color: c.foreground },
    infeasibleCard: {
      backgroundColor: "rgba(248,113,113,0.05)",
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.2)",
      gap: 4,
    },
    infeasibleAction: { fontSize: 12, fontWeight: "600", color: "#f87171" },
    infeasibleReason: { fontSize: 11, color: c.mutedForeground, lineHeight: 17 },

    // ── Alerts tab ───────────────────────────────────────────────────────────
    alertsSubtitle: { fontSize: 11, color: c.mutedForeground, marginBottom: 4, lineHeight: 16 },
    alertCard: { backgroundColor: c.surfaceElevated, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border, gap: 8 },
    alertHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    alertAudience: { fontSize: 13, fontWeight: "700", color: c.foreground, flex: 1 },
    alertChannelBadge: { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    alertChannelText: { fontSize: 10, color: "#38bdf8", fontWeight: "600" },
    alertSentBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    alertSentText: { fontSize: 10, fontWeight: "600" },
    alertMessage: { fontSize: 12, color: c.mutedForeground, lineHeight: 18 },
    allocCard: { backgroundColor: c.surfaceElevated, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border, gap: 10 },
    allocHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    allocLabel: { fontSize: 13, fontWeight: "700", color: c.foreground, flex: 1 },
    priorityBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    priorityText: { fontSize: 10, fontWeight: "700" },
    allocGrid: { flexDirection: "row", gap: 8 },
    allocItem: { flex: 1, alignItems: "center", gap: 2 },
    allocIcon: { fontSize: 20 },
    allocVal: { fontSize: 18, fontWeight: "700", color: c.foreground },
    allocItemLabel: { fontSize: 9, color: c.mutedForeground, textAlign: "center", fontWeight: "600" },
    tradeoffText: { fontSize: 11, color: c.mutedForeground, lineHeight: 17, fontStyle: "italic" },
    constraintBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: "rgba(100,116,139,0.1)",
      borderRadius: 8,
      padding: 10,
    },
    constraintText: { fontSize: 11, color: c.mutedForeground, flex: 1, lineHeight: 17 },

    // ── Chat ─────────────────────────────────────────────────────────────────
    chatFab: {
      position: "absolute",
      right: 16,
      zIndex: 100,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      backgroundColor: "#38bdf8",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    chatFabText: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
    chatPanel: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 420,
      backgroundColor: c.surfaceElevated,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderTopWidth: 1,
      borderTopColor: c.border,
      zIndex: 200,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    chatTitle: { fontSize: 14, fontWeight: "700", color: c.foreground },
    chatEmptyText: { fontSize: 12, color: c.mutedForeground, textAlign: "center", lineHeight: 18 },
    chatBubble: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      maxWidth: "85%",
    },
    chatBubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: "#38bdf8",
      borderBottomRightRadius: 4,
    },
    chatBubbleBot: {
      alignSelf: "flex-start",
      backgroundColor: c.surfaceGlass,
      borderColor: c.surfaceGlassBorder,
      borderWidth: 1,
      borderBottomLeftRadius: 4,
    },
    chatTextUser: { fontSize: 13, color: "#0f172a", lineHeight: 18 },
    chatTextBot: { fontSize: 13, color: c.foreground, lineHeight: 18 },
    chatComposer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    chatInputWrap: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    chatInput: { fontSize: 14, color: c.foreground, maxHeight: 80 },
    chatSendBtn: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: "#38bdf8",
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
