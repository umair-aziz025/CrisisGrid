# CrisisGrid Mobile (React Native)

A production-ready React Native app — built with Expo + TypeScript — that mirrors the
CrisisGrid / AidBridge web platform on iOS and Android. The mobile app reuses the same
backend API and business logic; only the UI layer is rewritten with native components.

## Stack

- **Expo SDK 51** + **React Native 0.74** + **TypeScript** (strict)
- **React Navigation** (native-stack + bottom tabs) for native-feeling routing
- **react-native-maps** + **expo-location** — live crisis map, tap-to-pin
  reporting, and on-duty volunteer location streaming
- **socket.io-client** — real-time crisis broadcasts, claim/resolve updates,
  volunteer alerts, security alerts
- **Lucide React Native** for crisp, theme-matched iconography
- **AsyncStorage** for persistent auth (replaces `localStorage`)
- **expo-clipboard** for copying 2FA secrets and backup codes
- **Safe-area + KeyboardAvoiding** wrappers on every screen
- Custom `StyleSheet`-based design system — no runtime CSS, fastest startup

## Project layout

```
mobile/
├── App.tsx                       # Providers + RootNavigator
├── app.json                      # Expo manifest (iOS + Android)
├── babel.config.js               # Babel + module-resolver (`@/*` alias)
├── tsconfig.json                 # Strict TS, path aliases
└── src/
    ├── api/client.ts             # Mirror of web `src/lib/api.ts` (AsyncStorage)
    ├── components/               # ErrorBoundary, Toast, RequestCard
    │   └── ui/                   # Button, Input, Card, Badge, Screen, Spinner, Brand
    ├── hooks/useAuth.tsx         # Auth context + persistence
    ├── navigation/               # RootNavigator + types (auth vs app)
    ├── screens/                  # Landing, SignIn, SignUp, …, Dashboard, admin/…
    ├── theme/index.ts            # Colors, spacing, typography, shadows
    └── utils/crisis.ts           # Crisis types, status meta, helpers
```

## Theme

Design tokens are ported 1:1 from the web `src/index.css` HSL variables and converted
into hex values for native rendering. The crisis palette
(`crisisMedical`, `crisisFoodWater`, `crisisRescue`, `statusClaimed`) is preserved so
both apps render identical visual semantics.

## Screens

| Screen                    | Route                     | Mirrors web page                |
|---------------------------|---------------------------|---------------------------------|
| Landing                   | Auth.Landing              | `pages/Landing.tsx`             |
| SignIn (+ 2FA + backup)   | Auth.SignIn               | `pages/SignIn.tsx`              |
| SignUp                    | Auth.SignUp               | `pages/SignUp.tsx`              |
| ForgotPassword            | Auth.ForgotPassword       | `pages/ForgotPassword.tsx`      |
| ResetPassword             | Auth.ResetPassword        | `pages/ResetPassword.tsx`       |
| AdminLogin                | Auth.AdminLogin           | `pages/AdminLogin.tsx`          |
| Contact                   | Auth.Contact / App        | `pages/Contact.tsx`             |
| Dashboard (live map)      | App.Tabs.Dashboard        | `pages/Index.tsx` (mobile)      |
| Requests (filter+claim)   | App.Tabs.Requests         | (subset of Index)               |
| Tasks (resolve/cancel)    | App.Tabs.Tasks            | (subset of Index)               |
| Profile (on-duty + GPS)   | App.Tabs.Profile          | (subset of Index)               |
| ChangePassword            | App.ChangePassword        | inline web modal                |
| TwoFactorSettings         | App.TwoFactorSettings     | inline web modal                |
| TwoFactorSetup (QR)       | App.TwoFactorSetup        | inline web modal                |
| SafeZones                 | App.SafeZones             | embedded panel                  |
| Chat                      | App.Chat                  | `components/crisis/TaskChatPanel.tsx` |
| AdminDashboard            | Admin.Admin               | `pages/admin/Dashboard.tsx`     |
| AdminUsers                | Admin.AdminUsers          | `pages/admin/Users.tsx`         |
| AdminRequests             | Admin.AdminRequests       | `pages/admin/Requests.tsx`      |
| AdminLogs                 | Admin.AdminLogs           | `pages/admin/Logs.tsx`          |
| NotFound                  | (any).NotFound            | `pages/NotFound.tsx`            |

## Live features

- **Tap-to-pin crisis map**. The Dashboard renders all active requests as
  Lucide icon markers, color-coded by crisis type. Tapping the map drops a
  pin used as the location for new requests. A "Use my location" button
  fills the pin from `expo-location`.
- **On-duty volunteer tracking**. Toggle "On Duty" in Profile to start
  watching the device location and pushing periodic updates to
  `/api/volunteer/location` via `expo-location`. Other clients see those
  updates rendered as live green dots on the map.
- **Driving directions, ETA, alternative routes**. When a volunteer claims
  a task, the map draws a solid blue polyline from their current location
  to the crisis, plus dashed alternative routes when available. The overlay
  shows the live distance + ETA. Real Google Directions are used when
  `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY` is set; otherwise a Haversine
  straight-line + average-speed estimate is used as a graceful fallback.
- **Map controls**. Top-right of every map: tap to cycle Standard ↔
  Satellite ↔ Hybrid view. On Android there's also a heatmap toggle
  derived from the active-request density.
- **Open in Maps**. When the volunteer is on an active task, an "Open in
  Maps" pill appears on the map and deep-links into Google Maps (Android
  + iOS) for turn-by-turn navigation. Falls back to the platform's `geo:`
  scheme if Google Maps isn't installed.
- **Live coordination chat**. Reachable from a claimed task or directly
  from the Dashboard's active-task panel. Uses the same Socket.IO
  protocol as the web (`join_chat`, `send_chat_message`, `chat_history`,
  `chat_message`) — only the requester, assigned volunteer, and admins
  can join a thread.
- **Access control**. The Dashboard feed shows **only your own requests**;
  other people's reports remain visible as map markers (and as heatmap
  density). Volunteers see a locked "Claim" button with an explanation
  banner whenever they're already on an active task — mirrors the
  server's HTTP 409 enforcement.
- **Socket.IO**. `src/hooks/useSocket.ts` connects to the same backend
  as the web app, listens to `new_crisis`, `crisis_claimed`,
  `crisis_resolved`, `volunteer_alert`, `volunteer_location`,
  `priority_alert`, `chat_message`, `chat_history`, and `security_alert`,
  and authenticates with the persisted Bearer token.
- **Session timeout**. Auto-logout after 15 minutes idle, with a 60-second
  warning modal that lets the user extend the session.
- **2FA settings**. Set up via QR code, regenerate backup codes, disable
  with password — uses the same `/api/auth/2fa/*` endpoints.

## API parity

`src/api/client.ts` exposes the **same method names and signatures** as the web
`src/lib/api.ts`, so nothing else needs to change to call the existing backend:

```ts
api.login({ email, password });
api.createRequest({ type, description, lat, lng });
api.claimRequest(id);
// …etc.
```

`localStorage` calls are replaced with `AsyncStorage`. Auth tokens are bootstrapped
on app start (`bootstrapAuthToken`) so the user remains signed in across launches.

## Polish & UX

- Every screen wraps its content in `<Screen>`, which provides:
  - `SafeAreaView` with status-bar colors
  - `KeyboardAvoidingView` (iOS-style padding)
  - `ScrollView` with refresh control where applicable
- Centralized `<Toast>` provider replaces Sonner.
- `<ErrorBoundary>` catches render-time errors and renders a recovery UI.
- All inputs surface inline validation errors styled with the destructive token.
- Buttons have `loading` and `disabled` states with built-in spinners.
- Pull-to-refresh on Dashboard, Requests, Tasks, Admin.

## Running locally

```bash
cd mobile
npm install            # or: bun install / yarn
npx expo start         # press i for iOS sim, a for Android emulator
```

Set the backend URL via env (defaults to `https://aidbridge-34695e4b061e.herokuapp.com`):

```bash
export EXPO_PUBLIC_API_BASE_URL=https://your-api.example.com
```

## Android build notes

The copy-paste build and install commands, plus the Metro/debug APK error we hit, are documented in [ANDROID_BUILD_NOTES.md](ANDROID_BUILD_NOTES.md).

### Google Maps API keys

The map uses Google Maps under the hood on Android (and on iOS when an API
key is provided; otherwise iOS falls back to Apple Maps and works key-less).
Both are configured in `app.json`:

```json
"ios":     { "config": { "googleMapsApiKey": "YOUR_IOS_KEY" } },
"android": { "config": { "googleMaps": { "apiKey": "YOUR_ANDROID_KEY" } } }
```

> **Important — Expo Go ignores the key in app.json.** Expo Go is a single
> binary distributed by Expo with its own bundled Google Maps key. If your
> map renders as a blank cream tile with the Google logo bottom-left, that
> means the bundled key isn't authorized for your usage and the key in your
> `app.json` isn't being read.
>
> To use your own key you have to build a development client (or release
> build):
>
> ```bash
> npx expo prebuild --clean    # generates android/ + ios/ from app.json
> npx expo run:android         # builds and installs on your device/emulator
> ```
>
> The first time, `prebuild` will inject `<meta-data
> android:name="com.google.android.geo.API_KEY" .../>` into
> AndroidManifest.xml from the value in `app.json`. After that the dev
> client picks up your key and tiles render normally. The Heroku env var
> `VITE_GOOGLE_MAPS_API_KEY` is only used by the web build (Vite); it has
> no effect on the native mobile app.

Don't forget to enable **Maps SDK for Android** (and iOS, if you want
Google Maps on iOS) in your Google Cloud project, and restrict the key to
your app's package name + SHA-1 fingerprint for production.

### Backend integrations preserved

Because the mobile API client mirrors the web client method-for-method, all
of the backend integrations the web app already provides keep working —
no server changes are needed:

- **Database (Firebase Firestore)** — `server/firestoreDb.ts` (using the
  Firebase Admin SDK) is the runtime data store. All reads and writes go
  through the existing Express routes; the mobile app never touches
  Firestore directly. `firestore.rules` denies direct client access by
  design — everything is gated by the API.
- **Email (Resend)** — registration confirmations, password resets,
  contact form, volunteer alerts on new requests, claim notifications, and
  resolved-request notifications are dispatched server-side. The app just
  calls `forgotPassword`, `resetPassword`, `submitContact`, etc.

  > Mail not arriving? The server uses Resend with the default sender
  > `onboarding@resend.dev`. On Resend's free tier this address can only
  > deliver to the email registered with the Resend account. To receive
  > mail at any address (including a regular Gmail), verify a domain in
  > the Resend dashboard and update `FROM` in `server/email.ts`. Also
  > confirm `RESEND_API_KEY` is exported in the server environment —
  > without it `ensureResend()` throws and the server logs
  > `"Missing RESEND_API_KEY"` for every send.
- **2FA (speakeasy + qrcode)** — `setup2FA` returns a `qrCodeDataUrl` that
  the mobile setup screen renders directly via `<Image>`. Verification,
  backup codes, and disable use the same routes as the web.
- **Socket.IO** — same path (`/socket.io`), same events, authenticated with
  the persisted Bearer token.
- **Rate limiting / helmet / audit logs** — server-enforced, transparent
  to clients.

## CIRO — Crisis Intelligence & Response Orchestrator

The CIRO tab (Radio icon, fourth tab) gives every authenticated user access to the
four-agent Google Antigravity pipeline built for Challenge 3.

### What CIRO Does

CIRO fuses signals from multiple sources (social media, weather, traffic, sensors,
field reports, emergency calls), detects and classifies the crisis, allocates
constrained emergency resources, simulates coordinated response actions, and produces
a full Antigravity trace log — all in one pipeline run.

### Screen Layout

The CIRO tab has four inner sub-tabs:

| Tab | Content |
|---|---|
| **Signals** | Raw signal cards color-coded by credibility score; noise/stale signals shown dimmed with a reason; contradictions flagged in orange |
| **Trace** | Full Antigravity agent trace — every reasoning step, tool call, decision, warning, and outcome with timestamps and color-coded agent badges (Sentinel=blue, Analyst=purple, Strategist=orange, Executor=green) |
| **Outcome** | Google Maps view with before/after route polylines (red dashed = congested before; green solid = rerouted after), affected radius circles, and signal markers. Below: before/after state cards (response time, congestion, population exposed, lives saved), severity bar, duration estimate, uncertainty range, action chain with per-action side effects, and cost/latency summary |
| **Alerts** | Five tailored stakeholder alert cards (General Public, Hospital, Utility Companies, Transport Authority, Media/Command Center) with channel type and sent/failed status. Below: resource allocation cards per crisis location with trade-off reasoning |

### Scenarios

Select a scenario from the horizontal scroll picker before running:

| Scenario | What Is Demonstrated |
|---|---|
| **Urban Flooding — G-10** | Standard 5-source fusion with a conflicting water-main hypothesis |
| **Dual Crisis — Flood + Heatwave** | Multi-crisis resource split with explicit trade-off log |
| **False Alarm — Building Collapse** | Alert retraction and severity downgrade after field verification |
| **Degraded Mode — API Failure** | Cached-data fallback, failed-action retry, fallback log |

### How to Use

1. Open the app and sign in (any role can access CIRO)
2. Tap the **CIRO** tab (Radio icon)
3. Scroll the scenario selector and tap a scenario card to select it
4. Tap **Run Antigravity Agents** — a pulsing loader appears (25–60 seconds)
5. Results auto-open on the **Trace** tab; switch between tabs to explore
6. Tap the refresh icon (top-right) to reset and run another scenario

### API Methods (src/api/client.ts)

```typescript
api.getCIROScenarios()                     // GET /api/ciro/scenarios
api.getCIROScenario(id: string)            // GET /api/ciro/scenario/:id
api.runCIROAnalysis(scenarioId: string)    // POST /api/ciro/analyze
```

### Backend Connection

The Expo app connects to the backend via `extra.apiBaseUrl` in `app.json`.
For the Replit dev environment this is set to the Replit dev domain.
For a standalone demo, update `apiBaseUrl` to your production backend URL and
rebuild with `npx expo prebuild` before running on a real device.

### Performance

- Pipeline takes 25–60 seconds (4 sequential OpenAI calls)
- A 90-second timeout is enforced with a clear error message
- Cost per run: approximately $0.0012 USD (gpt-4o-mini)

---

## Building for production

```bash
# Recommended: EAS Build
npm install -g eas-cli
eas build -p ios
eas build -p android
```

Update `app.json > expo.ios.bundleIdentifier` and `expo.android.package`
to match your distribution profile before shipping.
