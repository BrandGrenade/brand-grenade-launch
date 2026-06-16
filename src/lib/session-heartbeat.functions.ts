import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";

const STALE_MS = 2 * 60 * 1000; // 2 minutes

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
    await supabaseAdmin
      .from("sessions")
      .update({
        status: "running",
        stage_status: `running:${data.stageId}`,
        interrupted_stage: null,
      })
      .eq("id", data.sessionId);
    return { ok: true };
  });

/**
 * Detects an interrupted stage on session resume. If the session's
 * stage_status indicates a stage was in-flight and updated_at is stale,
 * mark it interrupted and surface the affected stage id.
 */
export const detectInterruption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_status, updated_at, status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error || !row) return { interrupted: false as const };
    const s = row.stage_status ?? "";
    if (!s.startsWith("running:")) return { interrupted: false as const };
    const updatedAt = new Date(row.updated_at).getTime();
    if (Date.now() - updatedAt < STALE_MS) return { interrupted: false as const };
    const stageId = s.slice("running:".length);
    await supabaseAdmin
      .from("sessions")
      .update({
        status: "interrupted",
        stage_status: `interrupted:${stageId}`,
        interrupted_stage: parseInt(stageId, 10) || null,
      })
      .eq("id", data.sessionId);
    return { interrupted: true as const, stageId };
  });
