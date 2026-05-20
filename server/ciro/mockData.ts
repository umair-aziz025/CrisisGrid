export type SignalSource = {
  id: string;
  type: "social" | "weather" | "traffic" | "sensor" | "field_report" | "emergency_call";
  label: string;
  content: string;
  location: string;
  lat: number;
  lng: number;
  timestamp: string;
  credibilityScore: number;
  raw?: Record<string, unknown>;
};

export type CIROScenario = {
  id: string;
  name: string;
  description: string;
  signals: SignalSource[];
  resources: {
    ambulances: number;
    rescueTeams: number;
    trafficPolice: number;
    medics: number;
  };
};

const now = new Date().toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

export const SCENARIOS: Record<string, CIROScenario> = {
  flood: {
    id: "flood",
    name: "Urban Flooding — G-10 Islamabad",
    description:
      "Multiple signals indicate severe flooding in G-10 sector. One field report contradicts social media panic.",
    resources: { ambulances: 4, rescueTeams: 3, trafficPolice: 6, medics: 8 },
    signals: [
      {
        id: "sig-001",
        type: "social",
        label: "Twitter/X — Citizen Post",
        content:
          "G-10 mein pani bhar gaya hai! Road bilkul band hai, cars doob rahi hain. HELP!! #IslamabadFloods",
        location: "G-10/1, Islamabad",
        lat: 33.6929,
        lng: 73.0283,
        timestamp: minsAgo(8),
        credibilityScore: 0.62,
        raw: { likes: 312, retweets: 87, verified: false },
      },
      {
        id: "sig-002",
        type: "weather",
        label: "Pakistan Met Department — Live Feed",
        content:
          "Extreme rainfall warning active: 94mm/hr recorded at Islamabad stations. Urban flash flood risk: CRITICAL. Sectors G-9 through G-11 in high-risk zone.",
        location: "Islamabad Metropolitan",
        lat: 33.6844,
        lng: 73.0479,
        timestamp: minsAgo(5),
        credibilityScore: 0.97,
        raw: { rainfallMmHr: 94, windKmh: 45, humidity: 98 },
      },
      {
        id: "sig-003",
        type: "traffic",
        label: "Google Maps Traffic API",
        content:
          "Severe congestion detected on G-10 Markaz road. Multiple roads showing zero movement. Estimated clearance: 3+ hours.",
        location: "G-10 Markaz",
        lat: 33.6912,
        lng: 73.031,
        timestamp: minsAgo(3),
        credibilityScore: 0.91,
        raw: { congestionLevel: "extreme", affectedRoads: 7, avgSpeed: 0 },
      },
      {
        id: "sig-004",
        type: "field_report",
        label: "CDMA Field Officer Report",
        content:
          "Confirmed: G-10/2 main drain blocked causing water accumulation. NOT a river flood — localized water main + drain overflow. Estimated 40cm water depth in low-lying areas. Civil Works team alerted.",
        location: "G-10/2, Islamabad",
        lat: 33.6935,
        lng: 73.027,
        timestamp: minsAgo(12),
        credibilityScore: 0.88,
        raw: { officerId: "FO-114", waterDepthCm: 40, drainBlocked: true },
      },
      {
        id: "sig-005",
        type: "emergency_call",
        label: "Rescue 1122 — Call Log",
        content:
          "12 emergency calls received from G-10 sector in past 20 minutes. Reports: stranded vehicles, flooded ground floors, elderly residents trapped.",
        location: "G-10 Sector",
        lat: 33.692,
        lng: 73.029,
        timestamp: minsAgo(6),
        credibilityScore: 0.95,
        raw: { callCount: 12, trappedPersons: 7, vehiclesStranded: 15 },
      },
    ],
  },

  multi_crisis: {
    id: "multi_crisis",
    name: "Simultaneous Crises — Flood + Heatwave",
    description:
      "Two concurrent crises stress-test resource allocation: Flooding in G-10 and extreme heatwave casualties in F-8.",
    resources: { ambulances: 3, rescueTeams: 2, trafficPolice: 5, medics: 6 },
    signals: [
      {
        id: "mc-001",
        type: "social",
        label: "Twitter — G-10 Flood Reports",
        content:
          "G-10 mein pani bhar gaya, relief chahiye! 8 log phanse hain aik ghar mein. #G10Flood",
        location: "G-10, Islamabad",
        lat: 33.693,
        lng: 73.028,
        timestamp: minsAgo(10),
        credibilityScore: 0.71,
        raw: { trappedCount: 8 },
      },
      {
        id: "mc-002",
        type: "weather",
        label: "Met Department — Heat Index Alert",
        content:
          "F-8 sector heat index reached 51°C at 14:30. Three confirmed heatstroke fatalities reported at PIMS hospital. Heatwave continues for next 48 hours.",
        location: "F-8, Islamabad",
        lat: 33.7215,
        lng: 72.9983,
        timestamp: minsAgo(15),
        credibilityScore: 0.96,
        raw: { heatIndexC: 51, fatalities: 3, hospitalAdmissions: 22 },
      },
      {
        id: "mc-003",
        type: "emergency_call",
        label: "Rescue 1122 — Multi-location Calls",
        content:
          "Calls split: 14 from G-10 (flood/stranded), 9 from F-8 (heatstroke, medical). Resources severely stretched.",
        location: "Multiple Sectors",
        lat: 33.71,
        lng: 73.01,
        timestamp: minsAgo(4),
        credibilityScore: 0.94,
        raw: { g10Calls: 14, f8Calls: 9, totalUnits: 3 },
      },
      {
        id: "mc-004",
        type: "traffic",
        label: "Traffic Management — Live",
        content:
          "Routes between G-10 and F-8 partially blocked. Emergency vehicles rerouted via Srinagar Highway adding 18min transit time.",
        location: "Islamabad Road Network",
        lat: 33.707,
        lng: 73.013,
        timestamp: minsAgo(7),
        credibilityScore: 0.89,
        raw: { detourMinutes: 18, blockedRoutes: 3 },
      },
    ],
  },

  false_alarm: {
    id: "false_alarm",
    name: "False Alarm — Panic vs Field Verification",
    description:
      "Social media reports a building collapse, but field verification reveals a different (smaller) incident.",
    resources: { ambulances: 5, rescueTeams: 4, trafficPolice: 4, medics: 10 },
    signals: [
      {
        id: "fa-001",
        type: "social",
        label: "Twitter — Viral Panic Post",
        content:
          "BREAKING: 10-story building collapsed in I-8! Hundreds may be trapped! Video shows massive dust cloud! #IslamabadCollapse #Emergency",
        location: "I-8 Markaz",
        lat: 33.6627,
        lng: 73.0834,
        timestamp: minsAgo(18),
        credibilityScore: 0.38,
        raw: { shares: 4200, source: "unverified_account", videoUnverified: true },
      },
      {
        id: "fa-002",
        type: "social",
        label: "Twitter — Secondary Reports",
        content:
          "Confirmed building collapse I-8! Police on scene, ambulances coming. #I8Collapse",
        location: "I-8",
        lat: 33.663,
        lng: 73.0837,
        timestamp: minsAgo(16),
        credibilityScore: 0.41,
        raw: { shares: 1800, linkedToFa001: true },
      },
      {
        id: "fa-003",
        type: "field_report",
        label: "Police Control Room — Verified",
        content:
          "Officers on scene I-8/2. NO building collapse. Construction scaffolding partial collapse, 2 workers injured, no fatalities. Dust from construction site caused viral confusion. Major incident NEGATED.",
        location: "I-8/2, Plot 34",
        lat: 33.6631,
        lng: 73.0839,
        timestamp: minsAgo(9),
        credibilityScore: 0.97,
        raw: { officersOnScene: 4, injuredPersons: 2, fatalities: 0, collapsed: false },
      },
      {
        id: "fa-004",
        type: "emergency_call",
        label: "Rescue 1122 — On-site Report",
        content:
          "Two construction workers with minor fractures. Scene secured. Ambulance dispatched but full rescue deployment NOT required. Downgrading to Level 1 medical response only.",
        location: "I-8/2",
        lat: 33.663,
        lng: 73.0838,
        timestamp: minsAgo(7),
        credibilityScore: 0.93,
        raw: { injuredCount: 2, severity: "minor", downgraded: true },
      },
    ],
  },

  degraded: {
    id: "degraded",
    name: "Degraded Mode — API Failure Fallback",
    description:
      "Traffic API goes offline mid-response. Agents must use cached data and fallback logic to continue crisis management.",
    resources: { ambulances: 4, rescueTeams: 3, trafficPolice: 5, medics: 7 },
    signals: [
      {
        id: "dg-001",
        type: "social",
        label: "Twitter — Road Blockage",
        content: "Aabpara Chowk mein truck ka accident. Road completely blocked. #Islamabad",
        location: "Aabpara Chowk",
        lat: 33.7294,
        lng: 73.0881,
        timestamp: minsAgo(12),
        credibilityScore: 0.69,
      },
      {
        id: "dg-002",
        type: "traffic",
        label: "NTRC Traffic API — OFFLINE",
        content:
          "[API_ERROR 503] Traffic data feed unavailable. Last successful pull: 18 minutes ago. Using cached data from previous snapshot.",
        location: "Islamabad",
        lat: 33.7294,
        lng: 73.0881,
        timestamp: minsAgo(18),
        credibilityScore: 0.4,
        raw: { status: "OFFLINE", cachedDataAge: 18, errorCode: 503 },
      },
      {
        id: "dg-003",
        type: "emergency_call",
        label: "Rescue 1122 — Accident Report",
        content:
          "Truck vs. two cars collision at Aabpara. 4 injured, 1 critical. Ambulance dispatched but route guidance affected by traffic API outage.",
        location: "Aabpara Chowk",
        lat: 33.7291,
        lng: 73.0878,
        timestamp: minsAgo(8),
        credibilityScore: 0.95,
        raw: { injured: 4, critical: 1, trafficApiDown: true },
      },
      {
        id: "dg-004",
        type: "sensor",
        label: "CCTV Monitoring — Control Room",
        content:
          "Visual confirmation: heavy debris on road, 3-lane blockage. Alternate via Margalla Road clear (CCTV feed stable). Recommending manual reroute.",
        location: "Aabpara — Control Room Feed",
        lat: 33.7295,
        lng: 73.088,
        timestamp: minsAgo(6),
        credibilityScore: 0.87,
        raw: { cctvId: "CAM-088", lanesBlocked: 3, alternateRoute: "Margalla Road" },
      },
    ],
  },
};
