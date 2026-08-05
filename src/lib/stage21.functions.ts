// Stage 21 — Channel Detonation Briefs
// Generates one brief per active channel from Stage 19. Briefs are generated
// in parallel with Promise.all and stored as a JSON object in
// stage_21_outputs keyed by channel name.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_21_CHANNEL_DETONATION_BRIEFS_PROMPT } from "./stage21-channel-detonation-briefs-prompt";
import {
  appendRedirect,
  extractStage19ChannelEntries,
  extractStage20BChannelEntries,
  formatThreeTruths,
  smpGoverningBlock,
  withPhase2Formatting,
} from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";
import { getObjectiveDirective } from "./strategic-objective.server";

const STAGE21_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_18_selected_detonation",
  "stage_18_detonation_line",
  "stage_19_output",
  "stage_20_output",
  "stage_20l_output",
  "locked_big_idea",
  "locked_campaign_line",
  "locked_big_idea_lens",
  "stage_20l_approved",
  "stage_20b_output",
  "truth_product",
  "truth_consumer",
  "truth_cultural",
  "stage_21_outputs",
].join(", ");

type Stage21Session = {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_18_selected_detonation: string | null;
  stage_18_detonation_line: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  stage_20l_output: string | null;
  locked_big_idea: string | null;
  locked_campaign_line: string | null;
  locked_big_idea_lens: string | null;
  stage_20l_approved: boolean | null;
  stage_20b_output: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
  stage_21_outputs: Record<string, string> | null;
};


function extractSection(context: string, label: string): string {
  if (!context) return "";
  // Match LABEL: ... until next ALL-CAPS header (3+ words/letters) followed by ":" or end of string
  const re = new RegExp(
    `${label}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Z0-9 \\-]{2,}\\s*:|$)`,
    "i",
  );
  const m = context.match(re);
  return m ? m[1].trim() : "";
}

function buildStage21UserMessage(
  channel: string,
  role: string,
  context: string,
  s: Stage21Session,
): string {
  const smpTranslationRaw = extractSection(context, "SMP TRANSLATION");
  const smpTranslation = smpTranslationRaw || (context?.trim() || "—");
  const audienceMindstate = extractSection(context, "AUDIENCE MINDSTATE");

  const lockedBlock = s.locked_big_idea?.trim()
    ? [
        "BINDING INPUT — THE LOCKED CAMPAIGN BIG IDEA AND LINE",
        "This single idea and line were selected for the whole campaign BEFORE any channel work began, from a 37-lens sweep run against the proposition alone. They outrank every other input in this message. Your only job for this channel is to ADAPT this idea and carry this line. You may not reinterpret the proposition, invent a different idea, or narrow it to what this channel finds convenient.",
        "",
        `WINNING IDEA (lens: ${s.locked_big_idea_lens ?? "—"})`,
        s.locked_big_idea.trim(),
        "",
        "WINNING CAMPAIGN LINE — THE ONLY CAMPAIGN LINE FOR THIS CAMPAIGN. Open the brief with Section zero — Campaign Line and reproduce the text below there, verbatim, character for character, on its own line. It is not optional and it is not conditional on the brief happening to mention a line. Any other line supplied anywhere in this message — including the Stage 18 selected detonation line — is superseded and must not be presented as the campaign line. Never substitute the proposition text for the line, never write a channel-specific variant of it, and never present a sentence of your own as the campaign line.",
        s.locked_campaign_line?.trim() || "—",


        "",
        "————",
        "",
      ]
    : [];

  return [
    ...lockedBlock,
    "BINDING INPUT — THE LEAD CREATIVE EXPRESSION",
    "This is the decided creative idea for this campaign. It outranks every other input in this message, including the channel strategy below. Your job for this channel is to ADAPT this already-decided idea to this channel's moment and medium. You are NOT permitted to independently interpret the proposition, invent a different idea, or narrow the idea to whatever this channel finds convenient. Every one of the five non-negotiables must be carried in your brief. The misreading named in this document must never appear in your brief — if the channel context below pulls you toward it, ignore the pull and stay with the decided idea. A brief that reads as a different campaign sharing the same proposition is a failure of this stage.",
    "",
    s.stage_20l_output?.trim() || "— (none decided; do not invent one, and stay strictly within the Master Detonation Brief's stated meaning)",
    "",
    "————",
    "",
    "SUPPORTING INPUT — CHANNEL STRATEGY AND AUDIENCE INTELLIGENCE (Stage 20B)",
    "Use this for channel selection rationale, audience definition, mindstate, occasion, behavioural triggers and message priority — the mechanics of the moment. Do NOT use it as a source of creative meaning. Where this document's framing of the proposition differs in meaning from the Lead Creative Expression above, the Lead Creative Expression wins.",
    "",
    s.stage_20b_output?.trim() || "—",
    "",
    "—",
    "",
    smpGoverningBlock(s.selected_smp),
    "",
    `CHANNEL: ${channel}`,
    `ROLE IN HIERARCHY: ${role}`,
    "CHANNEL CONTEXT FOR THIS CHANNEL (this channel's Section Three paragraph from Stage 20B, or Stage 19 fallback):",
    context?.trim() || "—",
    "",
    "HOW THIS CHANNEL SHOULD CARRY THE IDEA (Stage 20B's channel translation — mechanics only, subordinate to the Lead Creative Expression):",
    smpTranslation,

    "",
    "AUDIENCE MINDSTATE IN THIS CHANNEL:",
    audienceMindstate,
    "",
    `BRAND: ${s.brand_name ?? "—"}`,
    `CATEGORY: ${s.category ?? "—"}`,
    "",
    "VALIDATED SMP",
    s.selected_smp?.trim() || "—",
    "",
    s.locked_campaign_line?.trim()
      ? "SELECTED DETONATION LINE (Stage 18 — SUPERSEDED. A campaign line has been locked above; this text is historical context only. Do not reproduce it as the campaign line and do not open the brief with it.)"
      : "SELECTED DETONATION LINE (Stage 18 — short campaign line, must appear first under THE DETONATION)",
    s.stage_18_detonation_line?.trim() || "—",

    "",
    "SELECTED DETONATION STATEMENT (Stage 18 — full statement, must appear directly below the line under THE DETONATION)",
    s.stage_18_selected_detonation?.trim() || "—",
    "",
    "THREE TRUTH POSITIONING",
    formatThreeTruths({
      product: s.truth_product,
      consumer: s.truth_consumer,
      cultural: s.truth_cultural,
    }),
    "",
    "MASTER DETONATION BRIEF (Stage 20 — strategic context, subordinate to the Lead Creative Expression above)",
    s.stage_20_output?.trim() || "—",
  ].join("\n");

}

