// Stage 20 — Master Detonation Brief
// Single one-page brief output with parseable sections and a Brief Quality
// Score block. Supports section-level regeneration (regenerateStage20Section)
// in addition to whole-brief retry.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_20_MASTER_DETONATION_BRIEF_PROMPT } from "./stage20-master-detonation-brief-prompt";
import {
  appendRedirect,
  formatThreeTruths,
  parseStage20Output,
  joinStage20,
  parseBriefQualityScore,
  recomputeScore,
  formatBriefQualityScore,
  STAGE_20_SECTION_DEFS,
  smpGoverningBlock,
  withPhase2Formatting,
} from "./phase2-shared";

const STAGE20_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_5_output",
  "stage_17b_output",
  "stage_18_output",
  "stage_18_selected_detonation",
  "stage_19_output",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "stage_20_output",
].join(", ");

function buildStage20UserMessage(s: {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_5_output: string | null;
  stage_17b_output: string | null;
  stage_18_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_19_output: string | null;
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
    "VALIDATED SMP",
    s.selected_smp?.trim() || "—",
    "",
    "HUMAN CONTRADICTION STATEMENT (Stage 5)",
    s.stage_5_output?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "SELECTED DETONATION (Stage 18)",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "DETONATION SYSTEM PRINCIPLES & AMBITION BENCHMARK (Stage 17B)",
    s.stage_17b_output?.trim() || "—",
    "",
    "COURAGE & COMPOUNDING ASSESSMENT (Stage 18)",
    s.stage_18_output?.trim() || "—",
    "",
    "CHANNEL HIERARCHY (Stage 19)",
    s.stage_19_output?.trim() || "—",
  ].join("\n");
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage20 = createServerFn({ method: "POST" })
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_17b_output, stage_18_output, stage_18_selected_detonation, stage_19_output, truth_product, truth_consumer, truth_cultural, stage_20_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_19_output) throw new Error("Stage 19 must complete before Stage 20");
    if (session.stage_20_output) return { output: session.stage_20_output as string };

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(STAGE_20_MASTER_DETONATION_BRIEF_PROMPT),
        userMessage: buildStage20UserMessage(session as never),
        maxTokens: 8000,
        sessionId: data.sessionId,
        stageLabel: "Stage 20",
        stageNumber: "20",
        stageName: "Master Detonation Brief",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 20 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_20_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20_output: output, stage_20_error: null, phase_2_current_stage: '20' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 20 output: ${saveErr.message}`);
    return { output };
  });

export const saveStage20 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), output: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20_output: data.output, stage_20_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage20 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20_output, stage_20_approved")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return {
      output: (row?.stage_20_output as string | null) ?? null,
      approved: Boolean(row?.stage_20_approved),
    };
  });

const RetryInput = z.object({
  sessionId: z.string().uuid(),
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

export const retryStage20 = createServerFn({ method: "POST" })
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_17b_output, stage_18_output, stage_18_selected_detonation, stage_19_output, truth_product, truth_consumer, truth_cultural, stage_20_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

    const redirect = data.redirectInstructions["card-1"] ?? "";
    const system = appendRedirect(STAGE_20_MASTER_DETONATION_BRIEF_PROMPT, redirect);
    const output = await callClaude({
      systemPrompt: withPhase2Formatting(system),
      userMessage: buildStage20UserMessage(session as never),
      maxTokens: 8000,
      sessionId: data.sessionId,
      stageLabel: "Stage 20 (retry)",
      stageNumber: "20",
      stageName: "Master Detonation Brief",
    });
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20_output: output, stage_20_error: null, stage_20_approved: false })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output };
  });

const SectionInput = z.object({
  sessionId: z.string().uuid(),
  sectionId: z.string().min(1),
  feedback: z.string().min(1).max(5000),
});

/** Regenerate a single section of the Master Detonation Brief. */
export const regenerateStage20Section = createServerFn({ method: "POST" })
  .inputValidator((i) => SectionInput.parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !row?.stage_20_output) throw new Error("Stage 20 output not found");

    const parsed = parseStage20Output(row.stage_20_output as string);
    const section = parsed.sections.find((s) => s.id === data.sectionId);
    if (!section) throw new Error(`Section ${data.sectionId} not present in brief`);
    const sectionDef = STAGE_20_SECTION_DEFS.find((s) => s.id === data.sectionId);
    const label = sectionDef?.label ?? section.label;

    const system = `You are rewriting one specific section of the Master Detonation Brief. Section: ${label}. Current content: ${section.content}. Human feedback: ${data.feedback}. Rewrite this section only. Match the length and voice of the original. Output only the rewritten section content. No labels. No preamble. No metadata.`;

    const newContent = await callClaude({
      systemPrompt: withPhase2Formatting(system),
      userMessage: `Rewrite the ${label} section now. Output only the new section content.`,
      maxTokens: 2000,
      sessionId: data.sessionId,
      stageLabel: `Stage 20 (section ${data.sectionId})`,
      stageNumber: "20",
      stageName: "Master Detonation Brief",
    });

    parsed.sections = parsed.sections.map((s) =>
      s.id === data.sectionId ? { ...s, content: newContent.trim() } : s,
    );

    // Recompute score against new content. We re-parse the existing score
    // block (the dimensions don't change automatically — the human is editing
    // a section, not the rubric) and recompute composite + status.
    const score = recomputeScore(parseBriefQualityScore(parsed.scoreBlock));
    parsed.scoreBlock = formatBriefQualityScore(score);

    const merged = joinStage20(parsed);
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20_output: merged, stage_20_error: null, stage_20_approved: false })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output: merged, score };
  });

export const approveStage20 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !row?.stage_20_output) throw new Error("No brief to approve");
    const parsed = parseStage20Output(row.stage_20_output as string);
    const score = parseBriefQualityScore(parsed.scoreBlock);
    if (typeof score.composite !== "number" || score.composite < 40) {
      throw new Error("Brief Quality Score must be 40 or above to approve");
    }
    const { error: upErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20_approved: true, phase_2_current_stage: '21' })
      .eq("id", data.sessionId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });
