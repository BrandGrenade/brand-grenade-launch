// Registry of every long-running background job on the platform, expressed in
// the common supervision contract (see supervisor.server.ts).
//
// Adding a new long-running job means adding a domain here — the timeout,
// dead-man's-switch, auto-retry, backoff and escalation behaviour then come
// for free instead of being reinvented as another bespoke watchdog.

import { DEFAULT_BACKOFF, type JobDomain, type SupervisedJob } from "./supervisor.server";

type Admin = { from: (t: string) => any };

const quietSince = (...times: (string | null | undefined)[]): number => {
  const stamps = times
    .filter(Boolean)
    .map((t) => Date.parse(t as string))
    .filter((n) => Number.isFinite(n));
  if (!stamps.length) return Number.POSITIVE_INFINITY;
  return Date.now() - Math.max(...stamps);
};

/* ------------------------------------------------------------------ */
/* 1. Intelligence Lab analysis — fully recoverable server-side.       */
/* ------------------------------------------------------------------ */

// Observed healthy runs heartbeat every few seconds while streaming and
// complete inside ~15 min. Dispatch (queued -> first layer) is seconds.
const INTEL_QUEUED_MS = 90_000; // dead-man's-switch on a lost dispatch
const INTEL_RUNNING_MS = 5 * 60_000; // dead stream mid-run

const intelligenceDomain: JobDomain = {
  name: "intelligence",
  timeoutMs: INTEL_QUEUED_MS,
  maxAttempts: 3,
  backoffMs: DEFAULT_BACKOFF,
  async list(admin) {
    const { data } = await admin
      .from("intelligence_sessions")
      .select("id, user_id, brand_name, status, stage_status, updated_at, started_at")
      .eq("status", "running");
    const jobs: SupervisedJob[] = [];
    for (const row of (data ?? []) as Record<string, string>[]) {
      // A stalled territory revision must never escalate into a full re-run:
      // the stored report is still valid, so it is released, not retried.
      if (row.stage_status?.startsWith("revising:")) continue;
      const quiet = quietSince(row.updated_at, row.started_at);
      const threshold = row.stage_status === "queued" ? INTEL_QUEUED_MS : INTEL_RUNNING_MS;
      if (quiet < threshold) continue;
      jobs.push({
        jobId: row.id,
        ownerUserId: row.user_id,
        quietMs: quiet,
        detail: `${row.brand_name ?? "Intelligence run"} — ${row.stage_status ?? "running"}`,
        row,
      });
    }
    return jobs;
  },
  async recover(admin, job) {
    const { executeIntelligenceRun } = await import("@/lib/intelligence.functions");
    const r = await executeIntelligenceRun(admin as never, job.ownerUserId ?? undefined, job.jobId, true);
    if (!r.success) throw new Error(r.error ?? "Intelligence run failed");
  },
  async escalate(admin, job, message) {
    await admin
      .from("intelligence_sessions")
      .update({ status: "failed", last_error: message })
      .eq("id", job.jobId);
  },
};

/** Separate, non-retrying domain: stalled per-territory revisions. */
const intelligenceReviseDomain: JobDomain = {
  name: "intelligence-revise",
  timeoutMs: 5 * 60_000,
  maxAttempts: 0,
  async list(admin) {
    const { data } = await admin
      .from("intelligence_sessions")
      .select("id, user_id, status, stage_status, updated_at")
      .eq("status", "running");
    return ((data ?? []) as Record<string, string>[])
      .filter((r) => r.stage_status?.startsWith("revising:"))
      .map((r) => ({
        jobId: r.id,
        ownerUserId: r.user_id,
        quietMs: quietSince(r.updated_at),
        detail: "Territory revision",
      }))
      .filter((j) => j.quietMs >= 5 * 60_000);
  },
  async escalate(admin, job) {
    await admin
      .from("intelligence_sessions")
      .update({
        status: "complete",
        stage_status: "complete:10",
        last_error: "Territory revision stalled — the original territory was kept.",
      })
      .eq("id", job.jobId);
  },
};

