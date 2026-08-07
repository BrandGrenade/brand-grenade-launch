// CREATIVE STIMULUS ENGINE — PHASE 4 server functions.
// Gate Two (CD-level sign-off), the two-gate decision record, and the data
// behind both export tiers (Raw Idea, Full Finished).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
const db = supabaseAdmin as unknown as { from: (t: string) => any };

async function orchestrationForUser(id: string, userId: string) {
  const { data, error } = await db.from("stimulus_orchestrations").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`Orchestration not found: ${error?.message ?? "no row"}`);
  await assertSessionAccess(data.session_id as string, userId);
  return data as AnyRow;
}

async function promptForUser(promptId: string, userId: string) {
  const { data: prompt } = await db.from("stimulus_prompts").select("*").eq("id", promptId).single();
  if (!prompt) throw new Error("Prompt not found");
  const orch = await orchestrationForUser(prompt.orchestration_id as string, userId);
  return { prompt: prompt as AnyRow, orch };
}

async function directionRow(directionId: string) {
  const { data } = await db.from("stimulus_directions").select("*").eq("id", directionId).single();
  return (data ?? null) as AnyRow | null;
}

/* ------------------------------------------------------------------ Gate Two */

/**
 * CD-level sign-off on a single finished prompt. Narrow by design: this is a
 * confirmation that the finished work is still on-brief and on-strategy, not a
 * reopening of execution choices. The full rating snapshot at the moment of
 * approval is frozen onto the row.
 */
export const setGateTwoApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        promptId: z.string().uuid(),
        approved: z.boolean(),
        notes: z.string().max(4000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { prompt, orch } = await promptForUser(data.promptId, context.userId);
    if (prompt.status !== "active") throw new Error("This prompt is rejected — it cannot be signed off.");

    const dir = await directionRow(prompt.direction_id as string);
    const now = new Date().toISOString();
    const snapshot = data.approved
      ? {
          approved_at: now,
          channel_name: prompt.channel_name,
          lens_name: prompt.lens_name,
          tool_target: prompt.tool_target,
          final_prompt: prompt.final_prompt ?? prompt.working_prompt ?? prompt.initial_prompt ?? "",
          wad_status: prompt.wad_status,
          wad_reasoning: prompt.wad_reasoning ?? null,
          cd_note: prompt.cd_note ?? null,
          registry_version: orch.registry_version ?? null,
          gate_one: dir
            ? {
                approved_at: dir.gate_one_approved_at,
                notes: dir.gate_one_notes,
                ratings: dir.gate_one_snapshot?.ratings ?? dir.ratings ?? null,
                snapshot: dir.gate_one_snapshot ?? null,
              }
            : null,
          notes: data.notes ?? null,
        }
      : null;

    await db
      .from("stimulus_prompts")
      .update({
        gate_two_approved: data.approved,
        gate_two_approved_at: data.approved ? now : null,
        gate_two_notes: data.notes ?? null,
        gate_two_snapshot: snapshot,
      })
      .eq("id", data.promptId);

    return { ok: true, approvedAt: data.approved ? now : null };
  });

/**
 * Revision loop at Gate Two — one prompt sent back with notes, not the whole
 * set. Craft pass re-runs for this prompt only; the CD cohesion pass then
 * re-runs across the surviving set, matching the Phase 3 mechanism.
 */
export const sendPromptBackWithNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ promptId: z.string().uuid(), notes: z.string().min(1).max(4000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { prompt, orch } = await promptForUser(data.promptId, context.userId);
    const now = new Date().toISOString();
    const log = Array.isArray(prompt.revision_log) ? prompt.revision_log : [];

    await db
      .from("stimulus_prompts")
      .update({
        wad_status: "revising",
        wad_notes: data.notes,
        gate_two_approved: false,
        gate_two_approved_at: null,
        gate_two_snapshot: null,
        revision_log: [...log, { gate: "two", notes: data.notes, at: now }],
      })
      .eq("id", data.promptId);

    await db
      .from("stimulus_orchestrations")
      .update({
        status: "wad",
        cd_status: "pending",
        cd_revision_count: 0,
        gate_two_confirmed: false,
        gate_two_confirmed_at: null,
        phase_note: `Gate Two: one prompt sent back with notes. Craft pass re-runs on it, then a full CD re-check.`,
      })
      .eq("id", orch.id);

    return { ok: true };
  });

