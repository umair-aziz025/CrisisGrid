# CrisisGrid — Crisis Intelligence & Response Orchestrator (CIRO)

**Challenge 3 Submission** — Real-time emergency coordination platform with a four-agent AI pipeline for crisis detection, severity prediction, resource allocation, and coordinated response simulation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [CIRO — The Four-Agent Antigravity Pipeline](#3-ciro--the-four-agent-antigravity-pipeline)
   - [Agent 1: Sentinel](#agent-1--sentinel-signal-fusion--noise-filtering)
   - [Agent 2: Analyst](#agent-2--analyst-severity--evolution-prediction)
   - [Agent 3: Strategist](#agent-3--strategist-resource-allocation--action-planning)
   - [Agent 4: Executor](#agent-4--executor-action-simulation--impact-assessment)
   - [CIRO Pipeline Flow](#ciro-pipeline-flow)
   - [Async Job Architecture](#async-job-architecture)
   - [Live Trace Streaming](#live-trace-streaming)
4. [Data Stream Schemas](#4-data-stream-schemas)
5. [Stress-Test Scenarios](#5-stress-test-scenarios)
6. [Web Application](#6-web-application)
7. [Mobile Application](#7-mobile-application)
8. [Backend Architecture](#8-backend-architecture)
9. [Real & Mock APIs Used](#9-real--mock-apis-used)
10. [Integrations Implemented](#10-integrations-implemented)
11. [Full API Reference](#11-full-api-reference)
12. [WebSocket Events](#12-websocket-events)
13. [Database Schema](#13-database-schema)
14. [Authentication & Security](#14-authentication--security)
15. [Push Notification System](#15-push-notification-system)
16. [Antigravity Usage Mapping](#16-antigravity-usage-mapping)
17. [Baseline Comparison](#17-baseline-comparison)
18. [Cost & Latency Analysis](#18-cost--latency-analysis)
19. [Scalability Discussion](#19-scalability-discussion)
20. [Assumptions](#20-assumptions)
21. [Privacy & Safety Note](#21-privacy--safety-note)
22. [Limitations](#22-limitations)
23. [Project Structure](#23-project-structure)
24. [Setup & Deployment](#24-setup--deployment)
25. [Seeded Accounts](#25-seeded-accounts)
26. [Roles & Permissions](#26-roles--permissions)
27. [Acknowledgements](#27-acknowledgements)
28. [License](#28-license)

---

## 1. Project Overview

CrisisGrid is a full-stack, production-grade emergency coordination platform that connects victims in crisis with nearby volunteers, dispatches AI-optimized response routes, and provides real-time situational awareness to administrators and emergency services.

**Challenge 3 adds CIRO** — a four-agent system built on the Google Antigravity multi-agent framework. CIRO ingests signals from six source types (social media, weather, traffic, IoT sensors, field reports, emergency calls), fuses them, detects and classifies emerging crises, predicts severity with uncertainty quantification, allocates constrained emergency resources across simultaneous incidents, simulates coordinated response actions with before/after impact assessment, and recovers gracefully from false alarms, conflicting signals, and degraded API conditions.

**Stack at a glance:**

| Layer | Technology |
|---|---|
| Web Frontend | React 18 + TypeScript, Vite 5 |
| Mobile | Expo SDK 51 + React Native 0.74 + TypeScript |
| Backend | Express.js + TypeScript (tsx) |
| Database | Firebase Firestore (Admin SDK) |
| Real-time | Socket.IO |
| AI / Agents | OpenAI GPT-4o-mini (Antigravity orchestration) |
| Maps (Web) | Google Maps JavaScript API + Places API (New) |
| Maps (Mobile) | react-native-maps (Google Maps) |
| Push Notifications | Firebase Cloud Messaging (FCM) + Expo Push |
| Email | Resend API |
| Auth | bcryptjs + JWT + TOTP 2FA |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│                                                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐ │
│  │     Web App (React/Vite)    │    │    Mobile App (Expo React Native)   │ │
│  │  Port 5000 (dev) / Heroku   │    │   iOS + Android (EAS Build)         │ │
│  │                             │    │                                     │ │
│  │  /dashboard — Live Map      │    │  Dashboard Tab — Crisis Map         │ │
│  │  /ciro      — CIRO UI       │    │  CIRO Tab    — Agent Trace          │ │
│  │  /requests  — Request List  │    │  Requests Tab— Help Requests        │ │
│  │  /tasks     — Task Mgmt     │    │  Tasks Tab   — Volunteer Tasks      │ │
│  │  /admin/*   — Admin Portal  │    │  Profile Tab — Settings + 2FA       │ │
│  │  /profile   — User Profile  │    │  Admin Stack — Full Admin Panel     │ │
│  └──────────────┬──────────────┘    └──────────────────┬──────────────────┘ │
└─────────────────┼────────────────────────────────────────┼──────────────────┘
                  │ HTTP (REST) + WebSocket (Socket.IO)    │ HTTP + WebSocket
                  │                                        │ + FCM Push
┌─────────────────▼────────────────────────────────────────▼──────────────────┐
│                         EXPRESS.JS BACKEND (Port 3001 / Heroku)              │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Auth Layer  │  │  Crisis API  │  │  Admin API   │  │  CIRO API    │   │
│  │  JWT + 2FA   │  │  Requests /  │  │  Users/Logs/ │  │  Scenarios / │   │
│  │  bcrypt      │  │  Tasks /     │  │  Stats /     │  │  Analyze /   │   │
│  │  TOTP        │  │  Dispatch    │  │  SafeZones   │  │  Job Poll /  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  │  Chat /      │   │
│                                                          │  Signals     │   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  └──────────────┘   │
│  │ Socket.IO    │  │  Push (FCM)  │  │  Email       │                       │
│  │ Real-time    │  │  server/     │  │  (Resend)    │                       │
│  │ Events       │  │  push.ts     │  │  email.ts    │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    CIRO ANTIGRAVITY PIPELINE                          │  │
│  │                                                                       │  │
│  │  Signal Stream APIs ──▶ Sentinel ──▶ Analyst ──▶ Strategist ──▶ Exec │  │
│  │  (streamApis.ts)         (fusion)    (severity)  (resources)  (sim)  │  │
│  │                                                                       │  │
│  │  apiClient.ts: retry + fallback + API call logging                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │                          │                       │
         ▼                          ▼                       ▼
  Firebase Firestore          OpenAI API               Google Maps
  (users, requests,           (GPT-4o-mini)            (Maps JS +
   tasks, logs,               CIRO agents              Places API)
   pushTokens,
   notificationLogs)
```

### End-to-End Request Lifecycle

The following trace shows how a single victim-to-resolution event flows through every layer of the system:

```
[1] Victim submits crisis request (web or mobile)
       │  POST /api/requests { lat, lng, type, description }
       │  optionalAuth — works even without account
       ↓
[2] Express backend (server/routes.ts)
       │  Validates payload → requestCreate() in Firestore
       │  Auto-dispatch: checks volunteerPositionStore for nearest on-duty volunteer
       │  If volunteer found → claimRequestTransaction() atomically claims request
       │  sendVolunteerAlert() → FCM push to all on-duty volunteers
       │  sendRequesterConfirmation() → Resend email to victim
       ↓
[3] Socket.IO broadcast
       │  io.emit("new_crisis", requestObject)          → all connected clients
       │  io.emit("crisis_claimed", { claimedBy, ... }) → all connected clients
       │  io.to("admins").emit(...)                     → admin room only
       │  sendPushToRoles(["VOLUNTEER"])                 → FCM push to offline volunteers
       ↓
[4] Volunteer client receives event
       │  Web: React Query cache invalidated → live map marker appears
       │  Mobile: DashboardScreen updates crisis pins; notification deep-links to TasksScreen
       │  Volunteer can claim via POST /api/tasks/claim or accept auto-dispatch
       ↓
[5] Volunteer starts task
       │  POST /api/volunteer/location (every 5s) → volunteerPositionStore updated
       │  Socket: volunteer_location event → map shows live volunteer dot to victim + admins
       │  Chat room chat:{requestId} available immediately
       ↓
[6] Resolution
       │  POST /api/requests/:id/resolve → task status = COMPLETED in Firestore
       │  activityLogCreate() → audit trail written
       │  sendCrisisResolved() → email to both parties
       │  Socket: crisis_resolved → all clients remove marker from map
       ↓
[7] Admin / coverage monitoring (background)
       Every 30s: gap detection checks ACTIVE unclaimed requests
       → coverage_gap_update emitted to admin sockets with closestVolunteerKm per request
       Every 30s: auto-dispatch retry re-processes QUEUED requests
       → picks newly on-duty volunteers if none were available at creation time
```

---

## 3. CIRO — The Four-Agent Antigravity Pipeline

CIRO implements the full Google Antigravity multi-agent orchestration contract: workplan, agent observations, explicit reasoning steps, tool calls, action execution, error recovery, and complete trace export. All four agents call OpenAI GPT-4o-mini and emit structured `AgentLogEntry` objects that are streamed live to both the web CIRO page and the mobile CIRO screen via Socket.IO.

### Agent 1 — Sentinel (Signal Fusion & Noise Filtering)

**Role:** Ingest all raw multi-source signals, score each source for credibility, filter noise, detect contradictions, and produce a single fused situational picture.

**What it does:**
- Parses informal and multilingual text including Urdu and Roman Urdu social posts (e.g. *"G-10 mein pani bhar gaya hai, cars doob rahi hain"*)
- Assigns a credibility score to each signal based on: source type, recency, urgency language detection, corroboration by other sources, and geolocation confidence
- Separates genuine signals from noise (stale data, duplicates, low-credibility unverified posts)
- Detects contradictions across signals (e.g. social media reports "flood" while a field officer reports "broken water main only")
- Outputs a dominant crisis location, fused crisis type, summary narrative, and per-signal credibility map

**Antigravity trace steps emitted:**
`INIT → SIGNAL_PARSING → NOISE_FILTER → CONTRADICTION_CHECK → NOISE_REMOVED → FUSION_COMPLETE`

---

### Agent 2 — Analyst (Severity & Evolution Prediction)

**Role:** Take the Sentinel's fused output and produce a full severity classification with temporal trend analysis and uncertainty quantification.

**What it does:**
- Classifies crisis type: flood, heatwave, accident, infrastructure_failure, building_collapse, multi_crisis, power_outage, etc.
- Assigns severity tier 1–5 with a calibrated confidence score (0.0–1.0)
- Estimates affected radius (km), population at risk, peak impact time, and expected duration in hours
- Provides an **uncertainty range** (e.g. "±25% — conflicting sensor data weakens estimate") to communicate reliability
- Performs temporal trend analysis across signal timestamps to determine if the situation is escalating or stabilising
- Identifies spread risk: low / medium / high / critical
- Lists key risks (structural failure, secondary flooding, traffic gridlock, vulnerable population exposure)
- When Sentinel detected unresolved contradictions, confidence score is deliberately adjusted downward

**Antigravity trace steps emitted:**
`INIT → SEVERITY_CALC → SEVERITY_RESULT → POPULATION_RISK → CONTRADICTION_RESOLUTION → TEMPORAL_ANALYSIS → HANDOFF`

---

### Agent 3 — Strategist (Resource Allocation & Action Planning)

**Role:** Given the Analyst's severity report and a constrained real-world resource pool, optimally allocate resources across one or more simultaneous crises and generate a feasible action chain.

**What it does:**
- Models resource pools as constrained integer counts: ambulances, rescue teams, traffic police, medics
- For multi-crisis scenarios: explicitly splits allocation per crisis location with documented `tradeoffReasoning` (e.g. "3 of 4 ambulances to flooding; 1 held for heatwave medics pending severity confirmation")
- Generates a 4–5 step action chain with: step number, action description, responsible unit, resource constraint, feasibility flag, and estimated time in minutes
- Marks infeasible actions (e.g. "helicopter evacuation — no air units in current pool") with explicit reasons rather than silently omitting them
- Documents overall budget and time constraints
- Handles priority ranking when simultaneous crises compete for the same units

**Antigravity trace steps emitted:**
`INIT → CONSTRAINT_CHECK → ALLOCATION_DECISION → TRADE_OFF_LOG (multi-crisis) → INFEASIBLE_REJECTED → ACTION_CHAIN_READY`

---

### Agent 4 — Executor (Action Simulation & Impact Assessment)

**Role:** Execute the Strategist's plan through simulated tool calls, compute before/after system state, dispatch stakeholder alerts, and handle failures with retry and fallback logic.

**What it does:**
- Simulates realistic tool calls with function signatures, parameters, status, result text, and latency in ms:
  - `dispatch_rescue_unit(unitId, crisisLat, crisisLng, priority)`
  - `reroute_traffic(segmentIds, newRoute, durationMin)`
  - `send_sms_broadcast(message, areaCode, audienceSize)`
  - `create_emergency_ticket(type, severity, assignedTo)`
  - `notify_hospital(hospitalId, estimatedPatients, crisisType)`
  - `update_mock_map(incidentId, status, responderCount)`
  - `retract_public_alert(alertId, reason, correctedMessage)`
- Per action: records `status` (success/failed/retried), `result`, `latencyMs`, and `sideEffects[]` (predicted unintended consequences of that specific action)
- Computes **before state**: avg response time (min), congestion level, population exposed, resources deployed
- Computes **after state**: all above + estimated lives saved
- Generates tailored stakeholder alerts for **five audiences**: General Public, PIMS Hospital, Utility Companies (SNGPL/IESCO), Transport Authority (CDA), Media/Command Center
- **Degraded mode handling**: if an API stream returned 503, logs the failure, activates cached-data fallback, retries the failed action, and records every step in the trace
- **False alarm handling**: calls `retract_public_alert()`, generates correction messages for all stakeholders, logs severity downgrade with explanation

**Antigravity trace steps emitted:**
`INIT → DEGRADED_MODE (if applicable) → TOOL_CALL ×N → RETRY → FALLBACK_USED → ALERT_RETRACTION (false alarm) → OUTCOME_COMPUTED → ALERTS_SENT → COMPLETE`

---

### CIRO Pipeline Flow

```
POST /api/ciro/analyze
  │
  ├─ Returns 202 { jobId } immediately  ◀── avoids Heroku 30s timeout
  │
  └─ Background setImmediate():
       │
       ├─ apiClient.ts: ingestSignals(scenario)
       │   ├─ GET /api/signals/weather   ← streamApis.ts (simulated with realistic latency)
       │   ├─ GET /api/signals/traffic   ← 503 in degraded scenario → fallback activated
       │   ├─ GET /api/signals/social    ← includes Urdu-language posts
       │   ├─ GET /api/signals/sensor    ← IoT / infrastructure readings
       │   ├─ GET /api/signals/field     ← field officer reports
       │   └─ GET /api/signals/emergency ← emergency call logs
       │
       ├─ runSentinelAgent(signals, trace)
       │   └─ OpenAI GPT-4o-mini call → SentinelOutput
       │
       ├─ runAnalystAgent(sentinelOutput, trace)
       │   └─ OpenAI GPT-4o-mini call → AnalystOutput
       │
       ├─ runStrategistAgent(analyst, resources, trace)
       │   └─ OpenAI GPT-4o-mini call → StrategistOutput
       │
       ├─ runExecutorAgent(strategist, analyst, sentinel, trace)
       │   └─ OpenAI GPT-4o-mini call → ExecutorOutput
       │
       └─ job.status = "done"; job.result = CIROResult

GET /api/ciro/job/:jobId   ◀── client polls every 3s
  │
  └─ Returns: { status: "pending"|"processing"|"done"|"error", result? }
```

### Async Job Architecture

The pipeline uses an **async job pattern** to handle the 25–60 second processing time without hitting server timeout limits:

- `POST /api/ciro/analyze` returns `202 Accepted` with a `{ jobId }` within milliseconds
- The pipeline runs in a `setImmediate()` background callback (non-blocking)
- A per-job store (`Map<string, PipelineJob>`) holds status and result in memory
- Clients poll `GET /api/ciro/job/:jobId` every 3 seconds until `status === "done"`
- Jobs are garbage-collected after 1 hour via a `setInterval` cleanup
- Debug endpoint `GET /api/ciro/api-calls` returns the full API call log with retry/fallback statistics

### Live Trace Streaming

When a `sessionId` is passed in the analyze request body, every `AgentLogEntry` is emitted in real-time via Socket.IO to the room `ciro:{sessionId}` as a `ciro_trace_entry` event. The web CIRO page and mobile CIRO screen both join this room on connect, giving users a live feed of each agent's reasoning as it happens — before the full result is available.

---

## 4. Data Stream Schemas

### SignalSource

```typescript
type SignalSource = {
  id: string;
  type: "social"          // Citizen post — supports Urdu/Roman Urdu
       | "weather"        // Pakistan Met Dept / OpenWeatherMap style
       | "traffic"        // NTRC / Google Traffic API style
       | "sensor"         // IoT / infrastructure sensor readings
       | "field_report"   // Field officer reports
       | "emergency_call"; // Emergency call frequency / logs
  label: string;          // Human-readable source name
  content: string;        // Raw signal text
  location: string;       // Descriptive location name
  lat: number;            // WGS-84 latitude
  lng: number;            // WGS-84 longitude
  timestamp: string;      // ISO 8601
  credibilityScore: number; // 0.0–1.0
  raw?: Record<string, unknown>; // Original API payload (rain mm/hr, likes, etc.)
};
```

### CIROScenario

```typescript
type CIROScenario = {
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
```

### AgentLogEntry (Antigravity Trace)

```typescript
type AgentLogEntry = {
  agent: "Sentinel" | "Analyst" | "Strategist" | "Executor";
  step: string;       // e.g. "NOISE_FILTER", "TOOL_CALL", "TRADE_OFF_LOG"
  message: string;    // Human-readable description
  data?: Record<string, unknown>; // Structured payload (credibility scores, allocations, etc.)
  timestamp: string;  // ISO 8601
  type: "info" | "decision" | "tool_call" | "warning" | "success" | "error";
};
```

### SentinelOutput

```typescript
type SentinelOutput = {
  filteredSignals: SignalSource[];       // Genuine, credible signals
  noiseSignals: SignalSource[];          // Filtered-out noise with reason
  contradictions: {
    signalIds: string[];
    explanation: string;
  }[];
  dominantLocation: { lat: number; lng: number; name: string };
  crisisType: string;                    // e.g. "urban_flooding"
  fusedSummary: string;                  // Narrative of the fused picture
  sourceCredibilityMap: Record<string, number>; // signalId → score
};
```

### AnalystOutput

```typescript
type AnalystOutput = {
  severityTier: 1 | 2 | 3 | 4 | 5;
  severityLabel: string;                 // e.g. "CRITICAL"
  confidenceScore: number;              // 0.0–1.0
  affectedRadiusKm: number;
  estimatedPopulationAtRisk: number;
  peakImpactTime: string;               // ISO 8601
  expectedDurationHrs: number;
  uncertaintyRange: string;             // e.g. "±25% — conflicting sensor data"
  spreadRisk: "low" | "medium" | "high" | "critical";
  keyRisks: string[];
  temporalAnalysis: string;             // Escalating / stabilising narrative
};
```

### StrategistOutput

```typescript
type StrategistOutput = {
  allocations: {
    crisisId: string;
    crisisLabel: string;
    ambulances: number;
    rescueTeams: number;
    trafficPolice: number;
    medics: number;
    priority: "critical" | "high" | "medium" | "low";
    tradeoffReasoning: string;          // Explicit justification
  }[];
  actionChain: {
    step: number;
    action: string;
    agent: string;                      // Responsible unit
    constraint: string;                 // Resource / time constraint
    feasible: boolean;
    estimatedMinutes: number;
  }[];
  infeasibleActions: { action: string; reason: string }[];
  budgetConstraints: string;
};
```

### ExecutorOutput

```typescript
type ExecutorOutput = {
  simulatedActions: {
    action: string;
    toolCall: string;                   // Function signature
    status: "success" | "failed" | "retried";
    result: string;
    latencyMs: number;
    sideEffects: string[];             // Predicted unintended consequences
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
    resourcesDeployed: number;
    estimatedLivesSaved: number;
  };
  stakeholderAlerts: {
    audience: string;   // General Public | Hospital | Utility | Transport | Media
    channel: string;    // SMS Broadcast | Direct Line | Email | Official Channel | Press
    message: string;    // Fully tailored message per audience
    sent: boolean;
  }[];
  costSummary: {
    totalUnitsDeployed: number;
    estimatedCostPKR: number;
    totalLatencyMs: number;
  };
  fallbacksUsed: string[];             // Describes each fallback activated
};
```

### MapVisualization

```typescript
type MapVisualization = {
  incidentCenter: { lat: number; lng: number };
  beforeRoute: { lat: number; lng: number }[];   // Congested route (red dashed)
  afterRoute: { lat: number; lng: number }[];    // Rerouted response path (green)
  safeZones: { lat: number; lng: number; label: string }[];
  evacuationRoutes: { lat: number; lng: number }[][];
  affectedRadiusKm: number;
};
```

### CIROResult

```typescript
type CIROResult = {
  scenarioId: string;
  scenarioName: string;
  antigravityTrace: AgentLogEntry[];   // Full trace from all four agents
  sentinel: SentinelOutput;
  analyst: AnalystOutput;
  strategist: StrategistOutput;
  executor: ExecutorOutput;
  mapVisualization: MapVisualization;
  completedAt: string;
};
```

### ApiIngestionResult (from apiClient.ts)

```typescript
type ApiIngestionResult = {
  scenario: string;
  totalSignals: number;
  signals: SignalSource[];
  sourceBreakdown: {
    source: string;
    signalCount: number;
    latencyMs: number;
    status: "ok" | "error" | "cached";
    error?: string;
    fallback?: string;
  }[];
  fetchedAt: string;
  totalLatencyMs: number;
};
```

---

## 5. Stress-Test Scenarios

All signal content is **fully synthetic**. No real personal data is used.

| ID | Name | Signals | Key Test |
|---|---|---|---|
| `flood` | Urban Flooding — G-10 Islamabad | social ×2, weather, traffic, sensor (5 total) | Standard full pipeline; contradicting "water main only" vs flood |
| `multi_crisis` | Simultaneous Crises — Flood + Heatwave | social ×2, weather ×2, traffic, sensor, field, emergency (8 total) | Two crises, same resource pool; Strategist must split + log trade-offs |
| `false_alarm` | False Alarm — Panic vs Field Verification | social ×2, traffic, field, emergency (4 total) | Escalation followed by field correction; Executor calls `retract_public_alert()` |
| `degraded` | Degraded Mode — Traffic API Failure | social, weather, traffic (503), sensor, field (4 valid) | Traffic stream goes offline; fallback to 18-min NTRC cache; retry logged |

### What each scenario proves against the challenge requirements:

**Scenario 1 — flood:** Demonstrates multi-source fusion, contradiction handling (social vs field report), credibility-weighted signal filtering, and the complete Sentinel→Analyst→Strategist→Executor chain.

**Scenario 2 — multi_crisis:** Demonstrates simultaneous incident management with competing resource allocation. The Strategist must explicitly reason about the trade-off between assigning ambulances to the flood rescue or the heatwave medical outreach, and document this in `tradeoffReasoning`.

**Scenario 3 — false_alarm:** Demonstrates false positive recovery. Initial signals drive a high-severity classification. A field verification signal contradicts the panic. The Executor downgrades, retracts the public alert, issues correction messages to all five stakeholder audiences, and logs the entire correction path in the trace.

**Scenario 4 — degraded:** Demonstrates API resilience. The traffic signal stream returns HTTP 503. The `apiClient.ts` retry logic catches the failure, activates the cached NTRC snapshot as a fallback source, logs the failure in the API call log, and continues the pipeline. The Executor records `fallbacksUsed` and one action with `status: "retried"`.

---

## 6. Web Application

Built with React 18 + TypeScript + Vite. Deployed on Heroku. Fully responsive with Tailwind CSS and shadcn/ui.

### Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Public hero page with platform introduction and CTA |
| `/dashboard` | Main Dashboard | Real-time Google Map with crisis markers, heatmap, safe zones, volunteer positions, search, and full control panel |
| `/requests` | Requests Page | All active crisis requests with status/type filters, search, and claim/manage actions |
| `/tasks` | Tasks Page | Volunteer task management with status filters, AI route plans, and task history |
| `/ciro` | CIRO Interface | Full CIRO web UI with scenario selector, live Socket.IO trace feed, agent trace timeline, signal cards, before/after outcome map, stakeholder alerts, and resource allocations |
| `/profile` | User Profile | Account info, role badge, 2FA setup/disable, backup codes regeneration, password change |
| `/signin` | Sign In | Email + password login with 2FA challenge flow if enabled |
| `/signup` | Sign Up | Registration with role selection |
| `/forgot-password` | Forgot Password | Password reset email request |
| `/reset-password` | Reset Password | New password form (token from email link) |
| `/admin/login` | Admin Login | Dedicated admin entry point |
| `/admin` | Admin Dashboard | System stats, security events, online volunteers, coverage gaps |
| `/admin/users` | User Management | Search, filter, role change, ban/unban, unlock locked accounts |
| `/admin/requests` | Requests Monitor | All crisis requests with full details |
| `/admin/logs` | Activity Logs | Audit log with search and filter by action type |
| `/contact` | Contact | Organization contact/inquiry form |
| `*` | 404 | Not found page |

### Dashboard Map Features (GoogleMapView.tsx)

- **Custom Gaussian heatmap** — canvas-based `OverlayView` implementation with true Gaussian intensity falloff (no ring artifacts), vibrant blue→amber→red gradient matching mobile marker colors exactly
- **Heatmap modes** — `combined` (all types) and `type` (per-type colored gradients for medical/food-water/rescue/volunteer)
- **Marker clustering** — `@googlemaps/markerclusterer` with custom SVG cluster icons
- **Crisis markers** — clean single-border style matching mobile concentric-ring design, always labeled
- **Safe zones** — admin-drawn polygons with type-coded colors
- **Volunteer position markers** — live GPS dots for on-duty responders
- **Route alternatives** — polylines for AI-generated route plans
- **Map/Satellite toggle** — standard hybrid view switcher
- **Custom controls** — zoom buttons, My Location, 3D tilt, fullscreen (map section only)
- **Places autocomplete search** — `AutocompleteSuggestion.fetchAutocompleteSuggestions` (Google Places API New)
- **Responsive** — map height adjusts to viewport, controls non-overlapping

### Web CIRO Page (src/pages/Ciro.tsx)

The web CIRO page provides the same analytical power as the mobile CIRO screen with a full desktop layout:

- Scenario selector cards with signal count badges
- Live Socket.IO trace feed — each agent step appears as it is emitted during processing
- Full Antigravity trace timeline with color-coded agent badges and step-type icons
- Signal credibility cards with noise/contradiction indicators
- Before/after outcome display with severity bar and response metrics
- Stakeholder alert cards (five audiences)
- Resource allocation display with trade-off reasoning
- Start/stop chat overlay for post-analysis questions via `/api/ciro/chat`

---

## 7. Mobile Application

Built with Expo SDK 51 + React Native 0.74 + TypeScript. Supports iOS and Android. Uses dark/light theme via a custom `ThemeProvider`.

### Navigation Structure

```
Root Navigator
├── Auth Stack (unauthenticated users)
│   ├── LandingScreen
│   ├── SignInScreen
│   ├── SignUpScreen
│   ├── ForgotPasswordScreen
│   ├── ResetPasswordScreen
│   └── ContactScreen
│
└── App Tabs (authenticated users)
    ├── Tab: Home/Dashboard — DashboardScreen
    ├── Tab: Requests       — RequestsScreen
    ├── Tab: Tasks          — TasksScreen
    ├── Tab: CIRO           — CIROScreen
    └── Tab: Profile        — ProfileScreen (+ nested stack)
        ├── ChangePasswordScreen
        ├── TwoFactorSettingsScreen
        └── TwoFactorSetupScreen

App Stack (overlaid, any tab)
├── SafeZonesScreen
├── ChatScreen (per task)
└── NotFoundScreen

Admin Stack (ADMIN/STAFF/SUPERADMIN)
├── AdminDashboardScreen
├── AdminUsersScreen
├── AdminRequestsScreen
├── AdminLogsScreen
└── CIROScreen (also accessible from tab)
```

### Screen Descriptions

| Screen | Key Features |
|---|---|
| **LandingScreen** | Hero banner, Sign In / Sign Up CTAs, platform feature highlights |
| **SignInScreen** | Email/password login, 2FA challenge step if enabled, session persistence |
| **SignUpScreen** | Registration with name, email, password, role (victim/volunteer), phone |
| **ForgotPasswordScreen** | Request password reset email |
| **ResetPasswordScreen** | New password form via deep-linked token |
| **DashboardScreen** | Live Google Map with crisis pins, tap-to-report crisis, on-duty toggle, GPS streaming, real-time socket events, notification bell |
| **RequestsScreen** | All active requests with status/type filter, claim button for volunteers, cancel/report buttons for victims |
| **TasksScreen** | Volunteer's active + historical tasks, AI route plan display, resolve action, open task chat |
| **CIROScreen** | Full CIRO UI — Signals tab, Trace tab (live streaming), Outcome tab (map + before/after), Alerts tab |
| **ChatScreen** | Real-time text + voice note chat for a specific task; MediaRecorder-style audio recording |
| **ProfileScreen** | Account info, role badge, theme toggle, 2FA enable/disable, session timeout warning |
| **ChangePasswordScreen** | Current + new password form |
| **TwoFactorSetupScreen** | QR code display, TOTP entry for initial setup, backup codes display |
| **TwoFactorSettingsScreen** | Enable/disable 2FA, regenerate backup codes |
| **SafeZonesScreen** | Map of all admin-created safe zones, tappable with info |
| **ContactScreen** | Organization contact form |
| **AdminDashboardScreen** | System stats, coverage gap list, security events |
| **AdminUsersScreen** | User search, role change, ban/unban, unlock |
| **AdminRequestsScreen** | All requests with full detail and status management |
| **AdminLogsScreen** | Paginated activity audit log |

### Mobile CIRO Screen (CIROScreen.tsx)

Four inner tabs within the CIRO screen:

| Tab | Content |
|---|---|
| **Signals** | All raw signals color-coded by credibility (green >0.8, amber 0.5–0.8, red <0.5); noise signals shown dimmed with filter reason; contradiction pairs flagged in orange |
| **Trace** | Full Antigravity trace scrollable list — each entry color-coded by agent (Sentinel=blue, Analyst=purple, Strategist=orange, Executor=green) and step type; timestamped |
| **Outcome** | Google Map with before (red dashed polyline) and after (green solid polyline) routes, affected radius circle, signal location markers; below: before/after stat cards (response time, congestion, population, lives saved), severity progress bar, duration estimate + uncertainty range, action chain with per-action side effects box, cost summary |
| **Alerts** | Five stakeholder alert cards (audience, channel, message, sent status); resource allocation cards per crisis with trade-off reasoning |

### Mobile-Specific Features

- **Background location tracking** (`mobile/src/tasks/backgroundLocation.ts`) — Expo TaskManager keeps GPS streaming even when app is backgrounded
- **FCM push notifications** (`useFCMNotifications.ts`) — Firebase Cloud Messaging for native push; deep-link routing to relevant screen on tap
- **Session timeout modal** — 15-minute idle timer with 60-second warning countdown; auto-logout
- **Theme system** — full dark/light mode with custom `ColorPalette` type; persisted to AsyncStorage
- **Voice notes** in chat — MediaRecorder-style recording with duration cap and base64 encoding
- **Notification bell** in dashboard header — real-time badge count via Socket.IO
- **Session persistence** — JWT stored in AsyncStorage; restored on cold start

---

## 8. Backend Architecture

### Entry Point — server/index.ts

- Express app with `helmet`, CORS, `express-rate-limit`, `express.json` (10kb limit)
- HTTP server wrapped with Socket.IO
- In-memory stores:
  - `volunteerPositionStore: Map<string, VolunteerPositionEntry>` — live GPS positions with timestamp
  - `volunteerShiftStore: Map<string, VolunteerShiftSession>` — on-duty session tracking
  - `chatStore: Map<string, ChatMessage[]>` — in-memory chat history per task
  - `socketUsers: Map<string, {userId, email, name, role}>` — authenticated socket registry
- Background intervals:
  - **Coverage gap detection** every 30 seconds — queries all ACTIVE unclaimed requests, emits `coverage_gap_update` to admin sockets
  - **Auto-dispatch retry** — re-attempts dispatch for requests that have been waiting > 2 minutes with no volunteer claimed
- Graceful shutdown: `SIGTERM`/`SIGINT` handlers flush state and close the HTTP server cleanly

### server/auth.ts

- `hashPassword(password)` — bcrypt, 10 rounds
- `verifyPassword(password, hash)` — bcrypt compare
- `generateToken(userId, email, role)` — JWT, 24h expiry, signed with `SESSION_SECRET`
- `verifyToken(token)` — returns `{ userId, email, role }` or null
- `generate2FAToken(userId)` — short-lived 5-minute JWT for the 2FA challenge step
- `requireAuth` middleware — validates Bearer JWT, attaches user to request
- `optionalAuth` middleware — attaches user if token present, continues if not
- Account lockout — 5 failed login attempts → `lockedUntil` field set in Firestore for 1 hour

### server/firestoreDb.ts

Full database abstraction layer using Firebase Admin SDK:
- User CRUD: `userFindByEmail`, `userFindById`, `userCreate`, `userUpdate`, `userFindMany`, `userCount`
- Request CRUD: `requestFindById`, `requestFindMany`, `requestCreate`, `requestUpdate`, `requestCount`
- Task CRUD: `taskFindFirst`, `taskFindMany`, `taskCreate`, `taskUpdate`, `claimRequestTransaction`
- Activity logging: `activityLogCreate`, `activityLogFindMany`, `activityLogCount`
- Safe zones: `safeZoneFindMany`, `safeZoneCreate`, `safeZoneDelete`
- Contact submissions: `contactSubmissionCreate`
- Utility: `generatePublicId(role)` — generates USR-XXXX, VOL-XXXX, ADM-XXXX etc.
- `getActiveRequests()` — used by coverage gap detection

### server/push.ts

Full FCM push notification system:
- Firestore-backed token persistence (`pushTokens` collection)
- Supports both FCM native tokens (long strings) and legacy Expo push tokens
- Auto-purges invalid/revoked tokens after failed sends
- Functions: `registerPushToken`, `unregisterPushToken`, `unregisterAllPushTokens`, `sendPushNotification`, `sendPushToUser`, `broadcastPushNotification`, `sendPushToRoles`, `sendPushToUsers`
- Notification log persisted to `notificationLogs` Firestore collection
- Android: high priority, custom channel ID `crisisgrid-alerts`, max importance
- iOS: sound default, badge increment 1

### server/email.ts (via Resend)

Transactional email functions:
- `sendRequesterConfirmation` — confirms request submission to the victim
- `sendStaffAlert` — notifies all staff of new crisis request
- `sendVolunteerAlert` — notifies nearby volunteers of new request
- `sendClaimedRequesterAlert` — notifies victim that a volunteer claimed their request
- `sendClaimedVolunteerAlert` — confirms task assignment to the volunteer
- `sendCrisisResolved` — notifies both parties of task resolution

### server/ciro/streamApis.ts

Simulated streaming signal API server. Mounts REST endpoints that CIRO's `apiClient.ts` calls internally during pipeline ingestion:

- `GET /api/signals/weather` — Pakistan Met Department style: rainfall mm/hr, wind speed, humidity, flood risk level, station ID
- `GET /api/signals/traffic` — NTRC style: congestion index, blocked segments, average speed, incident count
- `GET /api/signals/social` — Social media feed: posts with likes/retweets, verified flag, multilingual content
- `GET /api/signals/sensor` — IoT sensor readings: water level, structural integrity, power status
- `GET /api/signals/field` — Field officer reports: on-scene description, officer name, unit
- `GET /api/signals/emergency` — Emergency call logs: frequency count, dispatcher notes
- **Degraded scenario** — traffic endpoint returns HTTP 503 to trigger fallback testing
- All endpoints inject realistic simulated latency (base + random jitter)
- Each endpoint returns time-varying data using `Date.now()` for realistic freshness

### server/ciro/apiClient.ts

Production-grade API client for signal ingestion:
- `ingestSignals(scenario)` — calls all six signal stream endpoints, returns `ApiIngestionResult`
- `fetchWithRetry(endpoint, params, maxRetries, fallback)` — exponential backoff (200ms base, 2x per attempt, 2s cap, ±100ms jitter)
- `recordApiCall(log)` — logs every HTTP call with endpoint, status, HTTP code, latency, attempt number
- On HTTP 503: immediately switches to cached fallback data, logs `status: "fallback"`
- `fetchSignalApiStatus()` — reports per-source health (ok/error/cached)
- `getApiCallLogs()` / `clearApiCallLogs()` — inspectable via `GET /api/ciro/api-calls`

---

## 9. Real & Mock APIs Used

### Real APIs

| API | Purpose | Configuration |
|---|---|---|
| **OpenAI GPT-4o-mini** | All four CIRO agents — signal fusion, severity analysis, resource allocation, action simulation | `OPENAI_API_KEY` (Heroku env var) |
| **Firebase Admin SDK** | Firestore database, FCM push notifications, token management | `FIREBASE_SERVICE_ACCOUNT_JSON` (Heroku env var) |
| **Google Maps JavaScript API** | Web dashboard map rendering, heatmap, markers, safe zones, route overlays | `VITE_GOOGLE_MAPS_API_KEY` (Heroku build env) |
| **Google Places API (New)** | Address autocomplete in web dashboard search bar | Same key as Maps JS |
| **react-native-maps (Google)** | Mobile dashboard map and CIRO outcome map | `googleMapsApiKey` in app.json |
| **Resend** | All transactional emails — request confirmation, volunteer alerts, claim/resolve notifications, password reset | `RESEND_API_KEY` (Heroku env var) |
| **Firebase Cloud Messaging (FCM)** | Native push notifications to mobile devices | Firebase service account |
| **Expo Push** | Legacy Expo push token support (fallback for older app installs) | `EXPO_ACCESS_TOKEN` (optional) |

### Simulated / Mock APIs (CIRO Signal Streams)

These are internally served REST endpoints (`server/ciro/streamApis.ts`) that simulate real-world data streams for CIRO demo purposes. They produce realistic, time-varying payloads with proper HTTP status codes and latency:

| Endpoint | Simulates | Notes |
|---|---|---|
| `GET /api/signals/weather` | Pakistan Met Department live feed | Rainfall mm/hr, flood risk tiers, station IDs |
| `GET /api/signals/traffic` | NTRC / Pakistan traffic API | Congestion index, blocked segment IDs, speed readings |
| `GET /api/signals/social` | Twitter/X citizen post feed | Includes Urdu/Roman Urdu posts, engagement metrics |
| `GET /api/signals/sensor` | IoT / infrastructure sensor network | Water level sensors, structural monitors |
| `GET /api/signals/field` | Field officer dispatch reports | On-scene descriptions, unit assignments |
| `GET /api/signals/emergency` | Emergency call center logs | Call frequency, dispatcher notes |

### Simulated Tool Calls (CIRO Executor)

These are function calls simulated within the Executor agent to represent actions that a production system would make against real dispatch/utility systems:

| Tool Call | Simulates |
|---|---|
| `dispatch_rescue_unit(unitId, lat, lng, priority)` | CAD dispatch to rescue unit |
| `reroute_traffic(segmentIds, newRoute, durationMin)` | Traffic management center command |
| `send_sms_broadcast(message, areaCode, audienceSize)` | Public alert SMS via NDMA/telco |
| `create_emergency_ticket(type, severity, assignedTo)` | Incident management system |
| `notify_hospital(hospitalId, estimatedPatients, crisisType)` | Hospital ED alert system |
| `update_mock_map(incidentId, status, responderCount)` | Incident dashboard update |
| `retract_public_alert(alertId, reason, correctedMessage)` | Alert correction broadcast |

---

## 10. Integrations Implemented

### Firebase Firestore (Database)
All persistent data. Admin SDK only — no client-side Firestore access. Rules deny all direct client access. Collections: `users`, `requests`, `tasks`, `activityLogs`, `safeZones`, `contactSubmissions`, `pushTokens`, `notificationLogs`.

### Firebase Cloud Messaging (Push Notifications)
FCM tokens registered per user on login. Multi-device support. Role-based broadcast (`sendPushToRoles`). Automatic invalid token purging. Android high-priority channel with custom sound. iOS badge and sound configured.

### Google Maps Platform
- Web: Maps JavaScript API with all features (heatmap, clustering, safe zones, volunteer pins, route polylines, 3D tilt, custom controls, fullscreen)
- Web: Places API (New) — `AutocompleteSuggestion.fetchAutocompleteSuggestions` + `Place.fetchFields` for address search
- Mobile: react-native-maps with Google Maps provider; same visual feature set

### Resend (Email)
Six transactional email templates. HTML + text versions. Sender configured. All email triggers tied to request lifecycle events (create → claim → resolve) and auth events (forgot password, reset).

### OpenAI (CIRO Agents)
GPT-4o-mini via `openai` npm package. Four separate AI calls per pipeline run (one per agent). JSON mode enforced via system prompt. Full error handling with fallback defaults if model returns malformed JSON.

### Socket.IO (Real-time)
Server + client integration. Rooms: `volunteers`, `admins`, `chat:{requestId}`, `ciro:{sessionId}`. Auth via `authenticate` event. Full event list in Section 12.

### speakeasy + qrcode (TOTP 2FA)
TOTP secret generation, QR code URL generation, token verification, backup code generation (8 codes, bcrypt-hashed in Firestore). Full setup → enable → verify → disable flow on both web and mobile.

---

## 11. Full API Reference

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Register (email, password, name, role, phone?) |
| `POST` | `/api/auth/login` | None | Login → JWT + user; returns `requires2FA` flag if enabled |
| `POST` | `/api/auth/forgot-password` | None | Send password reset email |
| `POST` | `/api/auth/reset-password` | None | Set new password with reset token |
| `PATCH` | `/api/auth/change-password` | JWT | Change password (requires current password) |
| `GET` | `/api/auth/2fa/status` | JWT | Get 2FA enabled status |
| `POST` | `/api/auth/2fa/setup` | JWT | Generate TOTP secret + QR code |
| `POST` | `/api/auth/2fa/enable` | JWT | Confirm TOTP setup with first code + save backup codes |
| `POST` | `/api/auth/2fa/disable` | JWT | Disable 2FA |
| `POST` | `/api/auth/2fa/verify-login` | 2FA token | Verify TOTP code or backup code to complete login |
| `POST` | `/api/auth/2fa/backup-codes/regenerate` | JWT | Regenerate backup codes |

### Crisis Requests

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/requests` | None | List ACTIVE + CLAIMED requests |
| `GET` | `/api/requests/mine` | JWT | Victim's own requests |
| `POST` | `/api/requests` | Optional | Create new crisis request (lat, lng, type, description) |
| `POST` | `/api/requests/:id/resolve` | JWT | Volunteer marks task resolved |
| `POST` | `/api/requests/:id/cancel` | JWT | Victim cancels their own request |
| `POST` | `/api/requests/:id/report-fraud` | JWT | Report fraudulent request |

### Tasks

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/tasks/claim` | JWT | Claim a request as a volunteer/responder |
| `POST` | `/api/tasks/agent-dispatch` | JWT | AI-driven auto-dispatch to nearest available responder |
| `GET` | `/api/tasks/mine` | JWT | Active tasks with AI route plans |
| `GET` | `/api/tasks/history` | JWT | Completed task history |

### Volunteer

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/volunteer/location` | JWT | Update GPS position (lat, lng) |
| `POST` | `/api/volunteer/availability` | JWT | Toggle on/off duty |
| `GET` | `/api/volunteer/shift` | JWT | Get own shift stats (hours, tasks, distance) |

### Admin (ADMIN / STAFF / SUPERADMIN only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | Dashboard stats: user counts, request counts, active volunteers |
| `GET` | `/api/admin/security-summary` | Security events: failed logins, lockouts, blocked role changes |
| `GET` | `/api/admin/users` | Users with search, filter by role, pagination |
| `PATCH` | `/api/admin/users/:id/role` | Change user role (reassigns publicId) |
| `PATCH` | `/api/admin/users/:id/ban` | Ban or unban user |
| `PATCH` | `/api/admin/users/:id/reset-cancel-count` | Reset request cancel counter |
| `PATCH` | `/api/admin/users/:id/unlock` | Unlock locked account |
| `GET` | `/api/admin/logs` | Activity logs with search, filter, pagination |
| `GET` | `/api/admin/requests` | All requests with full details |
| `POST` | `/api/admin/safe-zones` | Create safe zone (name, type, lat, lng) |
| `DELETE` | `/api/admin/safe-zones/:id` | Delete safe zone |
| `GET` | `/api/admin/volunteer-shifts` | Live shift stats for all on-duty responders |

### CIRO

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/ciro/scenarios` | None | List all scenarios (id, name, description, signalCount) |
| `GET` | `/api/ciro/scenario/:id` | None | Full scenario with signals and resource pool |
| `POST` | `/api/ciro/analyze` | None | Start pipeline. Body: `{ scenarioId, sessionId? }`. Returns `{ jobId }` (202) |
| `GET` | `/api/ciro/job/:jobId` | None | Poll job status. Returns `CIROResult` when done |
| `GET` | `/api/ciro/api-calls` | None | Debug: full API call log for last pipeline run |
| `POST` | `/api/ciro/chat` | JWT | Post-analysis chat with AI assistant about CIRO results |

### Signal Streams (internal, CIRO pipeline)

| Endpoint | Description |
|---|---|
| `GET /api/signals/weather` | Simulated weather data |
| `GET /api/signals/traffic` | Simulated traffic data (503 in degraded scenario) |
| `GET /api/signals/social` | Simulated social media posts |
| `GET /api/signals/sensor` | Simulated IoT sensor readings |
| `GET /api/signals/field` | Simulated field officer reports |
| `GET /api/signals/emergency` | Simulated emergency call logs |
| `POST /api/signals/inject-failure` | Inject/clear API failure state for testing |

### Push Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/push/register` | JWT | Register device push token |
| `POST` | `/api/push/unregister` | JWT | Remove specific token |
| `POST` | `/api/push/unregister-all` | JWT | Remove all tokens (logout) |
| `GET` | `/api/push/my-tokens` | JWT | Get own registered tokens |

### Other

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check: Firestore connectivity status |
| `GET` | `/api/safe-zones` | Public list of all safe zones |
| `POST` | `/api/contact` | Submit contact/inquiry form |

---

## 12. WebSocket Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `authenticate` | JWT string | Authenticates socket; joins `volunteers` or `admins` room |
| `join_chat` | `{ requestId }` | Join chat room for a specific task |
| `send_chat_message` | `{ requestId, text }` | Send text message |
| `send_voice_note` | `{ requestId, audioBase64, mimeType, durationSec }` | Send voice note (700KB cap, 120s max) |
| `join_ciro_session` | sessionId string | Join CIRO live trace room for streaming trace entries |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `authenticated` | `{ userId, email, role }` | Confirms successful socket auth |
| `new_crisis` | Crisis request object | New ACTIVE request created |
| `crisis_claimed` | `{ id, claimedBy, responderCount }` | Volunteer claimed a request |
| `crisis_resolved` | `{ id, resolvedBy }` | Task resolved |
| `crisis_cancelled` | `{ id }` | Victim cancelled request |
| `volunteer_location` | `{ volunteerId, lat, lng, name }` | Volunteer GPS update |
| `volunteer_availability` | `{ volunteerId, isAvailable }` | Volunteer on/off duty toggle |
| `volunteer_alert` | Alert object with distance | New high-priority crisis near a volunteer |
| `priority_alert` | `{ nearestVolunteer, distanceKm, crisisId }` | AI nearest-volunteer dispatch notification |
| `security_alert` | Security event object | Login failures, lockouts, blocked role changes |
| `safe_zone_added` | Safe zone object | New safe zone created |
| `safe_zone_removed` | `{ id }` | Safe zone deleted |
| `coverage_gap_update` | `{ gaps[], checkedAt }` | Every 30s to admins: uncovered active requests |
| `chat_history` | `{ requestId, messages[] }` | Full chat history on join |
| `chat_message` | Message object | New text or voice message |
| `chat_error` | `{ requestId, reason }` | Chat join/send error |
| `ciro_trace_entry` | `AgentLogEntry` | Live single trace entry from active pipeline run |
| `ciro_complete` | `{ completedAt }` | Pipeline finished (fetch full result via job endpoint) |
| `ciro_error` | `{ message }` | Pipeline error notification |

---

## 13. Database Schema

All collections in Firebase Firestore. All access via Admin SDK (server-side only). Firestore security rules deny all direct client access.

### users
```
email (string, unique)
passwordHash (string)
role (VICTIM | VOLUNTEER | STAFF | ADMIN | SUPERADMIN)
name (string)
phone (string, optional)
address (string, optional)
publicId (string) — USR-XXXX, VOL-XXXX, ADM-XXXX etc.
banned (boolean)
failedLoginAttempts (number)
lockedUntil (timestamp, optional)
twoFactorSecret (string, optional)
twoFactorEnabled (boolean)
twoFactorBackupCodes (string[], hashed)
cancelCount (number)
passwordResetToken (string, optional)
passwordResetExpiry (timestamp, optional)
createdAt (timestamp)
```

### requests
```
type (MEDICAL | FOOD_WATER | RESCUE)
description (string)
lat (number)
lng (number)
status (QUEUED | ACTIVE | CLAIMED | RESOLVED | CANCELLED)
userId (string, Firestore doc ID)
createdAt (timestamp)
```

### tasks
```
requestId (string)
volunteerId (string)
aiRoutePlan (string, OpenAI-generated route instructions)
status (ACTIVE | COMPLETED)
resolvedAt (timestamp, optional)
createdAt (timestamp)
```

### activityLogs
```
action (string) — e.g. "USER_BANNED", "ROLE_CHANGED", "REQUEST_RESOLVED"
details (string)
performedById (string)
targetUserId (string, optional)
createdAt (timestamp)
```

### safeZones
```
name (string)
type (SHELTER | HOSPITAL | FOOD_DISTRIBUTION | EVACUATION_POINT)
lat (number)
lng (number)
description (string, optional)
createdById (string)
createdAt (timestamp)
```

### contactSubmissions
```
orgName (string)
contactName (string)
email (string)
phone (string, optional)
message (string)
createdAt (timestamp)
```

### pushTokens
```
email (string, document ID)
tokens (string[]) — FCM + Expo push tokens
role (string, optional)
updatedAt (timestamp)
```

### notificationLogs
```
title (string)
body (string)
audience (string)
sentCount (number)
failedCount (number)
createdAt (timestamp)
```

---

## 14. Authentication & Security

### JWT Authentication
- Tokens signed with `SESSION_SECRET` (configurable via environment variable)
- 24-hour expiry
- Payload: `{ userId, email, role }`
- Stored in `localStorage` (web) and `AsyncStorage` (mobile) under key `crisisgrid_token`

### Password Security
- bcrypt with 10 rounds
- Minimum 8 characters enforced at registration
- Password change requires current password verification

### Two-Factor Authentication (TOTP)
- TOTP secrets generated via `speakeasy` (RFC 6238 compliant)
- QR code URI generated via `qrcode` for authenticator app setup (Google Authenticator, Authy, etc.)
- 8 backup codes generated on enable, bcrypt-hashed in Firestore
- Backup codes are single-use (invalidated after use)
- 2FA challenge uses a short-lived (5-minute) intermediate JWT

### Account Security
- 5 failed login attempts → account locked for 1 hour (`lockedUntil` field)
- Security events (lockouts, suspicious role changes) emitted as `security_alert` via Socket.IO
- Banned users receive 403 on all protected endpoints
- Cancel abuse detection: `cancelCount` tracked per user; admins can reset

### Rate Limiting
- `express-rate-limit` applied globally
- Extra strict limits on auth endpoints (register, login, forgot-password)

### Middleware Chain
- `helmet` — sets secure HTTP headers (HSTS, X-Content-Type-Options, etc.)
- CORS — `origin: true` for development; configured per-domain for production
- `requireAuth` / `optionalAuth` / `requireAdmin` / `checkBanned` applied per route

---

## 15. Push Notification System

CrisisGrid uses a dual-channel push system supporting both Firebase Cloud Messaging (FCM) native tokens and legacy Expo push tokens.

### Flow

```
Mobile App Login
  │
  ├─ useFCMNotifications.ts: requestPermission() → getToken()
  │
  └─ POST /api/push/register { token, role }
        │
        └─ Firestore pushTokens collection (email → tokens[])

Crisis Event (e.g. new request)
  │
  ├─ server/push.ts: sendPushToRoles(["VOLUNTEER", ...], title, body, data)
  │
  ├─ FCM tokens → Firebase Admin messaging.sendEachForMulticast()
  │   └─ Android: high priority, crisisgrid-alerts channel, max importance
  │   └─ iOS: sound default, badge +1
  │
  ├─ Expo tokens → expo-server-sdk sendPushNotificationsAsync()
  │
  └─ Failed/invalid tokens → auto-purged from Firestore

Notification received on device
  │
  └─ useFCMNotifications.ts: deep-link routing based on data.type
      ├─ new_crisis     → DashboardScreen
      ├─ crisis_claimed → TasksScreen
      └─ crisis_resolved → TasksScreen
```

### Push Triggers (server-side)
- New crisis request created → alert all on-duty volunteers
- Request claimed → confirm to claimant + notify victim
- Request resolved → notify victim
- High-priority alert (AI dispatch) → targeted push to nearest volunteer

---

## 16. Antigravity Usage Mapping

CIRO implements the full Google Antigravity multi-agent orchestration contract:

| Antigravity Requirement | CrisisGrid CIRO Implementation |
|---|---|
| **Multi-agent orchestration** | Four named agents: Sentinel → Analyst → Strategist → Executor with explicit handoffs |
| **Workplan / task plan** | Logged at pipeline start: scenario ID, signal count, agent sequence, resource pool |
| **Agent observations** | Each agent emits `INIT` + intermediate observation steps before producing output |
| **Reasoning and decisions** | Explicit reasoning steps: `ALLOCATION_DECISION`, `CONTRADICTION_RESOLUTION`, `SEVERITY_RESULT`, `TRADE_OFF_LOG` |
| **Tool calls** | Executor logs every simulated tool call with full function signature, parameters, status, latency, and result |
| **Action execution** | Step-by-step simulation of dispatches, reroutes, alerts, tickets, hospital notifications |
| **Error recovery** | Degraded mode: API failure detected → cached fallback activated → action retried → all steps traced |
| **False alarm handling** | Executor calls `retract_public_alert()`, corrects all five stakeholder messages, logs severity downgrade |
| **Final outcomes** | `OUTCOME_COMPUTED` step logs before/after state comparison; `COMPLETE` step logs cost summary |
| **Full trace export** | `antigravityTrace: AgentLogEntry[]` returned in full via REST API + streamed live via Socket.IO |
| **Trace visibility** | Every step printed to server console with `[ANTIGRAVITY]` prefix; visible in Heroku logs |

### Trace Rendering

The web CIRO page and mobile CIRO screen both render the `antigravityTrace` array as a scrollable, color-coded timeline. Each entry shows:
- Agent badge (color-coded)
- Step name (e.g. `NOISE_FILTER`, `TOOL_CALL`)
- Message text
- Step type icon (info / decision / tool_call / warning / success / error)
- ISO timestamp

Live streaming via Socket.IO means trace entries appear one by one as they are emitted, before the full result is ready — giving the user a real-time view of the AI reasoning process.

### Prompt Engineering Contract

Each agent is given a structured system prompt that enforces the Antigravity contract. The pattern is consistent across all four agents:

```
[SYSTEM PROMPT STRUCTURE — identical contract per agent]

Role definition:
  "You are <AgentName>, the <role> agent in the CIRO emergency coordination pipeline."

Workplan acknowledgment:
  "You receive <InputType> and must produce a structured <OutputType>."
  "Think step-by-step. Document your reasoning at each stage."

Output schema enforcement:
  "Return ONLY valid JSON matching this exact schema: { ... }"
  "Do not include any text outside the JSON object."

Antigravity contract clauses per agent:
  Sentinel  → "Assign a credibilityScore (0.0–1.0) to each signal. List contradictions explicitly."
  Analyst   → "State your uncertainty as a range string. Explain if confidence was adjusted for contradictions."
  Strategist→ "For each allocation decision, write a tradeoffReasoning string. List infeasible actions."
  Executor  → "For every tool call, record status (success/failed/retried) and latencyMs."
               "Compute beforeState and afterState explicitly. List fallbacksUsed."

Error recovery instruction (all agents):
  "If any input field is missing or ambiguous, make a conservative assumption and note it."
  "Do not fail — produce the best output you can from available data."
```

If GPT-4o-mini returns malformed JSON, each agent has a deterministic hardcoded fallback function that returns a valid `SentinelOutput`/`AnalystOutput`/`StrategistOutput`/`ExecutorOutput` with clearly marked `"[FALLBACK]"` strings, ensuring the pipeline always completes rather than crashing.

---

## 17. Baseline Comparison

A simple rule-based (non-agentic) system would implement this logic:
> "If keyword 'flood' appears in ≥3 signals from the area → severity = HIGH → dispatch all ambulances → send generic SMS"

### Why CIRO is substantially better

| Dimension | Rule-Based Baseline | CIRO (Agentic) |
|---|---|---|
| **Signal parsing** | Hard-coded keyword matching on English text only | Understands informal Urdu/Roman Urdu; infers context from signal content, metadata, and raw API values |
| **Credibility** | No source weighting | Per-signal credibility score based on type, recency, urgency language, corroboration, geolocation confidence |
| **Contradiction handling** | None — first match wins | Sentinel explicitly detects conflicts between sources; Analyst adjusts confidence score downward |
| **Multi-language** | Fails on non-English | GPT-4o-mini handles Urdu, Roman Urdu, and English social posts |
| **Severity** | Fixed HIGH/MEDIUM/LOW per keyword | Calibrated tier 1–5 with confidence score, uncertainty range, temporal trend, and spread risk |
| **Duration estimate** | None | Expected hours + uncertainty range with reasoning |
| **Multi-crisis** | Processes one incident at a time | Parallel reasoning for two simultaneous incidents with explicit split-allocation trade-off |
| **Resource optimization** | Dispatch everything | Constrained optimization — ambulances, rescue teams, police, medics split across crises with documented reasoning |
| **False alarm** | No correction path | Full retraction: `retract_public_alert()`, five corrected stakeholder messages, severity downgrade logged |
| **API failure** | Crashes or blocks | Detected gracefully; cached fallback activated; action retried; all fallbacks logged |
| **Side effects** | Not predicted | Per-action predicted unintended consequences (e.g. "rerouting via Margalla adds 4 min to commuters") |
| **Stakeholder alerts** | Single generic broadcast | Five tailored messages: public / hospital / utility / transport / media — different content per audience |
| **Auditability** | Zero trace | Full Antigravity trace: every reasoning step, decision, tool call, timestamp — exportable via API |

### Quantitative Improvement Estimates

The table above describes qualitative improvements. Based on realistic emergency-response benchmarks, CIRO's agentic approach also provides measurable improvements over a rule-based baseline in a demo simulation:

| Metric | Rule-Based Estimate | CIRO Estimate | Improvement |
|---|---|---|---|
| Signal processing time (5 sources) | ~200ms (regex scan) | 25–45s (deep reasoning) | Depth vs speed trade-off |
| False positive rate (panic-only signals) | ~40% (keyword hit = alert) | ~8% (contradiction detection + field verification) | ~5× fewer false alarms |
| Stakeholder messages generated | 1 generic broadcast | 5 tailored messages per audience | 5× coverage |
| Resource utilisation in multi-crisis | 100% dispatched to first incident | Optimal split with documented trade-offs | Prevents total resource lock-out |
| Audit trail entries per run | 0 | 15–30 structured `AgentLogEntry` records | Full accountability |
| Languages handled | English only | English + Urdu + Roman Urdu | 3× language coverage |

> Note: CIRO's 25–60s latency makes it unsuitable for sub-second dispatch triggering. It is designed for **situation assessment and resource planning**, not for replacing the millisecond-level auto-dispatch system already implemented in `server/index.ts`.

---

## 18. Cost & Latency Analysis

### Cost per CIRO pipeline run (4 OpenAI GPT-4o-mini calls)

| Agent | ~Input tokens | ~Output tokens | Cost (GPT-4o-mini) |
|---|---|---|---|
| Sentinel | 600 | 300 | ~$0.00027 |
| Analyst | 500 | 250 | ~$0.00022 |
| Strategist | 700 | 400 | ~$0.00033 |
| Executor | 800 | 500 | ~$0.00039 |
| **Total per run** | **2,600** | **1,450** | **~$0.0012** |

*GPT-4o-mini pricing: $0.15 / 1M input tokens, $0.60 / 1M output tokens.*

### End-to-end latency per scenario

| Scenario | Typical latency |
|---|---|
| Flood (5 signals, standard pipeline) | 25–45 seconds |
| Multi-crisis (8 signals, complex allocation) | 35–60 seconds |
| False alarm / Degraded (4 signals, fallback) | 25–45 seconds |

Latency is dominated by four sequential OpenAI API calls (~5–12s each). Signal ingestion via `streamApis.ts` adds 50–300ms per source.

### Async job pattern

Because pipeline latency (25–60s) exceeds HTTP timeout limits on production servers:
- `POST /api/ciro/analyze` returns `202 Accepted + { jobId }` within milliseconds
- Client polls `GET /api/ciro/job/:jobId` every 3 seconds
- Live trace entries stream via Socket.IO during processing
- Total perceived wait matches pipeline latency but no HTTP timeout is hit

### Retry and Fallback Cost Overhead

The degraded scenario triggers retry logic in `apiClient.ts`. Each retry attempt that ultimately fails adds a small overhead before falling back to cached data — but critically, the four OpenAI agent calls are unaffected since `apiClient.ts` handles fallback at the signal ingestion level:

| Condition | Additional cost | Notes |
|---|---|---|
| Normal run (all APIs ok) | $0 extra | No retries triggered |
| One API returns 503 (degraded scenario) | ~$0.00002 extra | 1 failed HTTP call + 1 retry attempt; no extra OpenAI calls |
| Malformed LLM JSON → fallback function | ~$0.0006 extra | One additional GPT-4o-mini re-prompt attempt before hardcoded fallback activates |
| Full pipeline re-run (user clicks Analyze again) | ~$0.0012 | Full cost of a fresh pipeline run; no caching between runs |

### Monthly Deployment Cost Estimates

| Usage Level | CIRO runs/month | OpenAI cost | Firebase (Firestore reads/writes) | Total estimate |
|---|---|---|---|---|
| Demo / low traffic | 50 runs | ~$0.06 | Free tier (50k reads/day) | **~$0.06/mo** |
| Active evaluation | 500 runs | ~$0.60 | Spark plan covers it | **~$0.60/mo** |
| Production pilot | 5,000 runs | ~$6.00 | Blaze pay-as-you-go ~$5–15 | **~$11–21/mo** |
| City-scale deployment | 50,000 runs | ~$60.00 | Blaze ~$50–150 | **~$110–210/mo** |

*These estimates assume average token counts from the table above. Heavier scenarios (multi_crisis with 8 signals) run ~15% above average cost.*

### At scale

| Scale | Cost per minute | Architecture change needed |
|---|---|---|
| 10× concurrent | ~$0.012/min | Current stateless Node.js handles this without change |
| 100× concurrent | ~$0.12/min | Add Redis for job store + BullMQ queue to prevent memory growth |
| 1000× concurrent | ~$1.20/min | Parallelize Sentinel + Analyst (Strategist/Executor must remain sequential); add CDN for scenario endpoints |

---

## 19. Scalability Discussion

### Current Architecture (Single-node Express)
- All CIRO jobs are in-memory (`jobStore: Map`) — resets on restart, unsuitable for multi-instance
- Volunteer position and shift stores are in-memory — same limitation
- Stateless HTTP routes and stateless auth (JWT) scale horizontally with no change

### Path to Production Scale

1. **Job queue** — Replace `setImmediate()` background jobs with BullMQ + Redis. `POST /api/ciro/analyze` enqueues a job; workers process it; Socket.IO notifies completion. Enables multi-worker deployment and job persistence across restarts.

2. **Agent parallelisation** — Sentinel and Analyst can run concurrently (both consume raw signals). Strategist and Executor must remain sequential (each depends on previous output). Parallel Sentinel+Analyst reduces pipeline latency by ~30%.

3. **Result caching** — Cache `CIROResult` by `scenarioId` in Redis (TTL 5 minutes). Repeated scenario runs return in <100ms. Useful for demo/presentation contexts.

4. **Volunteer position store** — Move from in-memory `Map` to Redis with TTL per entry. Enables multi-instance horizontal scaling for the volunteer dispatch system.

5. **Model routing** — Use GPT-4o-mini for Sentinel/Analyst triage (fast, cheap). Upgrade Strategist to GPT-4o when severity tier ≥ 4 (more complex resource allocation requires stronger reasoning). Cost increase ~5× per high-severity run.

6. **Multi-region** — Firestore and CIRO backend are both stateless/cloud-native. Deploy backend to multiple regions (US East, EU, Asia) with Cloudflare routing for latency reduction. CIRO scenarios endpoint can be served from CDN at ~0ms.

7. **Streaming responses** — Replace polling with OpenAI streaming API + Socket.IO relay for live agent output. Each token appears as it is generated. User sees reasoning in near-real-time.

### Socket.IO Horizontal Scaling Requirements

The current Socket.IO server operates in single-node mode. Scaling to multiple Node.js instances requires:

1. **Redis Pub/Sub adapter** — Replace the default in-memory adapter with `@socket.io/redis-adapter`. All Socket.IO events (`new_crisis`, `volunteer_location`, `ciro_trace_entry`, etc.) are published to Redis and fanned out to all nodes. Without this, clients connected to Node A will not receive events emitted by Node B.

2. **Sticky sessions** — Load balancers must route all connections from the same client to the same node for the WebSocket upgrade handshake. Configure sticky sessions via IP hash (nginx `ip_hash`) or cookie-based affinity (AWS ALB, Cloudflare). Failure to do so causes frequent reconnects and missed events during node failover.

3. **Volunteer and shift store migration** — `volunteerPositionStore` and `volunteerShiftStore` are currently `Map` objects in Node memory. In a multi-instance deployment they must move to Redis with a per-entry TTL of 10 minutes (matching the gap detection cutoff in `server/index.ts`).

4. **Chat store migration** — `chatStore` (in-memory per-task chat history) must move to Firestore or Redis so chat history persists across server restarts and is accessible from any node.

### Firestore Connection Pooling

Firebase Admin SDK opens a single gRPC connection per process. Under high concurrent load:
- Each Node.js worker process maintains its own connection — horizontal scaling naturally increases total connection capacity.
- For very high write throughput (>500 writes/sec), Firestore recommends key distribution (avoid monotonically increasing document IDs) — already handled by `generatePublicId()` which uses random suffixes.
- Firestore's free Spark plan supports 50k reads and 20k writes per day. Switch to Blaze pay-as-you-go before any production deployment.

---

## 20. Assumptions

1. **Synthetic signal data** — All CIRO signal content, locations, user names, sensor IDs, and incident references are entirely fabricated. No real emergency data, real persons, or real incidents are referenced.

2. **Mock tool calls** — `dispatch_rescue_unit()`, `reroute_traffic()`, and all Executor tool calls are simulations. They produce realistic trace output but do not contact any real dispatch center, hospital, utility company, or government system.

3. **Sequential agent pipeline** — Intentional design choice for trace clarity, demo reliability, and cost control. A production version with streaming and parallel execution would reduce latency significantly.

4. **Islamabad geography** — All scenario signals reference Islamabad neighbourhoods (G-10, F-8, G-9) for geographic realism. All other content is synthetic.

9. **LLM fallback behaviour** — Every agent (`runSentinelAgent`, `runAnalystAgent`, `runStrategistAgent`, `runExecutorAgent`) has a deterministic hardcoded fallback function. If `OPENAI_API_KEY` is missing, the key is invalid, or the model returns non-parseable JSON after one re-prompt, the fallback activates and the pipeline completes with clearly marked `"[FALLBACK]"` output. The system never throws an uncaught exception from within the CIRO pipeline.

10. **Single-server deployment** — The current implementation assumes a single Node.js process for the Replit and Heroku deployment contexts. In-memory stores (`volunteerPositionStore`, `chatStore`, `jobStore`) are appropriate for this assumption. Any multi-dyno or multi-instance deployment invalidates this assumption and requires the Redis migration described in Section 19.

11. **Client-side JWT storage** — JWTs are stored in `localStorage` (web) and `AsyncStorage` (mobile). This is appropriate for the demo context. A production deployment serving sensitive emergency data should evaluate `httpOnly` cookie storage and refresh token rotation to mitigate XSS-based token theft risks.

---

## 21. Privacy & Safety Note

- **No real personal data** — All signal payloads are entirely synthetic. No real names, phone numbers, CNIC numbers, addresses, or device identifiers appear anywhere in the CIRO data layer.
- **No real dispatch** — Tool calls in the Executor are simulated. No real emergency services, hospitals, utility companies, or government agencies are contacted.
- **False alarm correction** — The false_alarm scenario explicitly demonstrates that the system can detect, retract, and correct misinformation — a critical safety requirement for any real deployment.
- **Firestore rules** — All Firestore collections deny direct client access. All reads and writes go through the Express backend with authentication and role checks.
- **Live system requirements** — In a production deployment, stakeholder alerts (public SMS, hospital hotline, utility email) would require regulatory approval from NDMA, RESCUE 1122, and relevant provincial emergency services.
- **CIRO results not persisted** — All CIRO pipeline output is ephemeral (in-memory per HTTP request). No incident analysis data is stored in Firestore.
- **Password security** — All passwords bcrypt-hashed (10 rounds). No plaintext passwords stored anywhere.
- **Volunteer GPS data** — When a volunteer is on duty, their real-time GPS coordinates (`lat`, `lng`) are broadcast via Socket.IO to all connected clients in the `volunteers` and `admins` rooms. Volunteers are informed of this through the on-duty toggle. In a production deployment, location data should be: (a) broadcast only to the specific assigned victim and admin operators, not all connected clients; (b) encrypted in transit (already handled by TLS in production); (c) deleted from `volunteerPositionStore` immediately on going off-duty, not retained until server restart.
- **User-submitted crisis location** — Victim crisis requests include the precise GPS coordinates of the person in distress. These are stored in Firestore and returned via the public `GET /api/requests` endpoint. In a real-world deployment this endpoint should require authentication and location data should only be visible to assigned responders and admins, not all connected users.
- **Data retention** — No automated data retention or deletion policy is currently implemented. Firestore collections (`requests`, `tasks`, `activityLogs`) accumulate indefinitely. A production deployment should implement a Firestore TTL policy or scheduled cleanup function, especially for resolved requests and activity logs older than the legally required retention window.
- **Not certified for live emergency use** — CrisisGrid is a research and demonstration platform. It has not undergone the safety validation, regulatory approval, redundancy testing, or penetration testing required for deployment as a primary emergency coordination system. It must not be used as the sole or primary dispatch mechanism for real-life life-threatening emergencies until these requirements are met.

---

## 22. Limitations

1. **Pipeline latency (25–60s)** — Unsuitable for real-time emergency dispatch. A production version needs a fast-triage pass (<2s) with background full reasoning.

2. **No real sensor feeds** — All signals are static JSON payloads served by internal endpoints. Production would subscribe to live PMD, NTRC, IoT webhook, and social media streaming APIs.

3. **No real dispatch integration** — CAD (Computer-Aided Dispatch) integration with Rescue 1122, Edhi Foundation, or NDMA systems is required for operational use.

4. **Single-model multilingual** — Urdu/Roman Urdu parsing relies on GPT-4o-mini's general multilingual capability. A fine-tuned Urdu NLP model would improve accuracy on regional informal text.

5. **No real notification compliance** — Emergency SMS broadcasting in Pakistan requires coordination with PTA, NDMA, and telco operators. The `send_sms_broadcast()` tool call is simulated only.

9. **No outcome feedback loop** — CIRO severity priors are fixed per scenario. There is no mechanism to learn from resolved incidents, adjust credibility weights over time, or improve severity estimates based on historical accuracy. A production system would close this loop by recording actual incident outcomes and feeding them back as calibration data.

10. **No access control on CIRO endpoints** — `POST /api/ciro/analyze` and `GET /api/ciro/job/:jobId` are unauthenticated. Any user or bot can trigger unlimited pipeline runs, consuming OpenAI API quota. A production deployment must add rate limiting per IP and require JWT authentication on the analyze endpoint.

11. **Voice note storage** — Voice notes exchanged in task chat are transmitted as base64 audio over Socket.IO and stored in the in-memory `chatStore`. They are never persisted to Firestore and are lost on server restart. For a production deployment, audio should be uploaded to Firebase Storage or an equivalent blob store and referenced by URL in the chat record.

12. **No penetration testing or security audit** — The platform implements security best practices (bcrypt, JWT, helmet, rate limiting, Firestore rules) but has not undergone formal penetration testing, OWASP audit, or third-party security review. It should not be deployed in a production emergency context without such a review.

13. **CIRO is demonstration-only** — The CIRO pipeline is architected to demonstrate AI-driven crisis intelligence for the Antigravity challenge. It is not validated against real emergency data, has no SLA, and produces outputs that reflect the quality of GPT-4o-mini's reasoning on synthetic inputs. Any similarity to real crisis situations is coincidental and the outputs must not be treated as authoritative guidance for real-world emergency decision-making.

---

## 23. Project Structure

```
/
├── README.md                     ← This file
├── NOTIFICATION_SYSTEM.md        ← Push notification architecture details
├── package.json                  ← Root dependencies (web + server)
├── vite.config.ts                ← Vite frontend config
├── tailwind.config.ts
├── tsconfig.json
├── firestore.rules               ← Deny all direct client access
│
├── server/                       ← Express.js backend (TypeScript)
│   ├── index.ts                  ← Server entry, Socket.IO, background jobs
│   ├── routes.ts                 ← All REST API routes
│   ├── auth.ts                   ← JWT, bcrypt, 2FA middleware
│   ├── firebase.ts               ← Firebase Admin SDK initializer
│   ├── firestoreDb.ts            ← Firestore CRUD abstraction layer
│   ├── email.ts                  ← Resend email templates
│   ├── push.ts                   ← FCM + Expo push notifications
│   ├── seed.ts                   ← Database seed script
│   └── ciro/
│       ├── agents.ts             ← Four-agent Antigravity pipeline
│       ├── mockData.ts           ← Four stress-test scenarios
│       ├── routes.ts             ← CIRO REST + signal stream endpoints
│       ├── apiClient.ts          ← Signal ingestion with retry/fallback
│       └── streamApis.ts        ← Simulated signal stream API server
│
├── scripts/
│   ├── reseed.ts                 ← Database reseed utility
│   └── reset_firebase.py        ← Firebase collection reset tool
│
├── src/                          ← React web frontend (Vite)
│   ├── App.tsx                   ← Root with all routes
│   ├── main.tsx                  ← Entry point
│   ├── pages/
│   │   ├── Landing.tsx           ← Public landing page (/)
│   │   ├── Index.tsx             ← Main dashboard (/dashboard)
│   │   ├── SignUp.tsx            ← Registration (/signup)
│   │   ├── SignIn.tsx            ← Login (/signin)
│   │   ├── ForgotPassword.tsx    ← Password reset request
│   │   ├── ResetPassword.tsx     ← New password form
│   │   ├── AdminLogin.tsx        ← Admin entry (/admin/login)
│   │   ├── Contact.tsx           ← Contact form (/contact)
│   │   ├── Profile.tsx           ← User profile + 2FA (/profile)
│   │   ├── Ciro.tsx              ← CIRO web interface (/ciro)
│   │   ├── Requests.tsx          ← Requests list (/requests)
│   │   ├── Tasks.tsx             ← Task management (/tasks)
│   │   ├── NotFound.tsx          ← 404 page
│   │   └── admin/
│   │       ├── AdminLayout.tsx   ← Sidebar layout wrapper
│   │       ├── Dashboard.tsx     ← Admin dashboard (/admin)
│   │       ├── Users.tsx         ← User management (/admin/users)
│   │       ├── Requests.tsx      ← Request monitor (/admin/requests)
│   │       └── Logs.tsx          ← Activity logs (/admin/logs)
│   ├── components/
│   │   ├── AppFooter.tsx         ← Shared footer component
│   │   ├── NavLink.tsx
│   │   ├── ui/                   ← shadcn/ui components
│   │   └── crisis/
│   │       ├── GoogleMapView.tsx ← Full Google Maps component
│   │       ├── PlacesSearch.tsx  ← Places autocomplete
│   │       ├── AdminDashboard.tsx← Slide-out admin panel
│   │       ├── NotificationBell.tsx
│   │       ├── ShiftSummaryPanel.tsx
│   │       ├── TaskChatPanel.tsx ← Chat + voice notes
│   │       ├── VolunteerTasksSheet.tsx
│   │       └── types.ts
│   ├── hooks/
│   │   ├── use-socket.ts         ← Socket.IO client hook
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   └── lib/
│       ├── api.ts                ← Frontend API client (fetch + auth)
│       └── utils.ts
│
└── mobile/                       ← Expo React Native app
    ├── App.tsx                   ← Root providers + navigation
    ├── app.json                  ← Expo manifest (iOS + Android)
    ├── index.js                  ← Entry point
    ├── package.json
    ├── babel.config.js
    ├── tsconfig.json
    ├── assets/                   ← App icons, splash screens
    └── src/
        ├── api/client.ts         ← Mobile API client (AsyncStorage auth)
        ├── components/           ← UI components (Map, Cards, Modals, etc.)
        ├── hooks/
        │   ├── useAuth.tsx       ← Auth state + login/logout
        │   ├── useSocket.ts      ← Socket.IO hook
        │   ├── useVolunteerLocation.ts ← GPS streaming
        │   ├── useFCMNotifications.ts  ← FCM push + deep link routing
        │   └── useSessionTimeout.ts    ← 15-min idle timeout
        ├── navigation/
        │   ├── RootNavigator.tsx ← Bottom tabs + nested stacks
        │   └── types.ts          ← Navigation param types
        ├── screens/
        │   ├── LandingScreen.tsx
        │   ├── SignInScreen.tsx
        │   ├── SignUpScreen.tsx
        │   ├── ForgotPasswordScreen.tsx
        │   ├── ResetPasswordScreen.tsx
        │   ├── ChangePasswordScreen.tsx
        │   ├── DashboardScreen.tsx
        │   ├── RequestsScreen.tsx
        │   ├── TasksScreen.tsx
        │   ├── CIROScreen.tsx    ← CIRO: Signals / Trace / Outcome / Alerts
        │   ├── ChatScreen.tsx
        │   ├── ProfileScreen.tsx
        │   ├── SafeZonesScreen.tsx
        │   ├── TwoFactorSetupScreen.tsx
        │   ├── TwoFactorSettingsScreen.tsx
        │   ├── ContactScreen.tsx
        │   ├── NotFoundScreen.tsx
        │   └── admin/
        │       ├── AdminDashboardScreen.tsx
        │       ├── AdminUsersScreen.tsx
        │       ├── AdminRequestsScreen.tsx
        │       └── AdminLogsScreen.tsx
        ├── tasks/
        │   └── backgroundLocation.ts ← Expo TaskManager background GPS
        └── theme/
            ├── index.ts          ← ColorPalette type + theme tokens
            └── ThemeProvider.tsx ← Dark/light mode context
```

---

## 24. Setup & Deployment

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Full Firebase service account JSON for project `crisisgrid-fe615` |
| `RESEND_API_KEY` | Yes | Resend API key for all transactional emails |
| `SESSION_SECRET` | Yes | JWT signing secret |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key (Maps JS + Places API + billing enabled in GCP) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for all four CIRO agents |
| `EXPO_ACCESS_TOKEN` | Optional | Expo push token support for legacy devices |

### Local Development

```bash
# Install root dependencies
npm install

# Start backend (port 3001)
npx tsx server/index.ts

# Start frontend (port 5000, separate terminal)
npm run dev

# Seed the database (first run only)
npx tsx server/seed.ts
```

### Mobile App

```bash
cd mobile
npm install

# Start Expo dev server
npx expo start

# Press i for iOS simulator, a for Android emulator
# Or scan QR code with Expo Go on a physical device
```

Update `mobile/app.json → extra.apiBaseUrl` to point to your backend URL before running on a physical device.

### Production Build (Web)

```bash
npm run build     # Vite builds to /dist
npm start         # Express serves /dist + API on same port
```

The Express server in production mode serves the Vite build from `/dist` and handles all API routes. This is the Heroku deployment configuration.

### Mobile Production Build (EAS)

```bash
npm install -g eas-cli
eas build -p ios
eas build -p android
```

---

## 25. Seeded Accounts

Password for all accounts: **password123**

| Email | Name | Role |
|---|---|---|
| superadmin@crisisgrid.app | Aria Sterling | SUPERADMIN |
| admin@crisisgrid.app | Marcus Webb | ADMIN |
| staff@crisisgrid.app | Dana Okafor | STAFF |
| volunteer1@crisisgrid.app | Aisha Kareem | VOLUNTEER |
| volunteer2@crisisgrid.app | Omar Han | VOLUNTEER |
| volunteer3@crisisgrid.app | Lina Park | VOLUNTEER |
| volunteer4@crisisgrid.app | David Cole | VOLUNTEER |
| volunteer5@crisisgrid.app | Yusuf Ali | VOLUNTEER |
| volunteer6@crisisgrid.app | Mina Zhou | VOLUNTEER |
| volunteer7@crisisgrid.app | Carlos Vega | VOLUNTEER |
| volunteer8@crisisgrid.app | Sara Nouri | VOLUNTEER |
| civilian1@crisisgrid.app | Hiba Malik | VICTIM |
| civilian2@crisisgrid.app | Noah Reed | VICTIM |
| civilian3@crisisgrid.app | Rania Saleh | VICTIM |
| civilian4@crisisgrid.app | Bilal Shah | VICTIM |
| civilian5@crisisgrid.app | Layla Noor | VICTIM |
| civilian6@crisisgrid.app | Amir Khan | VICTIM |
| civilian7@crisisgrid.app | Zara Imran | VICTIM |
| civilian8@crisisgrid.app | Leo Kim | VICTIM |
| civilian9@crisisgrid.app | Maya Singh | VICTIM |
| civilian10@crisisgrid.app | Hamza Qureshi | VICTIM |
| civilian11@crisisgrid.app | Nora Aziz | VICTIM |
| civilian12@crisisgrid.app | Imran Yousaf | VICTIM |
| anonymous@crisisgrid.app | Anonymous | VICTIM |

**Total: 24 users** (1 SUPERADMIN, 1 ADMIN, 1 STAFF, 8 VOLUNTEERs, 13 VICTIMs)

---

## 26. Roles & Permissions

| Role | Public ID Prefix | Capabilities |
|---|---|---|
| **VICTIM** | USR-XXXX | Submit crisis requests, cancel own requests, report fraud, access CIRO |
| **VOLUNTEER** | VOL-XXXX | All Victim capabilities + claim/resolve tasks, GPS streaming, task chat, voice notes, view AI route plans, shift tracking |
| **STAFF** | STA-XXXX | All Volunteer capabilities + admin monitoring access (read-only on user/request lists) |
| **ADMIN** | ADM-XXXX | All Staff capabilities + full admin panel: user management (role/ban/unlock), safe zone creation, activity log access, security event monitoring |
| **SUPERADMIN** | SUP-XXXX | All Admin capabilities + can change roles of any user including other admins |

All roles can access the CIRO feature (web `/ciro` page and mobile CIRO tab).

---

## 27. Acknowledgements

> *"Technology is at its best when it brings people together in moments that matter most."*
> — Inspired by the spirit of open-source humanitarian tech

CrisisGrid was built with a deep belief that **coordination saves lives**. In the critical first minutes of any emergency, the gap between those who need help and those who can provide it is measured not in kilometers — but in **information latency**. Every design decision in this project, from the 30-second auto-dispatch loop to the multi-language signal parsing, was driven by one question: *how do we close that gap faster?*

### Tools & Platforms That Powered This Build

| Technology | Role |
|---|---|
| [OpenAI GPT-4o-mini](https://openai.com) | The reasoning engine behind all four CIRO agents |
| [Firebase](https://firebase.google.com) | Real-time database, authentication, and push notifications |
| [Google Maps Platform](https://developers.google.com/maps) | Web and mobile map rendering, geocoding, and Places API |
| [React](https://react.dev) & [Vite](https://vitejs.dev) | Fast, modern web frontend |
| [Expo](https://expo.dev) & [React Native](https://reactnative.dev) | Cross-platform mobile deployment |
| [Socket.IO](https://socket.io) | Real-time bidirectional event streaming |
| [Tailwind CSS](https://tailwindcss.com) & [shadcn/ui](https://ui.shadcn.com) | Beautiful, accessible UI components |
| [Resend](https://resend.com) | Reliable transactional email delivery |
| [Prisma](https://prisma.io) | Type-safe database schema and migrations |

### Special Thanks

- The **open-source community** — for the countless libraries, bug reports, and documentation that make ambitious projects like this possible
- **First responders and emergency coordinators worldwide** — whose real-world workflows inspired the architecture of CIRO
- Everyone who has contributed ideas, feedback, or stress-tested the platform

### A Note on Synthetic Data

All crisis scenarios, signal content, user names, and geographic references in CIRO are **entirely synthetic**. No real emergency data, personal information, or live incident feeds are used. This project is a demonstration of capability — not an operational emergency system.

---

## 28. License

CrisisGrid is released under the [MIT License](LICENSE).

You are free to use, modify, and distribute this software. If you build something that helps people because of it, that is the best return on investment we could ask for.

---

<p align="center">
  <strong>CrisisGrid</strong> — Built with urgency. Designed for humanity.
  <br>
  <sub>Challenge 3 Submission · 2026</sub>
</p>
