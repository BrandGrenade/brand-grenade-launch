// Orchestration core — server-only.
//
// Holds the shared DB helpers and the phase-by-phase step machine so both the
// thin `runOrchestrationStep` RPC and the background driver call exactly the
// same code. Kept out of *.functions.ts so the server-function file stays a
// thin wrapper (module scope there must not carry runtime siblings).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { scheduleBackground } from "@/lib/background.server";
import type { BrandAssetRules } from "./orchestration-prompts";
import { lockedLinesBlock } from "./orchestration-prompts";
import {
  amendmentStatus,
  canRetry,
  field2Placement,
  fidelityBelow,
  linesCheck,
} from "./platform-retry-rules";

const PROMPT_BATCH = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = Record<string, any>;
export const db = supabaseAdmin as unknown as {
  from: (t: string) => any;
};

export async function loadOrchestration(id: string, userId: string) {
  const { data, error } = await db.from("stimulus_orchestrations").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`Orchestration not found: ${error?.message ?? "no row"}`);
  await assertSessionAccess(data.session_id as string, userId);
  return data as AnyRow;
}

export async function sessionContext(sessionId: string) {
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

export async function loadAssetRules(userId: string, brandName: string): Promise<BrandAssetRules | null> {
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

export async function setPhase(id: string, patch: AnyRow) {
  // Entering a whole-set phase re-queues every active channel so the Step 4
  // progress bar shows per-channel state from the saved rows (survives refresh).
  if (["extract", "propagate", "wad", "cd"].includes(patch.status)) {
    await db.from("stimulus_prompts").update({ run_state: "queued" }).eq("orchestration_id", id).eq("status", "active");
  }
  if (patch.status === "complete") {
    await db.from("stimulus_prompts").update({ run_state: "done" }).eq("orchestration_id", id).eq("status", "active").neq("run_state", "failed");
  }
  // Every phase write doubles as a liveness heartbeat, so a browser-driven
  // step keeps the row visibly alive exactly like the background driver does.
  await db
    .from("stimulus_orchestrations")
    .update({ driver_heartbeat_at: new Date().toISOString(), ...patch })
    .eq("id", id);
}


/** One phase-slice of the orchestration state machine. */
export async function orchestrationStep(orchestrationId: string, userId: string) {
    const orch = await loadOrchestration(orchestrationId, userId);
    const id = orch.id as string;
    const ctx = await sessionContext(orch.session_id as string);
    const assetRules = await loadAssetRules(userId, ctx.brandName);
    const passes = await import("./orchestrate.server");

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
          await db.from("stimulus_prompts").update({ run_state: "running" }).eq("id", p.id);
          const { data: dir } = await db
            .from("stimulus_directions")
            .select("direction, instinct_brief, lens_name, campaign_line, expression_under_master")
            .eq("id", p.direction_id)
            .single();
          const { data: run } = await db
            .from("stimulus_runs")
            .select("channel_brief, smp")
            .eq("id", p.run_id)
            .single();
          const write = () => passes.writeInitialPrompt({
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
            field1: (dir?.campaign_line as string) ?? null,
            field2: (dir?.expression_under_master as string) ?? null,
          });
          // Locked lines are binding: retry up to twice, then name the fault.
          let text = await write();
          let linesErr = linesCheck(text, dir?.campaign_line ?? null, dir?.expression_under_master ?? null);
          for (let r = 0; linesErr && canRetry(r); r++) {
            text = await write();
            linesErr = linesCheck(text, dir?.campaign_line ?? null, dir?.expression_under_master ?? null);
          }
          await db
            .from("stimulus_prompts")
            .update({
              initial_prompt: text,
              working_prompt: text,
              field2_placement: field2Placement(text),
              run_state: linesErr ? "failed" : "done",
              error: linesErr ? `Platform error after 2 retries: ${linesErr}` : null,
            })
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
          const { data: lockedDir } = await db
            .from("stimulus_directions")
            .select("direction, campaign_line, expression_under_master")
            .eq("id", p.direction_id)
            .single();
          const amendments = (Array.isArray(orch.amendment_log) ? orch.amendment_log : [])
            .map((a: AnyRow) => String(a.notes ?? ""))
            .concat(orch.mandate_text ? [String(orch.mandate_text)] : [])
            .filter(Boolean);
          const sigs = await passes.extractSignatures({
            channelName: p.channel_name as string,
            lensName: p.lens_name as string,
            smp: ctx.smp,
            prompt: (p.final_prompt as string) ?? (p.working_prompt as string) ?? (p.initial_prompt as string) ?? "",
            instinctBrief: (dir?.instinct_brief as string) ?? null,
            lockedIdea: [
              lockedDir?.direction ?? "",
              lockedLinesBlock(lockedDir?.campaign_line ?? null, lockedDir?.expression_under_master ?? null),
            ].join("\n\n"),
            amendments,
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
                // The registry only carries devices from the locked idea, its
                // lines or applied amendments. Channel inventions are kept as
                // removed rows so the removal is listed, never silent.
                ...(s.basis === "channel_invention" && s.origin !== "instinct_brief"
                  ? {
                      status: "retired",
                      retired_at: new Date().toISOString(),
                      retired_reason: "Removed: not from the locked idea, its lines or an applied amendment.",
                    }
                  : {}),
              })),
            );
          }
          await db.from("stimulus_prompts").update({ signatures_extracted: true, run_state: "done" }).eq("id", p.id);
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
          await db.from("stimulus_prompts").update({ propagated: true, run_state: "done" }).eq("id", p.id);
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
            // "Regenerate with this reason" / "Send back with notes" is binding.
            revisionNote: p.wad_status === "revising" && p.wad_notes ? `CREATIVE DIRECTOR REASON — apply it: ${p.wad_notes}` : undefined,
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
                  run_state: "done",
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
                  run_state: "done",
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
                run_state: "done",
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
                run_state: "done",
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
        await queueFidelity(id);
        await setPhase(id, {
          status: "fidelity",
          cd_output: finalCd.reasoning,
          cd_status: cdStatus,
          cd_revision_count: revisionCount,
          error: null,
          phase_note:
            cdStatus === "flagged"
              ? "Cohesion still failing after one automatic revision — checking fidelity per channel."
              : "Creative Director pass complete. Checking fidelity per channel.",
        });
        return { done: false, phase: "fidelity", note: `Creative Director pass: ${cdStatus}.` };
      }

      if (status === "repair") return await repairSlice(orch, ctx, passes);
      if (status === "fidelity") return await fidelitySlice(orch, passes);

      return { done: true, phase: status, note: "Nothing left to run." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Orchestration step failed";
      // Keep `status` on the current phase: it is the resume point and the
      // step machine has no 'failed' branch. Mark the failure in phase_note
      // so a stalled run is distinguishable from one still working.
      await setPhase(id, { error: msg, phase_note: `Step failed — retry: ${msg}` });
      throw new Error(msg);


    }
}

