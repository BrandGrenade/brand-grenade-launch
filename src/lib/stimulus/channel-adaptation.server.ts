// STEP 3 — channel adaptation engine.
//
// One locked idea, adapted into one channel, held against the locked idea
// immediately, and — if it drifted or broke away — regenerated once
// automatically before the user is ever told it failed. A channel is only
// surfaced as failed when it fails fidelity twice in a row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/lib/claude.server";
import {
  CHANNEL_ADAPTATION_LENS_ID,
  CHANNEL_ADAPTATION_LENS_NAME,
  CHANNEL_ADAPTATION_SYSTEM_PROMPT,
  buildChannelAdaptationMessage,
} from "./channel-adaptation";
import { checkAndStoreAdaptationFidelity } from "./adaptation-fidelity.server";
import type { AdaptationFidelity } from "./adaptation-fidelity-types";

type SessionRow = {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_21_outputs: Record<string, string> | null;
  locked_big_idea: string | null;
  locked_campaign_line: string | null;
  locked_big_idea_lens: string | null;
};

export async function loadLockedSession(sessionId: string): Promise<SessionRow> {
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "brand_name, category, selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line, locked_big_idea_lens",
    )
    .eq("id", sessionId)
    .single();
  if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
  if (!session.locked_big_idea?.trim())
    throw new Error(
      "No winning idea is locked. Lock a winning idea on Step 2 — Shortlist before generating channel briefs.",
    );
  return session as unknown as SessionRow;
}

function unverified(reason: string, lockedLine: string | null): AdaptationFidelity {
  return {
    kind: "channel_adaptation_fidelity",
    verdict: "drift",
    score: 0,
    reasoning: `${reason} Treat this adaptation as unverified.`,
    missing: [],
    misreadingEvidence: "",
    lineVerbatim: false,
    lockedLine: (lockedLine ?? "").trim(),
    checkedAt: new Date().toISOString(),
  };
}

async function generateOnce(args: {
  session: SessionRow;
  sessionId: string;
  channelName: string;
  brief: string;
  attempt: number;
}): Promise<string> {
  const retryNote =
    args.attempt > 1
      ? "\n\nPREVIOUS ATTEMPT FAILED THE FIDELITY CHECK. It drifted from the locked idea or did not carry the locked campaign line verbatim. This attempt must stay inside the locked idea and reproduce the locked line exactly as written."
      : "";
  const text = await callClaude({
    systemPrompt: CHANNEL_ADAPTATION_SYSTEM_PROMPT,
    userMessage:
      buildChannelAdaptationMessage({
        brandName: args.session.brand_name ?? "—",
        category: args.session.category ?? "—",
        channelName: args.channelName,
        channelBrief: args.brief,
        smp: args.session.selected_smp ?? "",
        lockedIdea: args.session.locked_big_idea!,
        lockedLine: args.session.locked_campaign_line ?? "",
        lockedLens: args.session.locked_big_idea_lens ?? null,
      }) + retryNote,
    skipUniversalWrapper: true,
    maxTokens: 8000,
    temperature: 1,
    sessionId: args.sessionId,
    stageLabel: `Channel adaptation (${args.channelName})${args.attempt > 1 ? " — auto-retry" : ""}`,
  });
  return text.trim();
}

/**
 * Generates a channel adaptation, fidelity-checks it, and auto-retries once
 * when the check does not pass. Returns the run that the user should see.
 */
