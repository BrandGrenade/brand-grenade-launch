import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TerritoryReviseInput = z.object({
  intelligenceSessionId: z.string().uuid(),
  territoryId: z.string().min(1).max(64),
  instructions: z.string().trim().min(3).max(8000),
});

/** Regenerate one territory against a free-text human redirect. */
export const reviseIntelligenceTerritory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TerritoryReviseInput.parse(input))
  .handler(async ({ data, context }): Promise<{ started: true }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("intelligence_sessions")
      .select("id, user_id, status, final_report")
      .eq("id", data.intelligenceSessionId)
      .maybeSingle();
    if (error || !row) throw new Error("Intelligence session not found");
    if (row.user_id !== userId) throw new Error("Unauthorised");
    if (!row.final_report) throw new Error("This session has no report to revise yet");
    if (row.status === "running") throw new Error("A run is already in progress for this session");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("intelligence_sessions")
      .update({
        status: "running",
        stage_status: `revising:${data.territoryId}`,
        last_error: null,
      })
      .eq("id", data.intelligenceSessionId);

    const { scheduleBackground } = await import("./background.server");
    const { reviseTerritoryRun } = await import("./intelligence-revise.server");
    scheduleBackground(
      reviseTerritoryRun({
        sessionId: data.intelligenceSessionId,
        territoryId: data.territoryId,
        instructions: data.instructions,
      }),
      `intelligence-revise:${data.intelligenceSessionId}`,
    );
    return { started: true };
  });
