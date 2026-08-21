// CREATIVE STIMULUS ENGINE — PHASE 3 server functions.
// The Orchestration Engine: initial tool-specific prompts, Campaign Signature
// Registry, propagation, combined Writer/AD pass, Creative Director pass.
//
// Runs session-level across every Gate One-confirmed channel run at once —
// never incrementally per direction, so no early prompt can miss a signature
// that only emerges from a later approval.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import type { BrandAssetRules } from "./stimulus/orchestration-prompts";
import { runStaleness } from "./stimulus/staleness";

import {
  db,
  loadAssetRules,
  loadOrchestration,
  orchestrationStep,
  driveOrchestrationInBackground,
  setPhase,
  type AnyRow,
} from "./stimulus/orchestration-core.server";



// ------------------------------------------------------------------ brand assets

export const getBrandAssetRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ brandName: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const rules = await loadAssetRules(context.userId, data.brandName);
    return { rules };
  });

export const saveBrandAssetRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        brandName: z.string().min(1),
        colours: z.string().max(4000).default(""),
        logoReferences: z.string().max(4000).default(""),
        typography: z.string().max(4000).default(""),
        packagingRules: z.string().max(4000).default(""),
        legalLines: z.string().max(4000).default(""),
        notes: z.string().max(4000).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      brand_name: data.brandName,
      brand_key: data.brandName.trim().toLowerCase(),
      colours: data.colours,
      logo_references: data.logoReferences,
      typography: data.typography,
      packaging_rules: data.packagingRules,
      legal_lines: data.legalLines,
      notes: data.notes,
    };
    const { error } = await db
      .from("brand_asset_rules")
      .upsert(row, { onConflict: "user_id,brand_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------ start / load

/** Session-level: gathers every Gate One-confirmed run's approved directions. */
export const startOrchestration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);

    const { data: runs } = await db
      .from("stimulus_runs")
      .select(
        "id, channel_name, run_mode, gate_one_confirmed, locked_big_idea_at_generation, locked_line_at_generation",
      )
      .eq("session_id", data.sessionId)
      .eq("gate_one_confirmed", true);
    const allConfirmed = (runs ?? []) as AnyRow[];
    // Orchestration consumes the real Step 3 artefacts — the Gate One-confirmed
    // content creation input prompts adapted from the locked idea. Legacy 37-lens
    // sweep runs are only used when a session has no adaptation runs at all.
    const adaptations = allConfirmed.filter((r) => r.run_mode === "channel_adaptation");
    const confirmed =
      adaptations.length > 0
        ? adaptations
        : allConfirmed.filter((r) => r.run_mode === "channel" || !r.run_mode);
    if (confirmed.length === 0)
      throw new Error(
        "No Gate One-confirmed content creation input prompts on this session yet. Confirm Gate One on the channel prompts in Step 3 first.",
      );


    // Staleness gate: a run snapshots its Stage 21 brief at creation. If the
    // session's locked idea/line has moved since, orchestrating that run would
    // build finished creative on a superseded proposition.
    const { data: lockRow } = await db
      .from("sessions")
      .select("locked_big_idea, locked_campaign_line")
      .eq("id", data.sessionId)
      .single();
    const lock = {
      locked_big_idea: (lockRow?.locked_big_idea as string | null) ?? null,
      locked_campaign_line: (lockRow?.locked_campaign_line as string | null) ?? null,
    };
    const stale = confirmed
      .map((r) => ({
        channel: r.channel_name as string,
        s: runStaleness(
          {
            locked_big_idea_at_generation: (r.locked_big_idea_at_generation as string | null) ?? null,
            locked_line_at_generation: (r.locked_line_at_generation as string | null) ?? null,
          },
          lock,
        ),
      }))
      .filter((x) => x.s.stale);
    if (stale.length > 0) {
      throw new Error(
        `Orchestration blocked — ${stale.length} channel run${stale.length > 1 ? "s are" : " is"} stale against the currently locked campaign idea. ` +
          stale.map((x) => `"${x.channel}": ${x.s.reason}`).join(" ") +
          " Re-run the sweep for these channels against the current lock before orchestrating.",
      );
    }

    const runIds = confirmed.map((r) => r.id as string);
    const { data: dirs } = await db
      .from("stimulus_directions")
      .select("id, run_id, lens_name, direction, instinct_brief, sort_order, gate_one_approved")
      .in("run_id", runIds)
      .eq("gate_one_approved", true)
      .order("sort_order", { ascending: true });
    const approved = (dirs ?? []) as AnyRow[];
    if (approved.length === 0) throw new Error("No Gate One-approved directions to orchestrate.");

    const { data: orch, error } = await db
      .from("stimulus_orchestrations")
      .insert({
        session_id: data.sessionId,
        created_by: context.userId,
        status: "initial_prompts",
        phase_note: `Writing initial tool-specific prompts for ${approved.length} approved directions across ${confirmed.length} channels.`,
      })
      .select("*")
      .single();
    if (error || !orch) throw new Error(error?.message ?? "Could not create orchestration");

    const byRun = new Map(confirmed.map((r) => [r.id as string, r.channel_name as string]));
    const rows = approved.map((d, idx) => ({
      orchestration_id: orch.id,
      direction_id: d.id,
      run_id: d.run_id,
      channel_name: byRun.get(d.run_id as string) ?? "—",
      lens_name: (d.lens_name as string) ?? "",
      sort_order: idx,
    }));
    const { error: pErr } = await db.from("stimulus_prompts").insert(rows);
    if (pErr) throw new Error(pErr.message);

    return { orchestrationId: orch.id as string, prompts: rows.length, channels: confirmed.length };
  });

