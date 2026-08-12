import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Demo Mode walkthrough — read-only server functions.
 * Auth-scoped: all reads go through the caller's RLS-scoped client, so a
 * user can only walk through sessions they already have access to.
 */

export const listWalkthroughSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSessionsForWalkthrough } = await import("./walkthrough.server");
    return await listSessionsForWalkthrough(context.supabase);
  });

export const getWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { loadWalkthrough } = await import("./walkthrough.server");
    return await loadWalkthrough(context.supabase, data.sessionId);
  });
