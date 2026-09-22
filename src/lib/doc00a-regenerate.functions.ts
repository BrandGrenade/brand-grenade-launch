import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RegenerateInput = z.object({
  intelligenceSessionId: z.string().uuid(),
  /** Absorptions, exclusions and corrections to apply to this regeneration. */
  instructions: z.string().trim().max(8000).optional(),
  territoryIds: z.array(z.string().min(1).max(64)).max(20).optional(),
});

/**
 * Regenerate Document 00A from the session's current state. The document is
 * rendered from the stored report, so this reconciles the stored report itself
 * against downstream Briefing Room state and operator directives, then stamps
 * the result with its own run reference.
 */
export const regenerateDocument00A = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RegenerateInput.parse(input))
  .handler(async ({ data, context }): Promise<{ started: true }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("intelligence_sessions")
      .select("id, user_id, status, final_report, report_metadata")
      .eq("id", data.intelligenceSessionId)
      .maybeSingle();
    if (error || !row) throw new Error("Intelligence session not found");
    if (row.user_id !== userId) throw new Error("Unauthorised");
    if (!row.final_report) throw new Error("This session has no report to regenerate yet");
    if (row.status === "running") throw new Error("A run is already in progress for this session");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta =
      row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
        ? (row.report_metadata as Record<string, unknown>)
        : {};

    // Persist the request before dispatch: if the background invocation is
    // lost, the instruction is still on the row rather than in a dead Worker.
    await supabaseAdmin
      .from("intelligence_sessions")
      .update({
        status: "running",
        stage_status: "doc00a:0/0",
        last_error: null,
        report_metadata: {
          ...meta,
          pending_doc00a_regeneration: {
            instructions: data.instructions ?? null,
            territory_ids: data.territoryIds ?? null,
            requested_at: new Date().toISOString(),
          },
        },
      } as never)
      .eq("id", data.intelligenceSessionId);

    const { scheduleBackground } = await import("./background.server");
    const { regenerateDocument00ARun } = await import("./doc00a-regenerate.server");
    scheduleBackground(
      regenerateDocument00ARun({
        sessionId: data.intelligenceSessionId,
        instructions: data.instructions,
        territoryIds: data.territoryIds,
      }).then(async (res) => {
        try {
          const { data: cur } = await supabaseAdmin
            .from("intelligence_sessions")
            .select("report_metadata")
            .eq("id", data.intelligenceSessionId)
            .maybeSingle();
          const m =
            cur?.report_metadata && typeof cur.report_metadata === "object" && !Array.isArray(cur.report_metadata)
              ? { ...(cur.report_metadata as Record<string, unknown>) }
              : {};
          delete m["pending_doc00a_regeneration"];
          await supabaseAdmin
            .from("intelligence_sessions")
            .update({ report_metadata: m } as never)
            .eq("id", data.intelligenceSessionId);
        } catch {
          /* best effort */
        }
        return res;
      }),
      `doc00a-regenerate:${data.intelligenceSessionId}`,
    );

    return { started: true };
  });
