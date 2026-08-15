// CREATIVE STIMULUS ENGINE — server functions.
// Trigger: manual, in-pipeline, one channel per run.
// Generation is resumable: the client calls generateStimulusBatch until the
// run reports complete, so no single request has to carry all 37 lenses.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { callClaude } from "./claude.server";
import { STIMULUS_LENSES, getLens } from "./stimulus/lenses";
import { runStaleness } from "./stimulus/staleness";
import {
  STIMULUS_SYSTEM_PROMPT,
  buildStimulusUserMessage,
  parseStimulusResponse,
} from "./stimulus/generate-prompt";


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


/** Channels available for a stimulus run — the Stage 21 channel brief keys. */
export const listStimulusChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SessionOnly.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    const outputs = (row?.stage_21_outputs as Record<string, string> | null) ?? {};
    return { channels: Object.keys(outputs) };
  });

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

export const startStimulusRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), channelName: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const outputs = (session.stage_21_outputs as Record<string, string> | null) ?? {};
    const brief = outputs[data.channelName];
    if (!brief?.trim())
      throw new Error(`No Stage 21 Channel Detonation Brief found for "${data.channelName}"`);

    const { data: run, error: runErr } = await supabaseAdmin
      .from("stimulus_runs")
      .insert({
        session_id: data.sessionId,
        created_by: context.userId,
        channel_name: data.channelName,
        channel_brief: brief,
        smp: session.selected_smp ?? "",
        locked_big_idea_at_generation: session.locked_big_idea ?? null,
        locked_line_at_generation: session.locked_campaign_line ?? null,
        status: "generating",
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(`Failed to create stimulus run: ${runErr?.message}`);


    const rows = STIMULUS_LENSES.map((l, i) => ({
      run_id: run.id,
      lens_id: l.id,
      lens_name: l.name,
      sort_order: i,
      status: "pending",
    }));
    const { error: dErr } = await supabaseAdmin.from("stimulus_directions").insert(rows);
    if (dErr) throw new Error(`Failed to seed stimulus directions: ${dErr.message}`);

    return { runId: run.id, total: rows.length };
  });

/** Generates the next batch of pending lenses. Call repeatedly until done. */
export const generateStimulusBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), batchSize: z.number().int().min(1).max(6).default(4) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await loadRun(data.runId, context.userId);

    const { data: pending, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_id")
      .eq("run_id", run.id)
      .eq("status", "pending")
      .order("sort_order", { ascending: true })
      .limit(data.batchSize);
    if (error) throw new Error(error.message);

    if (!pending || pending.length === 0) {
      await supabaseAdmin
        .from("stimulus_runs")
        .update({ status: "complete", error: null })
        .eq("id", run.id);
      return { done: true as const, generated: 0, remaining: 0 };
    }

    const { data: sessionRow } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_18_detonation_line")
      .eq("id", run.session_id)
      .single();

    const lenses = pending
      .map((p) => getLens(p.lens_id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));

    try {
      const raw = await callClaude({
        systemPrompt: STIMULUS_SYSTEM_PROMPT,
        userMessage: buildStimulusUserMessage({
          brandName: sessionRow?.brand_name ?? "—",
          category: sessionRow?.category ?? "—",
          channelName: run.channel_name,
          channelBrief: run.channel_brief,
          smp: run.smp,
          detonationLine: sessionRow?.stage_18_detonation_line ?? "",
          lenses,
        }),
        skipUniversalWrapper: true,
        maxTokens: 8000,
        temperature: 1,
        sessionId: run.session_id,
        stageLabel: `Creative Stimulus (${run.channel_name})`,
      });

      const parsed = parseStimulusResponse(raw);
      for (const p of pending) {
        const text = parsed[p.lens_id]?.trim();
        await supabaseAdmin
          .from("stimulus_directions")
          .update(
            text
              ? { direction: text, status: "generated", error: null }
              : { status: "failed", error: "Lens produced no parseable direction" },
          )
          .eq("id", p.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stimulus generation failed";
      await supabaseAdmin.from("stimulus_runs").update({ error: msg }).eq("id", run.id);
      // Without this the claimed rows stay 'pending' forever and the UI shows
      // an eternal spinner instead of a failure.
      await supabaseAdmin
        .from("stimulus_directions")
        .update({ status: "failed", error: msg })
        .in(
          "id",
          pending.map((p) => p.id),
        );
      throw e instanceof Error ? e : new Error(msg);

    }

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
    }
    return { done: remaining === 0, generated: pending.length, remaining };
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


