// Stage 20B — Channel Strategy engine.
//
// The generation itself is a single multi-minute model call. It must never be
// tethered to the browser's HTTP request: the Worker invocation dies the moment
// the client connection drops, which is what made this stage look like it
// "timed out" and never produced a channel strategy. Callers run it through
// `scheduleBackground()` and poll the session row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_20B_CHANNEL_STRATEGY_PROMPT } from "./stage20b-prompt";
import {
  appendRedirect,
  formatThreeTruths,
  smpGoverningBlock,
  withPhase2Formatting,
} from "./phase2-shared";

export type Stage20bAudienceInput = {
  audienceAsHumans: string;
  dayInTheirLife: string;
  influenceMap: string;
  decisionJourney: string;
  psychologicalProfile: string;
  channelUniverseAndBudget: string;
};

export const STAGE20B_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_1_output",
  "stage_3_output",
  "stage_14c_output",
  "stage_18_selected_detonation",
  "stage_18_detonation_line",
  "stage_19_output",
  "stage_20_output",
  "stage_20_approved",
  "stage_20b_output",
  "stage_20b_audience_input",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
].join(", ");

export type Stage20bSession = {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_1_output: string | null;
  stage_3_output: string | null;
  stage_14c_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_18_detonation_line: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  stage_20_approved: boolean | null;
  stage_20b_output: string | null;
  stage_20b_audience_input: Stage20bAudienceInput | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
};

function formatAudienceInput(a: Stage20bAudienceInput): string {
  return [
    "USER-PROVIDED AUDIENCE INTELLIGENCE — MANDATORY INPUTS",
    "",
    "WHO IS THIS AUDIENCE AS HUMANS",
    a.audienceAsHumans.trim(),
    "",
    "A DAY IN THEIR LIFE",
    a.dayInTheirLife.trim(),
    "",
    "THEIR INFLUENCE MAP",
    a.influenceMap.trim(),
    "",
    "THEIR DECISION JOURNEY FOR THIS SPECIFIC CATEGORY",
    a.decisionJourney.trim(),
    "",
    "THEIR PSYCHOLOGICAL PROFILE IN THIS CATEGORY",
    a.psychologicalProfile.trim(),
    "",
    "CHANNEL UNIVERSE AND BUDGET ORIENTATION",
    a.channelUniverseAndBudget.trim(),
  ].join("\n");
}

export function buildStage20bUserMessage(
  s: Stage20bSession,
  a: Stage20bAudienceInput,
): string {
  return [
    smpGoverningBlock(s.selected_smp),
    "",
    `BRAND: ${s.brand_name ?? "—"}`,
    `CATEGORY: ${s.category ?? "—"}`,
    "",
    "VALIDATED SMP",
    s.selected_smp?.trim() || "—",
    "",
    "SELECTED DETONATION LINE (Stage 18)",
    s.stage_18_detonation_line?.trim() || "—",
    "",
    "SELECTED DETONATION STATEMENT (Stage 18)",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "BRAND WORLD AND CREATIVE TERRITORY (Stage 14C)",
    s.stage_14c_output?.trim() || "—",
    "",
    "AUDIENCE DEFINITION (Stage 1)",
    s.stage_1_output?.trim() || "—",
    "",
    "AUDIENCE INSIGHT (Stage 3)",
    s.stage_3_output?.trim() || "—",
    "",
    "ACTIVATION ARCHITECTURE (Stage 19)",
    s.stage_19_output?.trim() || "—",
    "",
    "MASTER DETONATION BRIEF (Stage 20 — APPROVED)",
    s.stage_20_output?.trim() || "—",
    "",
    formatAudienceInput(a),
  ].join("\n");
}

export async function loadStage20bSession(sessionId: string): Promise<Stage20bSession> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(STAGE20B_SELECT)
    .eq("id", sessionId)
    .single();
  if (error || !data) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
  return data as unknown as Stage20bSession;
}

export function assertStage20bReady(s: Stage20bSession): void {
  if (!s.stage_20_output) throw new Error("Stage 20 must complete before Stage 20B");
  if (!s.stage_20_approved) throw new Error("Stage 20 must be approved before Stage 20B");
}

/** Runs the model call and persists the result. Safe to run detached. */
export async function generateStage20b(args: {
  sessionId: string;
  audienceInput: Stage20bAudienceInput;
  redirect?: string;
  stageLabel?: string;
}): Promise<string> {
  const s = await loadStage20bSession(args.sessionId);
  assertStage20bReady(s);

  const system = appendRedirect(
    STAGE_20B_CHANNEL_STRATEGY_PROMPT,
    args.redirect ?? "",
  );

  let output: string;
  try {
    output = await callClaude({
      systemPrompt: withPhase2Formatting(system),
      userMessage: buildStage20bUserMessage(s, args.audienceInput),
      maxTokens: 64000,
      sessionId: args.sessionId,
      stageLabel: args.stageLabel ?? "Stage 20B",
      stageNumber: "20B",
      stageName: "Channel Strategy and Audience Intelligence",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stage 20B failed";
    await supabaseAdmin
      .from("sessions")
      .update({ stage_20b_error: msg })
      .eq("id", args.sessionId);
    throw e instanceof Error ? e : new Error(msg);
  }

  if (!output.trim()) {
    const msg = "Stage 20B returned an empty channel strategy. Re-run the stage.";
    await supabaseAdmin
      .from("sessions")
      .update({ stage_20b_error: msg })
      .eq("id", args.sessionId);
    throw new Error(msg);
  }

  const { error: saveErr } = await supabaseAdmin
    .from("sessions")
    .update({
      stage_20b_output: output,
      stage_20b_audience_input: args.audienceInput as never,
      stage_20b_error: null,
      phase_2_current_stage: "20B",
    })
    .eq("id", args.sessionId);
  if (saveErr) throw new Error(`Failed to save Stage 20B output: ${saveErr.message}`);
  return output;
}
