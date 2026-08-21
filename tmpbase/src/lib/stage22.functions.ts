// Stage 22 — Brand Architecture
// Two sequential Claude calls:
//   1. Brand Architecture — six-component synthesis from STAGE_22_BRAND_ARCHITECTURE_PROMPT
//   2. Conceptual Assets — focused three-section breakdown
// Combined transcript stored in stage_22_output, each piece in its own column.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_22_BRAND_ARCHITECTURE_PROMPT } from "./stage22-brand-architecture-prompt";
import { appendRedirect, formatThreeTruths, formatBrandIntelligence, smpGoverningBlock, withPhase2Formatting } from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const DISTINCTIVE_ASSETS_PROMPT = `You are a senior brand architect producing the Conceptual Assets for this brand.

Synthesise the brand's existing distinctive assets, the pipeline's strategic outputs, and the selected Detonation into a single one-page architecture.

OUTPUT EXACTLY THREE SECTIONS, EACH WITH AN UPPERCASE LABEL:

RECOMMENDED ASSETS
A bulleted list of 4–6 assets the brand already owns or can credibly own. Each item: 2–6 words. Tag each with (Visual), (Verbal), (Sonic), or (Behavioural).

DEPLOYMENT PRINCIPLES
A numbered list of 4–6 rules describing how these assets must behave across the Detonation. Each rule: one sentence, imperative voice.

THE RECOGNITION TEST
Two sentences. Sentence one: the test the assets must pass for the brand to be recognisable without its logo. Sentence two: what fails the test.

No preamble. No metadata. No pipeline terminology. Begin immediately with RECOMMENDED ASSETS.`;

const STAGE22_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_5_output",
  "stage_13_output",
  "stage_14c_output",
  "stage_17_selected_territory",
  "stage_17b_output",
  "stage_18_selected_detonation",
  "locked_big_idea",
  "locked_campaign_line",
  "locked_big_idea_lens",
  "stage_19_output",
  "stage_20_output",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "brand_intel_type",
  "brand_intel_values",
  "brand_intel_tone",
  "brand_intel_assets",
  "stage_22_output",
  "stage_22_brand_architecture",
  "stage_22_distinctive_assets",
].join(", ");

type Stage22Session = {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_5_output: string | null;
  stage_13_output: string | null;
  stage_14c_output: string | null;
  stage_17_selected_territory: string | null;
  stage_17b_output: string | null;
  stage_18_selected_detonation: string | null;
  locked_big_idea: string | null;
  locked_campaign_line: string | null;
  locked_big_idea_lens: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
  brand_intel_type: string | null;
  brand_intel_values: string | null;
  brand_intel_tone: string | null;
  brand_intel_assets: unknown;
  stage_22_output: string | null;
  stage_22_brand_architecture: string | null;
  stage_22_distinctive_assets: string | null;
};

function buildStage22UserMessage(s: Stage22Session): string {
  // The locked campaign big idea and line supersede the Stage 18 detonation
  // for every downstream stage, Stage 22 included. When one is locked, Stage 22
  // architects the brand around THAT idea and carries THAT line verbatim.
  const locked = s.locked_big_idea?.trim();
  const lockedBlock = locked
    ? [
        "BINDING INPUT — THE LOCKED CAMPAIGN BIG IDEA AND LINE",
        "This idea and line were selected for the whole campaign through the 37-lens sweep and its validation gates. They outrank the Stage 18 detonation supplied below, which is historical context only. The brand architecture and the conceptual assets you produce must be the assets THIS idea needs in order to become recognisable over time.",
        "",
        `LOCKED CAMPAIGN BIG IDEA (lens: ${s.locked_big_idea_lens ?? "—"})`,
        locked,
        "",
        "LOCKED CAMPAIGN LINE — reproduce this verbatim, character for character, wherever your output refers to the campaign line. Never paraphrase it and never substitute a line of your own.",
        s.locked_campaign_line?.trim() || "—",
        "",
        "————",
        "",
      ]
    : [];

  return [
    ...lockedBlock,
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
    "BRAND HERITAGE & VALUES (Stage 13)",
    s.stage_13_output?.trim() || "—",
    "",
    "BRAND WORLD (Stage 14C)",
    s.stage_14c_output?.trim() || "—",
    "",
    "SELECTED DETONATION TERRITORY (Stage 17)",
    s.stage_17_selected_territory?.trim() || "—",
    "",
    "DETONATION INTELLIGENCE (Stage 17B)",
    s.stage_17b_output?.trim() || "—",
    "",
    locked
      ? "SELECTED DETONATION (Stage 18 — SUPERSEDED by the locked campaign big idea above; historical context only)"
      : "SELECTED DETONATION (Stage 18)",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "ACTIVATION ARCHITECTURE (Stage 19)",
    s.stage_19_output?.trim() || "—",
    "",
    "MASTER DETONATION BRIEF (Stage 20)",
    s.stage_20_output?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "BRAND INTELLIGENCE INPUT",
    formatBrandIntelligence({
      type: s.brand_intel_type,
      values: s.brand_intel_values,
      tone: s.brand_intel_tone,
      assets: s.brand_intel_assets,
    }),
  ].join("\n");
}

