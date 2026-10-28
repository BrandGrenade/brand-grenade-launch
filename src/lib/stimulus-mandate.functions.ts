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
      .select("id")
      .eq("orchestration_id", orch.id)
      .eq("status", "active");
    const ids = ((promptRows ?? []) as AnyRow[]).map((p) => p.id as string);
    if (ids.length === 0) throw new Error("No active prompts in this set to mandate against.");
    const now = new Date().toISOString();
    const log = Array.isArray(orch.mandate_log) ? orch.mandate_log : [];
    await db
      .from("stimulus_orchestrations")
      .update({
        mandate_text: mandateText,
        mandate_source: source,
        mandate_signature_id: data.signatureId ?? null,
        mandate_applied_at: now,
        mandate_log: [...log, { at: now, by: context.userId, mandate: mandateText, source, prompts: ids.length }],
      })
      .eq("id", orch.id);
    // Every channel is rewritten and checked by the background runner; an
    // absent mandate retries twice before the CD is offered a decision.
    const { queueRepair } = await import("@/lib/stimulus/orchestration-core.server");
    await queueRepair(orch.id, ids, "mandate", `Mandate: applying to ${ids.length} channel(s).`);
    return { queued: ids.length };
  });
