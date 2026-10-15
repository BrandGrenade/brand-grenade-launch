// Room 00 activity log. Optional room, so every write is best-effort: a
// failure here must never block the user from continuing into the
// Intelligence Lab.

import { supabase } from "@/integrations/supabase/client";
import { hubColumns } from "@/lib/hub/context";
import { SYNTHESISER_CATEGORIES, type SynthesisedClaim } from "@/lib/synthesiser/types";

const HEADING = new Map(SYNTHESISER_CATEGORIES.map((c) => [c.key, c.title]));

/** One record per claim per heading it appears under, in text-block order. */
export function claimRecords(runId: string, claims: SynthesisedClaim[]) {
  const rows: Array<{ synthesiser_run_id: string; heading: string; claim_text: string; label: SynthesisedClaim["status"]; source: string | null; source_date: null; position: number }> = [];
  for (const cat of SYNTHESISER_CATEGORIES) {
    for (const c of claims) {
      if (!c.categories.includes(cat.key)) continue;
      rows.push({ synthesiser_run_id: runId, heading: HEADING.get(cat.key)!, claim_text: c.claim, label: c.status, source: c.sourceDocument || null, source_date: null, position: rows.length + 1 });
    }
  }
  return rows;
}

async function storeClaims(runId: string, claims: SynthesisedClaim[]) {
  const { data: run } = await supabase.from("synthesiser_runs").select("claims_stored").eq("id", runId).maybeSingle();
  if (!run || run.claims_stored) return;
  const rows = claimRecords(runId, claims);
  if (rows.length) {
    const { error } = await supabase.from("synthesiser_claims").insert(rows);
    if (error) return;
  }
  await supabase.from("synthesiser_runs").update({ claims_stored: true }).eq("id", runId);
}

export type SynthesiserRunStatus = "in_progress" | "applied";

/**
 * Records (or updates) the current user's Research Synthesiser run for a
 * brand. Returns the row id so a later "applied" write can update the same
 * row rather than creating a second one.
 */
export async function recordSynthesiserRun(input: {
  id?: string | null;
  brandName: string;
  category: string | null;
  status: SynthesiserRunStatus;
  claimCount: number;
  claims?: SynthesisedClaim[];
}): Promise<string | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;

    const patch = {
      brand_name: input.brandName,
      category: input.category,
      status: input.status,
      claim_count: input.claimCount,
      applied_at: input.status === "applied" ? new Date().toISOString() : null,
    };

    if (input.id) {
      const { error } = await supabase
        .from("synthesiser_runs")
        .update(patch)
        .eq("id", input.id);
      if (error) return input.id;
      if (input.status === "applied" && input.claims) await storeClaims(input.id, input.claims);
      return input.id;
    }

    const { data, error } = await supabase
      .from("synthesiser_runs")
      .insert({ ...patch, ...hubColumns(), user_id: userId })
      .select("id")
      .single();
    if (error || !data) return null;
    if (input.status === "applied" && input.claims) await storeClaims(data.id, input.claims);
    return data.id;
  } catch {
    return null;
  }
}
