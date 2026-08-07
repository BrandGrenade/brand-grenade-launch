// CREATIVE STIMULUS ENGINE — PHASE 5. The Gate Two mandate.
//
// At Gate Two the Creative Director can mandate one element across the entire
// set: an existing Campaign Signature, or something new written on the spot.
// It is binding — every active prompt is rewritten to carry it, there is no
// per-channel accept or reject, and a full Creative Director cohesion re-run
// fires afterwards so the set is re-judged as a whole rather than assumed fine.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
const db = supabaseAdmin as unknown as { from: (t: string) => any };

async function orchestrationForUser(id: string, userId: string) {
  const { data, error } = await db
    .from("stimulus_orchestrations")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`Orchestration not found: ${error?.message ?? "no row"}`);
  await assertSessionAccess(data.session_id as string, userId);
  return data as AnyRow;
}

/** Signatures available to mandate, plus whatever mandate is already in force. */
export const getMandateOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orchestrationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orch = await orchestrationForUser(data.orchestrationId, context.userId);
    const { data: sigs } = await db
      .from("stimulus_signatures")
      .select("id, name, category, description, source_channel, status")
      .eq("orchestration_id", orch.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    return {
      signatures: ((sigs ?? []) as AnyRow[]).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        category: s.category as string,
        description: s.description as string,
        sourceChannel: (s.source_channel as string) ?? "—",
      })),
      current: orch.mandate_text
        ? {
            text: orch.mandate_text as string,
            source: (orch.mandate_source as string) ?? "new",
            appliedAt: orch.mandate_applied_at as string | null,
          }
        : null,
      log: (orch.mandate_log ?? []) as AnyRow[],
      cdStatus: (orch.cd_status as string) ?? "pending",
      cdOutput: (orch.cd_output as string) ?? "",
    };
  });

/**
 * Applies a mandate to every active prompt in the set, then re-runs the
 * Creative Director cohesion pass. Gate Two approvals are cleared first: the
 * prompts being approved are no longer the prompts that were approved.
 */
