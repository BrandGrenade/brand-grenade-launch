import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SessionInput = z.object({ intelligenceSessionId: z.string().uuid() });
const RestoreInput = z.object({
  intelligenceSessionId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export interface IntelligenceVersionRow {
  id: string;
  reason: string;
  territory_count: number | null;
  created_at: string;
  chars: number;
}

/** Prior saved versions of this session's report, newest first. */
export const listIntelligenceVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SessionInput.parse(input))
  .handler(async ({ data, context }): Promise<{ versions: IntelligenceVersionRow[] }> => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("intelligence_report_versions")
      .select("id, reason, territory_count, created_at, final_report")
      .eq("session_id", data.intelligenceSessionId)
      .order("created_at", { ascending: false })
      .limit(25);

    return {
      versions: (rows ?? []).map((r) => ({
        id: r.id,
        reason: r.reason,
        territory_count: r.territory_count,
        created_at: r.created_at,
        chars: r.final_report?.length ?? 0,
      })),
    };
  });

/** Restore a saved version as the live report (snapshotting the current one first). */
export const restoreIntelligenceVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestoreInput.parse(input))
  .handler(async ({ data, context }): Promise<{ restored: true }> => {
    const { supabase, userId } = context;

    const { data: session } = await supabase
      .from("intelligence_sessions")
      .select("id, user_id, status")
      .eq("id", data.intelligenceSessionId)
      .maybeSingle();
    if (!session) throw new Error("Intelligence session not found");
    if (session.user_id !== userId) throw new Error("Unauthorised");
    if (session.status === "running") throw new Error("A run is in progress — wait for it to finish");

    const { data: version } = await supabase
      .from("intelligence_report_versions")
      .select("id, session_id, final_report, report_metadata")
      .eq("id", data.versionId)
      .maybeSingle();
    if (!version || version.session_id !== data.intelligenceSessionId) {
      throw new Error("Version not found for this session");
    }

    const { snapshotIntelligenceReport } = await import("./intelligence-versions.server");
    await snapshotIntelligenceReport(data.intelligenceSessionId, "manual");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("intelligence_sessions")
      .update({
        final_report: version.final_report,
        report_metadata: version.report_metadata,
        status: "complete",
        stage_status: "complete:10",
        current_layer: 10,
        last_error: null,
      } as never)
      .eq("id", data.intelligenceSessionId);

    return { restored: true };
  });