export async function runChannelAdaptation(args: {
  sessionId: string;
  userId: string;
  channelName: string;
}): Promise<{ runId: string; directionId: string; fidelity: AdaptationFidelity; attempts: number }> {
  const session = await loadLockedSession(args.sessionId);
  const outputs = session.stage_21_outputs ?? {};
  const brief = outputs[args.channelName];
  if (!brief?.trim())
    throw new Error(`No Stage 21 Channel Detonation Brief found for "${args.channelName}"`);

  const { data: run, error: runErr } = await supabaseAdmin
    .from("stimulus_runs")
    .insert({
      session_id: args.sessionId,
      created_by: args.userId,
      channel_name: args.channelName,
      channel_brief: brief,
      smp: session.selected_smp ?? "",
      run_mode: "channel_adaptation",
      locked_big_idea_at_generation: session.locked_big_idea ?? null,
      locked_line_at_generation: session.locked_campaign_line ?? null,
      status: "generating",
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`Failed to create channel run: ${runErr?.message}`);

  try {
    let directionId: string | null = null;
    let fidelity: AdaptationFidelity | null = null;
    let attempts = 0;

    // Attempt 1, then one automatic retry if fidelity does not pass.
    for (let attempt = 1; attempt <= 2; attempt++) {
      attempts = attempt;
      const text = await generateOnce({
        session,
        sessionId: args.sessionId,
        channelName: args.channelName,
        brief,
        attempt,
      });

      if (directionId) {
        await supabaseAdmin
          .from("stimulus_directions")
          .update({ direction: text })
          .eq("id", directionId);
      } else {
        const { data: direction, error: dErr } = await supabaseAdmin
          .from("stimulus_directions")
          .insert({
            run_id: run.id,
            lens_id: CHANNEL_ADAPTATION_LENS_ID,
            lens_name: CHANNEL_ADAPTATION_LENS_NAME,
            sort_order: 0,
            direction: text,
            campaign_line: session.locked_campaign_line ?? null,
            master_line_at_generation: session.locked_campaign_line ?? null,
            status: "generated",
          })
          .select("id")
          .single();
        if (dErr || !direction) throw new Error(dErr?.message ?? "Failed to store adaptation");
        directionId = direction.id;
      }

      try {
        fidelity = await checkAndStoreAdaptationFidelity({
          sessionId: args.sessionId,
          directionId,
          channelName: args.channelName,
          adaptation: text,
          lockedIdea: session.locked_big_idea!,
          lockedLine: session.locked_campaign_line ?? null,
          lockedLens: session.locked_big_idea_lens ?? null,
        });
      } catch (e) {
        fidelity = unverified(
          `Fidelity check could not complete: ${e instanceof Error ? e.message : String(e)}.`,
          session.locked_campaign_line ?? null,
        );
        await supabaseAdmin
          .from("stimulus_directions")
          .update({ line_check: fidelity as never })
          .eq("id", directionId);
      }

      if (fidelity.verdict === "pass") break;
    }

    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "complete", error: null })
      .eq("id", run.id);

    return { runId: run.id, directionId: directionId!, fidelity: fidelity!, attempts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Channel adaptation failed";
    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "failed", error: msg })
      .eq("id", run.id);
    throw e instanceof Error ? e : new Error(msg);
  }
}

/** Saves a hand-edited adaptation and re-runs the fidelity check on it. */
export async function saveEditedAdaptation(args: {
  sessionId: string;
  directionId: string;
  channelName: string;
  text: string;
}): Promise<AdaptationFidelity> {
  const session = await loadLockedSession(args.sessionId);
  await supabaseAdmin
    .from("stimulus_directions")
    .update({ direction: args.text.trim() })
    .eq("id", args.directionId);

  try {
    return await checkAndStoreAdaptationFidelity({
      sessionId: args.sessionId,
      directionId: args.directionId,
      channelName: args.channelName,
      adaptation: args.text.trim(),
      lockedIdea: session.locked_big_idea!,
      lockedLine: session.locked_campaign_line ?? null,
      lockedLens: session.locked_big_idea_lens ?? null,
    });
  } catch (e) {
    const f = unverified(
      `Fidelity check could not complete after the edit: ${e instanceof Error ? e.message : String(e)}.`,
      session.locked_campaign_line ?? null,
    );
    await supabaseAdmin
      .from("stimulus_directions")
      .update({ line_check: f as never })
      .eq("id", args.directionId);
    return f;
  }
}