/* ------------------------------------------------------------------ */
/* 2. Big idea sweep (37 lenses) — recoverable by driving more slices. */
/* ------------------------------------------------------------------ */

const bigIdeaDomain: JobDomain = {
  name: "big-idea-sweep",
  timeoutMs: 150_000,
  maxAttempts: 3,
  async list(admin) {
    const { data } = await admin
      .from("stimulus_runs")
      .select("id, session_id, status, last_batch_at, updated_at")
      .eq("run_mode", "big_idea")
      .in("status", ["generating", "failed"]);
    const jobs: SupervisedJob[] = [];
    for (const run of (data ?? []) as Record<string, string>[]) {
      const { count } = await admin
        .from("stimulus_directions")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id)
        .in("status", ["pending", "failed"]);
      if (!count) continue;
      jobs.push({
        jobId: run.id,
        quietMs: quietSince(run.last_batch_at, run.updated_at),
        detail: `Big idea sweep — ${count} lenses outstanding`,
        row: run,
      });
    }
    return jobs;
  },
  async recover(admin, job) {
    const { driveBigIdeaSweep } = await import("@/lib/stimulus/big-idea-sweep.server");
    await admin
      .from("stimulus_runs")
      .update({ status: "generating", error: null, last_batch_at: new Date().toISOString() })
      .eq("id", job.jobId);
    await driveBigIdeaSweep(job.jobId);
  },
  async escalate(admin, job, message) {
    await admin.from("stimulus_runs").update({ status: "failed", error: message }).eq("id", job.jobId);
  },
};

/* ------------------------------------------------------------------ */
/* 3. Creative orchestration state machine — recoverable by stepping.  */
/* ------------------------------------------------------------------ */

const ORCH_SLICE_MS = 45_000;

const orchestrationDomain: JobDomain = {
  name: "orchestration",
  timeoutMs: 90_000,
  maxAttempts: 3,
  async list(admin) {
    const { data } = await admin
      .from("stimulus_orchestrations")
      .select("id, session_id, status, driver_status, driver_heartbeat_at, updated_at")
      .not("status", "in", '("complete")');
    return ((data ?? []) as Record<string, string>[])
      .filter((r) => r.driver_status !== "cancelled")
      .map((r) => ({
        jobId: r.id,
        quietMs: quietSince(r.driver_heartbeat_at, r.updated_at),
        detail: `Creative orchestration — ${r.status ?? "running"}`,
        row: r,
      }));
  },
  async recover(admin, job) {
    const sessionId = (job.row as { session_id?: string } | undefined)?.session_id;
    const { data: session } = await admin
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .maybeSingle();
    const userId = (session as { user_id?: string } | null)?.user_id;
    if (!userId) throw new Error("Orchestration has no owning session user");

    const { orchestrationStep } = await import("@/lib/stimulus/orchestration-core.server");
    await admin
      .from("stimulus_orchestrations")
      .update({ driver_status: "running", driver_heartbeat_at: new Date().toISOString(), error: null })
      .eq("id", job.jobId);

    const started = Date.now();
    for (;;) {
      const r = await orchestrationStep(job.jobId, userId);
      if (r.done) {
        await admin
          .from("stimulus_orchestrations")
          .update({ driver_status: "idle", driver_heartbeat_at: new Date().toISOString() })
          .eq("id", job.jobId);
        break;
      }
      if (Date.now() - started > ORCH_SLICE_MS) break;
    }
  },
  async escalate(admin, job, message) {
    await admin
      .from("stimulus_orchestrations")
      .update({ driver_status: "failed", error: message })
      .eq("id", job.jobId);
  },
};

/* ------------------------------------------------------------------ */
/* 4. Pipeline stages — browser-driven streams; released, not retried. */
/* ------------------------------------------------------------------ */

