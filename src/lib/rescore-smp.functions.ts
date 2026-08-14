import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { rescoreLockedSmp } from "./rescore-smp.server";

const Input = z.object({ sessionId: z.string().uuid() });

/**
 * Ensures the locked/selected SMP carries its own independent Stage 10 score.
 * Idempotent: returns immediately when a matching score block already exists.
 */
export const ensureLockedSmpScored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    return rescoreLockedSmp(data.sessionId);
  });
