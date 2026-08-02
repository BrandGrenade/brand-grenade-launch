import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";

/**
 * A stage is considered stalled when its heartbeat has not been refreshed
 * for this long. Stage runners beat every ~30s while streaming, so two
 * minutes of silence means the worker is gone, not merely slow.
 */
export const STALE_MS = 2 * 60 * 1000;

/**
 * Mark a stage as in-flight on the session. Called at the start of every
 * stage runner so we can detect interruptions on resume.
 */
export const beginStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sessionId: z.string().uuid(), stageId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("sessions")
      .update({
        status: "running",
        stage_status: `running:${data.stageId}`,
        interrupted_stage: null,
        interrupted_at: null,
        stage_started_at: now,
        last_heartbeat_at: now,
      })
      .eq("id", data.sessionId);
    return { ok: true };
  });

/**
 * Refresh the liveness heartbeat for an in-flight stage. Cheap enough to
 * call on every stream delta batch; interruption detection reads it.
 */
export const beatStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    await supabaseAdmin
      .from("sessions")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", data.sessionId);
    return { ok: true };
  });

/**
 * Detects an interrupted stage on session resume. If the session's
 * stage_status indicates a stage was in-flight and the heartbeat is stale,
 * mark it interrupted and surface the affected stage id.
 *
 * Staleness is measured from last_heartbeat_at where present and falls back
 * to updated_at for sessions that predate the heartbeat column.
 */
export const detectInterruption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_status, updated_at, last_heartbeat_at, status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error || !row) return { interrupted: false as const };
    const s = row.stage_status ?? "";
    if (!s.startsWith("running:")) return { interrupted: false as const };
    const beat = new Date(row.last_heartbeat_at ?? row.updated_at).getTime();
    if (Date.now() - beat < STALE_MS) return { interrupted: false as const };
    const stageId = s.slice("running:".length);
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("sessions")
      .update({
        status: "interrupted",
        stage_status: `interrupted:${stageId}`,
        interrupted_stage: parseInt(stageId, 10) || null,
        interrupted_at: now,
      })
      .eq("id", data.sessionId);
    return { interrupted: true as const, stageId };
  });

/**
 * Per-stage retry dispatcher. Clears the interrupted markers, bumps the
 * retry counter and hands the caller the stage id to re-run. Stage output
 * clearing itself stays with resetStage / resetStageCascade in
 * retry.functions.ts — this function decides *what* to retry and records it.
 */
export const retryInterruptedStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ sessionId: z.string().uuid(), stageId: z.string().min(1).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_status, interrupted_stage, retry_count")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error || !row) throw new Error("Session not found");

    const fromStatus = (row.stage_status ?? "").includes(":")
      ? (row.stage_status ?? "").split(":")[1]
      : "";
    const stageId =
      data.stageId ??
      (fromStatus ||
        (row.interrupted_stage != null ? String(row.interrupted_stage) : ""));

    if (!stageId) throw new Error("No interrupted stage to retry on this session.");

    const retryCount = (row.retry_count ?? 0) + 1;
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        status: "running",
        stage_status: `running:${stageId}`,
        interrupted_stage: null,
        interrupted_at: null,
        retry_count: retryCount,
        stage_started_at: now,
        last_heartbeat_at: now,
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to arm retry: ${updateErr.message}`);

    return { stageId, retryCount };
  });