/**
 * Total-failure path. Rare — a real campaign enters Gate Two from 3–8 Gate One
 * approved directions. Sends the whole active set back with one amendment note
 * and regenerates, matching Stage 8's proven retry-with-notes pattern.
 */
export const retrySetWithAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ orchestrationId: z.string().uuid(), notes: z.string().min(1).max(4000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const orch = await orchestrationForUser(data.orchestrationId, context.userId);
    const now = new Date().toISOString();
    const amendments = Array.isArray(orch.amendment_log) ? orch.amendment_log : [];

    const { data: prompts } = await db
      .from("stimulus_prompts")
      .select("id, revision_log")
      .eq("orchestration_id", orch.id)
      .eq("status", "active");

    for (const p of ((prompts ?? []) as AnyRow[])) {
      const log = Array.isArray(p.revision_log) ? p.revision_log : [];
      await db
        .from("stimulus_prompts")
        .update({
          wad_status: "revising",
          wad_notes: data.notes,
          gate_two_approved: false,
          gate_two_approved_at: null,
          gate_two_snapshot: null,
          revision_log: [...log, { gate: "two", scope: "whole_set", notes: data.notes, at: now }],
        })
        .eq("id", p.id);
    }

    await db
      .from("stimulus_orchestrations")
      .update({
        status: "wad",
        cd_status: "pending",
        cd_revision_count: 0,
        gate_two_confirmed: false,
        gate_two_confirmed_at: null,
        gate_two_notes: null,
        amendment_log: [...amendments, { notes: data.notes, at: now, prompts: (prompts ?? []).length }],
        phase_note: `Gate Two: whole set sent back with amendment notes. Regenerating craft pass, then CD.`,
      })
      .eq("id", orch.id);

    return { ok: true, resent: (prompts ?? []).length };
  });

/** Final CD sign-off on the set. Freezes the complete two-gate decision record. */
export const confirmGateTwo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ orchestrationId: z.string().uuid(), notes: z.string().max(4000).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const orch = await orchestrationForUser(data.orchestrationId, context.userId);
    if (orch.status !== "complete")
      throw new Error("The orchestration has not finished its CD pass yet.");

    const { data: prompts } = await db
      .from("stimulus_prompts")
      .select("*")
      .eq("orchestration_id", orch.id)
      .order("sort_order", { ascending: true });
    const rows = (prompts ?? []) as AnyRow[];
    const active = rows.filter((p) => p.status === "active");
    const approved = active.filter((p) => p.gate_two_approved);
    if (approved.length === 0) throw new Error("Sign off at least one prompt before confirming Gate Two.");
    const outstanding = active.filter((p) => !p.gate_two_approved);
    if (outstanding.length > 0)
      throw new Error(
        `${outstanding.length} prompt(s) still awaiting a Gate Two decision — approve, send back, or reject each one first.`,
      );

    const now = new Date().toISOString();
    const snapshot = {
      confirmed_at: now,
      registry_version: orch.registry_version,
      cd_status: orch.cd_status,
      cd_output: orch.cd_output,
      cd_revision_count: orch.cd_revision_count,
      approved: approved.map((p) => p.gate_two_snapshot ?? { id: p.id }),
      rejected: rows
        .filter((p) => p.status !== "active")
        .map((p) => ({
          id: p.id,
          channel_name: p.channel_name,
          lens_name: p.lens_name,
          rejected_reason: p.rejected_reason,
          rejected_at: p.rejected_at,
        })),
      notes: data.notes ?? null,
    };

    await db
      .from("stimulus_orchestrations")
      .update({
        gate_two_confirmed: true,
        gate_two_confirmed_at: now,
        gate_two_notes: data.notes ?? null,
        gate_two_snapshot: snapshot,
        phase_note: `Gate Two confirmed — ${approved.length} finished prompt(s) signed off.`,
      })
      .eq("id", orch.id);

    return { ok: true, confirmedAt: now, approved: approved.length };
  });

