// Room 00 activity log. Optional room, so every write is best-effort: a
// failure here must never block the user from continuing into the
// Intelligence Lab.

import { supabase } from "@/integrations/supabase/client";
import { hubColumns, readHubContext } from "@/lib/hub/context";
import { SYNTHESISER_CATEGORIES, type SynthesisedClaim } from "@/lib/synthesiser/types";
import { sourceDateFromExtraction } from './source-date';

const HEADING = new Map(SYNTHESISER_CATEGORIES.map((c) => [c.key, c.title]));

/** One record per exact claim; all category headings retained on that row. */
export function claimRecords(runId: string, claims: SynthesisedClaim[]) {
  const rows: Array<{ synthesiser_run_id: string; heading: string; claim_text: string; label: SynthesisedClaim["status"]; source: string | null; source_date: string | null; position: number }> = [];
  for (const c of claims) {
    const existing = rows.find(r => r.claim_text === c.claim);
    const headings = SYNTHESISER_CATEGORIES.filter(cat => c.categories.includes(cat.key)).map(cat => HEADING.get(cat.key) ?? cat.title);
    if (existing) {
      existing.heading = [...new Set([...existing.heading.split('; '), ...headings])].join('; ');
      continue;
    }
    rows.push({ synthesiser_run_id: runId, heading: headings.join('; ') || 'Brand Grenade Intelligence Pack', claim_text: c.claim, label: c.status, source: c.sourceDocument || null, source_date: sourceDateFromExtraction(c.sourceDate), position: rows.length + 1 });
  }
  return rows;
}

async function storeClaims(runId: string, claims: SynthesisedClaim[]) {
  const { data: run } = await supabase.from("synthesiser_runs").select("claims_stored").eq("id", runId).maybeSingle();
  if (!run || run.claims_stored) return;
  const rows = claimRecords(runId, claims);
  if (rows.length) {
    const save = () => supabase.from("synthesiser_claims").upsert(rows, { onConflict: "synthesiser_run_id,position", ignoreDuplicates: true });
    let { error } = await save();
    if (error) ({ error } = await save());
    if (error) {
      // Never block the user, but never fail silently either: the error is
      // recorded on the run so the missing claims are visible and repairable.
      await supabase
        .from("synthesiser_runs")
        .update({ claims_error: `Platform structured-data save error after retry: ${error.message}` })
        .eq("id", runId);
      return;
    }
  }
  await supabase.from("synthesiser_runs").update({ claims_stored: true, claims_error: null }).eq("id", runId);
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
  /** Optional client/engagement chosen on the start form; linked via the database. */
  link?: { clientId: string; engagementId: string } | null;
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

    const hub = readHubContext();
    if (hub) {
      const { data: client, error } = await supabase.rpc("bg_lookup_hub_client", { _hub_client_id: hub.client });
      if (error || !client?.[0]) return null;
    }
    const { data, error } = await supabase
      .from("synthesiser_runs")
      .insert({ ...patch, ...hubColumns(), user_id: userId })
      .select("id")
      .single();
    if (error || !data) return null;
    if (!hub && input.link?.clientId && input.link?.engagementId) {
      await supabase.rpc("bg_user_link_run", {
        _table: "synthesiser_runs",
        _run_id: data.id,
        _client: input.link.clientId,
        _engagement: input.link.engagementId,
      });
    }
    if (input.status === "applied" && input.claims) await storeClaims(data.id, input.claims);
    return data.id;
  } catch {
    return null;
  }
}
