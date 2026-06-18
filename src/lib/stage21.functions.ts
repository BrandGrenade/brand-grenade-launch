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
  formatThreeTruths,
  smpGoverningBlock,
  withPhase2Formatting,
} from "./phase2-shared";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const STAGE21_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_18_selected_detonation",
  "stage_18_detonation_line",
  "stage_19_output",
  "stage_20_output",
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

  return [
    smpGoverningBlock(s.selected_smp),
    "",
    `CHANNEL: ${channel}`,
    `ROLE IN HIERARCHY: ${role}`,
    "CHANNEL CONTEXT FROM STAGE 19:",
    context?.trim() || "—",
    "",
    "SMP TRANSLATION FOR THIS CHANNEL:",
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
    "SELECTED DETONATION LINE (Stage 18 — short campaign line, must appear first under THE DETONATION)",
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
    "MASTER DETONATION BRIEF (Stage 20)",
    s.stage_20_output?.trim() || "—",
  ].join("\n");
}

async function generateOne(
  sessionId: string,
  channel: string,
  role: string,
  context: string,
  s: Stage21Session,
  redirectText: string,
): Promise<string> {
  const system = appendRedirect(STAGE_21_CHANNEL_DETONATION_BRIEFS_PROMPT, redirectText);
  return callClaude({
    systemPrompt: withPhase2Formatting(system),
    userMessage: buildStage21UserMessage(channel, role, context, s),
    maxTokens: 4000,
    sessionId,
    stageLabel: `Stage 21 (${channel})`,
    stageNumber: "21",
    stageName: "Channel Briefs",
  });
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
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 21);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_selected_detonation, stage_18_detonation_line, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage21Session;
    if (!s.stage_19_output) throw new Error("Stage 19 missing");
    if (!s.stage_20_output) throw new Error("Stage 20 missing");

    if (s.stage_21_outputs && Object.keys(s.stage_21_outputs).length > 0) {
      return { outputs: s.stage_21_outputs };
    }

    const entries = extractStage19ChannelEntries(s.stage_19_output);
    if (entries.length === 0)
      throw new Error("No active channels found in Stage 19 hierarchy");

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
      .update({ stage_21_outputs: outputs, stage_21_error: null, phase_2_current_stage: '22' })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 21 outputs: ${saveErr.message}`);
    return { outputs };
  });


export const saveStage21 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), outputs: z.record(z.string(), z.string()) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
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
    await assertSessionOwner(data.sessionId, context.userId);
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
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: null, stage_21_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
    await assertSessionOwner(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_selected_detonation, stage_18_detonation_line, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage21Session;
    if (!s.stage_19_output) throw new Error("Stage 19 missing");

    const allEntries = extractStage19ChannelEntries(s.stage_19_output);
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
      .update({ stage_21_outputs: merged, stage_21_error: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { outputs: merged };
  });
