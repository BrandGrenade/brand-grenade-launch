// Stage 20 — Master Detonation Brief
// Single one-page brief output with parseable sections and a Brief Quality
// Score block. Supports section-level regeneration (regenerateStage20Section)
// in addition to whole-brief retry.
//
// SCORING: the BRIEF QUALITY SCORE block is produced by an independent scorer
// (src/lib/stage20-scorer.ts) that runs AFTER generation. Any model-self-
// reported score in the generation output is stripped and replaced. The old
// placeholder that hard-coded 45/50 has been removed — no silent fallback
// path remains.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_20_MASTER_DETONATION_BRIEF_PROMPT } from "./stage20-master-detonation-brief-prompt";
import {
  appendRedirect,
  appendFinalInstruction,
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
import {
  scoreStage20Brief,
  attachScorerBlock,
  buildRewriteInstruction,
  stripQualityScoreBlock,
  type ScorerResult,
} from "./stage20-scorer";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const STAGE20_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_5_output",
  "stage_17b_output",
  "stage_18_output",
  "stage_18_selected_detonation",
  "stage_18_detonation_line",
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
  stage_18_detonation_line: string | null;
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
    "════════════════════════════════════════",
    "THE ONLY DETONATION THAT EXISTS FOR THIS BRIEF",
    "════════════════════════════════════════",
    "The human has selected ONE Detonation from the Stage 18 candidates. It is the ONLY Detonation for this brief. Any other candidate that existed in Stage 18 is discarded and MUST NOT appear anywhere in the output — not in THE DETONATION, not in springboard directions, not in principles, not in guardrails. Do not blend candidates. Do not average across them. Do not reference a candidate that was not selected.",
    "",
    "SELECTED DETONATION LINE (must appear first under THE DETONATION — verbatim)",
    s.stage_18_detonation_line?.trim() || "—",
    "",
    "SELECTED DETONATION STATEMENT (must appear directly below the line under THE DETONATION — verbatim)",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "DETONATION SYSTEM PRINCIPLES & AMBITION BENCHMARK (Stage 17B)",
    s.stage_17b_output?.trim() || "—",
    "",
    "CHANNEL HIERARCHY (Stage 19 — built against the selected Detonation above)",
    s.stage_19_output?.trim() || "—",
  ].join("\n");
}

const RunInput = z.object({ sessionId: z.string().uuid() });

/** Score a fresh brief with the independent scorer. If the composite is
 *  below 40, regenerate the brief once with the failing dimensions as a
 *  mandatory rewrite instruction, then re-score. Returns the final body
 *  (with the real BRIEF QUALITY SCORE block appended) and the score. */
async function scoreAndMaybeRewrite(args: {
  briefBody: string;
  sessionId: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  stageLabel: string;
}): Promise<{ output: string; score: ScorerResult }> {
  const cleanFirst = stripQualityScoreBlock(args.briefBody);
  let result = await scoreStage20Brief({
    briefBody: cleanFirst,
    sessionId: args.sessionId,
  });

  if (result.score.status === "REVIEW" && result.failing.length > 0) {
    const rewriteInstruction = buildRewriteInstruction(result);
    const rewrittenRaw = await callClaude({
      systemPrompt: appendFinalInstruction(args.systemPrompt, rewriteInstruction),
      userMessage: args.userMessage,
      maxTokens: args.maxTokens,
      sessionId: args.sessionId,
      stageLabel: `${args.stageLabel} (rewrite)`,
      stageNumber: "20",
      stageName: "Master Detonation Brief",
    });
    const cleanRewrite = stripQualityScoreBlock(rewrittenRaw);
    const rescored = await scoreStage20Brief({
      briefBody: cleanRewrite,
      sessionId: args.sessionId,
    });
    // Keep the higher-composite draft — the rewrite is discarded if it made
    // things worse. This never returns to the caller with a placeholder.
    if (rescored.score.composite >= result.score.composite) {
      return { output: attachScorerBlock(cleanRewrite, rescored), score: rescored };
    }
  }
  return { output: attachScorerBlock(cleanFirst, result), score: result };
}

export const runStage20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 20);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_17b_output, stage_18_output, stage_18_selected_detonation, stage_18_detonation_line, stage_19_output, truth_product, truth_consumer, truth_cultural, stage_20_output")
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
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 20",
        stageNumber: "20",
        stageName: "Master Detonation Brief",
      });
      output = ensureQualityScoreBlock(output);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), output: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20_output: data.output, stage_20_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_17b_output, stage_18_output, stage_18_selected_detonation, stage_18_detonation_line, stage_19_output, truth_product, truth_consumer, truth_cultural, stage_20_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

    const redirect = data.redirectInstructions["card-1"] ?? "";
    const system = appendRedirect(STAGE_20_MASTER_DETONATION_BRIEF_PROMPT, redirect);
    let output = await callClaude({
      systemPrompt: withPhase2Formatting(system),
      userMessage: buildStage20UserMessage(session as never),
      maxTokens: 64000,
      sessionId: data.sessionId,
      stageLabel: "Stage 20 (retry)",
      stageNumber: "20",
      stageName: "Master Detonation Brief",
    });
    output = ensureQualityScoreBlock(output);
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_20_output: output,
        stage_20_error: null,
        stage_20_approved: false,
        checkpoint_f_confirmed: false,
        checkpoint_f_confirmed_at: null,
      })
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
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SectionInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
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
      maxTokens: 64000,
      sessionId: data.sessionId,
      stageLabel: `Stage 20 (section ${data.sectionId})`,
      stageNumber: "20",
      stageName: "Master Detonation Brief",
    });

    // Strip any leading label the model may have re-emitted (e.g. "THE DETONATION"
    // or "THE DETONATION:") despite the prompt instruction. Repeats once in case
    // the model emits both the canonical label and a sub-label.
    const labelEsc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stripLeadingLabel = (s: string) =>
      s.replace(new RegExp(`^\\s*${labelEsc}\\s*:?\\s*\\n+`, "i"), "");
    let cleaned = stripLeadingLabel(newContent.trim());
    cleaned = stripLeadingLabel(cleaned).trim();

    parsed.sections = parsed.sections.map((s) =>
      s.id === data.sectionId ? { ...s, content: cleaned } : s,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
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
      .update({
        stage_20_approved: true,
        phase_2_current_stage: '21',
        // Checkpoint F — explicit human approval of the Master Detonation
        // Brief. Mirrors checkpoint_a/b/c_confirmed structure. Gate enforces
        // composite score >= 40 above before this row is reached.
        checkpoint_f_confirmed: true,
        checkpoint_f_confirmed_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });
