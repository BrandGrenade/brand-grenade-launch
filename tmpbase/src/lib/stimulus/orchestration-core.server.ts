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
      // Keep `status` on the current phase: it is the resume point and the
      // step machine has no 'failed' branch. Mark the failure in phase_note
      // so a stalled run is distinguishable from one still working.
      await setPhase(id, { error: msg, phase_note: `Step failed — retry: ${msg}` });
      throw new Error(msg);


    }
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