/* ------------------------------------------------------------------ exports */

/**
 * RAW IDEA EXPORT — reachable straight from Tissue Check or Gate One. No
 * orchestration, no signature registry, no CD pass. Just the spark.
 */
export const getRawIdeaExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ directionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const dir = await directionRow(data.directionId);
    if (!dir) throw new Error("Direction not found");
    const { data: run } = await db
      .from("stimulus_runs")
      .select("id, session_id, channel_name, channel_brief, smp")
      .eq("id", dir.run_id)
      .single();
    if (!run) throw new Error("Run not found");
    await assertSessionAccess(run.session_id as string, context.userId);
    const { data: session } = await db
      .from("sessions")
      .select("brand_name, category")
      .eq("id", run.session_id)
      .single();

    return {
      brandName: session?.brand_name ?? "—",
      category: session?.category ?? "—",
      channelName: run.channel_name as string,
      smp: run.smp as string,
      direction: {
        lensId: dir.lens_id as string,
        lensName: dir.lens_name as string,
        text: (dir.direction as string) ?? "",
        instinctBrief: (dir.instinct_brief as string) ?? "",
        tissueStatus: dir.status as string,
        ratings: dir.ratings ?? null,
        ratedAt: dir.rated_at ?? null,
        gateOneApproved: Boolean(dir.gate_one_approved),
        gateOneApprovedAt: dir.gate_one_approved_at ?? null,
        gateOneNotes: dir.gate_one_notes ?? null,
      },
    };
  });

/**
 * MULTI-SELECT RAW IDEA EXPORT — the same content and format as the single Raw
 * Idea export, batched into one print-ready document. For reviewing the field
 * away from the screen.
 */
export const getRawIdeaExportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ directionIds: z.array(z.string().uuid()).min(1).max(40) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: dirs } = await db
      .from("stimulus_directions")
      .select("*")
      .in("id", data.directionIds);
    const rows = (dirs ?? []) as AnyRow[];
    if (rows.length === 0) throw new Error("No directions found");

    const runIds = [...new Set(rows.map((r) => r.run_id as string))];
    const { data: runs } = await db
      .from("stimulus_runs")
      .select("id, session_id, channel_name, smp")
      .in("id", runIds);
    const runById = new Map((runs ?? []).map((r: AnyRow) => [r.id as string, r]));

    // Every selected lens must belong to a session this user can reach.
    const sessionIds = [...new Set((runs ?? []).map((r: AnyRow) => r.session_id as string))];
    for (const sid of sessionIds) await assertSessionAccess(sid, context.userId);

    const { data: session } = await db
      .from("sessions")
      .select("brand_name, category")
      .eq("id", sessionIds[0])
      .single();

    const order = new Map(data.directionIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return {
      brandName: session?.brand_name ?? "—",
      category: session?.category ?? "—",
      channelName: [...new Set(rows.map((r) => runById.get(r.run_id)?.channel_name))]
        .filter(Boolean)
        .join(" · "),
      smp: (runById.get(rows[0].run_id)?.smp as string) ?? "",
      directions: rows.map((dir) => ({
        lensId: dir.lens_id as string,
        lensName: dir.lens_name as string,
        text: (dir.direction as string) ?? "",
        instinctBrief: (dir.instinct_brief as string) ?? "",
        tissueStatus: dir.status as string,
        ratings: dir.ratings ?? null,
        ratedAt: dir.rated_at ?? null,
        gateOneApproved: Boolean(dir.gate_one_approved),
        gateOneApprovedAt: dir.gate_one_approved_at ?? null,
        gateOneNotes: dir.gate_one_notes ?? null,
      })),
    };
  });


