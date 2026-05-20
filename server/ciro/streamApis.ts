import { Router } from "express";
import type { SignalSource } from "./mockData.js";

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const secsAgo = (s: number) => new Date(Date.now() - s * 1000).toISOString();

// ── Simulated API failure state for "degraded" scenario ──────────────────────
const apiFailureState: Record<string, { offline: boolean; since: number }> = {};

function isApiOffline(apiName: string): boolean {
  const state = apiFailureState[apiName];
  if (!state) return false;
  // Auto-recover after 120 seconds
  if (Date.now() - state.since > 120_000) {
    delete apiFailureState[apiName];
    return false;
  }
  return state.offline;
}

// Inject simulated API latency (realistic variance)
function simulatedLatency(base: number, jitter: number): Promise<void> {
  const delay = base + Math.random() * jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ─────────────────────────────────────────────────────────────────────────────
// WEATHER SIGNAL API
// Simulates: Pakistan Met Department / OpenWeatherMap-style feed
// ─────────────────────────────────────────────────────────────────────────────
function weatherSignals(scenario: string): SignalSource[] {
  const base: Record<string, SignalSource[]> = {
    flood: [
      {
        id: `wx-${Date.now()}-001`,
        type: "weather",
        label: "Pakistan Met Department — Live Feed",
        content: `Extreme rainfall warning active: ${82 + Math.round(Math.random() * 20)}mm/hr recorded at Islamabad stations. Urban flash flood risk: CRITICAL. Sectors G-9 through G-11 in high-risk zone.`,
        location: "Islamabad Metropolitan",
        lat: 33.6844,
        lng: 73.0479,
        timestamp: secsAgo(Math.floor(Math.random() * 120 + 60)),
        credibilityScore: 0.94 + Math.random() * 0.05,
        raw: {
          rainfallMmHr: 82 + Math.round(Math.random() * 20),
          windKmh: 40 + Math.round(Math.random() * 15),
          humidity: 95 + Math.round(Math.random() * 5),
          source: "PMD_LIVE_API",
          stationId: "ISB-MET-07",
          fetchedAt: new Date().toISOString(),
        },
      },
    ],
    multi_crisis: [
      {
        id: `wx-${Date.now()}-mc`,
        type: "weather",
        label: "Met Department — Heat Index Alert",
        content: `F-8 sector heat index reached ${49 + Math.round(Math.random() * 4)}°C. ${Math.floor(Math.random() * 2) + 2} confirmed heatstroke fatalities at PIMS. Heatwave persists 48h.`,
        location: "F-8, Islamabad",
        lat: 33.7215,
        lng: 72.9983,
        timestamp: minsAgo(Math.floor(Math.random() * 10 + 5)),
        credibilityScore: 0.95,
        raw: {
          heatIndexC: 49 + Math.round(Math.random() * 4),
          fatalities: Math.floor(Math.random() * 2) + 2,
          hospitalAdmissions: 18 + Math.round(Math.random() * 8),
          source: "PMD_HEAT_API",
          fetchedAt: new Date().toISOString(),
        },
      },
    ],
    false_alarm: [
      {
        id: `wx-${Date.now()}-fa`,
        type: "weather",
        label: "PMD — Dust Conditions Advisory",
        content: "Low wind advisory in I-8. Construction dust dispersal expected. No precipitation. Visibility slightly reduced.",
        location: "I-8, Islamabad",
        lat: 33.6627,
        lng: 73.0834,
        timestamp: secsAgo(90),
        credibilityScore: 0.91,
        raw: { dustIndex: "moderate", windKmh: 12, source: "PMD_ENV_API", fetchedAt: new Date().toISOString() },
      },
    ],
    degraded: [
      {
        id: `wx-${Date.now()}-dg`,
        type: "weather",
        label: "PMD — Road Conditions Feed",
        content: "Clear conditions at Aabpara Chowk. Dry road surface. No weather-related obstruction.",
        location: "Aabpara, Islamabad",
        lat: 33.7294,
        lng: 73.0881,
        timestamp: secsAgo(60),
        credibilityScore: 0.9,
        raw: { conditions: "clear", roadSurface: "dry", source: "PMD_ROAD_API", fetchedAt: new Date().toISOString() },
      },
    ],
  };
  return base[scenario] || base.flood;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC SIGNAL API
// Simulates: Google Maps Traffic API / NTRC Pakistan
// ─────────────────────────────────────────────────────────────────────────────
function trafficSignals(scenario: string): SignalSource[] {
  if (scenario === "degraded" && isApiOffline("traffic")) {
    return [
      {
        id: `tr-${Date.now()}-OFFLINE`,
        type: "traffic",
        label: "NTRC Traffic API — OFFLINE",
        content: `[API_ERROR 503] Traffic data feed unavailable. Last successful pull: ${Math.floor((Date.now() - (apiFailureState.traffic?.since || Date.now())) / 60000) + 1} minutes ago. Using cached fallback data.`,
        location: "Islamabad",
        lat: 33.7294,
        lng: 73.0881,
        timestamp: new Date(apiFailureState.traffic?.since || Date.now()).toISOString(),
        credibilityScore: 0.35,
        raw: { status: "OFFLINE", errorCode: 503, cachedDataAge: Math.floor((Date.now() - (apiFailureState.traffic?.since || Date.now())) / 60000) + 1, source: "NTRC_CACHED", fetchedAt: new Date().toISOString() },
      },
    ];
  }

  const base: Record<string, SignalSource[]> = {
    flood: [
      {
        id: `tr-${Date.now()}-001`,
        type: "traffic",
        label: "Google Maps Traffic API",
        content: `Severe congestion detected on G-10 Markaz road. ${5 + Math.round(Math.random() * 4)} roads showing zero movement. Estimated clearance: ${2 + Math.round(Math.random() * 2)}+ hours.`,
        location: "G-10 Markaz",
        lat: 33.6912,
        lng: 73.031,
        timestamp: secsAgo(Math.floor(Math.random() * 90 + 30)),
        credibilityScore: 0.88 + Math.random() * 0.06,
        raw: { congestionLevel: "extreme", affectedRoads: 5 + Math.round(Math.random() * 4), avgSpeed: Math.round(Math.random() * 3), source: "GMAPS_TRAFFIC_API", fetchedAt: new Date().toISOString() },
      },
    ],
    multi_crisis: [
      {
        id: `tr-${Date.now()}-mc`,
        type: "traffic",
        label: "Traffic Management — Live",
        content: `Routes between G-10 and F-8 partially blocked. Emergency vehicles rerouted via Srinagar Highway adding ${15 + Math.round(Math.random() * 8)}min transit time.`,
        location: "Islamabad Road Network",
        lat: 33.707,
        lng: 73.013,
        timestamp: secsAgo(Math.floor(Math.random() * 180 + 60)),
        credibilityScore: 0.87,
        raw: { detourMinutes: 15 + Math.round(Math.random() * 8), blockedRoutes: 2 + Math.round(Math.random() * 2), source: "NTRC_LIVE_API", fetchedAt: new Date().toISOString() },
      },
    ],
    false_alarm: [
      {
        id: `tr-${Date.now()}-fa`,
        type: "traffic",
        label: "NTRC Traffic — I-8 Sector",
        content: "Minor slowdown on I-8 Markaz approach. Construction zone advisory in effect. No emergency route impact.",
        location: "I-8 Markaz",
        lat: 33.6627,
        lng: 73.0834,
        timestamp: secsAgo(45),
        credibilityScore: 0.82,
        raw: { congestionLevel: "minor", cause: "construction_zone", source: "NTRC_LIVE_API", fetchedAt: new Date().toISOString() },
      },
    ],
    degraded: [
      {
        id: `tr-${Date.now()}-dg`,
        type: "traffic",
        label: "NTRC Traffic API — Live",
        content: `Complete blockage at Aabpara Chowk. Truck accident debris on ${2 + Math.round(Math.random() * 2)} lanes. Alternate via Margalla Road recommended.`,
        location: "Aabpara Chowk",
        lat: 33.7294,
        lng: 73.0881,
        timestamp: secsAgo(Math.floor(Math.random() * 120 + 30)),
        credibilityScore: 0.85,
        raw: { lanesBlocked: 2 + Math.round(Math.random() * 2), avgSpeed: 0, source: "NTRC_LIVE_API", fetchedAt: new Date().toISOString() },
      },
    ],
  };
  return base[scenario] || base.flood;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL MEDIA SIGNAL API
// Simulates: Twitter/X API v2, Facebook Graph, Citizen App
// ─────────────────────────────────────────────────────────────────────────────
function socialSignals(scenario: string): SignalSource[] {
  const base: Record<string, SignalSource[]> = {
    flood: [
      {
        id: `sm-${Date.now()}-001`,
        type: "social",
        label: "Twitter/X — Citizen Post",
        content: "G-10 mein pani bhar gaya hai! Road bilkul band hai, cars doob rahi hain. HELP!! #IslamabadFloods",
        location: "G-10/1, Islamabad",
        lat: 33.6929,
        lng: 73.0283,
        timestamp: minsAgo(Math.floor(Math.random() * 5 + 4)),
        credibilityScore: 0.58 + Math.random() * 0.12,
        raw: {
          likes: 280 + Math.round(Math.random() * 80),
          retweets: 70 + Math.round(Math.random() * 40),
          verified: false,
          mentionVelocity: "high",
          source: "TWITTER_API_V2",
          fetchedAt: new Date().toISOString(),
        },
      },
      {
        id: `sm-${Date.now()}-002`,
        type: "social",
        label: "Facebook — Community Reports",
        content: `G-10 flooding getting worse. ${8 + Math.round(Math.random() * 5)} families evacuating. Someone please alert NDMA!`,
        location: "G-10, Islamabad",
        lat: 33.692,
        lng: 73.029,
        timestamp: minsAgo(Math.floor(Math.random() * 4 + 3)),
        credibilityScore: 0.55 + Math.random() * 0.1,
        raw: { shares: 120 + Math.round(Math.random() * 60), reactions: 890, source: "FACEBOOK_GRAPH_API", fetchedAt: new Date().toISOString() },
      },
    ],
    multi_crisis: [
      {
        id: `sm-${Date.now()}-mc`,
        type: "social",
        label: "Twitter — G-10 Flood Reports",
        content: `G-10 mein pani bhar gaya, relief chahiye! ${6 + Math.round(Math.random() * 4)} log phanse hain. #G10Flood`,
        location: "G-10, Islamabad",
        lat: 33.693,
        lng: 73.028,
        timestamp: minsAgo(8 + Math.floor(Math.random() * 5)),
        credibilityScore: 0.68 + Math.random() * 0.1,
        raw: { trappedCount: 6 + Math.round(Math.random() * 4), source: "TWITTER_API_V2", fetchedAt: new Date().toISOString() },
      },
    ],
    false_alarm: [
      {
        id: `sm-${Date.now()}-fa1`,
        type: "social",
        label: "Twitter — Viral Panic Post",
        content: "BREAKING: 10-story building collapsed in I-8! Hundreds may be trapped! Video shows massive dust cloud! #IslamabadCollapse #Emergency",
        location: "I-8 Markaz",
        lat: 33.6627,
        lng: 73.0834,
        timestamp: minsAgo(16 + Math.floor(Math.random() * 5)),
        credibilityScore: 0.32 + Math.random() * 0.1,
        raw: { shares: 3800 + Math.round(Math.random() * 800), source: "unverified_account", videoUnverified: true, platform: "TWITTER_API_V2", fetchedAt: new Date().toISOString() },
      },
      {
        id: `sm-${Date.now()}-fa2`,
        type: "social",
        label: "Twitter — Secondary Reports",
        content: "Confirmed building collapse I-8! Police on scene, ambulances coming. #I8Collapse",
        location: "I-8",
        lat: 33.663,
        lng: 73.0837,
        timestamp: minsAgo(14 + Math.floor(Math.random() * 4)),
        credibilityScore: 0.38 + Math.random() * 0.08,
        raw: { shares: 1500 + Math.round(Math.random() * 600), linkedToOriginPost: true, source: "TWITTER_API_V2", fetchedAt: new Date().toISOString() },
      },
    ],
    degraded: [
      {
        id: `sm-${Date.now()}-dg`,
        type: "social",
        label: "Twitter — Road Blockage",
        content: "Aabpara Chowk mein truck ka accident. Road completely blocked. #Islamabad",
        location: "Aabpara Chowk",
        lat: 33.7294,
        lng: 73.0881,
        timestamp: minsAgo(10 + Math.floor(Math.random() * 5)),
        credibilityScore: 0.65 + Math.random() * 0.1,
        raw: { likes: 42, retweets: 18, source: "TWITTER_API_V2", fetchedAt: new Date().toISOString() },
      },
    ],
  };
  return base[scenario] || base.flood;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY CALLS API
// Simulates: Rescue 1122 / Police 15 call log feed
// ─────────────────────────────────────────────────────────────────────────────
function emergencyCallSignals(scenario: string): SignalSource[] {
  const base: Record<string, SignalSource[]> = {
    flood: [
      {
        id: `ec-${Date.now()}-001`,
        type: "emergency_call",
        label: "Rescue 1122 — Call Log",
        content: `${10 + Math.round(Math.random() * 5)} emergency calls received from G-10 sector in past 20 minutes. Reports: stranded vehicles, flooded ground floors, elderly residents trapped.`,
        location: "G-10 Sector",
        lat: 33.692,
        lng: 73.029,
        timestamp: secsAgo(Math.floor(Math.random() * 120 + 90)),
        credibilityScore: 0.93 + Math.random() * 0.05,
        raw: {
          callCount: 10 + Math.round(Math.random() * 5),
          trappedPersons: 5 + Math.round(Math.random() * 4),
          vehiclesStranded: 12 + Math.round(Math.random() * 6),
          source: "RESCUE1122_API",
          callcenterId: "ISB-CC-01",
          fetchedAt: new Date().toISOString(),
        },
      },
    ],
    multi_crisis: [
      {
        id: `ec-${Date.now()}-mc`,
        type: "emergency_call",
        label: "Rescue 1122 — Multi-location Calls",
        content: `Calls split: ${12 + Math.round(Math.random() * 5)} from G-10 (flood/stranded), ${7 + Math.round(Math.random() * 4)} from F-8 (heatstroke, medical). Resources severely stretched.`,
        location: "Multiple Sectors",
        lat: 33.71,
        lng: 73.01,
        timestamp: secsAgo(Math.floor(Math.random() * 90 + 60)),
        credibilityScore: 0.93,
        raw: {
          g10Calls: 12 + Math.round(Math.random() * 5),
          f8Calls: 7 + Math.round(Math.random() * 4),
          totalUnits: 3,
          source: "RESCUE1122_API",
          fetchedAt: new Date().toISOString(),
        },
      },
    ],
    false_alarm: [
      {
        id: `ec-${Date.now()}-fa`,
        type: "emergency_call",
        label: "Rescue 1122 — On-site Report",
        content: "Two construction workers with minor fractures. Scene secured. Full rescue NOT required. Downgrading to Level 1 medical response.",
        location: "I-8/2",
        lat: 33.663,
        lng: 73.0838,
        timestamp: secsAgo(Math.floor(Math.random() * 90 + 60)),
        credibilityScore: 0.94,
        raw: { injuredCount: 2, severity: "minor", downgraded: true, source: "RESCUE1122_API", fetchedAt: new Date().toISOString() },
      },
    ],
    degraded: [
      {
        id: `ec-${Date.now()}-dg`,
        type: "emergency_call",
        label: "Rescue 1122 — Accident Report",
        content: `Truck vs. ${1 + Math.round(Math.random() * 2)} cars collision at Aabpara. ${3 + Math.round(Math.random() * 2)} injured, 1 critical. Route guidance affected by traffic API outage.`,
        location: "Aabpara Chowk",
        lat: 33.7291,
        lng: 73.0878,
        timestamp: secsAgo(Math.floor(Math.random() * 120 + 60)),
        credibilityScore: 0.94,
        raw: { injured: 3 + Math.round(Math.random() * 2), critical: 1, trafficApiDown: true, source: "RESCUE1122_API", fetchedAt: new Date().toISOString() },
      },
    ],
  };
  return base[scenario] || base.flood;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD REPORTS API
// Simulates: CDMA / Police Control Room officer submissions
// ─────────────────────────────────────────────────────────────────────────────
function fieldReportSignals(scenario: string): SignalSource[] {
  const base: Record<string, SignalSource[]> = {
    flood: [
      {
        id: `fr-${Date.now()}-001`,
        type: "field_report",
        label: "CDMA Field Officer Report",
        content: `Confirmed: G-10/2 main drain blocked causing water accumulation. NOT a river flood — localized drain overflow. Estimated ${35 + Math.round(Math.random() * 15)}cm water depth in low-lying areas.`,
        location: "G-10/2, Islamabad",
        lat: 33.6935,
        lng: 73.027,
        timestamp: minsAgo(10 + Math.floor(Math.random() * 5)),
        credibilityScore: 0.86 + Math.random() * 0.06,
        raw: {
          officerId: `FO-${100 + Math.round(Math.random() * 50)}`,
          waterDepthCm: 35 + Math.round(Math.random() * 15),
          drainBlocked: true,
          source: "CDMA_FIELD_API",
          gpsAccuracyM: 8,
          fetchedAt: new Date().toISOString(),
        },
      },
    ],
    multi_crisis: [],
    false_alarm: [
      {
        id: `fr-${Date.now()}-fa`,
        type: "field_report",
        label: "Police Control Room — Verified",
        content: "Officers on scene I-8/2. NO building collapse. Construction scaffolding partial collapse, 2 workers injured, no fatalities. Dust from construction site caused viral confusion. Major incident NEGATED.",
        location: "I-8/2, Plot 34",
        lat: 33.6631,
        lng: 73.0839,
        timestamp: minsAgo(7 + Math.floor(Math.random() * 3)),
        credibilityScore: 0.97,
        raw: { officersOnScene: 4, injuredPersons: 2, fatalities: 0, collapsed: false, source: "POLICE_FIELD_API", fetchedAt: new Date().toISOString() },
      },
    ],
    degraded: [],
  };
  return base[scenario] || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSOR API
// Simulates: CCTV Control Room / IoT water level / environmental sensors
// ─────────────────────────────────────────────────────────────────────────────
function sensorSignals(scenario: string): SignalSource[] {
  const base: Record<string, SignalSource[]> = {
    flood: [
      {
        id: `sn-${Date.now()}-001`,
        type: "sensor",
        label: "IoT Water Level Sensor — G-10 Storm Drain",
        content: `Water level at G-10 storm drain: ${180 + Math.round(Math.random() * 40)}% of capacity. Overflow imminent. Sensor last calibrated 2 days ago.`,
        location: "G-10/3, Storm Drain Node 4",
        lat: 33.6925,
        lng: 73.0295,
        timestamp: secsAgo(Math.floor(Math.random() * 60 + 20)),
        credibilityScore: 0.82,
        raw: { waterLevelPct: 180 + Math.round(Math.random() * 40), sensorId: "WLS-G10-04", batteryPct: 67, source: "IOT_SENSOR_API", fetchedAt: new Date().toISOString() },
      },
    ],
    multi_crisis: [],
    false_alarm: [],
    degraded: [
      {
        id: `sn-${Date.now()}-dg`,
        type: "sensor",
        label: "CCTV Monitoring — Control Room",
        content: "Visual confirmation: heavy debris on road, 3-lane blockage. Alternate via Margalla Road clear. Recommending manual reroute.",
        location: "Aabpara — Control Room Feed",
        lat: 33.7295,
        lng: 73.088,
        timestamp: secsAgo(Math.floor(Math.random() * 90 + 30)),
        credibilityScore: 0.87,
        raw: { cctvId: `CAM-${80 + Math.round(Math.random() * 20)}`, lanesBlocked: 3, alternateRoute: "Margalla Road", source: "CCTV_SENSOR_API", fetchedAt: new Date().toISOString() },
      },
    ],
  };
  return base[scenario] || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Request/Response Logger
// ─────────────────────────────────────────────────────────────────────────────
function logApiRequest(endpoint: string, params: Record<string, string>, signalCount: number, latencyMs: number, status: "ok" | "error" | "cached") {
  console.log(`[SIGNAL_API][${status.toUpperCase()}] ${endpoint} | scenario=${params.scenario} | signals=${signalCount} | latency=${latencyMs}ms | ts=${new Date().toISOString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAM API ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export function createSignalStreamRoutes(): Router {
  const router = Router();

  // GET /api/signals/weather
  router.get("/api/signals/weather", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";
    await simulatedLatency(120, 80);
    const signals = weatherSignals(scenario);
    const latency = Date.now() - t0;
    logApiRequest("/api/signals/weather", { scenario }, signals.length, latency, "ok");
    res.json({ source: "weather", scenario, signals, fetchedAt: new Date().toISOString(), latencyMs: latency, apiVersion: "v2.1" });
  });

  // GET /api/signals/traffic
  router.get("/api/signals/traffic", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";

    // Degrade traffic API for "degraded" scenario
    if (scenario === "degraded" && !apiFailureState.traffic) {
      apiFailureState.traffic = { offline: true, since: Date.now() };
      console.log(`[SIGNAL_API][FAULT_INJECT] Traffic API set OFFLINE for degraded scenario at ${new Date().toISOString()}`);
    }

    if (scenario === "degraded" && isApiOffline("traffic")) {
      await simulatedLatency(2000, 500); // extra latency for timeout
      const latency = Date.now() - t0;
      const cached = trafficSignals(scenario);
      logApiRequest("/api/signals/traffic", { scenario }, cached.length, latency, "cached");
      return res.status(503).json({
        source: "traffic",
        scenario,
        signals: cached,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
        error: "API_OFFLINE_503",
        fallback: "cached_snapshot",
        cacheAgeMinutes: Math.floor((Date.now() - (apiFailureState.traffic?.since || Date.now())) / 60000) + 1,
      });
    }

    await simulatedLatency(150, 100);
    const signals = trafficSignals(scenario);
    const latency = Date.now() - t0;
    logApiRequest("/api/signals/traffic", { scenario }, signals.length, latency, "ok");
    res.json({ source: "traffic", scenario, signals, fetchedAt: new Date().toISOString(), latencyMs: latency, apiVersion: "v3.0" });
  });

  // GET /api/signals/social
  router.get("/api/signals/social", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";
    await simulatedLatency(200, 150);
    const signals = socialSignals(scenario);
    const latency = Date.now() - t0;
    logApiRequest("/api/signals/social", { scenario }, signals.length, latency, "ok");
    res.json({ source: "social_media", scenario, signals, fetchedAt: new Date().toISOString(), latencyMs: latency, rateLimitRemaining: 480 - Math.round(Math.random() * 50) });
  });

  // GET /api/signals/emergency-calls
  router.get("/api/signals/emergency-calls", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";
    await simulatedLatency(100, 60);
    const signals = emergencyCallSignals(scenario);
    const latency = Date.now() - t0;
    logApiRequest("/api/signals/emergency-calls", { scenario }, signals.length, latency, "ok");
    res.json({ source: "emergency_calls", scenario, signals, fetchedAt: new Date().toISOString(), latencyMs: latency, dispatchCenterId: "ISB-CC-01" });
  });

  // GET /api/signals/field-reports
  router.get("/api/signals/field-reports", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";
    await simulatedLatency(80, 40);
    const signals = fieldReportSignals(scenario);
    const latency = Date.now() - t0;
    logApiRequest("/api/signals/field-reports", { scenario }, signals.length, latency, "ok");
    res.json({ source: "field_reports", scenario, signals, fetchedAt: new Date().toISOString(), latencyMs: latency });
  });

  // GET /api/signals/sensors
  router.get("/api/signals/sensors", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";
    await simulatedLatency(60, 40);
    const signals = sensorSignals(scenario);
    const latency = Date.now() - t0;
    logApiRequest("/api/signals/sensors", { scenario }, signals.length, latency, "ok");
    res.json({ source: "sensors", scenario, signals, fetchedAt: new Date().toISOString(), latencyMs: latency, sensorNetworkId: "CIRO-IOT-NET-01" });
  });

  // GET /api/signals/ingest?scenario= — aggregates ALL sources (used by agents)
  router.get("/api/signals/ingest", async (req, res) => {
    const t0 = Date.now();
    const scenario = (req.query.scenario as string) || "flood";

    console.log(`[SIGNAL_API][INGEST_START] Fetching all signal sources for scenario=${scenario} at ${new Date().toISOString()}`);

    const sources = ["weather", "traffic", "social", "emergency-calls", "field-reports", "sensors"];
    const sourceResults: Array<{ source: string; signals: SignalSource[]; latencyMs: number; error?: string; fallback?: string }> = [];

    for (const src of sources) {
      const srcT0 = Date.now();
      try {
        // Simulate per-source latency inline (mirrors what /api/signals/* endpoints do)
        const signals: SignalSource[] = await (async () => {
          if (src === "weather") { await simulatedLatency(120, 80); return weatherSignals(scenario); }
          if (src === "traffic") {
            if (scenario === "degraded" && !apiFailureState.traffic) {
              apiFailureState.traffic = { offline: true, since: Date.now() };
            }
            if (scenario === "degraded" && isApiOffline("traffic")) {
              await simulatedLatency(2000, 500);
              return trafficSignals(scenario); // returns OFFLINE signal
            }
            await simulatedLatency(150, 100); return trafficSignals(scenario);
          }
          if (src === "social") { await simulatedLatency(200, 150); return socialSignals(scenario); }
          if (src === "emergency-calls") { await simulatedLatency(100, 60); return emergencyCallSignals(scenario); }
          if (src === "field-reports") { await simulatedLatency(80, 40); return fieldReportSignals(scenario); }
          if (src === "sensors") { await simulatedLatency(60, 40); return sensorSignals(scenario); }
          return [];
        })();
        const srcLatency = Date.now() - srcT0;
        sourceResults.push({ source: src, signals, latencyMs: srcLatency });
        logApiRequest(`/api/signals/${src}`, { scenario }, signals.length, srcLatency, isApiOffline(src) ? "cached" : "ok");
      } catch (err) {
        const srcLatency = Date.now() - srcT0;
        console.error(`[SIGNAL_API][ERROR] Source ${src} failed: ${err}`);
        sourceResults.push({ source: src, signals: [], latencyMs: srcLatency, error: String(err) });
        logApiRequest(`/api/signals/${src}`, { scenario }, 0, srcLatency, "error");
      }
    }

    const allSignals = sourceResults.flatMap((r) => r.signals);
    const totalLatency = Date.now() - t0;

    console.log(`[SIGNAL_API][INGEST_COMPLETE] scenario=${scenario} | totalSignals=${allSignals.length} | totalLatency=${totalLatency}ms | sources=${sourceResults.map(r => `${r.source}:${r.signals.length}`).join(", ")}`);

    res.json({
      scenario,
      totalSignals: allSignals.length,
      signals: allSignals,
      sourceBreakdown: sourceResults.map((r) => ({
        source: r.source,
        signalCount: r.signals.length,
        latencyMs: r.latencyMs,
        status: r.error ? "error" : r.fallback ? "cached" : "ok",
        ...(r.error && { error: r.error }),
        ...(r.fallback && { fallback: r.fallback }),
      })),
      fetchedAt: new Date().toISOString(),
      totalLatencyMs: totalLatency,
    });
  });

  // GET /api/signals/status — health check for all signal APIs
  router.get("/api/signals/status", (_req, res) => {
    res.json({
      apis: {
        weather: { status: "online", provider: "Pakistan Met Department (simulated)", latencyMs: "~120-200ms" },
        traffic: { status: isApiOffline("traffic") ? "offline" : "online", provider: "NTRC / Google Maps (simulated)", latencyMs: isApiOffline("traffic") ? "2000-2500ms (timeout)" : "~150-250ms" },
        social: { status: "online", provider: "Twitter/X API v2, Facebook Graph (simulated)", latencyMs: "~200-350ms" },
        emergency_calls: { status: "online", provider: "Rescue 1122 CAD System (simulated)", latencyMs: "~100-160ms" },
        field_reports: { status: "online", provider: "CDMA / Police Control Room (simulated)", latencyMs: "~80-120ms" },
        sensors: { status: "online", provider: "IoT Sensor Network / CCTV Feed (simulated)", latencyMs: "~60-100ms" },
      },
      note: "All APIs are synthetic/simulated. Data is dynamically generated with realistic variance and timestamps.",
      checkedAt: new Date().toISOString(),
    });
  });

  return router;
}

export { simulatedLatency };
