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

export function buildStage22UserMessage(s: Stage22Session): string {
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

// Queued-for-generation marker on sessions.stage_22_error. The stage22-tick
// route claims it by appending ":claimed:<attempt>"; see stage22-tick.server.ts.
export const STAGE_22_RUNNING = "__STAGE_22_RUNNING__";

export type Stage22Sentinel = { running: boolean; claimed: boolean; attempt: number };

export function parseStage22Sentinel(err: string | null): Stage22Sentinel {
  if (!err || !err.startsWith(STAGE_22_RUNNING)) return { running: false, claimed: false, attempt: 0 };
  const m = err.match(/:claimed:(\d+)$/);
  return { running: true, claimed: Boolean(m), attempt: m ? parseInt(m[1], 10) : 0 };
}

/**
 * Full Stage 22 generation, safe to run detached from the requesting
 * connection — the /api/public/stage22-tick route drives it while streaming
 * keep-alive bytes. Running this inside the start request sent no bytes for
 * minutes, so on the published runtime the idle connection was dropped and the
 * worker cancelled mid-stream, losing the output (JLR, 26 Oct 2026). Writes
 * the real error to stage_22_error on failure.
 */
export async function generateStage22(
  sessionId: string,
): Promise<{ output: string; architecture: string; assets: string }> {
  await assertUpstreamStageOutput(sessionId, 22);
  {
    const { requireNoFidelityBreak } = await import("./stage21-fidelity-gate.server");
    await requireNoFidelityBreak(sessionId, "Stage 22 (Brand Architecture)");
  }
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select(STAGE22_SELECT)
    .eq("id", sessionId)
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
    ({ architecture, assets } = await generateBoth(sessionId, s, "", ""));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stage 22 failed";
    await supabaseAdmin
      .from("sessions")
      .update({ stage_22_error: msg })
      .eq("id", sessionId);
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
    .eq("id", sessionId);
  if (saveErr) throw new Error(`Failed to save Stage 22 output: ${saveErr.message}`);
  return { output: combined, architecture, assets };
}

/** Queues Stage 22 for the background runner. No-op when output exists or a run is already queued/claimed. */
async function queueStage22(sessionId: string): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("sessions")
    .select("stage_22_error, stage_22_output")
    .eq("id", sessionId)
    .single();
  if (row?.stage_22_output) return;
  if (parseStage22Sentinel((row?.stage_22_error as string | null) ?? null).running) return;
  await supabaseAdmin
    .from("sessions")
    .update({ stage_22_error: STAGE_22_RUNNING })
    .eq("id", sessionId);
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export type Stage22RunResult =
  | { queued: true; output: null; architecture: null; assets: null }
  | { queued: false; output: string; architecture: string; assets: string };

export const runStage22 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }): Promise<Stage22RunResult> => {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 22);
    {
      const { requireNoFidelityBreak } = await import("./stage21-fidelity-gate.server");
      await requireNoFidelityBreak(data.sessionId, "Stage 22 (Brand Architecture)");
    }
    // Never generates in-request: two multi-minute model calls inside the
    // start request are cancelled mid-stream on the published runtime (the
    // Stage 20B failure mode). Returns the cached output when present,
    // otherwise queues the background runner; the UI polls loadStage22.
    const { data: row } = await supabaseAdmin
      .from("sessions")
      .select("stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets")
      .eq("id", data.sessionId)
      .single();
    if (row?.stage_22_output) {
      return {
        queued: false,
        output: row.stage_22_output,
        architecture: (row.stage_22_brand_architecture as string | null) ?? "",
        assets: (row.stage_22_distinctive_assets as string | null) ?? "",
      };
    }
    await queueStage22(data.sessionId);
    return { queued: true, output: null, architecture: null, assets: null };
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
      .select("stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets, stage_22_error")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    const sentinel = parseStage22Sentinel((row?.stage_22_error as string | null) ?? null);
    return {
      output: (row?.stage_22_output as string | null) ?? null,
      architecture: (row?.stage_22_brand_architecture as string | null) ?? null,
      assets: (row?.stage_22_distinctive_assets as string | null) ?? null,
      error: sentinel.running ? null : ((row?.stage_22_error as string | null) ?? null),
      running: sentinel.running,
      attempt: sentinel.attempt,
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
    {
      const { requireNoFidelityBreak } = await import("./stage21-fidelity-gate.server");
      await requireNoFidelityBreak(data.sessionId, "Stage 22 (Brand Architecture)");
    }
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
  .handler(async ({ data, context }): Promise<Stage22RunResult> => {
    await assertSessionAccess(data.sessionId, context.userId);
    {
      const { requireNoFidelityBreak } = await import("./stage21-fidelity-gate.server");
      await requireNoFidelityBreak(data.sessionId, "Stage 22 (Brand Architecture)");
    }
    // Clear existing outputs so the generation starts from scratch, then
    // queue the background runner — never generate in-request (see
    // generateStage22 for why).
    await supabaseAdmin
      .from("sessions")
      .update({
        version_reason: "rerun: stage 22",
        version_actor: context.userId,
        stage_22_output: null,
        stage_22_brand_architecture: null,
        stage_22_distinctive_assets: null,
        stage_22_error: STAGE_22_RUNNING,
      })
      .eq("id", data.sessionId);
    return { queued: true, output: null, architecture: null, assets: null };
  });
