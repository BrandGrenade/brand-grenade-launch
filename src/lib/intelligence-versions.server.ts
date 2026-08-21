// Durable version history for Intelligence Lab reports.
//
// Why this exists: a re-run (session-level "Retry with instructions", a
// watchdog takeover, or a territory revision) overwrites
// intelligence_sessions.final_report in place. Before this module existed the
// only copy of the prior report was a single-use, truncated marker in
// report_metadata that was deleted on completion — so a re-run that returned a
// thinner report destroyed the richer one with no way back.
//
// Every destructive write now snapshots the current report into
// intelligence_report_versions first. Snapshots are content-deduped, so
// repeated calls on the same report do not pile up rows.

export type SnapshotReason =
  | "before-rerun"
  | "before-redirect-rerun"
  | "before-territory-revision"
  | "manual";

export async function snapshotIntelligenceReport(
  sessionId: string,
  reason: SnapshotReason,
): Promise<{ saved: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("intelligence_sessions")
      .select("id, user_id, final_report, report_metadata")
      .eq("id", sessionId)
      .maybeSingle();

    const report = row?.final_report?.trim();
    if (!row || !report) return { saved: false };

    // Content dedupe against the most recent snapshot.
    const { data: latest } = await supabaseAdmin
      .from("intelligence_report_versions")
      .select("final_report")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.final_report === row.final_report) return { saved: false };

    let territoryCount: number | null = null;
    try {
      const parsed = JSON.parse(report) as { territories?: unknown[] };
      territoryCount = Array.isArray(parsed.territories) ? parsed.territories.length : null;
    } catch {
      territoryCount = null;
    }

    await supabaseAdmin.from("intelligence_report_versions").insert({
      session_id: sessionId,
      user_id: row.user_id,
      reason,
      territory_count: territoryCount,
      final_report: row.final_report,
      report_metadata: row.report_metadata,
    } as never);

    return { saved: true };
  } catch (e) {
    // Never let snapshotting break a run — but make the failure visible.
    console.error(`[intelligence-versions] snapshot failed for ${sessionId}`, e);
    return { saved: false };
  }
}
