// Stage 19 — Activation Architecture
// Single-output stage. Derives channel hierarchy + compounding media strategy
// from the selected Detonation and Three Truths.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_19_ACTIVATION_ARCHITECTURE_PROMPT } from "./stage19-activation-architecture-prompt";
import { appendRedirect, formatThreeTruths, smpGoverningBlock, withPhase2Formatting } from "./phase2-shared";

const STAGE19_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_18_selected_detonation",
  "stage_18_output",
  "stage_14b_output",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "stage_19_output",
].join(", ");

function buildStage19UserMessage(s: {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_18_selected_detonation: string | null;
  stage_18_output: string | null;
  stage_14b_output: string | null;
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
    "SELECTED DETONATION (Stage 18)",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "CAMPAIGN OR PLATFORM ASSESSMENT (from Stage 18 Compounding Assessment)",
    s.stage_18_output?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "CHANNEL EXPRESSION MAPPING (Stage 14B)",
    s.stage_14b_output?.trim() || "—",
  ].join("\n");
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage19 = createServerFn({ method: "POST" })
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data }) => {
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "E");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_selected_detonation, stage_18_output, stage_14b_output, truth_product, truth_consumer, truth_cultural, stage_19_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_18_selected_detonation)
      throw new Error("A Detonation must be selected before Stage 19");
    if (session.stage_19_output) return { output: session.stage_19_output as string };

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(STAGE_19_ACTIVATION_ARCHITECTURE_PROMPT),
        userMessage: buildStage19UserMessage(session as never),
        maxTokens: 20000,
        sessionId: data.sessionId,
        stageLabel: "Stage 19",
        stageNumber: "19",
        stageName: "Activation Architecture",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 19 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_19_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_19_output: output, stage_19_error: null, phase_2_current_stage: '20' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 19 output: ${saveErr.message}`);
    return { output };
  });

export const saveStage19 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), output: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_19_output: data.output, stage_19_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage19 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_19_output")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return { output: (row?.stage_19_output as string | null) ?? null };
  });

const RetryInput = z.object({
  sessionId: z.string().uuid(),
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

export const retryStage19 = createServerFn({ method: "POST" })
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data }) => {
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "E");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_selected_detonation, stage_18_output, stage_14b_output, truth_product, truth_consumer, truth_cultural, stage_19_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_18_selected_detonation)
      throw new Error("A Detonation must be selected before Stage 19");

    const redirect = data.redirectInstructions["card-1"] ?? "";
    const system = appendRedirect(STAGE_19_ACTIVATION_ARCHITECTURE_PROMPT, redirect);
    const output = await callClaude({
      systemPrompt: withPhase2Formatting(system),
      userMessage: buildStage19UserMessage(session as never),
      maxTokens: 20000,
      sessionId: data.sessionId,
      stageLabel: "Stage 19 (retry)",
      stageNumber: "19",
      stageName: "Activation Architecture",
    });
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_19_output: output, stage_19_error: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output };
  });