// ------------------------------------------------------------------ platform repair

type Passes = typeof import("./orchestrate.server");
type Ctx = Awaited<ReturnType<typeof sessionContext>>;

async function lockedFor(directionId: string) {
  const { data } = await db
    .from("stimulus_directions")
    .select("direction, campaign_line, expression_under_master")
    .eq("id", directionId)
    .single();
  return {
    idea: (data?.direction as string) ?? "",
    field1: (data?.campaign_line as string) ?? null,
    field2: (data?.expression_under_master as string) ?? null,
  };
}

async function queueFidelity(id: string) {
  await db
    .from("stimulus_prompts")
    .update({ repair_kind: "fidelity", fidelity_retries: 0, run_state: "queued" })
    .eq("orchestration_id", id)
    .eq("status", "active");
}

/**
 * Queues channels for a binding rewrite (mandate, amendment or a CD-requested
 * adaptation). The step machine then works one attempt per slice, so each
 * request stays short and the job resumes from the saved rows.
 */
export async function queueRepair(
  orchestrationId: string,
  promptIds: string[],
  kind: "mandate" | "mandate_adapt" | "amendment" | "amendment_adapt",
  note: string,
) {
  const amend = kind.startsWith("amendment");
  for (const pid of promptIds) {
    await db
      .from("stimulus_prompts")
      .update({
        repair_kind: kind,
        run_state: "queued",
        ...(amend ? { amendment_retries: 0, amendment_status: null, amendment_reason: null } : { mandate_retries: 0 }),
        gate_two_approved: false,
        gate_two_approved_at: null,
        gate_two_approved_by: null,
        gate_two_snapshot: null,
      })
      .eq("id", pid)
      .eq("orchestration_id", orchestrationId);
  }
  await setPhase(orchestrationId, {
    status: "repair",
    repair_next: kind === "amendment" ? "extract" : "cd_review",
    gate_two_confirmed: false,
    gate_two_confirmed_at: null,
    driver_status: "idle",
    error: null,
    phase_note: note,
  });
}

async function repairSlice(orch: AnyRow, ctx: Ctx, passes: Passes) {
  const id = orch.id as string;
  const { data: rows } = await db
    .from("stimulus_prompts")
    .select("*")
    .eq("orchestration_id", id)
    .eq("status", "active")
    .in("repair_kind", ["mandate", "mandate_adapt", "amendment", "amendment_adapt"])
    .order("sort_order", { ascending: true })
    .limit(1);
  const p = ((rows ?? []) as AnyRow[])[0];

  if (!p) {
    if (orch.repair_next === "extract") {
      // Rebuild the Signature Registry against the amended set. Old rows are
      // retired, never deleted, so every earlier registry stays in history.
      const now = new Date().toISOString();
      await db
        .from("stimulus_signatures")
        .update({ status: "retired", retired_at: now, retired_reason: "Registry rebuilt after a Gate Two amendment." })
        .eq("orchestration_id", id)
        .eq("status", "active");
      await db
        .from("stimulus_cross_refs")
        .update({ status: "voided", decision_reason: "Registry rebuilt after a Gate Two amendment." })
        .eq("orchestration_id", id)
        .eq("status", "suggested");
      // The amended prompt is kept as written: the craft pass is not re-run on
      // it, so the amendment cannot be quietly undone.
      await db
        .from("stimulus_prompts")
        .update({ signatures_extracted: false, propagated: false, wad_status: "passed" })
        .eq("orchestration_id", id)
        .eq("status", "active");
      await setPhase(id, {
        status: "extract",
        registry_version: (orch.registry_version ?? 1) + 1,
        repair_next: null,
        phase_note: "Amendment applied. Rebuilding the Campaign Signature Registry.",
      });
      return { done: false, phase: "extract", note: "Rebuilding the registry." };
    }
    // Mandate or adaptation: the set is re-judged as a whole, without rewrites.
    const { data: set } = await db
      .from("stimulus_prompts")
      .select("id, channel_name, lens_name, final_prompt, working_prompt")
      .eq("orchestration_id", id)
      .eq("status", "active");
    const { data: registry } = await db
      .from("stimulus_signatures")
      .select("name, category, description, source_channel")
      .eq("orchestration_id", id)
      .eq("status", "active");
    const cd = await passes.runCreativeDirectorPass({
      brandName: ctx.brandName,
      smp: ctx.smp,
      detonationLine: ctx.detonationLine,
      prompts: ((set ?? []) as AnyRow[]).map((x) => ({
        id: x.id,
        channelName: x.channel_name,
        lensName: x.lens_name,
        prompt: x.final_prompt ?? x.working_prompt ?? "",
      })),
      crossRefs: [],
      registry: ((registry ?? []) as AnyRow[]).map((r) => ({
        name: r.name,
        category: r.category,
        description: r.description,
        sourceChannel: r.source_channel ?? "—",
      })),
      revisionNote: orch.mandate_text
        ? `A binding Creative Director mandate is in force:\n${orch.mandate_text}\nJudge the set with it in force. Do not rewrite.`
        : undefined,
    });
    for (const n of cd.prompt_notes ?? []) {
      await db.from("stimulus_prompts").update({ cd_note: n.note }).eq("id", n.prompt_id);
    }
    await queueFidelity(id);
    await setPhase(id, {
      status: "fidelity",
      repair_next: null,
      cd_output: cd.reasoning,
      cd_status: cd.cohesion === "pass" ? "revised" : "flagged",
      phase_note: "Set re-judged. Checking fidelity per channel.",
    });
    return { done: false, phase: "fidelity", note: "Repair complete." };
  }

  const amend = String(p.repair_kind).startsWith("amendment");
  const adapt = String(p.repair_kind).endsWith("_adapt");
  const retries = (amend ? p.amendment_retries : p.mandate_retries) ?? 0;
  const instruction = amend ? String(orch.pending_amendment ?? "") : String(orch.mandate_text ?? "");
  if (!instruction.trim()) throw new Error("No saved mandate or amendment to apply.");
  const locked = await lockedFor(p.direction_id);
  const lastReason = amend ? p.amendment_reason : p.mandate_carrier;
  await db.from("stimulus_prompts").update({ run_state: "running" }).eq("id", p.id);
  await setPhase(id, {
    phase_note: `${amend ? "Amendment" : "Mandate"}${adapt ? " adaptation" : ""}: ${p.channel_name} — attempt ${retries + 1} of 3.`,
  });

  const binding = [
    instruction,
    adapt
      ? `ADAPT FOR THIS CHANNEL TYPE: earlier attempts could not carry this literally. Express it in the form a ${p.channel_name} execution can genuinely carry (a format, a sequence, a spoken line, a placement), keeping its meaning.`
      : "",
    retries > 0 && lastReason ? `PREVIOUS ATTEMPT FELL SHORT: ${lastReason}` : "",
    lockedLinesBlock(locked.field1, locked.field2),
  ]
    .filter(Boolean)
    .join("\n\n");
  const base = (p.final_prompt as string) ?? (p.working_prompt as string) ?? "";
  const rewritten = await passes.applyMandateToPrompt({
    mandate: binding,
    channelName: p.channel_name,
    lensName: p.lens_name,
    prompt: base,
  });
  let check = await passes.checkMandateCompliance({
    mandate: instruction,
    channelName: p.channel_name,
    lensName: p.lens_name,
    prompt: rewritten,
  });
  const linesErr = linesCheck(rewritten, locked.field1, locked.field2);
  if (linesErr && check.verdict === "present") check = { ...check, verdict: "weak", reason: `${linesErr} ${check.reason}` };

  const passed = amend ? check.verdict === "present" : check.verdict !== "absent";
  const retryAgain = !passed && canRetry(retries);
  const now = new Date().toISOString();
  const log = Array.isArray(p.revision_log) ? p.revision_log : [];
  await db
    .from("stimulus_prompts")
    .update({
      working_prompt: rewritten,
      final_prompt: rewritten,
      field2_placement: field2Placement(rewritten),
      revision_log: [
        ...log,
        { at: now, kind: `gate_two_${p.repair_kind}`, attempt: retries + 1, instruction, before: base, compliance: check },
      ],
      ...(amend
        ? {
            amendment_status: passed ? "applied" : retryAgain ? amendmentStatus(check.verdict) : "platform_failed",
            amendment_reason: check.reason || check.carrier,
            amendment_retries: retryAgain ? retries + 1 : retries,
          }
        : {
            mandate_compliance: check.verdict,
            mandate_carrier: check.carrier || check.reason,
            mandate_checked_at: now,
            mandate_retries: retryAgain ? retries + 1 : retries,
          }),
      repair_kind: retryAgain ? p.repair_kind : null,
      run_state: retryAgain ? "queued" : passed ? "done" : "failed",
      error: null,
    })
    .eq("id", p.id);
  return { done: false, phase: "repair", note: `${p.channel_name}: ${check.verdict}.` };
}