async function generateBoth(
  sessionId: string,
  s: Stage22Session,
  architectureRedirect: string,
  assetsRedirect: string,
): Promise<{ architecture: string; assets: string }> {
  const userMessage = buildStage22UserMessage(s);
  const [architecture, assets] = await Promise.all([
    callClaude({
      systemPrompt: withPhase2Formatting(appendRedirect(STAGE_22_BRAND_ARCHITECTURE_PROMPT, architectureRedirect)),
      userMessage,
      maxTokens: 64000,
      sessionId,
      stageLabel: "Stage 22 (architecture)",
      stageNumber: "22",
      stageName: "Brand Architecture",
    }),
    callClaude({
      systemPrompt: withPhase2Formatting(appendRedirect(DISTINCTIVE_ASSETS_PROMPT, assetsRedirect)),
      userMessage,
      maxTokens: 64000,
      sessionId,
      stageLabel: "Stage 22 (assets)",
      stageNumber: "22",
      stageName: "Conceptual Assets",
    }),
  ]);
  return { architecture, assets };
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage22 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 22);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_13_output, stage_14c_output, stage_17_selected_territory, stage_17b_output, stage_18_selected_detonation, locked_big_idea, locked_campaign_line, locked_big_idea_lens, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, brand_intel_type, brand_intel_values, brand_intel_tone, brand_intel_assets, stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage22Session;
    if (!s.stage_20_output) throw new Error("Stage 20 must complete before Stage 22");

    if (s.stage_22_output) {
      return {
        output: s.stage_22_output,
        architecture: s.stage_22_brand_architecture ?? "",
        assets: s.stage_22_distinctive_assets ?? "",
      };
    }

    let architecture: string;
    let assets: string;
    try {
      ({ architecture, assets } = await generateBoth(data.sessionId, s, "", ""));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 22 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_22_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const combined = `${architecture.trim()}\n\n---\n\n${assets.trim()}`;
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_22_output: combined,
        stage_22_brand_architecture: architecture,
        stage_22_distinctive_assets: assets,
        stage_22_error: null,
        phase_2_current_stage: '22',
        phase_2_status: "complete",
      })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 22 output: ${saveErr.message}`);
    return { output: combined, architecture, assets };
  });

export const saveStage22 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        architecture: z.string(),
        assets: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const combined = `${data.architecture.trim()}\n\n---\n\n${data.assets.trim()}`;
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_22_output: combined,
        stage_22_brand_architecture: data.architecture,
        stage_22_distinctive_assets: data.assets,
        stage_22_error: null,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage22 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return {
      output: (row?.stage_22_output as string | null) ?? null,
      architecture: (row?.stage_22_brand_architecture as string | null) ?? null,
      assets: (row?.stage_22_distinctive_assets as string | null) ?? null,
    };
  });

const RetryInput = z.object({
  sessionId: z.string().uuid(),
  // cardIds: "architecture" and/or "assets". Empty = regenerate both.
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

export const retryStage22 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_13_output, stage_14c_output, stage_17_selected_territory, stage_17b_output, stage_18_selected_detonation, locked_big_idea, locked_campaign_line, locked_big_idea_lens, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, brand_intel_type, brand_intel_values, brand_intel_tone, brand_intel_assets, stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage22Session;

    const want = new Set(data.cardIds.length === 0 ? ["architecture", "assets"] : data.cardIds);
    let architecture = s.stage_22_brand_architecture ?? "";
    let assets = s.stage_22_distinctive_assets ?? "";

    const tasks: Array<Promise<void>> = [];
    if (want.has("architecture")) {
      tasks.push(
        callClaude({
          systemPrompt: withPhase2Formatting(appendRedirect(
            STAGE_22_BRAND_ARCHITECTURE_PROMPT,
            data.redirectInstructions["architecture"] ?? "",
          )),
          userMessage: buildStage22UserMessage(s),
          maxTokens: 64000,
          sessionId: data.sessionId,
          stageLabel: "Stage 22 (architecture retry)",
          stageNumber: "22",
          stageName: "Brand Architecture",
        }).then((t) => {
          architecture = t;
        }),
      );
    }
    if (want.has("assets")) {
      tasks.push(
        callClaude({
          systemPrompt: withPhase2Formatting(appendRedirect(
            DISTINCTIVE_ASSETS_PROMPT,
            data.redirectInstructions["assets"] ?? "",
          )),
          userMessage: buildStage22UserMessage(s),
          maxTokens: 64000,
          sessionId: data.sessionId,
          stageLabel: "Stage 22 (assets retry)",
          stageNumber: "22",
          stageName: "Conceptual Assets",
        }).then((t) => {
          assets = t;
        }),
      );
    }
    await Promise.all(tasks);

    const combined = `${architecture.trim()}\n\n---\n\n${assets.trim()}`;
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_22_output: combined,
        stage_22_brand_architecture: architecture,
        stage_22_distinctive_assets: assets,
        stage_22_error: null,
      })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { output: combined, architecture, assets };
  });

export const regenerateStage22 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    // Clear existing outputs so the generation starts from scratch.
    await supabaseAdmin
      .from("sessions")
      .update({
        stage_22_output: null,
        stage_22_brand_architecture: null,
        stage_22_distinctive_assets: null,
        stage_22_error: null,
      })
      .eq("id", data.sessionId);

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_5_output, stage_13_output, stage_14c_output, stage_17_selected_territory, stage_17b_output, stage_18_selected_detonation, locked_big_idea, locked_campaign_line, locked_big_idea_lens, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, brand_intel_type, brand_intel_values, brand_intel_tone, brand_intel_assets")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage22Session;
    if (!s.stage_20_output) throw new Error("Stage 20 must complete before Stage 22");

    let architecture: string;
    let assets: string;
    try {
      ({ architecture, assets } = await generateBoth(data.sessionId, s, "", ""));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 22 regeneration failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_22_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const combined = `${architecture.trim()}\n\n---\n\n${assets.trim()}`;
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_22_output: combined,
        stage_22_brand_architecture: architecture,
        stage_22_distinctive_assets: assets,
        stage_22_error: null,
        phase_2_current_stage: "22",
        phase_2_status: "complete",
      })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 22 output: ${saveErr.message}`);
    return { output: combined, architecture, assets };
  });