export const applyGateTwoMandate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        orchestrationId: z.string().uuid(),
        signatureId: z.string().uuid().optional(),
        mandateText: z.string().trim().min(3).max(2000).optional(),
      })
      .refine((v) => Boolean(v.signatureId) || Boolean(v.mandateText), {
        message: "Choose an existing signature or write a new mandate.",
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const orch = await orchestrationForUser(data.orchestrationId, context.userId);

    let mandateText = data.mandateText?.trim() ?? "";
    let source: "signature" | "new" = "new";
    if (data.signatureId) {
      const { data: sig } = await db
        .from("stimulus_signatures")
        .select("id, name, category, description, orchestration_id")
        .eq("id", data.signatureId)
        .single();
      if (!sig || sig.orchestration_id !== orch.id) throw new Error("Signature not found");
      source = "signature";
      mandateText = `${sig.name} (${sig.category}) — ${sig.description}${
        data.mandateText?.trim() ? `\n\nCreative Director addition: ${data.mandateText.trim()}` : ""
      }`;
    }

    const { data: promptRows } = await db
      .from("stimulus_prompts")
      .select("id, channel_name, lens_name, working_prompt, final_prompt, revision_log")
      .eq("orchestration_id", orch.id)
      .neq("status", "rejected");
    const prompts = (promptRows ?? []) as AnyRow[];
    if (prompts.length === 0) throw new Error("No active prompts in this set to mandate against.");

    const passes = await import("@/lib/stimulus/orchestrate.server");
    const now = new Date().toISOString();
    const failures: string[] = [];

    for (const p of prompts) {
      const base = (p.final_prompt as string) ?? (p.working_prompt as string) ?? "";
      if (!base) continue;
      try {
        const rewritten = await passes.applyMandateToPrompt({
          mandate: mandateText,
          channelName: p.channel_name as string,
          lensName: p.lens_name as string,
          prompt: base,
        });
        const log = Array.isArray(p.revision_log) ? p.revision_log : [];
        await db
          .from("stimulus_prompts")
          .update({
            working_prompt: rewritten,
            final_prompt: rewritten,
            // The approved artefact has changed; approval must be re-earned.
            gate_two_approved: false,
            gate_two_approved_at: null,
            gate_two_snapshot: null,
            revision_log: [
              ...log,
              { at: now, kind: "gate_two_mandate", mandate: mandateText, source },
            ],
            error: null,
          })
          .eq("id", p.id);
      } catch (e) {
        failures.push(`${p.channel_name}: ${e instanceof Error ? e.message : "rewrite failed"}`);
      }
    }

    // Mandatory cohesion re-run — the set is re-judged as a whole.
    const ctxRow = await db
      .from("sessions")
      .select("brand_name, selected_smp, stage_18_detonation_line")
      .eq("id", orch.session_id)
      .single();
    const ctx = ctxRow.data ?? {};

    const { data: refreshed } = await db
      .from("stimulus_prompts")
      .select("id, channel_name, lens_name, final_prompt, working_prompt")
      .eq("orchestration_id", orch.id)
      .neq("status", "rejected");

    const { data: registry } = await db
      .from("stimulus_signatures")
      .select("name, category, description, source_channel")
      .eq("orchestration_id", orch.id)
      .eq("status", "active");

    const cd = await passes.runCreativeDirectorPass({
      brandName: (ctx.brand_name as string) ?? "—",
      smp: (ctx.selected_smp as string) ?? "",
      detonationLine: (ctx.stage_18_detonation_line as string) ?? "",
      prompts: ((refreshed ?? []) as AnyRow[]).map((p) => ({
        id: p.id as string,
        channelName: p.channel_name as string,
        lensName: p.lens_name as string,
        prompt: (p.final_prompt as string) ?? (p.working_prompt as string) ?? "",
      })),
      crossRefs: [],
      registry: ((registry ?? []) as AnyRow[]).map((s) => ({
        name: s.name as string,
        category: s.category as string,
        description: s.description as string,
        sourceChannel: (s.source_channel as string) ?? "—",
      })),
      revisionNote: `A Creative Director mandate has just been applied across the whole set:\n${mandateText}\n\nJudge cohesion with the mandate in force. Name any channel where the mandate sits weakly or has flattened the idea.`,
    });

    for (const n of cd.prompt_notes ?? []) {
      await db.from("stimulus_prompts").update({ cd_note: n.note }).eq("id", n.prompt_id);
    }

    const cdStatus = cd.cohesion === "pass" ? "revised" : "flagged";
    const log = Array.isArray(orch.mandate_log) ? orch.mandate_log : [];
    await db
      .from("stimulus_orchestrations")
      .update({
        mandate_text: mandateText,
        mandate_source: source,
        mandate_signature_id: data.signatureId ?? null,
        mandate_applied_at: now,
        mandate_log: [
          ...log,
          {
            at: now,
            mandate: mandateText,
            source,
            promptsRewritten: prompts.length - failures.length,
            failures,
            cohesion: cd.cohesion,
          },
        ],
        cd_output: cd.reasoning,
        cd_status: cdStatus,
        // Set-level Gate Two confirmation is void once the prompts change.
        gate_two_confirmed: false,
        gate_two_confirmed_at: null,
        phase_note:
          cdStatus === "flagged"
            ? "Mandate applied. Cohesion flagged — read the Creative Director note before confirming Gate Two."
            : "Mandate applied and the set re-judged as cohesive. Gate Two approvals need re-confirming.",
        error: failures.length ? `Mandate failed on: ${failures.join("; ")}` : null,
      })
      .eq("id", orch.id);

    return {
      promptsRewritten: prompts.length - failures.length,
      failures,
      cohesion: cd.cohesion as string,
      cdOutput: cd.reasoning as string,
      cdStatus,
    };
  });
