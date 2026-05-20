const API_BASE = "";

let authToken: string | null = localStorage.getItem("crisisgrid_token");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("crisisgrid_token", token);
  } else {
    localStorage.removeItem("crisisgrid_token");
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  register: (data: { email: string; password: string; name: string; role: string; phone?: string; address?: string }) =>
    apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  forgotPassword: (email: string) =>
    apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/api/auth/change-password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) }),

  get2FAStatus: () => apiFetch("/api/auth/2fa/status"),

  setup2FA: () => apiFetch("/api/auth/2fa/setup", { method: "POST" }),

  enable2FA: (code: string) =>
    apiFetch("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) }),

  disable2FA: (password: string) =>
    apiFetch("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) }),

  verify2FALogin: (params: { twoFactorToken: string; code?: string; backupCode?: string }) =>
    apiFetch("/api/auth/2fa/verify-login", { method: "POST", body: JSON.stringify(params) }),

  regenerateBackupCodes: (code: string) =>
    apiFetch("/api/auth/2fa/backup-codes/regenerate", { method: "POST", body: JSON.stringify({ code }) }),

  getRequests: () => apiFetch("/api/requests"),

  getMyRequests: () => apiFetch("/api/requests/mine"),

  createRequest: (data: { type: string; description: string; lat: number; lng: number }) =>
    apiFetch("/api/requests", { method: "POST", body: JSON.stringify(data) }),

  claimRequest: (requestId: string) =>
    apiFetch("/api/tasks/claim", { method: "POST", body: JSON.stringify({ requestId }) }),

  getMyTasks: () => apiFetch("/api/tasks/mine"),

  getTaskHistory: () => apiFetch("/api/tasks/history"),

  resolveRequest: (requestId: string) =>
    apiFetch(`/api/requests/${requestId}/resolve`, { method: "POST" }),

  cancelRequest: (requestId: string) =>
    apiFetch(`/api/requests/${requestId}/cancel`, { method: "POST" }),

  reportFraud: (requestId: string, reason: string) =>
    apiFetch(`/api/requests/${requestId}/report-fraud`, { method: "POST", body: JSON.stringify({ reason }) }),

  submitContact: (data: { orgName: string; contactName: string; email: string; phone?: string; message: string }) =>
    apiFetch("/api/contact", { method: "POST", body: JSON.stringify(data) }),

  updateVolunteerLocation: (lat: number, lng: number) =>
    apiFetch("/api/volunteer/location", { method: "POST", body: JSON.stringify({ lat, lng }) }),

  setVolunteerAvailability: (isAvailable: boolean) =>
    apiFetch("/api/volunteer/availability", { method: "POST", body: JSON.stringify({ isAvailable }) }),

  adminGetStats: () => apiFetch("/api/admin/stats"),

  adminGetUsers: (params: { search?: string; role?: string; banned?: boolean; locked?: boolean; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.role) sp.set("role", params.role);
    if (params.banned !== undefined) sp.set("banned", String(params.banned));
    if (params.locked !== undefined) sp.set("locked", String(params.locked));
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiFetch(`/api/admin/users?${sp.toString()}`);
  },

  adminChangeRole: (userId: number, newRole: string) =>
    apiFetch(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role: newRole }) }),

  adminToggleBan: (userId: number, banned: boolean) =>
    apiFetch(`/api/admin/users/${userId}/ban`, { method: "PATCH", body: JSON.stringify({ banned }) }),

  adminUnlockUser: (userId: number) =>
    apiFetch(`/api/admin/users/${userId}/unlock`, { method: "PATCH" }),

  adminGetLogs: (params: { search?: string; action?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.action) sp.set("action", params.action);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    return apiFetch(`/api/admin/logs?${sp.toString()}`);
  },

  adminGetRequests: () => apiFetch("/api/admin/requests"),

  adminGetSecuritySummary: () => apiFetch("/api/admin/security-summary"),

  getSafeZones: () => apiFetch("/api/safe-zones"),

  adminCreateSafeZone: (data: { name: string; type: string; lat: number; lng: number; description?: string }) =>
    apiFetch("/api/admin/safe-zones", { method: "POST", body: JSON.stringify(data) }),

  adminDeleteSafeZone: (id: number) =>
    apiFetch(`/api/admin/safe-zones/${id}`, { method: "DELETE" }),

  health: () => apiFetch("/api/health"),

  getMyShift: () => apiFetch("/api/volunteer/shift"),

  adminGetVolunteerShifts: () => apiFetch("/api/admin/volunteer-shifts"),

  getAdminRequests: () => apiFetch("/api/admin/requests"),

  agentDispatch: (requestId: string) =>
    apiFetch("/api/tasks/agent-dispatch", { method: "POST", body: JSON.stringify({ requestId }) }),
};
