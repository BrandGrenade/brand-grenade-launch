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

const PROMPT_BATCH = 2;

type AnyRow = Record<string, unknown>;
const db = supabaseAdmin as unknown as {
  from: (t: string) => any;
};

async function loadOrchestration(id: string, userId: string) {
  const { data, error } = await db.from("stimulus_orchestrations").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`Orchestration not found: ${error?.message ?? "no row"}`);
  await assertSessionAccess(data.session_id as string, userId);
  return data as AnyRow;
}

async function sessionContext(sessionId: string) {
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("brand_name, category, selected_smp, stage_18_detonation_line")
    .eq("id", sessionId)
    .single();
  return {
    brandName: data?.brand_name ?? "—",
    category: data?.category ?? "—",
    smp: data?.selected_smp ?? "",
    detonationLine: data?.stage_18_detonation_line ?? "",
  };
}

async function loadAssetRules(userId: string, brandName: string): Promise<BrandAssetRules | null> {
  const { data } = await db
    .from("brand_asset_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("brand_key", brandName.trim().toLowerCase())
    .maybeSingle();
  if (!data) return null;
  return {
    brandName: data.brand_name,
    colours: data.colours ?? "",
    logoReferences: data.logo_references ?? "",
    typography: data.typography ?? "",
    packagingRules: data.packaging_rules ?? "",
    legalLines: data.legal_lines ?? "",
    notes: data.notes ?? "",
  };
}

async function setPhase(id: string, patch: AnyRow) {
  await db.from("stimulus_orchestrations").update(patch).eq("id", id);
}

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
      .select("id, channel_name, gate_one_confirmed")
      .eq("session_id", data.sessionId)
      .eq("gate_one_confirmed", true);
    const confirmed = (runs ?? []) as AnyRow[];
    if (confirmed.length === 0)
      throw new Error("No Gate One-confirmed channel runs on this session yet.");

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
  .handler(async ({ data, context }) => {
    const orch = await loadOrchestration(data.orchestrationId, context.userId);
    const id = orch.id as string;
    const ctx = await sessionContext(orch.session_id as string);
    const assetRules = await loadAssetRules(context.userId, ctx.brandName);
    const passes = await import("./stimulus/orchestrate.server");

    const activePrompts = async () =>
      ((
        await db
          .from("stimulus_prompts")
          .select("*")
          .eq("orchestration_id", id)
          .eq("status", "active")
          .order("sort_order", { ascending: true })
      ).data ?? []) as AnyRow[];

    const activeSignatures = async () =>
      ((
        await db
          .from("stimulus_signatures")
          .select("*")
          .eq("orchestration_id", id)
          .eq("status", "active")
      ).data ?? []) as AnyRow[];

    try {
      const status = orch.status as string;

      // ---------------------------------------------------------- initial prompts
      if (status === "initial_prompts" || status === "pending") {
        const prompts = (await activePrompts()).filter((p) => !p.initial_prompt);
        if (prompts.length === 0) {
          await setPhase(id, {
            status: "extract",
            phase_note: "All initial prompts written. Extracting the Campaign Signature Registry.",
          });
          return { done: false, phase: "extract", note: "Initial prompts complete." };
        }
        const batch = prompts.slice(0, PROMPT_BATCH);
        for (const p of batch) {
          const { data: dir } = await db
            .from("stimulus_directions")
            .select("direction, instinct_brief, lens_name")
            .eq("id", p.direction_id)
            .single();
          const { data: run } = await db
            .from("stimulus_runs")
            .select("channel_brief, smp")
            .eq("id", p.run_id)
            .single();
          const text = await passes.writeInitialPrompt({
            brandName: ctx.brandName,
            category: ctx.category,
            channelName: p.channel_name as string,
            channelBrief: (run?.channel_brief as string) ?? "",
            smp: (run?.smp as string) || ctx.smp,
            detonationLine: ctx.detonationLine,
            lensName: (dir?.lens_name as string) ?? (p.lens_name as string),
            direction: (dir?.direction as string) ?? "",
            instinctBrief: (dir?.instinct_brief as string) ?? null,
            assetRules,
          });
          await db
            .from("stimulus_prompts")
            .update({ initial_prompt: text, working_prompt: text, error: null })
            .eq("id", p.id);
        }
        const remaining = prompts.length - batch.length;
        await setPhase(id, {
          phase_note: `Initial prompts: ${remaining} remaining.`,
        });
        return { done: false, phase: "initial_prompts", note: `${remaining} initial prompts remaining.` };
      }

      // ---------------------------------------------------------- step 1: extract
      if (status === "extract") {
        const prompts = (await activePrompts()).filter((p) => !p.signatures_extracted);
        if (prompts.length === 0) {
          await setPhase(id, {
            status: "propagate",
            phase_note: "Registry complete. Running the propagation pass.",
          });
          return { done: false, phase: "propagate", note: "Signature Registry complete." };
        }
        const batch = prompts.slice(0, PROMPT_BATCH);
        for (const p of batch) {
          const { data: dir } = await db
            .from("stimulus_directions")
            .select("instinct_brief")
            .eq("id", p.direction_id)
            .single();
          const sigs = await passes.extractSignatures({
            channelName: p.channel_name as string,
            lensName: p.lens_name as string,
            smp: ctx.smp,
            prompt: (p.initial_prompt as string) ?? "",
            instinctBrief: (dir?.instinct_brief as string) ?? null,
          });
          if (sigs.length) {
            await db.from("stimulus_signatures").insert(
              sigs.map((s) => ({
                orchestration_id: id,
                source_prompt_id: p.id,
                source_direction_id: p.direction_id,
                source_channel: p.channel_name,
                category: s.category,
                name: s.name,
                description: s.description,
                origin: s.origin,
                registry_version: orch.registry_version ?? 1,
              })),
            );
          }
          await db.from("stimulus_prompts").update({ signatures_extracted: true }).eq("id", p.id);
        }
        return {
          done: false,
          phase: "extract",
          note: `${prompts.length - batch.length} prompts left to scan.`,
        };
      }

      // ---------------------------------------------------------- step 2: propagate
      if (status === "propagate") {
        const registry = await activeSignatures();
        const prompts = (await activePrompts()).filter((p) => !p.propagated);
        if (prompts.length === 0) {
          await setPhase(id, {
            status: "wad",
            phase_note: "Cross-references suggested. Running the Writer / Art Director pass.",
          });
          return { done: false, phase: "wad", note: "Propagation complete." };
        }
        const batch = prompts.slice(0, PROMPT_BATCH);
        for (const p of batch) {
          const usable = registry.filter((s) => s.source_prompt_id !== p.id);
          const suggestions = await passes.proposeCrossReferences({
            channelName: p.channel_name as string,
            lensName: p.lens_name as string,
            prompt: (p.working_prompt as string) ?? (p.initial_prompt as string) ?? "",
            registry: usable.map((s) => ({
              name: s.name as string,
              category: s.category as string,
              description: s.description as string,
              sourceChannel: (s.source_channel as string) ?? "—",
              origin: s.origin as string,
            })),
          });
          for (const s of suggestions) {
            const match = usable.find(
              (r) => (r.name as string).toLowerCase() === s.signature_name.toLowerCase(),
            );
            await db.from("stimulus_cross_refs").insert({
              orchestration_id: id,
              prompt_id: p.id,
              signature_id: match?.id ?? null,
              source_direction_id: match?.source_direction_id ?? null,
              suggestion: s.suggestion,
              rationale: s.rationale,
              status: "suggested",
              registry_version: orch.registry_version ?? 1,
            });
          }
          await db.from("stimulus_prompts").update({ propagated: true }).eq("id", p.id);
        }
        return {
          done: false,
          phase: "propagate",
          note: `${prompts.length - batch.length} prompts left to cross-reference.`,
        };
      }

      // ---------------------------------------------------------- step 3: writer/AD
      if (status === "wad") {
        const prompts = (await activePrompts()).filter(
          (p) => p.wad_status === "pending" || p.wad_status === "revising",
        );
        if (prompts.length === 0) {
          await setPhase(id, {
            status: "cd",
            phase_note: "Craft pass complete. Running the Creative Director pass across the set.",
          });
          return { done: false, phase: "cd", note: "Writer / AD pass complete." };
        }
        const batch = prompts.slice(0, PROMPT_BATCH);
        for (const p of batch) {
          const { data: refs } = await db
            .from("stimulus_cross_refs")
            .select("suggestion")
            .eq("prompt_id", p.id)
            .eq("status", "suggested");
          const suggestions = ((refs ?? []) as AnyRow[]).map((r) => r.suggestion as string);
          const base = (p.working_prompt as string) ?? (p.initial_prompt as string) ?? "";

          let result = await passes.runWriterAdPass({
            brandName: ctx.brandName,
            channelName: p.channel_name as string,
            lensName: p.lens_name as string,
            smp: ctx.smp,
            prompt: base,
            suggestions,
            assetRules,
          });

          if (result.verdict === "fail" && result.revised_prompt) {
            // Exactly one automatic revision attempt.
            const revised = result.revised_prompt;
            const second = await passes.runWriterAdPass({
              brandName: ctx.brandName,
              channelName: p.channel_name as string,
              lensName: p.lens_name as string,
              smp: ctx.smp,
              prompt: revised,
              suggestions,
              assetRules,
              revisionNote: result.reasoning,
            });
            if (second.verdict === "pass") {
              await db
                .from("stimulus_prompts")
                .update({
                  working_prompt: revised,
                  final_prompt: revised,
                  wad_status: "revised",
                  wad_reasoning: second.reasoning,
                  wad_notes: `First pass failed: ${result.reasoning}\nImperfection: ${second.imperfection_verdict}`,
                  wad_revision_count: 1,
                })
                .eq("id", p.id);
            } else {
              // Still weak after one revision — flagged to the human. Never dropped.
              await db
                .from("stimulus_prompts")
                .update({
                  working_prompt: revised,
                  final_prompt: revised,
                  wad_status: "flagged",
                  wad_reasoning: second.reasoning,
                  wad_notes: `Still weak after one automatic revision. First pass: ${result.reasoning}\nImperfection: ${second.imperfection_verdict}`,
                  wad_revision_count: 1,
                })
                .eq("id", p.id);
            }
          } else if (result.verdict === "fail") {
            await db
              .from("stimulus_prompts")
              .update({
                wad_status: "flagged",
                wad_reasoning: result.reasoning,
                wad_notes: `Failed the craft pass and no revision was returned. Imperfection: ${result.imperfection_verdict}`,
                final_prompt: base,
              })
              .eq("id", p.id);
          } else {
            await db
              .from("stimulus_prompts")
              .update({
                wad_status: "passed",
                wad_reasoning: result.reasoning,
                wad_notes: `Imperfection: ${result.imperfection_verdict}`,
                final_prompt: base,
              })
              .eq("id", p.id);
          }
        }
        return {
          done: false,
          phase: "wad",
          note: `${prompts.length - batch.length} prompts left in the craft pass.`,
        };
      }

      // ---------------------------------------------------------- step 4: CD
      if (status === "cd") {
        const prompts = await activePrompts();
        const registry = await activeSignatures();
        const { data: refRows } = await db
          .from("stimulus_cross_refs")
          .select("*")
          .eq("orchestration_id", id)
          .eq("status", "suggested");
        const refs = ((refRows ?? []) as AnyRow[]).map((r) => ({
          id: r.id as string,
          promptId: r.prompt_id as string,
          signatureName:
            (registry.find((s) => s.id === r.signature_id)?.name as string) ?? "unmatched",
          suggestion: r.suggestion as string,
          rationale: r.rationale as string,
        }));

        const buildSet = (rows: AnyRow[]) =>
          rows.map((p) => ({
            id: p.id as string,
            channelName: p.channel_name as string,
            lensName: p.lens_name as string,
            prompt: (p.final_prompt as string) ?? (p.working_prompt as string) ?? "",
          }));

        const registryForCd = registry.map((s) => ({
          name: s.name as string,
          category: s.category as string,
          description: s.description as string,
          sourceChannel: (s.source_channel as string) ?? "—",
        }));

        const cd = await passes.runCreativeDirectorPass({
          brandName: ctx.brandName,
          smp: ctx.smp,
          detonationLine: ctx.detonationLine,
          prompts: buildSet(prompts),
          crossRefs: refs,
          registry: registryForCd,
        });

        // Accept / reject every propagated suggestion. Nothing is silently merged.
        for (const d of cd.decisions) {
          await db
            .from("stimulus_cross_refs")
            .update({
              status: d.decision === "accept" ? "accepted" : "rejected",
              decision_reason: d.reason ?? null,
              decided_at: new Date().toISOString(),
            })
            .eq("id", d.id)
            .eq("orchestration_id", id);
        }
        for (const n of cd.prompt_notes) {
          await db.from("stimulus_prompts").update({ cd_note: n.note }).eq("id", n.prompt_id);
        }

        let finalCd = cd;
        let revisionCount = (orch.cd_revision_count as number) ?? 0;

        if (cd.cohesion === "fail" && revisionCount === 0) {
          // Exactly one automatic cohesion revision, then re-judge the whole set.
          for (const n of cd.prompt_notes) {
            const target = prompts.find((p) => p.id === n.prompt_id);
            if (!target) continue;
            const rewritten = await passes.reviseForCohesion({
              note: n.note,
              prompt: (target.final_prompt as string) ?? (target.working_prompt as string) ?? "",
              channelName: target.channel_name as string,
            });
            await db
              .from("stimulus_prompts")
              .update({ working_prompt: rewritten, final_prompt: rewritten })
              .eq("id", target.id);
          }
          revisionCount = 1;
          const refreshed = await activePrompts();
          finalCd = await passes.runCreativeDirectorPass({
            brandName: ctx.brandName,
            smp: ctx.smp,
            detonationLine: ctx.detonationLine,
            prompts: buildSet(refreshed),
            crossRefs: [],
            registry: registryForCd,
            revisionNote: cd.reasoning,
          });
        }

        const cdStatus =
          finalCd.cohesion === "pass" ? (revisionCount ? "revised" : "passed") : "flagged";
        await setPhase(id, {
          status: "complete",
          cd_output: finalCd.reasoning,
          cd_status: cdStatus,
          cd_revision_count: revisionCount,
          error: null,
          phase_note:
            cdStatus === "flagged"
              ? "Cohesion still failing after one automatic revision — flagged for a human before Gate Two."
              : "Orchestration complete. Ready for Gate Two.",
        });
        return { done: true, phase: "complete", note: `Creative Director pass: ${cdStatus}.` };
      }

      return { done: true, phase: status, note: "Nothing left to run." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Orchestration step failed";
      await setPhase(id, { error: msg });
      throw new Error(msg);
    }
  });

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
