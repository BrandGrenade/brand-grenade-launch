// PLATFORM RELIABILITY LAYER
//
// A single supervisor that applies the same four guarantees to EVERY
// long-running background job on the platform, instead of one bespoke
// watchdog per failure mode:
//
//   1. TIMEOUT DETECTION — any job sitting in a non-terminal state whose
//      heartbeat has been quiet longer than the domain's timeout is flagged
//      stalled by the system, not by a human noticing.
//   2. AUTO-RETRY WITH BACKOFF — a stalled job is recovered automatically,
//      up to `maxAttempts` times, with growing gaps between attempts.
//   3. DEAD-MAN'S-SWITCH — "quiet" is measured from the job's own progress
//      heartbeat, so a dispatched-but-never-started job (no heartbeat at all)
//      trips the same logic as a job that dies mid-stream.
//   4. ESCALATION LAST — only when retries are exhausted is the job written
//      to a terminal failed state with the real last_error, and marked
//      `escalated` in public.job_supervision for the UI to surface.
//
// State lives in public.job_supervision (domain, job_id) so attempts survive
// worker death, deploys, and browser closure.

type Admin = {
  from: (t: string) => any;
};

export interface SupervisedJob {
  jobId: string;
  ownerUserId?: string | null;
  /** How long the job's heartbeat has been quiet, in ms. */
  quietMs: number;
  /** Human-readable context shown on escalation. */
  detail?: string;
  /** Anything the domain wants back in recover()/escalate(). */
  row?: Record<string, unknown>;
}

export interface JobDomain {
  /** Stable key stored in job_supervision.domain. */
  name: string;
  /** Generous ceiling on expected quiet time before a job is stalled. */
  timeoutMs: number;
  /** Automatic attempts before a human is involved. */
  maxAttempts: number;
  /** Backoff before attempt N (1-indexed), in ms. */
  backoffMs?: (attempt: number) => number;
  /** All currently non-terminal jobs whose heartbeat is quiet past timeoutMs. */
  list(admin: Admin): Promise<SupervisedJob[]>;
  /**
   * Attempt automatic recovery. Must throw on failure. Domains whose work can
   * only be resumed from the browser omit this: they escalate immediately
   * after the timeout, which is still better than hanging forever.
   */
  recover?(admin: Admin, job: SupervisedJob): Promise<void>;
  /** Write a terminal failed state carrying `message` as the last error. */
  escalate(admin: Admin, job: SupervisedJob, message: string): Promise<void>;
}

export const DEFAULT_BACKOFF = (attempt: number): number =>
  [60_000, 180_000, 600_000][Math.min(attempt, 3) - 1] ?? 600_000;

export interface SupervisionOutcome {
  domain: string;
  jobId: string;
  action: "recovered" | "retry-failed" | "escalated" | "waiting-backoff" | "already-escalated";
  attempts: number;
  error?: string;
}

interface SupervisionRow {
  id: string;
  attempts: number;
  state: string;
  next_attempt_at: string | null;
  last_error: string | null;
}

async function loadRow(
  admin: Admin,
  domain: string,
  job: SupervisedJob,
): Promise<SupervisionRow> {
  const { data } = await admin
    .from("job_supervision")
    .select("id, attempts, state, next_attempt_at, last_error")
    .eq("domain", domain)
    .eq("job_id", job.jobId)
    .maybeSingle();
  if (data) return data as SupervisionRow;

  const { data: inserted } = await admin
    .from("job_supervision")
    .insert({
      domain,
      job_id: job.jobId,
      owner_user_id: job.ownerUserId ?? null,
      state: "watching",
      attempts: 0,
      detail: job.detail ?? null,
    })
    .select("id, attempts, state, next_attempt_at, last_error")
    .single();
  return (inserted as SupervisionRow) ?? {
    id: "",
    attempts: 0,
    state: "watching",
    next_attempt_at: null,
    last_error: null,
  };
}

async function patchRow(admin: Admin, id: string, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  await admin.from("job_supervision").update(patch).eq("id", id);
}

/** Clear supervision for a job that is healthy/terminal again. */
export async function clearSupervision(
  admin: Admin,
  domain: string,
  jobId: string,
): Promise<void> {
  await admin
    .from("job_supervision")
    .update({ state: "cleared", attempts: 0, next_attempt_at: null, last_error: null })
    .eq("domain", domain)
    .eq("job_id", jobId);
}

export async function superviseDomain(
  admin: Admin,
  domain: JobDomain,
  opts: { force?: boolean; onlyJobId?: string; deadline?: number } = {},
): Promise<SupervisionOutcome[]> {
  const out: SupervisionOutcome[] = [];
  let jobs: SupervisedJob[] = [];
  try {
    jobs = await domain.list(admin);
  } catch (e) {
    console.error(`[reliability:${domain.name}] list failed`, e);
    return out;
  }

  for (const job of jobs) {
    if (opts.onlyJobId && job.jobId !== opts.onlyJobId) continue;
    if (!opts.force && job.quietMs < domain.timeoutMs) continue;
    if (opts.deadline && Date.now() > opts.deadline) break;

    const row = await loadRow(admin, domain.name, job);

    if (row.state === "escalated" && !opts.force) {
      out.push({ domain: domain.name, jobId: job.jobId, action: "already-escalated", attempts: row.attempts });
      continue;
    }

    const nextAt = row.next_attempt_at ? Date.parse(row.next_attempt_at) : 0;
    if (!opts.force && nextAt && Date.now() < nextAt) {
      out.push({ domain: domain.name, jobId: job.jobId, action: "waiting-backoff", attempts: row.attempts });
      continue;
    }

    const attempts = row.attempts + 1;
    const backoff = (domain.backoffMs ?? DEFAULT_BACKOFF)(attempts);

    // Retry budget exhausted, or this domain cannot be resumed server-side:
    // escalate with the real error, and stop touching it automatically.
    if (!domain.recover || attempts > domain.maxAttempts) {
      const message =
        row.last_error ??
        (domain.recover
          ? `Automatic recovery failed after ${domain.maxAttempts} attempts.`
          : `Run stalled for ${Math.round(job.quietMs / 60_000)} min with no progress and cannot be resumed automatically.`);
      try {
        await domain.escalate(admin, job, message);
      } catch (e) {
        console.error(`[reliability:${domain.name}] escalate failed`, e);
      }
      await patchRow(admin, row.id, {
        state: "escalated",
        attempts: row.attempts,
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: null,
        last_error: message,
        detail: job.detail ?? null,
      });
      out.push({ domain: domain.name, jobId: job.jobId, action: "escalated", attempts: row.attempts, error: message });
      continue;
    }

    // Claim the attempt BEFORE running it: if this worker dies mid-recovery,
    // the attempt is still counted and the backoff prevents a hot loop.
    await patchRow(admin, row.id, {
      state: "retrying",
      attempts,
      owner_user_id: job.ownerUserId ?? null,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: new Date(Date.now() + backoff).toISOString(),
      detail: job.detail ?? null,
    });

    try {
      await domain.recover(admin, job);
      await patchRow(admin, row.id, {
        state: "recovered",
        next_attempt_at: null,
        last_error: null,
      });
      out.push({ domain: domain.name, jobId: job.jobId, action: "recovered", attempts });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await patchRow(admin, row.id, { state: "watching", last_error: message });
      out.push({ domain: domain.name, jobId: job.jobId, action: "retry-failed", attempts, error: message });
      console.error(`[reliability:${domain.name}:${job.jobId}] attempt ${attempts} failed: ${message}`);
    }
  }

  return out;
}
