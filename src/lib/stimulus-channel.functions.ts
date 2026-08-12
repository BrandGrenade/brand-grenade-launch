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

/** Saves a hand-edited content creation input prompt as a new version. */
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
    return saveEditedAdaptation({
      sessionId: run.session_id,
      runId: run.id,
      directionId: data.directionId,
      channelName: run.channel_name,
      text: data.text,
      userId: context.userId,
    });
  });

/** Full version history for one content creation input prompt. */
export const listPromptVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), directionId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: run } = await supabaseAdmin
      .from("stimulus_runs")
      .select("session_id")
      .eq("id", data.runId)
      .single();
    if (!run) throw new Error("Run not found");
    await assertSessionAccess(run.session_id, context.userId);
    const { listPromptVersionsFor } = await import("./stimulus/prompt-versions.server");
    return { versions: await listPromptVersionsFor(data.directionId) };
  });

/**
 * Reverts to an earlier version by writing its text forward as a new version —
 * history is never destroyed, and the restored text is fidelity-checked again.
 */
export const revertPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        directionId: z.string().uuid(),
        versionId: z.string().uuid(),
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

    const { data: version } = await supabaseAdmin
      .from("channel_prompt_versions")
      .select("text")
      .eq("id", data.versionId)
      .eq("direction_id", data.directionId)
      .single();
    if (!version?.text) throw new Error("That version could not be found.");

    const { saveEditedAdaptation } = await import("./stimulus/channel-adaptation.server");
    const r = await saveEditedAdaptation({
      sessionId: run.session_id,
      runId: run.id,
      directionId: data.directionId,
      channelName: run.channel_name,
      text: version.text,
      userId: context.userId,
      origin: "reverted",
    });
    return { ...r, text: version.text };
  });

/** Generates the human-facing Offline Creative Brief for one channel. */
export const generateOfflineCreativeBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { runOfflineCreativeBrief } = await import("./stimulus/offline-brief.server");
    return runOfflineCreativeBrief({
      sessionId: data.sessionId,
      userId: context.userId,
      channelName: data.channelName,
    });
  });

/** The latest Offline Creative Brief per channel for a session. */
export const listOfflineCreativeBriefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: runs } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id, channel_name, status, error, created_at")
      .eq("session_id", data.sessionId)
      .eq("run_mode", "offline_creative_brief")
      .order("created_at", { ascending: false });
    const ids = (runs ?? []).map((r) => r.id);
    const byChannel: Record<string, { runId: string; text: string; createdAt: string }> = {};
    if (ids.length > 0) {
      const { data: dirs } = await supabaseAdmin
        .from("stimulus_directions")
        .select("run_id, direction")
        .in("run_id", ids);
      const textByRun = new Map((dirs ?? []).map((d) => [d.run_id, d.direction ?? ""]));
      for (const r of runs ?? []) {
        if (byChannel[r.channel_name]) continue; // newest wins
        const text = textByRun.get(r.id) ?? "";
        if (!text.trim()) continue;
        byChannel[r.channel_name] = { runId: r.id, text, createdAt: r.created_at };
      }
    }
    return { byChannel };
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

// ------------------------------------------------------------------ Gate One
// Orchestration consumes Gate One-confirmed content creation input prompts.
// For these artefacts a channel has exactly one prompt, so "Gate One" is a
// single confirm per channel rather than a pick-from-many approval.

/** The newest content-creation-prompt run per channel, with its Gate One state. */
export const listChannelGateOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: runs } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id, channel_name, gate_one_confirmed, gate_one_confirmed_at, created_at")
      .eq("session_id", data.sessionId)
      .eq("run_mode", "channel_adaptation")
      .order("created_at", { ascending: false });
    const byChannel: Record<
      string,
      { runId: string; confirmed: boolean; confirmedAt: string | null }
    > = {};
    for (const r of runs ?? []) {
      if (byChannel[r.channel_name]) continue; // newest wins
      byChannel[r.channel_name] = {
        runId: r.id,
        confirmed: Boolean(r.gate_one_confirmed),
        confirmedAt: r.gate_one_confirmed_at ?? null,
      };
    }
    return { byChannel };
  });

/**
 * Confirms Gate One on the newest prompt for each named channel (all channels
 * when none are named). Older runs for the same channel are un-confirmed so
 * orchestration can never pick up a superseded prompt.
 */
export const confirmChannelGateOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        channels: z.array(z.string().min(1)).optional(),
        confirmed: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);

    const { data: runs } = await supabaseAdmin
      .from("stimulus_runs")
      .select("id, channel_name, created_at")
      .eq("session_id", data.sessionId)
      .eq("run_mode", "channel_adaptation")
      .order("created_at", { ascending: false });

    const wanted = data.channels ? new Set(data.channels) : null;
    const newest = new Map<string, string>();
    const superseded: string[] = [];
    for (const r of runs ?? []) {
      if (wanted && !wanted.has(r.channel_name)) continue;
      if (newest.has(r.channel_name)) superseded.push(r.id);
      else newest.set(r.channel_name, r.id);
    }
    if (newest.size === 0) throw new Error("No content creation input prompts to confirm.");

    const now = new Date().toISOString();
    const confirmedChannels: string[] = [];
    const skipped: { channel: string; reason: string }[] = [];

    for (const [channel, runId] of newest) {
      const { data: dir } = await supabaseAdmin
        .from("stimulus_directions")
        .select("id, direction")
        .eq("run_id", runId)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!dir?.direction?.trim()) {
        skipped.push({ channel, reason: "no finished prompt on this channel yet" });
        continue;
      }
      await supabaseAdmin
        .from("stimulus_directions")
        .update({
          gate_one_approved: data.confirmed,
          gate_one_approved_at: data.confirmed ? now : null,
        })
        .eq("id", dir.id);
      await supabaseAdmin
        .from("stimulus_runs")
        .update({
          gate_one_confirmed: data.confirmed,
          gate_one_confirmed_at: data.confirmed ? now : null,
        })
        .eq("id", runId);
      confirmedChannels.push(channel);
    }

    if (superseded.length > 0) {
      await supabaseAdmin
        .from("stimulus_runs")
        .update({ gate_one_confirmed: false, gate_one_confirmed_at: null })
        .in("id", superseded);
      await supabaseAdmin
        .from("stimulus_directions")
        .update({ gate_one_approved: false, gate_one_approved_at: null })
        .in("run_id", superseded);
    }

    return { confirmed: confirmedChannels, skipped, confirmedAt: data.confirmed ? now : null };
  });