const pipelineStageDomain: JobDomain = {
  name: "pipeline-stage",
  timeoutMs: 8 * 60_000,
  maxAttempts: 0,
  async list(admin) {
    const { data } = await admin
      .from("sessions")
      .select("id, user_id, brand_name, status, stage_status, updated_at, last_heartbeat_at, stage_started_at")
      .eq("status", "running");
    return ((data ?? []) as Record<string, string>[])
      .filter((r) => (r.stage_status ?? "").startsWith("running:"))
      .map((r) => ({
        jobId: r.id,
        ownerUserId: r.user_id,
        quietMs: quietSince(r.last_heartbeat_at, r.updated_at, r.stage_started_at),
        detail: `${r.brand_name ?? "Pipeline"} — ${r.stage_status}`,
        row: r,
      }))
      .filter((j) => j.quietMs >= 8 * 60_000);
  },
  async escalate(admin, job, message) {
    const stage = String((job.row as { stage_status?: string })?.stage_status ?? "running:?").split(":")[1];
    await admin
      .from("sessions")
      .update({ status: "interrupted", stage_status: `interrupted:${stage}` })
      .eq("id", job.jobId);
    console.error(`[reliability:pipeline-stage:${job.jobId}] ${message}`);
  },
};

/* ------------------------------------------------------------------ */
/* 5. Left-of-Centre engine — released for retry from the UI.          */
/* ------------------------------------------------------------------ */

const locDomain: JobDomain = {
  name: "loc",
  timeoutMs: 12 * 60_000,
  maxAttempts: 0,
  async list(admin) {
    const { data } = await admin
      .from("sessions")
      .select("id, user_id, brand_name, loc_status, updated_at, last_heartbeat_at")
      .eq("loc_status", "running");
    return ((data ?? []) as Record<string, string>[])
      .map((r) => ({
        jobId: r.id,
        ownerUserId: r.user_id,
        quietMs: quietSince(r.last_heartbeat_at, r.updated_at),
        detail: `${r.brand_name ?? "Session"} — Left-of-Centre engine`,
      }))
      .filter((j) => j.quietMs >= 12 * 60_000);
  },
  async escalate(admin, job, message) {
    await admin
      .from("sessions")
      .update({ loc_status: "failed", loc_error: message })
      .eq("id", job.jobId);
  },
};

/* ------------------------------------------------------------------ */
/* 6. Document generation — released to `error` so the UI can re-run.  */
/* ------------------------------------------------------------------ */

const DOC_FORMATS = [
  { status: "doc_consulting_status", at: "doc_consulting_status_at", label: "Consulting document" },
  { status: "doc_agency_status", at: "doc_agency_status_at", label: "Agency document" },
  { status: "doc_workshop_status", at: "doc_workshop_status_at", label: "Workshop document" },
] as const;

const documentDomains: JobDomain[] = DOC_FORMATS.map((fmt) => ({
  name: `document:${fmt.status}`,
  timeoutMs: 10 * 60_000,
  maxAttempts: 0,
  async list(admin: Admin) {
    const { data } = await admin
      .from("sessions")
      .select(`id, user_id, brand_name, ${fmt.status}, ${fmt.at}, updated_at`)
      .eq(fmt.status, "generating");
    return ((data ?? []) as Record<string, string>[])
      .map((r) => ({
        jobId: r.id,
        ownerUserId: r.user_id,
        quietMs: quietSince(r[fmt.at], r.updated_at),
        detail: `${r.brand_name ?? "Session"} — ${fmt.label}`,
      }))
      .filter((j) => j.quietMs >= 10 * 60_000);
  },
  async escalate(admin: Admin, job: SupervisedJob, message: string) {
    await admin
      .from("sessions")
      .update({ [fmt.status]: "error", [fmt.at]: new Date().toISOString() })
      .eq("id", job.jobId);
    console.error(`[reliability:${fmt.status}:${job.jobId}] ${message}`);
  },
}));

export const JOB_DOMAINS: JobDomain[] = [
  intelligenceDomain,
  intelligenceReviseDomain,
  bigIdeaDomain,
  orchestrationDomain,
  pipelineStageDomain,
  locDomain,
  ...documentDomains,
];

export function findDomain(name: string): JobDomain | undefined {
  return JOB_DOMAINS.find((d) => d.name === name);
}
