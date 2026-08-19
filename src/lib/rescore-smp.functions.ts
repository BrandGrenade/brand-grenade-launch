import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { ensureSmpScored, peekSmpScored, rescoreLockedSmp } from "./rescore-smp.server";
import { scheduleBackground } from "./background.server";

const Input = z.object({ sessionId: z.string().uuid() });

/**
 * Ensures the locked/selected SMP carries its own independent Stage 10 score.
 *
 * NON-BLOCKING (Issue 1). Opening a document used to run three live Claude
 * scoring passes end-to-end before anything rendered. The score is cached in
 * stage_10_output against the exact proposition text, so this now:
 *   · returns immediately when that cache hits (the common case),
 *   · schedules the scoring pass in the background and returns "scheduled"
 *     when the proposition has changed or was never scored.
 * The caller renders straight away and shows the "scheduled" state as a
 * visible status message.
 */
export const ensureLockedSmpScored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const peek = await peekSmpScored(data.sessionId);
    if (!peek.scoreable) return { status: "skipped" as const };
    if (peek.scored) return { status: "already_scored" as const };
    scheduleBackground(ensureSmpScored(data.sessionId), "smp-rescore");
    return { status: "scheduled" as const };
  });

/** Explicit, blocking re-score. Only for admin/repair paths, never a document open. */
export const rescoreLockedSmpNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    return rescoreLockedSmp(data.sessionId);
  });
