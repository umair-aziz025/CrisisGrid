import type { SignalSource } from "./mockData.js";

export type ApiIngestionResult = {
  scenario: string;
  totalSignals: number;
  signals: SignalSource[];
  sourceBreakdown: Array<{
    source: string;
    signalCount: number;
    latencyMs: number;
    status: "ok" | "error" | "cached";
    error?: string;
    fallback?: string;
  }>;
  fetchedAt: string;
  totalLatencyMs: number;
};

export type ApiCallLog = {
  endpoint: string;
  method: "GET" | "POST";
  params: Record<string, string>;
  status: "ok" | "error" | "retried" | "fallback";
  httpStatus: number;
  latencyMs: number;
  attempt: number;
  timestamp: string;
  error?: string;
};

// Central log of all API calls made during a pipeline run
export const apiCallLogs: ApiCallLog[] = [];

function recordApiCall(log: ApiCallLog) {
  apiCallLogs.push(log);
  const icon = log.status === "ok" ? "✓" : log.status === "retried" ? "↻" : log.status === "fallback" ? "⚡" : "✗";
  console.log(
    `[API_CLIENT][${icon}${log.status.toUpperCase()}] ${log.method} ${log.endpoint} | HTTP ${log.httpStatus} | ${log.latencyMs}ms | attempt=${log.attempt} | ts=${log.timestamp}`
  );
}

// Exponential backoff helper
function backoffDelay(attempt: number): Promise<void> {
  const delay = Math.min(200 * Math.pow(2, attempt - 1) + Math.random() * 100, 2000);
  console.log(`[API_CLIENT][RETRY] Waiting ${Math.round(delay)}ms before attempt ${attempt + 1}...`);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Core HTTP fetcher with retry + fallback
async function fetchWithRetry<T>(
  endpoint: string,
  params: Record<string, string> = {},
  maxRetries = 3,
  fallback?: () => T
): Promise<T> {
  const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
  const qs = new URLSearchParams(params).toString();
  const url = `${baseUrl}${endpoint}${qs ? `?${qs}` : ""}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const t0 = Date.now();
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json", "X-CIRO-Client": "antigravity-pipeline" },
        signal: AbortSignal.timeout(5000),
      });

      const latencyMs = Date.now() - t0;

      if (!response.ok) {
        // 503 = API offline — use fallback immediately, don't retry
        if (response.status === 503 && fallback) {
          recordApiCall({ endpoint, method: "GET", params, status: "fallback", httpStatus: response.status, latencyMs, attempt, timestamp: new Date().toISOString(), error: `HTTP 503` });
          console.log(`[API_CLIENT][FALLBACK] ${endpoint} returned 503 — activating fallback data source`);
          const body = await response.json() as T;
          return body; // 503 body still has cached signals
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as T;
      recordApiCall({ endpoint, method: "GET", params, status: attempt > 1 ? "retried" : "ok", httpStatus: response.status, latencyMs, attempt, timestamp: new Date().toISOString() });
      return data;
    } catch (err) {
      const latencyMs = Date.now() - t0;
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't log on last attempt — we'll handle below
      if (attempt < maxRetries) {
        recordApiCall({ endpoint, method: "GET", params, status: "error", httpStatus: 0, latencyMs, attempt, timestamp: new Date().toISOString(), error: lastError.message });
        console.warn(`[API_CLIENT][WARN] ${endpoint} attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
        await backoffDelay(attempt);
      }
    }
  }

  // All retries exhausted
  const latencyMs = 0;
  if (fallback) {
    recordApiCall({ endpoint, method: "GET", params, status: "fallback", httpStatus: 0, latencyMs, attempt: maxRetries, timestamp: new Date().toISOString(), error: `All ${maxRetries} retries failed: ${lastError?.message}` });
    console.error(`[API_CLIENT][FALLBACK] All retries exhausted for ${endpoint}. Using fallback. Error: ${lastError?.message}`);
    return fallback();
  }

  recordApiCall({ endpoint, method: "GET", params, status: "error", httpStatus: 0, latencyMs, attempt: maxRetries, timestamp: new Date().toISOString(), error: lastError?.message });
  throw lastError || new Error(`Failed to fetch ${endpoint} after ${maxRetries} attempts`);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all signals for a scenario via the /api/signals/ingest endpoint.
 * This is the primary entry point for all CIRO agents.
 */
export async function ingestSignals(scenario: string): Promise<ApiIngestionResult> {
  console.log(`[API_CLIENT][INGEST] Starting signal ingestion for scenario="${scenario}" via API`);
  const t0 = Date.now();

  const result = await fetchWithRetry<ApiIngestionResult>(
    "/api/signals/ingest",
    { scenario },
    3,
    // Fallback: return empty ingestion result with error note
    () => ({
      scenario,
      totalSignals: 0,
      signals: [],
      sourceBreakdown: [],
      fetchedAt: new Date().toISOString(),
      totalLatencyMs: Date.now() - t0,
    })
  );

  console.log(`[API_CLIENT][INGEST_DONE] scenario="${scenario}" | signals=${result.totalSignals} | latency=${result.totalLatencyMs}ms | sources=${result.sourceBreakdown?.map(s => `${s.source}:${s.status}`).join(", ")}`);
  return result;
}

/**
 * Fetch signals from a specific source API endpoint.
 */
export async function fetchSignalSource(
  source: "weather" | "traffic" | "social" | "emergency-calls" | "field-reports" | "sensors",
  scenario: string
): Promise<{ signals: SignalSource[]; latencyMs: number; status: string; error?: string }> {
  const t0 = Date.now();
  try {
    const data = await fetchWithRetry<{ signals: SignalSource[]; latencyMs: number; error?: string; fallback?: string }>(
      `/api/signals/${source}`,
      { scenario },
      2
    );
    return {
      signals: data.signals || [],
      latencyMs: Date.now() - t0,
      status: data.error ? "cached" : "ok",
      ...(data.error && { error: data.error }),
    };
  } catch (err) {
    console.error(`[API_CLIENT][SOURCE_FAIL] ${source} completely unavailable: ${err}`);
    return { signals: [], latencyMs: Date.now() - t0, status: "failed", error: String(err) };
  }
}

/**
 * Fetch API health/status
 */
export async function fetchSignalApiStatus(): Promise<Record<string, unknown>> {
  try {
    return await fetchWithRetry<Record<string, unknown>>("/api/signals/status", {}, 1);
  } catch {
    return { error: "status endpoint unavailable" };
  }
}

/**
 * Returns the running log of all API calls made during this process lifetime.
 * Used to build the Antigravity trace.
 */
export function getApiCallLogs(): ApiCallLog[] {
  return [...apiCallLogs];
}

export function clearApiCallLogs(): void {
  apiCallLogs.length = 0;
}