async function fidelitySlice(orch: AnyRow, passes: Passes) {
  const id = orch.id as string;
  const { data: rows } = await db
    .from("stimulus_prompts")
    .select("*")
    .eq("orchestration_id", id)
    .eq("status", "active")
    .eq("repair_kind", "fidelity")
    .order("sort_order", { ascending: true })
    .limit(1);
  const p = ((rows ?? []) as AnyRow[])[0];
  if (!p) {
    await setPhase(id, { status: "complete", error: null, phase_note: "Orchestration complete. Ready for Gate Two." });
    return { done: true, phase: "complete", note: "Fidelity checked on every channel." };
  }
  const retries = p.fidelity_retries ?? 0;
  await db.from("stimulus_prompts").update({ run_state: "running" }).eq("id", p.id);
  await setPhase(id, { phase_note: `Fidelity: ${p.channel_name} — check ${retries + 1} of 3.` });
  const prompt = (p.final_prompt as string) ?? (p.working_prompt as string) ?? "";
  const { runChannelFidelityCheck } = await import("@/lib/stage21-fidelity.server");
  const report = await runChannelFidelityCheck({
    sessionId: orch.session_id,
    leadExpression: null,
    outputs: { [p.channel_name]: prompt },
  });
  const result = report.results[0];
  if (!report.leadExpressionPresent || !result) {
    await db
      .from("stimulus_prompts")
      .update({ repair_kind: null, run_state: "done", fidelity_status: "not_checked", fidelity_reason: "No locked idea on this run to check against." })
      .eq("id", p.id);
    return { done: false, phase: "fidelity", note: `${p.channel_name}: not checked.` };
  }
  const below = fidelityBelow(result.score);
  if (below && canRetry(retries)) {
    const locked = await lockedFor(p.direction_id);
    const rewritten = await passes.reviseForCohesion({
      channelName: p.channel_name,
      prompt,
      note: `FIDELITY TO THE LOCKED IDEA scored ${result.score}/10: ${result.reasoning}\nRewrite so this channel adapts the locked idea faithfully.\n\nLOCKED IDEA:\n${locked.idea}\n\n${lockedLinesBlock(locked.field1, locked.field2)}`,
    });
    const log = Array.isArray(p.revision_log) ? p.revision_log : [];
    await db
      .from("stimulus_prompts")
      .update({
        working_prompt: rewritten,
        final_prompt: rewritten,
        field2_placement: field2Placement(rewritten),
        fidelity_score: result.score,
        fidelity_reason: result.reasoning,
        fidelity_retries: retries + 1,
        run_state: "queued",
        revision_log: [...log, { at: new Date().toISOString(), kind: "fidelity_retry", attempt: retries + 1, score: result.score, before: prompt }],
      })
      .eq("id", p.id);
    return { done: false, phase: "fidelity", note: `${p.channel_name}: ${result.score}/10, retrying.` };
  }
  await db
    .from("stimulus_prompts")
    .update({
      fidelity_score: result.score,
      fidelity_reason: result.reasoning,
      fidelity_status: below ? "below" : "pass",
      repair_kind: null,
      run_state: below ? "failed" : "done",
    })
    .eq("id", p.id);
  return { done: false, phase: "fidelity", note: `${p.channel_name}: ${result.score}/10.` };
}

