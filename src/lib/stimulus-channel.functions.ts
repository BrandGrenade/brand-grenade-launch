// STEP 3 — channel briefs.
//
// One locked idea, adapted per channel, fidelity-checked automatically and
// auto-retried once on failure. All engine logic lives in
// ./stimulus/channel-adaptation.server — this file is a thin RPC wrapper.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
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
    const { runChannelAdaptation } = await import("./stimulus/channel-adaptation.server");
    return runChannelAdaptation({
      sessionId: data.sessionId,
      userId: context.userId,
      channelName: data.channelName,
    });
  });

/** Saves a hand-edited channel brief and re-checks its fidelity. */
export const editChannelAdaptation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        directionId: z.string().uuid(),
        text: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: run } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id, session_id, channel_name")
      .eq("id", data.runId)
      .single();
    if (!run) throw new Error("Run not found");
    await assertSessionAccess(run.session_id, context.userId);

    const { saveEditedAdaptation } = await import("./stimulus/channel-adaptation.server");
    const fidelity = await saveEditedAdaptation({
      sessionId: run.session_id,
      directionId: data.directionId,
      channelName: run.channel_name,
      text: data.text,
    });
    return { fidelity };
  });


/** Verdicts for every channel-adaptation run on a session, keyed by run id. */
export const listAdaptationFidelity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: runs } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id")
      .eq("session_id", data.sessionId)
      .eq("run_mode", "channel_adaptation");
    const ids = (runs ?? []).map((r) => r.id);
    if (ids.length === 0) return { byRun: {} as Record<string, AdaptationFidelity> };
    const { data: dirs } = await supabaseAdmin
      .from("stimulus_directions")
      .select("run_id, line_check")
      .in("run_id", ids);
    const byRun: Record<string, AdaptationFidelity> = {};
    for (const d of dirs ?? []) {
      const lc = d.line_check as AdaptationFidelity | null;
      if (lc && lc.kind === "channel_adaptation_fidelity") byRun[d.run_id] = lc;
    }
    return { byRun };
  });

/** Re-runs the fidelity check against the adaptation already stored. */
export const recheckAdaptationFidelity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: run } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id, session_id, channel_name")
      .eq("id", data.runId)
      .single();
    if (!run) throw new Error("Run not found");
    await assertSessionAccess(run.session_id, context.userId);

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("locked_big_idea, locked_campaign_line, locked_big_idea_lens")
      .eq("id", run.session_id)
      .single();
    if (!session?.locked_big_idea?.trim()) throw new Error("No winning idea is locked.");

    const { data: dir } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, direction")
      .eq("run_id", run.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();
    if (!dir?.direction?.trim()) throw new Error("This channel brief has no stored content.");

    const { checkAndStoreAdaptationFidelity } = await import(
      "./stimulus/adaptation-fidelity.server"
    );
    const fidelity = await checkAndStoreAdaptationFidelity({
      sessionId: run.session_id,
      directionId: dir.id,
      channelName: run.channel_name,
      adaptation: dir.direction,
      lockedIdea: session.locked_big_idea,
      lockedLine: session.locked_campaign_line ?? null,
      lockedLens: session.locked_big_idea_lens ?? null,
    });
    return { fidelity };
  });
