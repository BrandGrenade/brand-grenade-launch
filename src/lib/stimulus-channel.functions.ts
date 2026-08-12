// STEP 3 — channel briefs.
//
// One locked idea, adapted per channel. This replaces the previous behaviour,
// which incorrectly seeded and generated all 37 lenses again for every
// channel and never showed the model the locked idea at all.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { callClaude } from "./claude.server";
import {
  CHANNEL_ADAPTATION_LENS_ID,
  CHANNEL_ADAPTATION_LENS_NAME,
  CHANNEL_ADAPTATION_SYSTEM_PROMPT,
  buildChannelAdaptationMessage,
} from "./stimulus/channel-adaptation";
import type { AdaptationFidelity } from "./stimulus/adaptation-fidelity-types";

const Input = z.object({
  sessionId: z.string().uuid(),
  channelName: z.string().min(1),
});

export const generateChannelAdaptation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line, locked_big_idea_lens",
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

    if (!session.locked_big_idea?.trim())
      throw new Error(
        "No winning idea is locked. Lock a winning idea on Step 2 — Shortlist before generating channel briefs.",
      );

    const outputs = (session.stage_21_outputs as Record<string, string> | null) ?? {};
    const brief = outputs[data.channelName];
    if (!brief?.trim())
      throw new Error(`No Stage 21 Channel Detonation Brief found for "${data.channelName}"`);

    const { data: run, error: runErr } = await supabaseAdmin
      .from("stimulus_runs")
      .insert({
        session_id: data.sessionId,
        created_by: context.userId,
        channel_name: data.channelName,
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
      const text = await callClaude({
        systemPrompt: CHANNEL_ADAPTATION_SYSTEM_PROMPT,
        userMessage: buildChannelAdaptationMessage({
          brandName: session.brand_name ?? "—",
          category: session.category ?? "—",
          channelName: data.channelName,
          channelBrief: brief,
          smp: session.selected_smp ?? "",
          lockedIdea: session.locked_big_idea,
          lockedLine: session.locked_campaign_line ?? "",
          lockedLens: session.locked_big_idea_lens ?? null,
        }),
        skipUniversalWrapper: true,
        maxTokens: 8000,
        temperature: 1,
        sessionId: data.sessionId,
        stageLabel: `Channel adaptation (${data.channelName})`,
      });

      const { data: direction, error: dErr } = await supabaseAdmin
        .from("stimulus_directions")
        .insert({
          run_id: run.id,
          lens_id: CHANNEL_ADAPTATION_LENS_ID,
          lens_name: CHANNEL_ADAPTATION_LENS_NAME,
          sort_order: 0,
          direction: text.trim(),
          campaign_line: session.locked_campaign_line ?? null,
          master_line_at_generation: session.locked_campaign_line ?? null,
          status: "generated",
        })
        .select("id")
        .single();
      if (dErr || !direction) throw new Error(dErr?.message ?? "Failed to store adaptation");

      // Hold the adaptation against the locked idea before it is usable.
      let fidelity: AdaptationFidelity;
      try {
        const { checkAndStoreAdaptationFidelity } = await import(
          "./stimulus/adaptation-fidelity.server"
        );
        fidelity = await checkAndStoreAdaptationFidelity({
          sessionId: data.sessionId,
          directionId: direction.id,
          channelName: data.channelName,
          adaptation: text.trim(),
          lockedIdea: session.locked_big_idea,
          lockedLine: session.locked_campaign_line ?? null,
          lockedLens: session.locked_big_idea_lens ?? null,
        });
      } catch (e) {
        // Never a silent pass: record the failure as an unverified verdict.
        fidelity = {
          kind: "channel_adaptation_fidelity" as const,
          verdict: "drift",
          score: 0,
          reasoning: `Fidelity check could not complete: ${
            e instanceof Error ? e.message : String(e)
          }. Treat this adaptation as unverified.`,
          missing: [],
          misreadingEvidence: "",
          lineVerbatim: false,
          lockedLine: (session.locked_campaign_line ?? "").trim(),
          checkedAt: new Date().toISOString(),
        };
        await supabaseAdmin
          .from("stimulus_directions")
          .update({ line_check: fidelity as never })
          .eq("id", direction.id);
      }

      await supabaseAdmin
        .from("stimulus_runs")
        .update({ status: "complete", error: null })
        .eq("id", run.id);

      return { runId: run.id, fidelity };

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Channel adaptation failed";
      await supabaseAdmin
        .from("stimulus_runs")
        .update({ status: "failed", error: msg })
        .eq("id", run.id);
      throw e instanceof Error ? e : new Error(msg);
    }
  });
