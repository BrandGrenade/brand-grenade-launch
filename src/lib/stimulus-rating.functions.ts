// CREATIVE STIMULUS ENGINE — PHASE 2 server functions.
// Gate One: full eight-dimension rating, seasoned-CD tie-breaker, approval record.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { getLens } from "./stimulus/lenses";
import type { DirectionRatings } from "./stimulus/rating-prompts";
import {
  tiebreakerCandidates,
  ratingSummaryLine,
  compositeIndex,
} from "./stimulus/rating-score";

const RATABLE = ["keep", "keep_in_play"];

async function loadRunForUser(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, channel_name, smp, status")
    .eq("id", runId)
    .single();
  if (error || !data) throw new Error(`Stimulus run not found: ${error?.message ?? "no row"}`);
  await assertSessionAccess(data.session_id, userId);
  return data;
}

async function sessionContext(sessionId: string) {
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("brand_name, category, stage_18_detonation_line, stage_1_output, selected_smp")
    .eq("id", sessionId)
    .single();
  return {
    brandName: data?.brand_name ?? "—",
    category: data?.category ?? "—",
    detonationLine: data?.stage_18_detonation_line ?? "",
    strategicTension: (data?.stage_1_output ?? "").slice(0, 3000),
    selectedSmp: data?.selected_smp ?? "",
  };
}

/** Rates the next unrated survivor(s) of Tissue Check. Call until done. */
export const rateStimulusBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        batchSize: z.number().int().min(1).max(3).default(2),
        directionId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await loadRunForUser(data.runId, context.userId);

    let query = supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_id, lens_name, direction, instinct_brief, status")
      .eq("run_id", run.id)
      .in("status", RATABLE)
      .order("sort_order", { ascending: true });
    if (data.directionId) query = query.eq("id", data.directionId);
    else query = query.eq("rating_status", "unrated").limit(data.batchSize);

    const { data: pending, error } = await query;
    if (error) throw new Error(error.message);

    if (!pending || pending.length === 0) return { done: true as const, rated: 0, remaining: 0 };

    const ctx = await sessionContext(run.session_id);
    const { rateDirection } = await import("./stimulus/rate.server");

    for (const d of pending) {
      try {
        const result = await rateDirection({
          brandName: ctx.brandName,
          category: ctx.category,
          channelName: run.channel_name,
          smp: run.smp || ctx.selectedSmp,
          strategicTension: ctx.strategicTension,
          detonationLine: ctx.detonationLine,
          lensName: d.lens_name ?? getLens(d.lens_id)?.name ?? d.lens_id,
          direction: d.direction ?? "",
          instinctBrief: d.instinct_brief ?? null,
        });
        await supabaseAdmin
          .from("stimulus_directions")
          .update({
            ratings: result.ratings as unknown as Record<string, unknown>,
            rating_status: "rated",
            rating_error: null,
            rated_at: new Date().toISOString(),
          })
          .eq("id", d.id);
      } catch (e) {
        await supabaseAdmin
          .from("stimulus_directions")
          .update({
            rating_status: "failed",
            rating_error: e instanceof Error ? e.message : "Rating failed",
          })
          .eq("id", d.id);
      }
    }

    const { count } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id)
      .in("status", RATABLE)
      .eq("rating_status", "unrated");

    const remaining = count ?? 0;
    if (remaining === 0)
      await supabaseAdmin.from("stimulus_runs").update({ status: "rated" }).eq("id", run.id);
    return { done: remaining === 0, rated: pending.length, remaining };
  });

/**
 * Seasoned-CD tie-breaker. Trigger condition, not a default step: it only runs
 * when the top rated directions sit inside the closeness threshold.
 */
export const runStimulusTiebreaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), force: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await loadRunForUser(data.runId, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_name, direction, ratings, sort_order")
      .eq("run_id", run.id)
      .in("status", RATABLE)
      .eq("rating_status", "rated")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const rated = (rows ?? [])
      .filter((r) => r.ratings)
      .map((r) => ({ ...r, ratings: r.ratings as unknown as DirectionRatings }));

    const decision = tiebreakerCandidates(rated);
    if (!decision.fires && !data.force) {
      await supabaseAdmin
        .from("stimulus_runs")
        .update({ tiebreaker_fired: false, tiebreaker_reason: decision.reason })
        .eq("id", run.id);
      return { fired: false as const, reason: decision.reason, output: null };
    }

    const candidates = (decision.candidates.length ? decision.candidates : rated.slice(0, 3)).map(
      (c) => ({
        label: `Direction ${String(c.sort_order + 1).padStart(2, "0")}`,
        lensName: c.lens_name ?? "",
        direction: c.direction ?? "",
        summary: `${ratingSummaryLine(c.ratings)} (closeness index ${compositeIndex(c.ratings).toFixed(3)})`,
      }),
    );

    const ctx = await sessionContext(run.session_id);
    const { runSeasonedCdPass } = await import("./stimulus/rate.server");
    const output = await runSeasonedCdPass({
      brandName: ctx.brandName,
      channelName: run.channel_name,
      smp: run.smp || ctx.selectedSmp,
      candidates,
    });

    await supabaseAdmin
      .from("stimulus_runs")
      .update({
        tiebreaker_output: output,
        tiebreaker_fired: true,
        tiebreaker_reason: data.force && !decision.fires ? `Manually forced. ${decision.reason}` : decision.reason,
        tiebreaker_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return { fired: true as const, reason: decision.reason, output };
  });

/** Gate One approval record: the decision, the full rating snapshot at that moment, and notes. */
export const setGateOneApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        directionId: z.string().uuid(),
        approved: z.boolean(),
        notes: z.string().max(4000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, run_id, ratings")
      .eq("id", data.directionId)
      .single();
    if (error || !row) throw new Error("Direction not found");
    await loadRunForUser(row.run_id, context.userId);

    const now = new Date().toISOString();
    const { error: uErr } = await supabaseAdmin
      .from("stimulus_directions")
      .update({
        gate_one_approved: data.approved,
        gate_one_approved_at: data.approved ? now : null,
        gate_one_notes: data.notes ?? null,
        gate_one_snapshot: data.approved
          ? { approved_at: now, ratings: row.ratings, notes: data.notes ?? null }
          : null,
      })
      .eq("id", data.directionId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, approvedAt: data.approved ? now : null };
  });

/** Confirms the Gate One checkpoint for the run once the campaign set is chosen. */
export const confirmGateOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const run = await loadRunForUser(data.runId, context.userId);
    const { count } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id)
      .eq("gate_one_approved", true);
    if (!count) throw new Error("Approve at least one direction before confirming Gate One.");
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("stimulus_runs")
      .update({ gate_one_confirmed: true, gate_one_confirmed_at: now, status: "gate_one" })
      .eq("id", data.runId);
    return { ok: true, approvedCount: count, confirmedAt: now };
  });