export const listOrchestrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: rows } = await db
      .from("stimulus_orchestrations")
      .select("id, status, cd_status, registry_version, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    return { orchestrations: (rows ?? []) as AnyRow[] };
  });

export const loadOrchestrationState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orchestrationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orch = await loadOrchestration(data.orchestrationId, context.userId);
    const [{ data: prompts }, { data: signatures }, { data: crossRefs }] = await Promise.all([
      db
        .from("stimulus_prompts")
        .select("*")
        .eq("orchestration_id", orch.id)
        .order("sort_order", { ascending: true }),
      db
        .from("stimulus_signatures")
        .select("*")
        .eq("orchestration_id", orch.id)
        .order("created_at", { ascending: true }),
      db
        .from("stimulus_cross_refs")
        .select("*")
        .eq("orchestration_id", orch.id)
        .order("created_at", { ascending: true }),
    ]);
    return {
      orchestration: orch,
      prompts: (prompts ?? []) as AnyRow[],
      signatures: (signatures ?? []) as AnyRow[],
      crossRefs: (crossRefs ?? []) as AnyRow[],
    };
  });

// ------------------------------------------------------------------ the driver

/**
 * Resumable, phase-by-phase driver. The client calls this until `done`.
 * Phases, in order:
 *   initial_prompts → extract → propagate → wad → cd → complete
 */
export const runOrchestrationStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orchestrationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => orchestrationStep(data.orchestrationId, context.userId));

/**
 * Start (or re-attach to) the detached server-side driver. Returns immediately;
 * the run continues inside the Worker even after the browser goes away.
 */
export const driveOrchestration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orchestrationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) =>
    driveOrchestrationInBackground(data.orchestrationId, context.userId),
  );


// ------------------------------------------------------------------ human control

/** Human override of any propagated suggestion. Suggestions are never silent. */
export const setCrossRefDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        crossRefId: z.string().uuid(),
        decision: z.enum(["accepted", "rejected", "suggested"]),
        reason: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await db
      .from("stimulus_cross_refs")
      .select("id, orchestration_id")
      .eq("id", data.crossRefId)
      .single();
    if (!row) throw new Error("Cross-reference not found");
    await loadOrchestration(row.orchestration_id as string, context.userId);
    await db
      .from("stimulus_cross_refs")
      .update({
        status: data.decision,
        decision_reason: data.reason ?? null,
        decided_at: data.decision === "suggested" ? null : new Date().toISOString(),
      })
      .eq("id", data.crossRefId);
    return { ok: true };
  });

