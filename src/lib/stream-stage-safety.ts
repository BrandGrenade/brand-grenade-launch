// Shared safety wrapper for every streaming stage in the pipeline.
//
// Problem this solves:
//   Cloudflare Workers can kill an in-flight invocation mid-stream (wall-clock
//   budget, CPU, or unexplained). If a stage is only wrapping streamClaude in
//   `try { for await ... } catch { setError }`, a Worker death BEFORE the first
//   output write leaves stage_N_output NULL, stage_N_error NULL, status
//   'running' — so the client's RPC awaits a response that will never come and
//   the row is stuck.
//
// What this wrapper does, on every streaming stage:
//   1. THROTTLED PARTIAL PERSISTENCE — while streaming, writes accumulated
//      output into stage_N_output every ~throttleMs seconds. The last snapshot
//      is at most that far behind the moment of Worker death.
//   2. WALL-CLOCK BUDGET — if streaming exceeds budgetMs, aborts with a real
//      error string written into stage_N_error and status='interrupted'.
//   3. GUARANTEED ERROR WRITE ON ANY THROW — the caller's catch block is
//      absorbed into the wrapper: any thrown error (network, upstream 4xx/5xx,
//      abort, budget) is persisted into stage_N_error, status flipped to
//      'interrupted', and re-thrown. Callers no longer need a try/catch around
//      the stream itself.
//
// This kills the silent-death class for streaming stages. It cannot cover an
// unrecoverable Worker kill that fires between two throttled persists — that
// residual risk is handled by the client-side watchdog in
// PreflightFullCheckPanel, which detects a stale sessions.updated_at while an
// RPC is in-flight and releases the row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface StreamStageSafetyOpts {
  sessionId: string;
  stageLabel: string;
  /** Column name to persist partial + final output into, e.g. "stage_7_output". */
  outputColumn: string;
  /** Column name to write error strings into, e.g. "stage_7_error". */
  errorColumn: string;
  /** Total wall-clock budget in ms; default 240_000 (4 min). */
  budgetMs?: number;
  /** How often to persist partial snapshots in ms; default 3000. */
  throttleMs?: number;
}

const DEFAULT_BUDGET_MS = 240_000;
const DEFAULT_THROTTLE_MS = 3_000;

/**
 * Wrap an async iterable of string deltas (typically `streamClaude(...)`) with
 * the safety net described in the file header. Yields raw string deltas;
 * caller accumulates and re-yields to its own client stream.
 *
 * The wrapper returns the final accumulated string so callers can use it after
 * the loop instead of maintaining their own accumulator, if they prefer.
 */
export async function* withStreamSafety(
  opts: StreamStageSafetyOpts,
  source: AsyncIterable<string>,
): AsyncGenerator<string, string> {
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;
  const start = Date.now();
  let accumulated = "";
  let lastPersist = 0;
  let dirty = false;

  const persist = async (err: string | null): Promise<void> => {
    try {
      await supabaseAdmin
        .from("sessions")
        .update({
          [opts.outputColumn]: accumulated.length > 0 ? accumulated : null,
          [opts.errorColumn]: err,
          // Liveness heartbeat: every persisted delta batch stamps this column.
          // The client watchdog reads it as proof that tokens are still flowing
          // (as opposed to `updated_at`, which can move for unrelated reasons
          // or fail to move if writes batch behind another update).
          stream_last_delta_at: new Date().toISOString(),
        } as never)
        .eq("id", opts.sessionId);
      dirty = false;
    } catch (writeErr) {
      // best-effort — do not mask the real error path
      console.warn(
        `[stream-safety] session=${opts.sessionId} stage="${opts.stageLabel}" partial-persist failed:`,
        writeErr instanceof Error ? writeErr.message : String(writeErr),
      );
    }
  };

  const markInterrupted = async (): Promise<void> => {
    try {
      await supabaseAdmin
        .from("sessions")
        .update({ status: "interrupted" })
        .eq("id", opts.sessionId);
    } catch {
      /* best-effort */
    }
  };

  try {
    for await (const delta of source) {
      accumulated += delta;
      dirty = true;
      yield delta;

      const now = Date.now();
      if (now - lastPersist > throttleMs) {
        lastPersist = now;
        // Await the persist so the write is actually scheduled on the Worker
        // event loop; a fire-and-forget promise can be dropped when the parent
        // await resolves. Cost is small (~30-100ms) versus the value of a
        // guaranteed heartbeat.
        await persist(null);
      }

      if (now - start > budgetMs) {
        const msg =
          `${opts.stageLabel} wall-clock budget exceeded ` +
          `(${Math.round((now - start) / 1000)}s of ${Math.round(budgetMs / 1000)}s allowed). ` +
          `Partial output (${accumulated.length} chars) saved. Retry to continue.`;
        console.error(`[stream-safety] session=${opts.sessionId} ${msg}`);
        await persist(msg);
        await markInterrupted();
        throw new Error(msg);
      }
    }
    // Final flush of any un-persisted tail so recovery reads the whole output
    // even if the caller crashes between the loop end and its own final save.
    if (dirty) await persist(null);
    return accumulated;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = raw.includes(opts.stageLabel) ? raw : `${opts.stageLabel} failed: ${raw}`;
    console.error(`[stream-safety] session=${opts.sessionId} ${msg}`);
    await persist(msg);
    await markInterrupted();
    throw e instanceof Error ? e : new Error(msg);
  }
}
