import { Router } from "express";
import type { Server as SocketServer } from "socket.io";
import { SCENARIOS } from "./mockData.js";
import { runCIROPipeline } from "./agents.js";
import type { AgentLogEntry } from "./agents.js";
import { createSignalStreamRoutes } from "./streamApis.js";
import { getApiCallLogs } from "./apiClient.js";

// Job store for tracking async pipeline execution
type PipelineJob = {
  jobId: string;
  scenarioId: string;
  status: "pending" | "processing" | "done" | "error";
  result?: any;
  error?: string;
  createdAt: number;
};

const jobStore = new Map<string, PipelineJob>();

export function createCIRORoutes(io?: SocketServer): Router {
  const router = Router();

  // ── Cleanup old jobs every 5 minutes (keep only last 1 hour) ────────────────
  setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour ago
    let cleaned = 0;
    for (const [jobId, job] of jobStore.entries()) {
      if (job.createdAt < cutoff) {
        jobStore.delete(jobId);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[CIRO] Cleaned ${cleaned} expired jobs`);
  }, 5 * 60 * 1000);

  // ── Mount all simulated streaming signal API endpoints ────────────────────
  router.use(createSignalStreamRoutes());

  // ── Scenario list ─────────────────────────────────────────────────────────
  router.get("/api/ciro/scenarios", (_req, res) => {
    const list = Object.values(SCENARIOS).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      signalCount: s.signals.length,
    }));
    res.json({ scenarios: list });
  });

  // ── Scenario detail ────────────────────────────────────────────────────────
  router.get("/api/ciro/scenario/:id", (req, res) => {
    const scenario = SCENARIOS[req.params.id];
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });
    res.json(scenario);
  });

  // ── Run CIRO pipeline (async, returns jobId to avoid Heroku 30s timeout) ────
  router.post("/api/ciro/analyze", (req, res) => {
    const { scenarioId, sessionId } = req.body as { scenarioId: string; sessionId?: string };
    const scenario = SCENARIOS[scenarioId];

    if (!scenario) {
      return res.status(404).json({ error: `Unknown scenario: ${scenarioId}` });
    }

    // Generate unique job ID
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    console.log(`[CIRO] POST /api/ciro/analyze — scenario="${scenarioId}" jobId="${jobId}" — returning immediately`);

    // Create job entry
    const job: PipelineJob = {
      jobId,
      scenarioId,
      status: "pending",
      createdAt: Date.now(),
    };
    jobStore.set(jobId, job);

    // Return job ID immediately (202 Accepted) — avoids Heroku 30s timeout
    res.status(202).json({ jobId, status: "pending", message: "Pipeline execution started. Use jobId to poll for results." });

    // Process pipeline in the background (non-blocking)
    setImmediate(async () => {
      try {
        job.status = "processing";

        // Build live-trace callback: emits each trace entry via Socket.IO
        const onTrace = (sessionId && io)
          ? (entry: AgentLogEntry) => {
              io.to(`ciro:${sessionId}`).emit("ciro_trace_entry", entry);
            }
          : undefined;

        console.log(`[CIRO] Background job ${jobId} — pipeline processing started`);
        const result = await runCIROPipeline(scenario, { onTrace });

        // Store result
        job.status = "done";
        job.result = result;

        // Notify session via Socket.IO
        if (sessionId && io) {
          io.to(`ciro:${sessionId}`).emit("ciro_complete", { completedAt: result.completedAt });
        }

        console.log(`[CIRO] Background job ${jobId} — pipeline complete (${result.antigravityTrace.length} trace entries)`);
      } catch (err) {
        job.status = "error";
        job.error = err instanceof Error ? err.message : "Unknown error";

        console.error(`[CIRO] Background job ${jobId} — pipeline error:`, job.error);

        if (sessionId && io) {
          io.to(`ciro:${sessionId}`).emit("ciro_error", { message: job.error });
        }
      }
    });
  });

  // ── Poll job status/result ─────────────────────────────────────────────────
  router.get("/api/ciro/job/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Return full result if done, otherwise just status
    if (job.status === "done" && job.result) {
      return res.json({ jobId, status: "done", result: job.result });
    }

    if (job.status === "error") {
      return res.status(500).json({ jobId, status: "error", error: job.error });
    }

    res.json({ jobId, status: job.status });
  });

  // ── API call log debug endpoint ────────────────────────────────────────────
  router.get("/api/ciro/api-calls", (_req, res) => {
    const logs = getApiCallLogs();
    res.json({
      totalCalls: logs.length,
      ok: logs.filter((l) => l.status === "ok").length,
      retried: logs.filter((l) => l.status === "retried").length,
      fallback: logs.filter((l) => l.status === "fallback").length,
      failed: logs.filter((l) => l.status === "error").length,
      calls: logs,
    });
  });

  return router;
}
