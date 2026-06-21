// Stage 17B — Detonation Intelligence
// Single-output stage (not card-based). Takes the selected Stage 17 territory
// and produces benchmark + differentiation guidance.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_17B_DETONATION_INTELLIGENCE_PROMPT } from "./stage17b-detonation-intelligence-prompt";
import { appendRedirect, formatThreeTruths, smpGoverningBlock, withPhase2Formatting } from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";

const STAGE17B_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_17_selected_territory",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "stage_17b_output",
].join(", ");

function buildStage17bUserMessage(s: {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_17_selected_territory: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
}): string {
  return [
    smpGoverningBlock(s.selected_smp),
    "",
    `BRAND: ${s.brand_name ?? "—"}`,
    `CATEGORY: ${s.category ?? "—"}`,
    "",
    "SELECTED DETONATION TERRITORY (Stage 17)",
    s.stage_17_selected_territory?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
  ].join("\n");
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage17b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 17, "Stage 17B");
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "stage17_selection");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_17_selected_territory, truth_product, truth_consumer, truth_cultural, stage_17b_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_17_selected_territory)
      throw new Error("Stage 17 territory must be selected first");
    if (session.stage_17b_output) return { output: session.stage_17b_output as string };

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(STAGE_17B_DETONATION_INTELLIGENCE_PROMPT),
        userMessage: buildStage17bUserMessage(session as never),
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 17B",
        stageNumber: "17B",
        stageName: "Detonation Intelligence",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 17B failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_17b_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { canonicaliseStage17bOutput } = await import("./canonical-format");
    output = canonicaliseStage17bOutput(output);

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_17b_output: output, stage_17b_error: null, phase_2_current_stage: '18' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 17B output: ${saveErr.message}`);
    return { output };
  });

export const saveStage17b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), output: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_17b_output: data.output, stage_17b_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage17b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_17b_output")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return { output: (row?.stage_17b_output as string | null) ?? null };
  });

// Single-output retry: cardIds/redirectInstructions accepted for interface
// parity but Stage 17B has only one logical card ("card-1").
const RetryInput = z.object({
  sessionId: z.string().uuid(),
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

export const retryStage17b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "stage17_selection");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_17_selected_territory, truth_product, truth_consumer, truth_cultural, stage_17b_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_17_selected_territory)
      throw new Error("Stage 17 territory must be selected first");

    const redirect = data.redirectInstructions["card-1"] ?? "";
    const system = appendRedirect(STAGE_17B_DETONATION_INTELLIGENCE_PROMPT, redirect);
    const baseUser = buildStage17bUserMessage(session as never);
    let userMessage = baseUser;
    if (redirect.trim()) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback: redirect,
        previousOutput: (session.stage_17b_output as string | null) ?? null,
        stageLabel: "Stage 17B",
      });
      userMessage = `${prefix}${baseUser}${suffix}`;
    }
    let output = await callClaude({
      systemPrompt: withPhase2Formatting(system),
      userMessage,
      maxTokens: 64000,
      sessionId: data.sessionId,
      stageLabel: "Stage 17B (retry)",
      stageNumber: "17B",
      stageName: "Detonation Intelligence",
    });

    const { canonicaliseStage17bOutput } = await import("./canonical-format");
    output = canonicaliseStage17bOutput(output);

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_17b_output: output, stage_17b_error: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output };
  });
