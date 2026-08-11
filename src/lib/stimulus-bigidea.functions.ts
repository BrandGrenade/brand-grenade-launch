// CREATIVE STIMULUS ENGINE — BIG IDEA SWEEP (architecture revision).
//
// Sequence: ONE 37-lens sweep per session, run against the verbatim SMP before
// any channel brief exists → Tissue Check → Gate One → one winning idea and
// one winning line locked → only then channel-specific briefs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { STIMULUS_LENSES } from "./stimulus/lenses";
import { loadGrounding } from "./stimulus/big-idea-sweep.server";

export const BIG_IDEA_CHANNEL_LABEL = "Campaign big idea (pre-channel)";


async function assertRunAccess(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, run_mode, smp, status")
    .eq("id", runId)
    .single();
  if (error || !data) throw new Error("Stimulus run not found");
  await assertSessionAccess(data.session_id, userId);
  return data as { id: string; session_id: string; run_mode: string; smp: string; status: string };
}

/** Starts (or reuses) the session's single pre-channel big idea sweep. */
export const startBigIdeaRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), force: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const g = await loadGrounding(data.sessionId);
    if (!g.smp)
      throw new Error(
        "This session has no approved SMP yet. The big idea sweep answers the SMP verbatim — select one in the Strategy Pipeline first.",
      );

    if (!data.force) {
      const { data: existing } = await supabaseAdmin
        .from("stimulus_runs")
        .select("id")
        .eq("session_id", data.sessionId)
        .eq("run_mode", "big_idea")
        .order("created_at", { ascending: false })
        .limit(1);
      if (existing && existing.length > 0) return { runId: existing[0].id, reused: true as const };
    }

    const { data: run, error: runErr } = await supabaseAdmin
      .from("stimulus_runs")
      .insert({
        session_id: data.sessionId,
        created_by: context.userId,
        run_mode: "big_idea",
        channel_name: BIG_IDEA_CHANNEL_LABEL,
        channel_brief: "",
        smp: g.smp,
        status: "generating",
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(`Failed to create big idea run: ${runErr?.message}`);

    const rows = STIMULUS_LENSES.map((l, i) => ({
      run_id: run.id,
      lens_id: l.id,
      lens_name: l.name,
      sort_order: i,
      status: "pending",
    }));
    const { error: dErr } = await supabaseAdmin.from("stimulus_directions").insert(rows);
    if (dErr) throw new Error(`Failed to seed lenses: ${dErr.message}`);

    return { runId: run.id, reused: false as const };
  });

/** Generates the next batch of pending lenses for a big idea run. */
/**
 * Generates the next batch of pending lenses for a big idea run.
 * Kept for manual "generate one batch" use; the full sweep is driven
 * server-side by `resumeBigIdeaSweep` so it survives the browser closing.
 */
export const generateBigIdeaBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ runId: z.string().uuid(), batchSize: z.number().int().min(1).max(6).default(3) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    const { runBigIdeaBatch } = await import("./stimulus/big-idea-sweep.server");
    return await runBigIdeaBatch(run.id, data.batchSize);
  });

/**
 * Starts (or re-starts) server-side generation of every remaining lens.
 * Returns immediately; the sweep continues in the background even if the
 * browser navigates away. Safe to call repeatedly — an actively-beating sweep
 * is left alone rather than double-driven.
 */
export const resumeBigIdeaSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), force: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    const { driveBigIdeaSweep, SWEEP_STALL_MS } = await import("./stimulus/big-idea-sweep.server");
    const { scheduleBackground } = await import("./background.server");

    const { data: row } = await supabaseAdmin
      .from("stimulus_runs")
      .select("status, last_batch_at")
      .eq("id", run.id)
      .single();

    const { count } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id)
      .eq("status", "pending");
    const remaining = count ?? 0;
    if (remaining === 0) {
      await supabaseAdmin
        .from("stimulus_runs")
        .update({ status: "tissue_check", error: null })
        .eq("id", run.id);
      return { started: false as const, alreadyRunning: false as const, remaining: 0 };
    }

    const beat = row?.last_batch_at ? Date.parse(row.last_batch_at) : 0;
    const live = row?.status === "generating" && Date.now() - beat < SWEEP_STALL_MS;
    if (live && !data.force)
      return { started: false as const, alreadyRunning: true as const, remaining };

    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "generating", error: null, last_batch_at: new Date().toISOString() })
      .eq("id", run.id);

    scheduleBackground(driveBigIdeaSweep(run.id), "big-idea-sweep");
    return { started: true as const, alreadyRunning: false as const, remaining };
  });

