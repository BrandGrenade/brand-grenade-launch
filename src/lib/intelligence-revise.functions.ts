import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TerritoryReviseInput = z.object({
  intelligenceSessionId: z.string().uuid(),
  territoryId: z.string().min(1).max(64),
  instructions: z.string().trim().min(3).max(8000),
  /** "replace" swaps this one territory for a different one; the rest of the report is untouched. */
  mode: z.enum(["revise", "replace"]).optional(),
});

/** Regenerate one territory against a free-text human redirect. */
export const reviseIntelligenceTerritory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TerritoryReviseInput.parse(input))
  .handler(async ({ data, context }): Promise<{ started: true }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("intelligence_sessions")
      .select("id, user_id, status, final_report, report_metadata")
      .eq("id", data.intelligenceSessionId)
      .maybeSingle();
    if (error || !row) throw new Error("Intelligence session not found");
    if (row.user_id !== userId) throw new Error("Unauthorised");
    if (!row.final_report) throw new Error("This session has no report to revise yet");
    if (row.status === "running") throw new Error("A run is already in progress for this session");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Persist the request itself BEFORE dispatch. If the background invocation
    // is lost (Worker torn down before the continuation runs), the watchdog has
    // no other way to know what the human asked for — without this the revision
    // is silently dropped and the user must retype the instruction.
    const meta =
      row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
        ? (row.report_metadata as Record<string, unknown>)
        : {};

    const mode = data.mode === "replace" ? "replace" : "revise";

    await supabaseAdmin
      .from("intelligence_sessions")
      .update({
        status: "running",
        stage_status: `revising:${data.territoryId}`,
        last_error: null,
        report_metadata: {
          ...meta,
          pending_revision: {
            territory_id: data.territoryId,
            instructions: data.instructions,
            mode,
            requested_at: new Date().toISOString(),
          },
        },
      } as never)
      .eq("id", data.intelligenceSessionId);

    const { scheduleBackground } = await import("./background.server");
    const { reviseTerritoryRun } = await import("./intelligence-revise.server");
    scheduleBackground(
      reviseTerritoryRun({
        sessionId: data.intelligenceSessionId,
        territoryId: data.territoryId,
        instructions: data.instructions,
        mode,
      }),
      `intelligence-revise:${data.intelligenceSessionId}`,
    );
    return { started: true };
  });
