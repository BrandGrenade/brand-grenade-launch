// Fetches the Intelligence Lab context used by the Strategy Executive Summary:
// the Briefing Room governing tension (handoff payload) and the Intelligence
// Lab executive summary. Returns empty values when no run exists for the brand.

import { supabase } from "@/integrations/supabase/client";
import { normalizeBrand } from "./brand-register";
import type { ExecSummaryIntel } from "./exec-summary-document";

export async function fetchExecSummaryIntel(
  brand: string,
): Promise<ExecSummaryIntel> {
  const key = normalizeBrand(brand);
  if (!key) return {};
  try {
    const res = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("intelligence_sessions" as any)
      .select("brand_name,status,updated_at,handoff_payload,report_metadata")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (res.error) return {};
    const rows = ((res.data ?? []) as unknown) as Array<{
      brand_name: string | null;
      status: string | null;
      handoff_payload: unknown;
      report_metadata: unknown;
    }>;
    const match = rows.find(
      (r) => normalizeBrand(r.brand_name) === key && r.status === "complete",
    );
    if (!match) return {};
    const handoff = match.handoff_payload as
      | { prebrief?: { tension?: string | null } }
      | null;
    const meta = match.report_metadata as
      | { executive_summary?: string | null }
      | null;
    return {
      tension: handoff?.prebrief?.tension ?? null,
      executiveSummary: meta?.executive_summary ?? null,
    };
  } catch {
    return {};
  }
}
