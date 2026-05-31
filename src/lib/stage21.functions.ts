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
  extractStage19Channels,
  extractChannelRoles,
  formatThreeTruths,
} from "./phase2-shared.server";

const STAGE21_SELECT = [
  "brand_name",
  "category",
  "selected_smp",
  "stage_18_selected_detonation",
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
  stage_19_output: string | null;
  stage_20_output: string | null;
  truth_product: string | null;
  truth_consumer: string | null;
  truth_cultural: string | null;
  stage_21_outputs: Record<string, string> | null;
};

function buildStage21UserMessage(channel: string, role: string, s: Stage21Session): string {
  return [
    `CHANNEL: ${channel}`,
    `CHANNEL ROLE: ${role}`,
    "",
    `BRAND: ${s.brand_name ?? "—"}`,
    `CATEGORY: ${s.category ?? "—"}`,
    "",
    "VALIDATED SMP",
    s.selected_smp?.trim() || "—",
    "",
    "SELECTED DETONATION (Stage 18)",
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
  s: Stage21Session,
  redirectText: string,
): Promise<string> {
  const system = appendRedirect(STAGE_21_CHANNEL_DETONATION_BRIEFS_PROMPT, redirectText);
  return callClaude({
    systemPrompt: system,
    userMessage: buildStage21UserMessage(channel, role, s),
    maxTokens: 4000,
    temperature: 0.5,
    sessionId,
    stageLabel: `Stage 21 (${channel})`,
    stageNumber: "21",
    stageName: "Channel Briefs",
  });
}

const RunInput = z.object({ sessionId: z.string().uuid() });

export const runStage21 = createServerFn({ method: "POST" })
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_selected_detonation, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage21Session;
    if (!s.stage_19_output) throw new Error("Stage 19 missing");
    if (!s.stage_20_output) throw new Error("Stage 20 missing");

    if (s.stage_21_outputs && Object.keys(s.stage_21_outputs).length > 0) {
      return { outputs: s.stage_21_outputs };
    }

    const channels = extractStage19Channels(s.stage_19_output);
    const roles = extractChannelRoles(s.stage_19_output);
    if (channels.length === 0)
      throw new Error("No active channels found in Stage 19 hierarchy");

    let outputs: Record<string, string>;
    try {
      const results = await Promise.all(
        channels.map((c) => generateOne(data.sessionId, c, roles[c] ?? "—", s, "")),
      );
      outputs = Object.fromEntries(channels.map((c, i) => [c, results[i]]));
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
      .update({ stage_21_outputs: outputs, stage_21_error: null, phase_2_current_stage: 21 })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(`Failed to save Stage 21 outputs: ${saveErr.message}`);
    return { outputs };
  });

export const saveStage21 = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), outputs: z.record(z.string(), z.string()) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: data.outputs, stage_21_error: null })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadStage21 = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
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

const RetryInput = z.object({
  sessionId: z.string().uuid(),
  // For Stage 21, cardIds == channel names. Empty = regenerate all.
  cardIds: z.array(z.string()).default([]),
  redirectInstructions: z.record(z.string(), z.string()).default({}),
});

export const retryStage21 = createServerFn({ method: "POST" })
  .inputValidator((i) => RetryInput.parse(i))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, selected_smp, stage_18_selected_detonation, stage_19_output, stage_20_output, truth_product, truth_consumer, truth_cultural, stage_21_outputs")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const s = session as unknown as Stage21Session;
    if (!s.stage_19_output) throw new Error("Stage 19 missing");

    const allChannels = extractStage19Channels(s.stage_19_output);
    const roles = extractChannelRoles(s.stage_19_output);
    const existing = s.stage_21_outputs ?? {};
    const regenerate = data.cardIds.length === 0 ? allChannels : data.cardIds;

    const results = await Promise.all(
      regenerate.map((c) =>
        generateOne(data.sessionId, c, roles[c] ?? "—", s, data.redirectInstructions[c] ?? ""),
      ),
    );
    const merged: Record<string, string> = { ...existing };
    regenerate.forEach((c, i) => {
      merged[c] = results[i];
    });

    const { error: saveErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_21_outputs: merged, stage_21_error: null })
      .eq("id", data.sessionId);
    if (saveErr) throw new Error(saveErr.message);
    return { outputs: merged };
  });
