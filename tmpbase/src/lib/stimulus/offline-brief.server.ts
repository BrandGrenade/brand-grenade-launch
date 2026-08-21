// OFFLINE CREATIVE BRIEF — generation engine.
//
// Generated from exactly the same locked idea and line as the Content
// Creation Input Prompt, so the two artefacts can never diverge at source.
// Stored as its own run (run_mode "offline_creative_brief") so it never
// appears in, or contaminates, the content-prompt list.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/lib/claude.server";
import { loadLockedSession } from "./channel-adaptation.server";
import {
  OFFLINE_BRIEF_LENS_ID,
  OFFLINE_BRIEF_LENS_NAME,
  OFFLINE_CREATIVE_BRIEF_SYSTEM_PROMPT,
  buildOfflineCreativeBriefMessage,
} from "./offline-brief";

/** The recorded "why it wins" reasoning for the idea locked on this session. */
async function loadWhyItWins(sessionId: string): Promise<string> {
  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("locked_big_idea_run_id")
    .eq("id", sessionId)
    .single();
  const runId = session?.locked_big_idea_run_id;
  if (!runId) return "";
  const { data: run } = await supabaseAdmin
    .from("stimulus_runs")
    .select("winning_direction_id")
    .eq("id", runId)
    .single();
  const directionId = run?.winning_direction_id;
  if (!directionId) return "";
  const { data: dir } = await supabaseAdmin
    .from("stimulus_directions")
    .select("rationale, instinct_brief")
    .eq("id", directionId)
    .single();
  return [dir?.rationale, dir?.instinct_brief].filter(Boolean).join("\n\n").trim();
}

async function loadGuardrails(sessionId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("stage_20_output, brand_constraints, brand_tone_of_voice")
    .eq("id", sessionId)
    .single();
  return [
    data?.brand_constraints ? `Brand constraints:\n${data.brand_constraints}` : "",
    data?.brand_tone_of_voice ? `Tone of voice:\n${data.brand_tone_of_voice}` : "",
    data?.stage_20_output ? `Master detonation brief:\n${data.stage_20_output}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

export async function runOfflineCreativeBrief(args: {
  sessionId: string;
  userId: string;
  channelName: string;
}): Promise<{ runId: string; directionId: string; text: string }> {
  const session = await loadLockedSession(args.sessionId);
  const outputs = session.stage_21_outputs ?? {};
  const brief = outputs[args.channelName];
  if (!brief?.trim())
    throw new Error(`No Stage 21 Channel Strategy found for "${args.channelName}"`);

  const [whyItWins, guardrails] = await Promise.all([
    loadWhyItWins(args.sessionId),
    loadGuardrails(args.sessionId),
  ]);

  const { data: run, error: runErr } = await supabaseAdmin
    .from("stimulus_runs")
    .insert({
      session_id: args.sessionId,
      created_by: args.userId,
      channel_name: args.channelName,
      channel_brief: brief,
      smp: session.selected_smp ?? "",
      run_mode: "offline_creative_brief",
      locked_big_idea_at_generation: session.locked_big_idea ?? null,
      locked_line_at_generation: session.locked_campaign_line ?? null,
      status: "generating",
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`Failed to create offline brief run: ${runErr?.message}`);

  try {
    const text = (
      await callClaude({
        systemPrompt: OFFLINE_CREATIVE_BRIEF_SYSTEM_PROMPT,
        userMessage: buildOfflineCreativeBriefMessage({
          brandName: session.brand_name ?? "—",
          category: session.category ?? "—",
          channelName: args.channelName,
          channelBrief: brief,
          smp: session.selected_smp ?? "",
          lockedIdea: session.locked_big_idea!,
          lockedLine: session.locked_campaign_line ?? "",
          lockedLens: session.locked_big_idea_lens ?? null,
          whyItWins,
          guardrails,
        }),
        skipUniversalWrapper: true,
        maxTokens: 4000,
        temperature: 1,
        sessionId: args.sessionId,
        stageLabel: `Offline creative brief (${args.channelName})`,
      })
    ).trim();

    const { data: direction, error: dErr } = await supabaseAdmin
      .from("stimulus_directions")
      .insert({
        run_id: run.id,
        lens_id: OFFLINE_BRIEF_LENS_ID,
        lens_name: OFFLINE_BRIEF_LENS_NAME,
        sort_order: 0,
        direction: text,
        campaign_line: session.locked_campaign_line ?? null,
        master_line_at_generation: session.locked_campaign_line ?? null,
        status: "generated",
      })
      .select("id")
      .single();
    if (dErr || !direction) throw new Error(dErr?.message ?? "Failed to store offline brief");

    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "complete", error: null })
      .eq("id", run.id);

    return { runId: run.id, directionId: direction.id, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Offline creative brief failed";
    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "failed", error: msg })
      .eq("id", run.id);
    throw e instanceof Error ? e : new Error(msg);
  }
}
