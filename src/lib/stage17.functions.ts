// Stage 17 — Detonation Territory
// Generates three Detonation Territory candidate cards. Cards are split by
// top-level `## ` markdown headings, each card has a stable positional id
// (card-1, card-2, card-3).
//
// Mirrors the Phase 1 pattern (createServerFn + supabaseAdmin + callClaude),
// adds per-card retry with optional redirect instructions per the Phase 2 spec.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_17_DETONATION_TERRITORY_PROMPT } from "./stage17-detonation-territory-prompt";
import {
  appendRedirect,
  splitCards,
  joinCards,
  formatBrandIntelligence,
  type Card,
  withPhase2Formatting,
} from "./phase2-shared.server";

const STAGE17_SELECT = "brand_name, category, selected_smp, stage_2_output, stage_5_output, stage_13_output, stage_14c_output, truth_product, truth_consumer, truth_cultural, brand_intel_type, brand_intel_values, brand_intel_tone, brand_intel_assets, stage_17_output" as const;

function buildStage17UserMessage(s: {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_2_output: string | null;
  stage_5_output: string | null;
  stage_13_output: string | null;
  stage_14c_output: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
  brand_intel_type: string | null;
  brand_intel_values: string | null;
  brand_intel_tone: string | null;
  brand_intel_assets: unknown;
}): string {
  const smp = s.selected_smp?.trim() || "—";
  const assetsText = formatBrandIntelligence({
    type: s.brand_intel_type,
    values: s.brand_intel_values,
    tone: s.brand_intel_tone,
    assets: s.brand_intel_assets,
  });
  return `
THE SMP — THIS GOVERNS EVERYTHING:
"${smp}"

Read this SMP three times before generating anything.
Every territory you generate must be an expression of this specific SMP given creative life.
Not a generic creative territory.
Not an interesting strategic space.
A specific answer to this question:
What does "${smp}" look and feel like when humans experience it in the world?

If a territory could exist without this specific SMP — it is wrong.
Regenerate it until the SMP is unmistakably present.

BRAND: ${s.brand_name ?? "—"}
CATEGORY: ${s.category ?? "—"}

BRAND INTELLIGENCE:
Type: ${s.brand_intel_type || "Not specified"}
Values: ${s.brand_intel_values || "Not specified"}
Tone of Voice: ${s.brand_intel_tone || "Not specified"}
Existing Assets:
${assetsText}

PRODUCT TRUTH:
${s.truth_product?.trim() || "Not confirmed"}

CONSUMER TRUTH:
${s.truth_consumer?.trim() || "Not confirmed"}

CULTURAL TRUTH:
${s.truth_cultural?.trim() || "Not confirmed"}

HUMAN CONTRADICTION STATEMENT (Stage 5):
${s.stage_5_output?.trim() || "Not available"}

BRAND WORLD (Stage 14C):
${s.stage_14c_output?.trim() || "Not available"}

BRAND FIT ASSESSMENT (Stage 13):
${s.stage_13_output?.trim() || "Not available"}

COMPETITIVE INTELLIGENCE (Stage 2):
${s.stage_2_output?.trim() || "Not available"}

Now generate three Detonation Territories that give this specific SMP — "${smp}" — a life it cannot have on paper.

For each territory — the first section after the territory name must be:

WHY THIS TERRITORY SERVES THE SMP:
[Two to three sentences that explicitly state why this specific territory — and no other — is the right creative expression of "${smp}". Not why it is interesting. Not why it is strategically valid. Why it makes THIS specific SMP alive in a way no other territory could. If you cannot write this statement specifically and convincingly — the territory is wrong. Generate a different one.]

This section must appear before the Territory Description. Before everything else. It is the first thing the human reads after the territory name. It must answer one question: Why is this territory the right home for "${smp}"?

The answer must be specific to the SMP as written. Not generic creative strategy. Not interesting thinking. A direct and specific answer to why THIS territory serves THIS proposition.
`.trim();
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage17 = createServerFn({ method: "POST" })
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(STAGE17_SELECT)
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (session.stage_17_output) return { output: session.stage_17_output as string };

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(STAGE_17_DETONATION_TERRITORY_PROMPT),
        userMessage: buildStage17UserMessage(session as never),
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 17",
        stageNumber: "17",
        stageName: "Detonation Territory",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 17 failed";
      await supabaseAdmin.from("sessions").update({ stage_17_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_17_output: output, stage_17_error: null, phase_2_current_stage: '17' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 17 output: ${saveErr.message}`);

    return { output };
  });

export const saveStage17 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid(), output: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_17_output: data.output, stage_17_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage17 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_17_output")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return { output: (row?.stage_17_output as string | null) ?? null };
  });

const RetryInput = z.object({
  sessionId: z.string().uuid(),
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

/** Retry Stage 17 selectively.
 *  - cardIds: ids of cards to REGENERATE. Empty array = regenerate all.
 *  - redirectInstructions: { cardId: redirectText } — applied per regenerated card.
 *  Cards not in cardIds are preserved verbatim. */
export const retryStage17 = createServerFn({ method: "POST" })
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(STAGE17_SELECT)
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_17_output) throw new Error("Stage 17 has no prior output to retry");

    const existing = splitCards(session.stage_17_output as string);
    const regenAll = data.cardIds.length === 0;
    const regenerateIds = regenAll ? existing.map((c) => c.id) : data.cardIds;
    if (regenerateIds.length === 0) return { output: session.stage_17_output as string };

    const baseUser = buildStage17UserMessage(session as never);
    const combinedRedirect = Object.values(data.redirectInstructions)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n");

    // Fast path: full-stage retry — one Claude call producing all three cards.
    // Avoids three serial 6000-token calls that can silently exceed the
    // worker's wall-clock window.
    if (regenAll) {
      const system = appendRedirect(STAGE_17_DETONATION_TERRITORY_PROMPT, combinedRedirect);
      const text = await callClaude({
        systemPrompt: withPhase2Formatting(system),
        userMessage: `${baseUser}\n\nRegenerate all three Detonation Territory candidates.`,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 17 (retry all)",
        stageNumber: "17",
        stageName: "Detonation Territory",
      });

      const { error: saveErr } = await supabaseAdmin
        .from("sessions")
        .update({ stage_17_output: text, stage_17_error: null })
        .eq("id", data.sessionId);
      if (saveErr) throw new Error(saveErr.message);
      return { output: text };
    }

    // Selective path: regenerate one card per id (1:1 with redirects).
    const regenerated: Record<string, Card> = {};
    for (const id of regenerateIds) {
      const redirect = data.redirectInstructions[id] ?? "";
      const system = appendRedirect(STAGE_17_DETONATION_TERRITORY_PROMPT, redirect);
      const userMessage = `${baseUser}\n\nProduce ONE Detonation Territory candidate (a single card with one ## heading). This will replace candidate ${id}.`;
      const text = await callClaude({
        systemPrompt: withPhase2Formatting(system),
        userMessage,
        maxTokens: 6000,
        sessionId: data.sessionId,
        stageLabel: `Stage 17 (retry ${id})`,
        stageNumber: "17",
        stageName: "Detonation Territory",
      });
      const cards = splitCards(text);
      const single = cards[0] ?? { id, name: "Territory", markdown: text };
      regenerated[id] = { ...single, id };
    }

    const merged = existing.map((c) => (regenerated[c.id] ? regenerated[c.id] : c));
    const output = joinCards(merged);

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_17_output: output, stage_17_error: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output };
  });

/** Persist the user's selected Stage 17 territory and advance the stage pointer. */
export const selectStage17Territory = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), territoryMarkdown: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_17_selected_territory: data.territoryMarkdown,
        phase_2_current_stage: '17b',
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