/**
 * FULL FINISHED EXPORT — the Gate Two-approved, orchestrated prompt set, plus
 * the complete two-gate decision record behind it.
 */
export const getFullFinishedExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orchestrationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orch = await orchestrationForUser(data.orchestrationId, context.userId);
    const { data: session } = await db
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_detonation_line")
      .eq("id", orch.session_id)
      .single();

    const { data: prompts } = await db
      .from("stimulus_prompts")
      .select("*")
      .eq("orchestration_id", orch.id)
      .order("sort_order", { ascending: true });
    const rows = (prompts ?? []) as AnyRow[];

    const dirIds = rows.map((p) => p.direction_id as string);
    const { data: dirs } = dirIds.length
      ? await db.from("stimulus_directions").select("*").in("id", dirIds)
      : { data: [] };
    const byDir = new Map(((dirs ?? []) as AnyRow[]).map((d) => [d.id as string, d]));

    const { data: crossRefs } = await db
      .from("stimulus_cross_refs")
      .select("*")
      .eq("orchestration_id", orch.id);
    const { data: signatures } = await db
      .from("stimulus_signatures")
      .select("*")
      .eq("orchestration_id", orch.id);

    const approved = rows
      .filter((p) => p.status === "active" && p.gate_two_approved)
      .map((p) => {
        const d = byDir.get(p.direction_id as string);
        return {
          id: p.id as string,
          channelName: p.channel_name as string,
          lensId: (d?.lens_id as string) ?? "",
          lensName: p.lens_name as string,
          toolTarget: p.tool_target as string,
          finalPrompt: (p.final_prompt ?? p.working_prompt ?? p.initial_prompt ?? "") as string,
          direction: (d?.direction as string) ?? "",
          instinctBrief: (d?.instinct_brief as string) ?? "",
          gateOne: {
            ratings: d?.gate_one_snapshot?.ratings ?? d?.ratings ?? null,
            approvedAt: d?.gate_one_approved_at ?? null,
            notes: d?.gate_one_notes ?? null,
          },
          cdNote: (p.cd_note as string) ?? null,
          wadStatus: p.wad_status as string,
          wadReasoning: (p.wad_reasoning as string) ?? null,
          revisionLog: Array.isArray(p.revision_log) ? p.revision_log : [],
          gateTwo: {
            approvedAt: p.gate_two_approved_at ?? null,
            notes: (p.gate_two_notes as string) ?? null,
          },
          crossRefs: ((crossRefs ?? []) as AnyRow[])
            .filter((c) => c.prompt_id === p.id && c.status === "accepted")
            .map((c) => ({ suggestion: c.suggestion as string, rationale: c.rationale as string })),
        };
      });

    return {
      brandName: session?.brand_name ?? "—",
      category: session?.category ?? "—",
      smp: session?.selected_smp ?? "",
      detonationLine: session?.stage_18_detonation_line ?? "",
      orchestration: {
        id: orch.id as string,
        registryVersion: orch.registry_version as number,
        cdStatus: orch.cd_status as string,
        cdOutput: (orch.cd_output as string) ?? "",
        gateTwoConfirmed: Boolean(orch.gate_two_confirmed),
        gateTwoConfirmedAt: orch.gate_two_confirmed_at ?? null,
        gateTwoNotes: (orch.gate_two_notes as string) ?? null,
        amendmentLog: Array.isArray(orch.amendment_log) ? orch.amendment_log : [],
      },
      signatures: ((signatures ?? []) as AnyRow[]).map((s) => ({
        category: s.category as string,
        name: s.name as string,
        description: s.description as string,
        status: s.status as string,
      })),
      rejected: rows
        .filter((p) => p.status !== "active")
        .map((p) => ({
          channelName: p.channel_name as string,
          lensName: p.lens_name as string,
          reason: (p.rejected_reason as string) ?? "",
          at: p.rejected_at ?? null,
        })),
      approved,
    };
  });
