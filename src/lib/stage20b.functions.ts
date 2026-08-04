// Stage 20B — Channel Strategy and Audience Intelligence
// Sits between Stage 20 approval and Stage 21.
//
// User provides six mandatory audience-intelligence inputs via the
// Stage 20B input screen. Those inputs, combined with the approved SMP,
// detonation, three truths, brand world, Stage 19 activation architecture,
// and the Stage 20 Master Detonation Brief, are fed into the channel
// strategist prompt to produce the seven-section channel strategy document
// that Stage 21 then uses as its primary input.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_20B_CHANNEL_STRATEGY_PROMPT } from "./stage20b-prompt";
import {
  appendRedirect,
  formatThreeTruths,
  smpGoverningBlock,
  withPhase2Formatting,
} from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";

const AudienceInput = z.object({
  audienceAsHumans: z.string().trim().min(1).max(8000),
  dayInTheirLife: z.string().trim().min(1).max(8000),
  influenceMap: z.string().trim().min(1).max(8000),
  decisionJourney: z.string().trim().min(1).max(8000),
  psychologicalProfile: z.string().trim().min(1).max(8000),
  channelUniverseAndBudget: z.string().trim().min(1).max(8000),
});
export type Stage20bAudienceInput = z.infer<typeof AudienceInput>;

const STAGE20B_SELECT = [
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
  "stage_20l_output",

  "stage_20b_output",
  "stage_20b_audience_input",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
].join(", ");

type Stage20bSession = {
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
  stage_20l_output: string | null;

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

function buildStage20bUserMessage(
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
    "THE LEAD CREATIVE EXPRESSION (Stage 20L — DECIDED AND BINDING)",
    "This is the single creative idea the whole campaign executes. Your channel strategy must describe how each channel carries THIS idea. Do not re-interpret the proposition into a different meaning, and do not let any channel's mechanics narrow the idea. If a channel cannot carry this idea, say so plainly rather than substituting a different idea for it.",
    s.stage_20l_output?.trim() || "—",
    "",
    formatAudienceInput(a),

  ].join("\n");
}

async function loadSession(sessionId: string): Promise<Stage20bSession> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(STAGE20B_SELECT)
    .eq("id", sessionId)
    .single();
  if (error || !data)
    throw new Error(`Session not found: ${error?.message ?? "no row"}`);
  return data as unknown as Stage20bSession;
}

const RunInput = z.object({
  sessionId: z.string().uuid(),
  audienceInput: AudienceInput,
  redirect: z.string().trim().max(4000).optional(),
});

export const runStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");

    const s = await loadSession(data.sessionId);
    if (!s.stage_20_output)
      throw new Error("Stage 20 must complete before Stage 20B");
    if (!s.stage_20_approved)
      throw new Error("Stage 20 must be approved before Stage 20B");

    const system = appendRedirect(
      STAGE_20B_CHANNEL_STRATEGY_PROMPT,
      data.redirect ?? "",
    );

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: withPhase2Formatting(system),
        userMessage: buildStage20bUserMessage(s, data.audienceInput),
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 20B",
        stageNumber: "20B",
        stageName: "Channel Strategy and Audience Intelligence",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 20B failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_20b_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_20b_output: output,
        stage_20b_audience_input: data.audienceInput as never,
        stage_20b_error: null,
        phase_2_current_stage: "20B",
      })
      .eq("id", data.sessionId);
    if (saveErr)
      throw new Error(`Failed to save Stage 20B output: ${saveErr.message}`);
    return { output, audienceInput: data.audienceInput };
  });

export const loadStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20b_output, stage_20b_audience_input")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return {
      output: (row?.stage_20b_output as string | null) ?? null,
      audienceInput:
        (row?.stage_20b_audience_input as Stage20bAudienceInput | null) ?? null,
    };
  });

export const saveStage20bInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        audienceInput: AudienceInput.partial(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20b_audience_input: data.audienceInput as never })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20b_output: null, stage_20b_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
