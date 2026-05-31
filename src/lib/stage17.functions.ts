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
  formatThreeTruths,
  formatBrandIntelligence,
  type Card,
} from "./phase2-shared.server";

const STAGE17_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_2_output",
  "stage_5_output",
  "stage_14c_output",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "brand_intel_type",
  "brand_intel_values",
  "brand_intel_tone",
  "brand_intel_assets",
  "stage_17_output",
].join(", ");

function buildStage17UserMessage(s: {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_2_output: string | null;
  stage_5_output: string | null;
  stage_14c_output: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
  brand_intel_type: string | null;
  brand_intel_values: string | null;
  brand_intel_tone: string | null;
  brand_intel_assets: unknown;
}): string {
  return [
    `BRAND: ${s.brand_name ?? "—"}`,
    `CATEGORY: ${s.category ?? "—"}`,
    "",
    "VALIDATED SMP",
    s.selected_smp?.trim() || "—",
    "",
    "HUMAN CONTRADICTION STATEMENT (Stage 5)",
    s.stage_5_output?.trim() || "—",
    "",
    "BRAND WORLD (Stage 14C)",
    s.stage_14c_output?.trim() || "—",
    "",
    "THREE TRUTH CONFIRMATION",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "BRAND INTELLIGENCE",
    formatBrandIntelligence({
      type: s.brand_intel_type,
      values: s.brand_intel_values,
      tone: s.brand_intel_tone,
      assets: s.brand_intel_assets,
    }),
    "",
    "COMPETITIVE INTELLIGENCE (Stage 2)",
    s.stage_2_output?.trim() || "—",
    "",
    "Produce three Detonation Territory candidates as requested in the system prompt.",
  ].join("\n");
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
        systemPrompt: STAGE_17_DETONATION_TERRITORY_PROMPT,
        userMessage: buildStage17UserMessage(session as never),
        maxTokens: 12000,
        temperature: 0.8,
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
      .update({ stage_17_output: output, stage_17_error: null, phase_2_current_stage: 17 })
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
    const regenerateIds = data.cardIds.length === 0
      ? existing.map((c) => c.id)
      : data.cardIds;
    if (regenerateIds.length === 0) return { output: session.stage_17_output as string };

    const baseUser = buildStage17UserMessage(session as never);

    // Regenerate one card per id (so redirect instructions apply 1:1).
    const regenerated: Record<string, Card> = {};
    for (const id of regenerateIds) {
      const redirect = data.redirectInstructions[id] ?? "";
      const system = appendRedirect(STAGE_17_DETONATION_TERRITORY_PROMPT, redirect);
      const userMessage = `${baseUser}\n\nProduce ONE Detonation Territory candidate (a single card with one ## heading). This will replace candidate ${id}.`;
      const text = await callClaude({
        systemPrompt: system,
        userMessage,
        maxTokens: 6000,
        temperature: 0.85,
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
        phase_2_current_stage: 17,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
