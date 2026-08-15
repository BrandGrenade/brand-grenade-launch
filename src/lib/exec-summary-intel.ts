// Fetches the Intelligence Lab context used by the Strategy Executive Summary:
// the Briefing Room governing tension (handoff payload) and the Intelligence
// Lab executive summary. Returns empty values when no run exists for the brand.

import { supabase } from "@/integrations/supabase/client";
import type { ExecSummaryIntel } from "./exec-summary-document";
import { intelligenceSourceIdFromBrief } from "./document-source-authority";

export async function fetchExecSummaryIntel(
  briefText: string | null | undefined,
): Promise<ExecSummaryIntel> {
  const sourceId = intelligenceSourceIdFromBrief(briefText);
  if (!sourceId) return {};
  try {
    const res = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("intelligence_sessions" as any)
      .select("id,brand_name,status,updated_at,completed_at,handoff_payload,report_metadata")
      .eq("id", sourceId)
      .eq("status", "complete")
      .maybeSingle();
    if (res.error) return {};
    const match = res.data as unknown as {
      id: string;
      brand_name: string | null;
      status: string | null;
      completed_at: string | null;
      handoff_payload: unknown;
      report_metadata: unknown;
    } | null;
    if (!match) return {};
    const handoff = match.handoff_payload as
      | { prebrief?: { tension?: string | null } }
      | null;
    const meta = match.report_metadata as
      | { executive_summary?: string | null }
      | null;
    return {
      sourceRunId: match.id,
      sourceCompletedAt: match.completed_at,
      tension: handoff?.prebrief?.tension ?? null,
      executiveSummary: meta?.executive_summary ?? null,
    };
  } catch {
    return {};
  }
}
