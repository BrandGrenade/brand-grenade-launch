// Attempt history for a creative lens. Each lens holds every take it has been
// given — first output, guided revisions, unguided second tries — and exactly
// one of them is active. Only the active attempt feeds Tissue Check decisions,
// Gate One scoring and everything downstream.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";

const DirectionOnly = z.object({ directionId: z.string().uuid() });

type DirRow = {
  id: string;
  run_id: string;
  lens_id: string;
  direction: string | null;
  revise_count: number | null;
  active_attempt_id: string | null;
};

async function loadDirectionAndRun(directionId: string, userId: string) {
  const { data: dir, error } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id, run_id, lens_id, direction, revise_count, active_attempt_id")
    .eq("id", directionId)
    .single();
  if (error || !dir) throw new Error("Direction not found");

  const { data: run, error: rErr } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, channel_name, channel_brief, smp, run_mode")
    .eq("id", dir.run_id)
    .single();
  if (rErr || !run) throw new Error("Stimulus run not found");
  await assertSessionAccess(run.session_id, userId);
  return { dir: dir as DirRow, run };
}

/** Every saved attempt for a lens, oldest first, with the active one marked. */
export const listDirectionAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DirectionOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { dir } = await loadDirectionAndRun(data.directionId, context.userId);
    const { data: attempts, error } = await supabaseAdmin
      .from("stimulus_direction_attempts")
      .select(
        "id, attempt_no, origin, direction, campaign_line, expression_under_master, master_line_at_generation, rationale, revise_notes, ratings, rating_status, rated_at, created_at",
      )
      .eq("direction_id", dir.id)
      .order("attempt_no", { ascending: true });
    if (error) throw new Error(error.message);
    return { attempts: attempts ?? [], activeAttemptId: dir.active_attempt_id };
  });

/**
 * Try Again — an unguided second take. No notes; the lens is re-run against the
 * same brief and truths and told, explicitly, to produce a genuinely different
 * idea from every attempt already on record.
 */
export const tryAgainStimulusDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DirectionOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { dir, run } = await loadDirectionAndRun(data.directionId, context.userId);
    const { regenerateDirection } = await import("@/lib/stimulus/regenerate.server");
    return regenerateDirection({ direction: dir, run, mode: "try_again" });
  });

/** Explicitly promote a stored attempt to active. Never automatic. */
export const setActiveAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ directionId: z.string().uuid(), attemptId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await loadDirectionAndRun(data.directionId, context.userId);
    const { activateAttempt } = await import("@/lib/stimulus/regenerate.server");
    return activateAttempt(data.directionId, data.attemptId);
  });