// ------------------------------------------------------------------ background driver

/** A claimed driver with no heartbeat for this long is treated as dead. */
const DRIVER_STALE_MS = 90_000;

async function heartbeat(id: string) {
  await db
    .from("stimulus_orchestrations")
    .update({ driver_heartbeat_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * A run can be stopped mid-flight by setting driver_status = 'cancelled'.
 * The loop checks this after every step, so an accidental or superseded run
 * stops instead of burning tokens forever.
 */
async function isCancelled(id: string) {
  const { data } = await db
    .from("stimulus_orchestrations")
    .select("driver_status")
    .eq("id", id)
    .maybeSingle();
  return (data as { driver_status?: string } | null)?.driver_status === "cancelled";
}


/**
 * Runs the whole orchestration server-side, detached from the browser request
 * via ctx.waitUntil() — the same decoupling used by the Intelligence Lab. Once
 * claimed, closing the tab, switching away or losing the connection has no
 * effect: the Worker keeps stepping and the client simply polls the row.
 */
export async function driveOrchestrationInBackground(orchestrationId: string, userId: string) {
  const orch = await loadOrchestration(orchestrationId, userId);
  const id = orch.id as string;

  if (orch.status === "complete") return { claimed: false, reason: "complete" as const };

  const hb = orch.driver_heartbeat_at ? Date.parse(orch.driver_heartbeat_at as string) : 0;
  const alive = orch.driver_status === "running" && Date.now() - hb < DRIVER_STALE_MS;
  if (alive) return { claimed: false, reason: "already_running" as const };

  await db
    .from("stimulus_orchestrations")
    .update({
      driver_status: "running",
      driver_heartbeat_at: new Date().toISOString(),
      driver_started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", id);

  scheduleBackground(
    (async () => {
      let guard = 0;
      try {
        for (;;) {
          guard += 1;
          if (guard > 400) throw new Error("Orchestration driver exceeded its step budget.");
          const r = await orchestrationStep(id, userId);
          await heartbeat(id);
          if (r.done) break;
          if (await isCancelled(id)) return;
        }

        await db
          .from("stimulus_orchestrations")
          .update({ driver_status: "idle", driver_heartbeat_at: new Date().toISOString() })
          .eq("id", id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Orchestration driver failed";
        await db
          .from("stimulus_orchestrations")
          .update({
            driver_status: "failed",
            driver_heartbeat_at: new Date().toISOString(),
            error: msg,
          })
          .eq("id", id);
      }
    })(),
    "orchestration-driver",
  );

  return { claimed: true, reason: "started" as const };
}
