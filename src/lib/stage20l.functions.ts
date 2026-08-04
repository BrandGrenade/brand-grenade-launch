// Stage 20L — Lead Creative Expression.
//
// Runs after Stage 20 is approved and BEFORE Stage 20B / Stage 21. Produces
// one decided creative idea in one primary medium. Stage 20B and Stage 21
// both inherit it as a binding constraint.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_20L_LEAD_EXPRESSION_PROMPT } from "./stage20l-lead-expression-prompt";
import {
  appendRedirect,
  formatThreeTruths,
  smpGoverningBlock,
  withPhase2Formatting,
} from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";

const SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_14c_output",
  "stage_17b_output",
  "stage_18_selected_detonation",
  "stage_18_detonation_line",
  "stage_20_output",
  "stage_20_approved",
  "stage_20l_output",
  "stage_20l_medium",
  "stage_20l_approved",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
].join(", ");

type Row = {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_14c_output: string | null;
  stage_17b_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_18_detonation_line: string | null;
  stage_20_output: string | null;
  stage_20_approved: boolean | null;
  stage_20l_output: string | null;
  stage_20l_medium: string | null;
  stage_20l_approved: boolean | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
};

function buildUserMessage(s: Row, mediumHint: string): string {
  return [
    smpGoverningBlock(s.selected_smp),
    "",
    `BRAND: ${s.brand_name ?? "—"}`,
    `CATEGORY: ${s.category ?? "—"}`,
    "",
    "VALIDATED PROPOSITION (SMP)",
    s.selected_smp?.trim() || "—",
    "",
    "SELECTED DETONATION LINE",
    s.stage_18_detonation_line?.trim() || "—",
    "",
    "SELECTED DETONATION STATEMENT",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "BRAND WORLD AND CREATIVE TERRITORY",
    s.stage_14c_output?.trim() || "—",
    "",
    "DETONATION INTELLIGENCE",
    s.stage_17b_output?.trim() || "—",
    "",
    "MASTER DETONATION BRIEF (APPROVED)",
    s.stage_20_output?.trim() || "—",
    "",
    mediumHint.trim()
      ? `PRIMARY MEDIUM DIRECTION FROM THE STRATEGIST — YOU MUST USE THIS MEDIUM: ${mediumHint.trim()}`
      : "PRIMARY MEDIUM: choose it yourself, and justify the choice in one sentence.",
  ].join("\n");
}

async function load(sessionId: string): Promise<Row> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(SELECT)
    .eq("id", sessionId)
    .single();
  if (error || !data) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
  return data as unknown as Row;
}

const RunInput = z.object({
  sessionId: z.string().uuid(),
  medium: z.string().trim().max(400).optional(),
  redirect: z.string().trim().max(4000).optional(),
});

export const runStage20l = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const s = await load(data.sessionId);
    if (!s.stage_20_output) throw new Error("Stage 20 must complete before the Lead Creative Expression");
    if (!s.stage_20_approved) throw new Error("Stage 20 must be approved before the Lead Creative Expression");

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(
          appendRedirect(STAGE_20L_LEAD_EXPRESSION_PROMPT, data.redirect ?? ""),
        ),
        userMessage: buildUserMessage(s, data.medium ?? ""),
        maxTokens: 32000,
        sessionId: data.sessionId,
        stageLabel: "Stage 20L",
        stageNumber: "20L",
        stageName: "Lead Creative Expression",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lead Creative Expression failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_20l_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    // Regenerating invalidates any prior approval — the decided idea changed.
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_20l_output: output,
        stage_20l_medium: data.medium?.trim() || null,
        stage_20l_error: null,
        stage_20l_approved: false,
        phase_2_current_stage: "20L",
      })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Lead Creative Expression: ${saveErr.message}`);
    return { output };
  });

export const loadStage20l = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20l_output, stage_20l_medium, stage_20l_approved, stage_20l_error")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return {
      output: (row?.stage_20l_output as string | null) ?? null,
      medium: (row?.stage_20l_medium as string | null) ?? null,
      approved: Boolean(row?.stage_20l_approved),
      error: (row?.stage_20l_error as string | null) ?? null,
    };
  });

export const approveStage20l = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), approved: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    if (data.approved) {
      const s = await load(data.sessionId);
      if (!s.stage_20l_output?.trim())
        throw new Error("There is no Lead Creative Expression to approve yet");
    }
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20l_approved: data.approved })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { approved: data.approved };
  });
