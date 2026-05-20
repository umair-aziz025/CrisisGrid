import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * Mobile API client. Mirrors the web app's `src/lib/api.ts` interface
 * exactly so existing business logic carries over unchanged. Differences:
 *  - `localStorage` is replaced by `AsyncStorage`.
 *  - The base URL comes from `expo.extra.apiBaseUrl` (or env override).
 */

const RAW_API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ||
  "https://aidbridge-34695e4b061e.herokuapp.com";

// Avoid accidental double slashes when app config includes a trailing '/'.
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

export const API_BASE_URL = API_BASE;

const TOKEN_KEY = "crisisgrid_token";
const USER_KEY = "crisisgrid_user";

let authToken: string | null = null;

export async function bootstrapAuthToken(): Promise<string | null> {
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
  return authToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function persistUser(user: unknown): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser<T = unknown>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function clearStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${normalizedPath}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    const detail = body.detail ? `: ${body.detail}` : "";
    throw new Error(`${body.error || `HTTP ${res.status}`}${detail}`);
  }

  return res.json();
}

export const api = {
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: string;
    phone?: string;
    address?: string;
  }) => apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  forgotPassword: (email: string) =>
    apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/api/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  verify2FALogin: (params: { twoFactorToken: string; code?: string; backupCode?: string }) =>
    apiFetch("/api/auth/2fa/verify-login", { method: "POST", body: JSON.stringify(params) }),

  get2FAStatus: () => apiFetch("/api/auth/2fa/status"),
  setup2FA: () => apiFetch("/api/auth/2fa/setup", { method: "POST" }),
  enable2FA: (code: string) =>
    apiFetch("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) }),
  disable2FA: (password: string) =>
    apiFetch("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) }),
  regenerateBackupCodes: (code: string) =>
    apiFetch("/api/auth/2fa/backup-codes/regenerate", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  getRequests: () => apiFetch("/api/requests"),
  getMyRequests: () => apiFetch("/api/requests/mine"),

  createRequest: (data: { type: string; description: string; lat: number; lng: number }) =>
    apiFetch("/api/requests", { method: "POST", body: JSON.stringify(data) }),

  claimRequest: (requestId: string) =>
    apiFetch("/api/tasks/claim", { method: "POST", body: JSON.stringify({ requestId }) }),

  agentDispatch: (requestId: string) =>
    apiFetch("/api/tasks/agent-dispatch", { method: "POST", body: JSON.stringify({ requestId }) }),

  getMyTasks: () => apiFetch("/api/tasks/mine"),
  getTaskHistory: () => apiFetch("/api/tasks/history"),

  registerPushToken: (token: string) =>
    apiFetch("/api/push/register", { method: "POST", body: JSON.stringify({ token }) }),

  unregisterPushToken: (token: string) =>
    apiFetch("/api/push/unregister", { method: "POST", body: JSON.stringify({ token }) }),

  unregisterAllPushTokens: () =>
    apiFetch("/api/push/unregister-all", { method: "POST" }),

  getMyPushTokens: () => apiFetch("/api/push/my-tokens"),

  resolveRequest: (requestId: string) =>
    apiFetch(`/api/requests/${requestId}/resolve`, { method: "POST" }),

  cancelRequest: (requestId: string) =>
    apiFetch(`/api/requests/${requestId}/cancel`, { method: "POST" }),

  reportFraud: (requestId: string, reason: string) =>
    apiFetch(`/api/requests/${requestId}/report-fraud`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  submitContact: (data: {
    orgName: string;
    contactName: string;
    email: string;
    phone?: string;
    message: string;
  }) => apiFetch("/api/contact", { method: "POST", body: JSON.stringify(data) }),

  updateVolunteerLocation: (lat: number, lng: number) =>
    apiFetch("/api/volunteer/location", { method: "POST", body: JSON.stringify({ lat, lng }) }),

  setVolunteerAvailability: (isAvailable: boolean) =>
    apiFetch("/api/volunteer/availability", {
      method: "POST",
      body: JSON.stringify({ isAvailable }),
    }),

  adminGetStats: () => apiFetch("/api/admin/stats"),
  adminGetRequests: () => apiFetch("/api/admin/requests"),
  adminGetSecuritySummary: () => apiFetch("/api/admin/security-summary"),

  adminChangeRole: (userId: number, newRole: string) =>
    apiFetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    }),
  adminToggleBan: (userId: number, banned: boolean) =>
    apiFetch(`/api/admin/users/${userId}/ban`, {
      method: "PATCH",
      body: JSON.stringify({ banned }),
    }),
  adminUnlockUser: (userId: number) =>
    apiFetch(`/api/admin/users/${userId}/unlock`, { method: "PATCH" }),
  adminResetCancelCount: (userId: number) =>
    apiFetch(`/api/admin/users/${userId}/reset-cancel-count`, { method: "PATCH" }),

  getMyShift: () => apiFetch("/api/volunteer/shift"),
  adminGetVolunteerShifts: () => apiFetch("/api/admin/volunteer-shifts"),

  getSafeZones: () => apiFetch("/api/safe-zones"),
  adminCreateSafeZone: (data: {
    name: string;
    type: string;
    lat: number;
    lng: number;
    description?: string;
  }) =>
    apiFetch("/api/admin/safe-zones", { method: "POST", body: JSON.stringify(data) }),
  adminDeleteSafeZone: (id: number) =>
    apiFetch(`/api/admin/safe-zones/${id}`, { method: "DELETE" }),

  adminGetUsers: (params: {
    search?: string;
    role?: string;
    banned?: boolean;
    locked?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.role) sp.set("role", params.role);
    if (params.banned !== undefined) sp.set("banned", String(params.banned));
    if (params.locked !== undefined) sp.set("locked", String(params.locked));
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiFetch(`/api/admin/users?${sp.toString()}`);
  },

  adminGetLogs: (params: { search?: string; action?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.action) sp.set("action", params.action);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiFetch(`/api/admin/logs?${sp.toString()}`);
  },

  health: () => apiFetch("/api/health"),

  getCIROScenarios: () => apiFetch("/api/ciro/scenarios"),
  getCIROScenario: (id: string) => apiFetch(`/api/ciro/scenario/${id}`),
  askCIRO: (question: string, context?: { scenarioId?: string; result?: unknown }) =>
    apiFetch("/api/ciro/chat", { method: "POST", body: JSON.stringify({ question, context }) }),

  runCIROAnalysis: async (scenarioId: string, sessionId?: string) => {
    // Step 1: Submit job (returns immediately with jobId)
    const submitRes = await fetch(`${API_BASE}/api/ciro/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ scenarioId, sessionId }),
    });

    if (submitRes.status !== 202) {
      const err = await submitRes.json();
      throw new Error(err.error || "Failed to start CIRO analysis");
    }

    const { jobId } = await submitRes.json();

    // Step 2: Poll for results (with timeout)
    return new Promise((resolve, reject) => {
      const maxAttempts = 120; // 2 minutes at 1s intervals
      let attempts = 0;

      const poll = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/ciro/job/${jobId}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          });

          if (!res.ok) {
            return reject(new Error("Job lookup failed"));
          }

          const job = await res.json();

          if (job.status === "done" && job.result) {
            resolve(job.result);
          } else if (job.status === "error") {
            reject(new Error(job.error || "Pipeline failed"));
          } else if (++attempts >= maxAttempts) {
            reject(new Error("Pipeline execution timeout (2 minutes exceeded)"));
          } else {
            // Poll again after 1 second
            setTimeout(poll, 1000);
          }
        } catch (err) {
          reject(err);
        }
      };

      // Start polling after a brief delay (let server start processing)
      setTimeout(poll, 500);
    });
  },
};

export type AuthUser = {
  id: number;
  fullName?: string;
  name?: string;
  email: string;
  role: string;
  publicId?: string | null;
};