/** Live progress for the sweep, including stall detection. */
export const bigIdeaSweepProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    const { SWEEP_STALL_MS } = await import("./stimulus/big-idea-sweep.server");

    const { data: row } = await supabaseAdmin
      .from("stimulus_runs")
      .select("status, error, last_batch_at, convergence_ledger")
      .eq("id", run.id)
      .single();
    const { data: rows } = await supabaseAdmin
      .from("stimulus_directions")
      .select("status")
      .eq("run_id", run.id);

    const all = rows ?? [];
    const pending = all.filter((r) => r.status === "pending").length;
    const generated = all.length - pending;
    const beat = row?.last_batch_at ? Date.parse(row.last_batch_at) : 0;
    const stalled =
      pending > 0 && (row?.status !== "generating" || Date.now() - beat > SWEEP_STALL_MS);

    return {
      status: row?.status ?? "unknown",
      error: row?.error ?? null,
      total: all.length,
      generated,
      pending,
      lastBatchAt: row?.last_batch_at ?? null,
      running: pending > 0 && !stalled,
      stalled,
      hasLedger: Boolean(row?.convergence_ledger),
    };
  });


/** Independent on-strategy check across every campaign line in the run. */
export const checkBigIdeaLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), recheck: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    const g = await loadGrounding(run.session_id);

    const { data: rows, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_name, campaign_line, line_check")
      .eq("run_id", run.id)
      .not("campaign_line", "is", null);
    if (error) throw new Error(error.message);

    const todo = (rows ?? [])
      .filter((r) => (r.campaign_line ?? "").trim() && (data.recheck || !r.line_check))
      .map((r) => ({ id: r.id, lensName: r.lens_name, line: (r.campaign_line ?? "").trim() }));
    if (todo.length === 0) return { checked: 0 };

    const { checkCampaignLines } = await import("./stimulus/line-check.server");
    let checked = 0;
    for (let i = 0; i < todo.length; i += 12) {
      const slice = todo.slice(i, i + 12);
      const result = await checkCampaignLines({
        sessionId: run.session_id,
        brandName: g.brandName,
        category: g.category,
        smp: run.smp || g.smp,
        lines: slice,
      });
      for (const [id, check] of Object.entries(result)) {
        await supabaseAdmin
          .from("stimulus_directions")
          .update({ line_check: check as never })
          .eq("id", id);
        checked += 1;
      }
    }
    return { checked };
  });

/** Locks exactly one winning idea and one winning line for the whole campaign. */
export const lockWinningIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        directionId: z.string().uuid(),
        lineDirectionId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_name, direction, campaign_line")
      .eq("run_id", run.id)
      .in("id", [data.directionId, data.lineDirectionId]);
    if (error) throw new Error(error.message);
    const idea = rows?.find((r) => r.id === data.directionId);
    const lineRow = rows?.find((r) => r.id === data.lineDirectionId);
    if (!idea) throw new Error("Winning idea not found in this run");
    if (!lineRow?.campaign_line?.trim()) throw new Error("Chosen line is empty");

    const lockedAt = new Date().toISOString();
    const { error: rErr } = await supabaseAdmin
      .from("stimulus_runs")
      .update({
        winning_direction_id: idea.id,
        winning_line_direction_id: lineRow.id,
        winning_line: lineRow.campaign_line.trim(),
        locked_at: lockedAt,
        status: "idea_locked",
      })
      .eq("id", run.id);
    if (rErr) throw new Error(rErr.message);

    const { error: sErr } = await supabaseAdmin
      .from("sessions")
      .update({
        locked_big_idea: idea.direction ?? "",
        locked_campaign_line: lineRow.campaign_line.trim(),
        locked_big_idea_lens: idea.lens_name,
        locked_big_idea_at: lockedAt,
        locked_big_idea_run_id: run.id,
      })
      .eq("id", run.session_id);
    if (sErr) throw new Error(sErr.message);

    return {
      lockedAt,
      line: lineRow.campaign_line.trim(),
      lens: idea.lens_name,
      pairedFromOtherLens: lineRow.id !== idea.id,
    };
  });

export const unlockWinningIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    await supabaseAdmin
      .from("stimulus_runs")
      .update({
        winning_direction_id: null,
        winning_line_direction_id: null,
        winning_line: null,
        locked_at: null,
        status: "tissue_check",
      })
      .eq("id", run.id);
    await supabaseAdmin
      .from("sessions")
      .update({
        locked_big_idea: null,
        locked_campaign_line: null,
        locked_big_idea_lens: null,
        locked_big_idea_at: null,
        locked_big_idea_run_id: null,
      })
      .eq("id", run.session_id);
    return { ok: true };
  });

/**
 * SECOND PASS — full-set idea convergence ledger. Runs once, after every lens
 * has generated, comparing all 37 root tensions against each other so clusters
 * (not just prior-in-sequence pairs) are caught. Mirrors Stage 9's disposition
 * ledger shape so Tissue Check can render it like the LOC pool.
 */
export const buildIdeaConvergenceLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), force: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    const { buildLedgerForRun } = await import("./stimulus/convergence-ledger-run.server");
    const r = await buildLedgerForRun(run.id, data.force);
    return {
      reused: r.reused,
      entries: r.entries as never,
      audited: r.audited,
      collisions: r.collisions,
    };
  });

