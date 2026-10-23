import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runBigIdeaBatch } from "./big-idea-sweep.server";
import { sweepCreditExhausted, SWEEP_CREDIT_MESSAGE, sweepErrorRetryable, sweepLeaseLive, SWEEP_BATCH_SIZE, SWEEP_SLICE_BATCHES, SWEEP_COOLDOWN_MS } from "./sweep-job-policy";

// Every entry point consults the durable pause state. Only an explicit resume
// may clear a paused job; page views cannot restart terminal failures.
export async function queueSweepJob(runId: string, explicitResume = false): Promise<boolean> {
  const { data: job, error } = await supabaseAdmin.from("stimulus_sweep_jobs").select("*").eq("run_id", runId).maybeSingle();
  if (error) throw error;
  if (job && (sweepLeaseLive(job) || job.status === "queued" || job.status === "complete" || (job.status === "paused" && !explicitResume))) return false;
  if (!job) {
    const { error: insertError } = await supabaseAdmin.from("stimulus_sweep_jobs").insert({ run_id: runId });
    if (insertError?.code === "23505") return false;
    if (insertError) throw insertError;
  } else {
    const { error: updateError } = await supabaseAdmin.from("stimulus_sweep_jobs").update({ status: "queued", error: null, remaining_hops: 30, lease_token: null, lease_until: null, updated_at: new Date().toISOString() }).eq("run_id", runId).eq("updated_at", job.updated_at);
    if (updateError) throw updateError;
  }
  return true;
}

export async function claimSweepJob(runId: string) {
  const { data: job } = await supabaseAdmin.from("stimulus_sweep_jobs").select("*").eq("run_id", runId).single();
  if (!job || job.status !== "queued" || job.remaining_hops <= 0) return null;
  const token = crypto.randomUUID();
  const { data: claimed, error } = await supabaseAdmin.from("stimulus_sweep_jobs").update({ status: "running", lease_token: token, lease_until: new Date(Date.now() + 600_000).toISOString(), updated_at: new Date().toISOString() }).eq("run_id", runId).eq("status", "queued").eq("updated_at", job.updated_at).select("*").maybeSingle();
  if (error) throw error;
  return claimed;
}

export async function runSweepJob(job: NonNullable<Awaited<ReturnType<typeof claimSweepJob>>>) {
  const timer = setInterval(() => {
    void supabaseAdmin.from("stimulus_sweep_jobs").update({ lease_until: new Date(Date.now() + 600_000).toISOString() }).eq("run_id", job.run_id).eq("lease_token", job.lease_token ?? "").then();
  }, 30_000);
  try {
    await supabaseAdmin.from("stimulus_runs").update({ status: "generating", error: null }).eq("id", job.run_id);
    // Original three-lens batches advance inside the keep-alive request, not
    // through a fresh database/HTTP handoff after every model call.
    let batches = 0;
    let remaining = 1;
    while (remaining > 0 && batches < Math.min(SWEEP_SLICE_BATCHES, job.remaining_hops)) {
      const result = await runBigIdeaBatch(job.run_id, SWEEP_BATCH_SIZE);
      batches += 1;
      remaining = result.remaining;
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, SWEEP_COOLDOWN_MS));
    }
    if (remaining > 0 && job.remaining_hops <= batches) throw new Error("Sweep iteration budget exhausted; resume required.");
    const { count: pending } = await supabaseAdmin.from("stimulus_directions").select("id", { count: "exact", head: true }).eq("run_id", job.run_id).eq("status", "pending");
    await supabaseAdmin.from("stimulus_sweep_jobs").update({ status: pending ? "queued" : "complete", remaining_hops: job.remaining_hops - batches, lease_token: null, lease_until: null, error: null, updated_at: new Date().toISOString() }).eq("run_id", job.run_id).eq("lease_token", job.lease_token ?? "");
    if (!pending) {
      const { buildLedgerForRun } = await import("./convergence-ledger-run.server");
      await buildLedgerForRun(job.run_id);
    }
    return { remaining: pending ?? 0 };
  } catch (error) {
    const message = sweepCreditExhausted(error) ? SWEEP_CREDIT_MESSAGE : error instanceof Error ? error.message : String(error);
    const retry = sweepErrorRetryable(error) && job.remaining_hops > 1;
    if (retry) await new Promise(resolve => setTimeout(resolve, 60_000));
    await supabaseAdmin.from("stimulus_sweep_jobs").update({ status: retry ? "queued" : "paused", error: message, remaining_hops: job.remaining_hops - 1, lease_token: null, lease_until: null, updated_at: new Date().toISOString() }).eq("run_id", job.run_id).eq("lease_token", job.lease_token ?? "");
    await supabaseAdmin.from("stimulus_runs").update({ status: retry ? "generating" : "failed", error: message }).eq("id", job.run_id);
    return { error: message, paused: !retry };
  } finally {
    clearInterval(timer);
  }
}