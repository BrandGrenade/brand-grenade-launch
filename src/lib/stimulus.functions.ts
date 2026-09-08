// CREATIVE STIMULUS ENGINE — shared run/direction server functions.
//
// ARCHITECTURE (current, single source of truth):
//   The 37-Lens Sweep fires ONCE per session, BEFORE any channel brief exists,
//   against the validated proposition / Detonation (see
//   src/lib/stimulus-bigidea.functions.ts → startBigIdeaRun / driveBigIdeaSweep).
//   Human gating then runs Tissue Check triage → Gate One approval
//   (setGateOneApproval / confirmGateOne) → lockWinningIdea. Stage 21 channel
//   briefs and every downstream channel / martech prompt are generated only
//   from that locked idea and locked line.
//
//   RETIRED: the legacy per-channel sweep (one run per Stage 21 channel brief)
//   was removed in Sep 2026 along with its only UI. Historical `stimulus_runs`
//   rows from that era remain readable; nothing generates new ones.
//
// The functions below are the shared read/triage/revise layer used by the
// pre-channel sweep and by channel-adaptation runs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { runStaleness } from "./stimulus/staleness";



const SessionOnly = z.object({ sessionId: z.string().uuid() });

type RunRow = {
  id: string;
  session_id: string;
  channel_name: string;
  channel_brief: string;
  smp: string;
  status: string;
  error: string | null;
  run_mode?: string;
  winning_direction_id?: string | null;
  winning_line_direction_id?: string | null;
  winning_line?: string | null;
  locked_at?: string | null;
  tiebreaker_output?: string | null;
  tiebreaker_fired?: boolean;
  tiebreaker_reason?: string | null;
  tiebreaker_at?: string | null;
  gate_one_confirmed?: boolean;
  gate_one_confirmed_at?: string | null;
  locked_big_idea_at_generation?: string | null;
  locked_line_at_generation?: string | null;
};

async function loadRun(runId: string, userId: string): Promise<RunRow> {
  const { data, error } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, channel_name, channel_brief, smp, status, error, run_mode, winning_direction_id, winning_line_direction_id, winning_line, locked_at, tiebreaker_output, tiebreaker_fired, tiebreaker_reason, tiebreaker_at, gate_one_confirmed, gate_one_confirmed_at, locked_big_idea_at_generation, locked_line_at_generation")
    .eq("id", runId)
    .single();
  if (error || !data) throw new Error(`Stimulus run not found: ${error?.message ?? "no row"}`);
  await assertSessionAccess(data.session_id, userId);
  return data as RunRow;
}



export const listStimulusRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SessionOnly.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: runs, error } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id, channel_name, status, error, created_at, run_mode, locked_at, locked_big_idea_at_generation, locked_line_at_generation")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: sess } = await supabaseAdmin
      .from("sessions")
      .select("locked_big_idea, locked_campaign_line")
      .eq("id", data.sessionId)
      .single();
    const lock = {
      locked_big_idea: sess?.locked_big_idea ?? null,
      locked_campaign_line: sess?.locked_campaign_line ?? null,
    };
    return {
      runs: (runs ?? []).map((r) => ({
        ...r,
        staleness: runStaleness(
          {
            locked_big_idea_at_generation: r.locked_big_idea_at_generation ?? null,
            locked_line_at_generation: r.locked_line_at_generation ?? null,
          },
          lock,
        ),
      })),
    };
  });

export const loadStimulusRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const run = await loadRun(data.runId, context.userId);
    const { data: directions, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select(
        "id, lens_id, lens_name, sort_order, direction, campaign_line, expression_under_master, master_line_at_generation, rationale, root_tension, guidance_alignment, guidance_alignment_note, convergence, convergence_regen_count, line_check, status, instinct_brief, revise_notes, revise_count, error, ratings, rating_status, rating_error, rated_at, gate_one_approved, gate_one_approved_at, gate_one_notes",
      )
      .eq("run_id", run.id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: sess } = await supabaseAdmin
      .from("sessions")
      .select("locked_big_idea, locked_campaign_line")
      .eq("id", run.session_id)
      .single();
    const staleness = runStaleness(
      {
        locked_big_idea_at_generation: run.locked_big_idea_at_generation ?? null,
        locked_line_at_generation: run.locked_line_at_generation ?? null,
      },
      {
        locked_big_idea: sess?.locked_big_idea ?? null,
        locked_campaign_line: sess?.locked_campaign_line ?? null,
      },
    );
    return { run, directions: directions ?? [], staleness };
  });

/** Tissue Check triage — the human pass. */
export const triageStimulusDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        directionId: z.string().uuid(),
        status: z.enum(["keep", "kill", "keep_in_play", "revise", "generated"]),
        instinctBrief: z.string().max(4000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, run_id")
      .eq("id", data.directionId)
      .single();
    if (error || !row) throw new Error("Direction not found");
    await loadRun(row.run_id, context.userId);

    const patch: { status: string; instinct_brief?: string } = { status: data.status };
    if (data.instinctBrief !== undefined) patch.instinct_brief = data.instinctBrief;
    const { error: uErr } = await supabaseAdmin
      .from("stimulus_directions")
      .update(patch)
      .eq("id", data.directionId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

/**
 * Revise: regenerate a single direction through the same lens with notes.
 * Records the result as a new attempt rather than overwriting the previous one
 * — see stimulus-attempts.functions.ts for the attempt history contract.
 */
export const reviseStimulusDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        directionId: z.string().uuid(),
        notes: z.string().trim().min(1).max(2000),
        // Caller's stated target. Verified against the stored row before any
        // write, so a stale or mis-copied request fails loudly instead of
        // landing in the wrong idea's slot.
        expectedSlot: z.number().int().min(1).max(99).nullish(),
        expectedLensId: z.string().nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, run_id, lens_id, lens_name, sort_order, direction, revise_count")
      .eq("id", data.directionId)
      .single();
    if (error || !row) throw new Error("Direction not found");
    const run = await loadRun(row.run_id, context.userId);

    const { assertReviseTarget } = await import("./stimulus/revise-target");
    assertReviseTarget({
      notes: data.notes,
      actual: { slot: (row.sort_order ?? 0) + 1, lensName: row.lens_name ?? row.lens_id },
      actualLensId: row.lens_id,
      expected: { slot: data.expectedSlot, lensId: data.expectedLensId },
    });

    const { regenerateDirection } = await import("./stimulus/regenerate.server");
    const result = await regenerateDirection({
      direction: row,
      run,
      mode: "revise",
      notes: data.notes,
    });
    return { direction: result.direction };
  });