/**
 * LATE REJECTION AT THE CD PASS — the confirmed mechanism.
 *
 * 1. The prompt is marked rejected (never deleted — the record stands).
 * 2. Every signature sourced from that direction is RETIRED, not hard-deleted,
 *    with the rejection reason attached. The audit trail survives.
 * 3. Every cross-reference sourced from a retired signature is voided, so no
 *    orphaned reference is left sitting silently inside another prompt.
 * 4. The affected prompts — only those that carried a voided reference — are
 *    reset for a targeted re-propagation against the live Registry. Extraction
 *    does NOT re-run and the run does NOT restart.
 * 5. The registry version increments, and the CD pass re-runs across the WHOLE
 *    surviving set (the confirmed choice), so cohesion is judged on what is
 *    actually left rather than on the touched prompts alone.
 */
export const rejectPromptAtCd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ promptId: z.string().uuid(), reason: z.string().min(1).max(2000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: prompt } = await db
      .from("stimulus_prompts")
      .select("*")
      .eq("id", data.promptId)
      .single();
    if (!prompt) throw new Error("Prompt not found");
    const orch = await loadOrchestration(prompt.orchestration_id as string, context.userId);
    const id = orch.id as string;
    const now = new Date().toISOString();
    const nextVersion = ((orch.registry_version as number) ?? 1) + 1;

    // 1. Reject the direction's prompt.
    await db
      .from("stimulus_prompts")
      .update({ status: "rejected", rejected_reason: data.reason, rejected_at: now })
      .eq("id", data.promptId);

    // 2. Retire its signatures.
    const { data: retired } = await db
      .from("stimulus_signatures")
      .update({ status: "retired", retired_reason: data.reason, retired_at: now })
      .eq("orchestration_id", id)
      .eq("source_prompt_id", data.promptId)
      .eq("status", "active")
      .select("id");
    const retiredIds = ((retired ?? []) as AnyRow[]).map((r) => r.id as string);

    // 3. Void every cross-reference that depended on them.
    let affectedPromptIds: string[] = [];
    if (retiredIds.length) {
      const { data: voided } = await db
        .from("stimulus_cross_refs")
        .update({
          status: "voided",
          decision_reason: `Source direction rejected at the CD pass: ${data.reason}`,
          decided_at: now,
        })
        .eq("orchestration_id", id)
        .in("signature_id", retiredIds)
        .neq("status", "voided")
        .select("prompt_id");
      affectedPromptIds = Array.from(
        new Set(((voided ?? []) as AnyRow[]).map((v) => v.prompt_id as string)),
      ).filter((pid) => pid !== data.promptId);
    }
    // Any suggestion still attached to the rejected prompt itself is voided too.
    await db
      .from("stimulus_cross_refs")
      .update({ status: "voided", decision_reason: "Prompt rejected at the CD pass.", decided_at: now })
      .eq("prompt_id", data.promptId)
      .neq("status", "voided");

    // 4. Targeted re-propagation for the affected survivors only.
    if (affectedPromptIds.length) {
      await db
        .from("stimulus_prompts")
        .update({ propagated: false })
        .in("id", affectedPromptIds);
    }

    // 5. Bump the version and re-run propagation → craft (untouched prompts keep
    //    their craft verdict) → CD across the whole surviving set.
    await setPhase(id, {
      status: "propagate",
      registry_version: nextVersion,
      cd_status: "pending",
      cd_revision_count: 0,
      phase_note: `Direction rejected late. ${retiredIds.length} signature(s) retired, ${affectedPromptIds.length} prompt(s) re-propagating, then a full CD re-run at registry v${nextVersion}.`,
    });

    return {
      ok: true,
      retiredSignatures: retiredIds.length,
      repropagatedPrompts: affectedPromptIds.length,
      registryVersion: nextVersion,
    };
  });
