// Stage 18 — The Detonation
// Generates three Detonation candidate cards. Card-based, with selective
// retry, per-card redirects, and a Courage Override path that appends a
// fixed instruction to the system prompt for all three regenerations.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_18_THE_DETONATION_PROMPT } from "./stage18-the-detonation-prompt";
import {
  appendFinalInstruction,
  appendRedirect,
  splitCards,
  joinCards,
  formatThreeTruths,
  smpGoverningBlock,
  type Card,
  withPhase2Formatting,
} from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const STAGE18_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_17_selected_territory",
  "stage_17b_output",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "stage_18_output",
].join(", ");

function buildStage18UserMessage(s: {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_17_selected_territory: string | null;
  stage_17b_output: string | null;
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
    "DETONATION INTELLIGENCE — SYSTEM PRINCIPLES & AMBITION BENCHMARK (Stage 17B)",
    s.stage_17b_output?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "Produce three Detonation candidates as requested in the system prompt.",
    "",
    "For each Detonation candidate — the first section after the Detonation name must be:",
    "",
    "WHY THIS DETONATION SERVES THE SMP:",
    `[Two to three sentences that explicitly state why this specific Detonation — and no other — makes "${(s.selected_smp ?? "").trim() || "—"}" explosive in the world. Not why it is interesting. Not why it is strategically valid. Why it makes THIS specific SMP alive in a way no other Detonation could. If you cannot write this statement specifically and convincingly — the Detonation is wrong. Generate a different one.]`,
    "",
    "This section must appear before everything else for the candidate. It is the first thing the human reads after the Detonation name. It must answer one question: Why is this Detonation the right home for the SMP?",
    "",
    "The answer must be specific to the SMP as written. Not generic creative strategy. Not interesting thinking. A direct and specific answer to why THIS Detonation serves THIS proposition.",
  ].join("\n");
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage18 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "D");
    await assertUpstreamStageOutput(data.sessionId, 18);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_17_selected_territory, stage_17b_output, truth_product, truth_consumer, truth_cultural, stage_18_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_17b_output)
      throw new Error("Stage 17B must complete before Stage 18");
    // Defensive parse — refuse to generate against a NULL or malformed territory.
    const { parseStage17Territory } = await import("./canonical-format");
    const parsed = parseStage17Territory(session.stage_17_selected_territory);
    (session as { stage_17_selected_territory: string }).stage_17_selected_territory = parsed.canonical;
    if (session.stage_18_output) return { output: session.stage_18_output as string };

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(STAGE_18_THE_DETONATION_PROMPT),
        userMessage: buildStage18UserMessage(session as never),
        maxTokens: 20000,
        sessionId: data.sessionId,
        stageLabel: "Stage 18",
        stageNumber: "18",
        stageName: "The Detonation",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 18 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_18_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_18_output: output, stage_18_error: null, phase_2_current_stage: '18' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 18 output: ${saveErr.message}`);
    return { output };
  });

export const saveStage18 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), output: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_18_output: data.output, stage_18_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage18 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_18_output")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return { output: (row?.stage_18_output as string | null) ?? null };
  });

const RetryInput = z.object({
  sessionId: z.string().uuid(),
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
  courageRedirect: z.boolean().optional(),
});

const COURAGE_REDIRECT_INSTRUCTION = `COURAGE REDIRECT ACTIVE: Generate a new candidate that names something the category has been unwilling to say. Push until it generates genuine strategic discomfort arising from truth not provocation.`;

export const retryStage18 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "D");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_17_selected_territory, stage_17b_output, truth_product, truth_consumer, truth_cultural, stage_18_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_18_output) throw new Error("Stage 18 has no prior output to retry");
    const { parseStage17Territory } = await import("./canonical-format");
    const parsed = parseStage17Territory(session.stage_17_selected_territory);
    (session as { stage_17_selected_territory: string }).stage_17_selected_territory = parsed.canonical;

    const existing = splitCards(session.stage_18_output as string);
    const regenerateIds = data.cardIds.length === 0
      ? existing.map((c) => c.id)
      : data.cardIds;
    if (regenerateIds.length === 0) return { output: session.stage_18_output as string };

    const baseUser = buildStage18UserMessage(session as never);

    const regenerated: Record<string, Card> = {};
    for (const id of regenerateIds) {
      const redirect = data.redirectInstructions[id] ?? "";
      let system = appendRedirect(STAGE_18_THE_DETONATION_PROMPT, redirect);
      if (data.courageRedirect) {
        system = appendFinalInstruction(system, COURAGE_REDIRECT_INSTRUCTION);
      }
      const userMessage = `${baseUser}\n\nProduce ONE Detonation candidate (a single card with one ## heading). This will replace candidate ${id}.`;
      const text = await callClaude({
        systemPrompt: withPhase2Formatting(system),
        userMessage,
        maxTokens: 20000,
        sessionId: data.sessionId,
        stageLabel: `Stage 18 (retry ${id}${data.courageRedirect ? " courage" : ""})`,
        stageNumber: "18",
        stageName: "The Detonation",
      });
      const cards = splitCards(text);
      const single = cards[0] ?? { id, name: "Detonation", markdown: text };
      regenerated[id] = { ...single, id };
    }

    const merged = existing.map((c) => (regenerated[c.id] ? regenerated[c.id] : c));
    const output = joinCards(merged);

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_18_output: output, stage_18_error: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output };
  });

/** Save the human-selected Detonation and advance. */
export const selectStage18Detonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      sessionId: z.string().uuid(),
      detonationMarkdown: z.string().min(1),
      detonationLine: z.string().min(1).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_18_selected_detonation: data.detonationMarkdown,
        stage_18_detonation_line: data.detonationLine ?? null,
        phase_2_current_stage: '19',
        // Checkpoint E — explicit human confirmation that a Detonation has
        // been selected. Mirrors checkpoint_a/b/c_confirmed structure.
        checkpoint_e_confirmed: true,
        checkpoint_e_confirmed_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