export async function generateOne(
  sessionId: string,
  channel: string,
  role: string,
  context: string,
  s: Stage21Session,
  redirectText: string,
): Promise<string> {
  const system = appendRedirect(STAGE_21_CHANNEL_DETONATION_BRIEFS_PROMPT, redirectText);
  return callClaude({
    systemPrompt: withPhase2Formatting(system, await getObjectiveDirective(sessionId, "phase2")),
    userMessage: buildStage21UserMessage(channel, role, context, s),
    maxTokens: 64000,
    sessionId,
    stageLabel: `Stage 21 (${channel})`,
    stageNumber: "21",
    stageName: "Channel Briefs",
  });
}

/**
 * Holds every channel brief against the decided Lead Creative Expression and
 * persists the report. A failure here must never block the briefs from being
 * saved — it only means the set is unverified.
 */
async function checkAndSaveFidelity(
  sessionId: string,
  leadExpression: string | null,
  outputs: Record<string, string>,
) {
  try {
    const { runChannelFidelityCheck } = await import("./stage21-fidelity.server");
    const report = await runChannelFidelityCheck({ sessionId, leadExpression, outputs });
    await supabaseAdmin
      .from("sessions")
      .update({ stage_21_fidelity: report as never })
      .eq("id", sessionId);
    return report;
  } catch (e) {
    console.error("Channel fidelity check failed:", e);
    return null;
  }
}


const RunInput = z.object({
  sessionId: z.string().uuid(),
  audienceChannelDirection: z.string().trim().max(4000).optional(),
});

function buildAudienceChannelRedirect(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return `MANDATORY CHANNEL AND AUDIENCE CONSTRAINT — THIS OVERRIDES ALL DEFAULT CHANNEL RECOMMENDATIONS — ${t}`;
}

export const runStage21 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 21);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(STAGE21_SELECT)
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage21Session;
    if (!s.stage_19_output) throw new Error("Stage 19 missing");
    if (!s.stage_20_output) throw new Error("Stage 20 missing");
    if (!s.stage_20b_output) throw new Error("Stage 20B (Channel Strategy and Audience Intelligence) must complete before Stage 21");
    if (!s.stage_20l_output?.trim())
      throw new Error(
        "The Lead Creative Expression (Stage 20L) must be generated before Stage 21. Without it, each channel brief independently reinterprets the proposition.",
      );
    if (!s.stage_20l_approved)
      throw new Error("The Lead Creative Expression must be approved before Stage 21 can run.");


    if (
      s.stage_21_outputs &&
      Object.keys(s.stage_21_outputs).length > 0 &&
      !data.audienceChannelDirection?.trim()
    ) {
      return { outputs: s.stage_21_outputs };
    }

    // Stage 20B is the canonical source of the channel list. Parse Section
    // Three for ALL-CAPS named channel headers. Fall back to the Stage 19
    // extractor only when Stage 20B parsing yields nothing (legacy sessions).
    const stage20bEntries = extractStage20BChannelEntries(s.stage_20b_output);
    const entries = stage20bEntries.length > 0
      ? stage20bEntries
      : extractStage19ChannelEntries(s.stage_19_output);
    if (entries.length === 0)
      throw new Error("No named channels found in Stage 20B Section Three or Stage 19 hierarchy");

    const redirectText = buildAudienceChannelRedirect(data.audienceChannelDirection ?? "");

    let outputs: Record<string, string>;
    try {
      const results: string[] = [];
      for (const e of entries) {
        const result = await generateOne(data.sessionId, e.name, e.role, e.content, s, redirectText);
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      outputs = Object.fromEntries(entries.map((e, i) => [e.name, results[i]]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 21 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_21_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: outputs, stage_21_error: null, stage_21_fidelity: null, phase_2_current_stage: '22' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 21 outputs: ${saveErr.message}`);

    const fidelity = await checkAndSaveFidelity(data.sessionId, s.stage_20l_output, outputs);
    return { outputs, fidelity };
  });



export const saveStage21 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), outputs: z.record(z.string(), z.string()) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: data.outputs, stage_21_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage21 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return {
      outputs:
        (row?.stage_21_outputs as Record<string, string> | null) ?? null,
    };
  });

export const clearStage21 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: null, stage_21_error: null, stage_21_fidelity: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reads the stored fidelity report without re-running the check. */
export const loadStage21Fidelity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_21_fidelity")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    return { fidelity: (row?.stage_21_fidelity as unknown) ?? null };
  });

/** Re-runs the fidelity check against the briefs already on the session. */
export const recheckStage21Fidelity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20l_output, stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Session not found");
    const outputs = (row.stage_21_outputs as Record<string, string> | null) ?? {};
    if (Object.keys(outputs).length === 0)
      throw new Error("There are no channel briefs to check yet.");
    const { runChannelFidelityCheck } = await import("./stage21-fidelity.server");
    const report = await runChannelFidelityCheck({
      sessionId: data.sessionId,
      leadExpression: (row.stage_20l_output as string | null) ?? null,
      outputs,
    });
    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_fidelity: report as never })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { fidelity: report };
  });


const RetryInput = z.object({
  sessionId: z.string().uuid(),
  // For Stage 21, cardIds == channel names. Empty = regenerate all.
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

export const retryStage21 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(STAGE21_SELECT)
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage21Session;
    if (!s.stage_19_output) throw new Error("Stage 19 missing");
    if (!s.stage_20b_output) throw new Error("Stage 20B (Channel Strategy and Audience Intelligence) must complete before Stage 21");

    const stage20bEntries = extractStage20BChannelEntries(s.stage_20b_output);
    const allEntries = stage20bEntries.length > 0
      ? stage20bEntries
      : extractStage19ChannelEntries(s.stage_19_output);
    const existing = s.stage_21_outputs ?? {};
    const regenerate =
      data.cardIds.length === 0
        ? allEntries
        : allEntries.filter((e) => data.cardIds.includes(e.name));

    const results: string[] = [];
    for (const e of regenerate) {
      const result = await generateOne(
        data.sessionId,
        e.name,
        e.role,
        e.content,
        s,
        data.redirectInstructions[e.name] ?? "",
      );
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const merged: Record<string, string> = { ...existing };
    regenerate.forEach((e, i) => {
      merged[e.name] = results[i];
    });

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: merged, stage_21_error: null, stage_21_fidelity: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);

    const fidelity = await checkAndSaveFidelity(data.sessionId, s.stage_20l_output, merged);
    return { outputs: merged, fidelity };

  });
