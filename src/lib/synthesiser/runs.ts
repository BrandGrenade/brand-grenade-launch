// Room 00 activity log. Optional room, so every write is best-effort: a
// failure here must never block the user from continuing into the
// Intelligence Lab.

import { supabase } from "@/integrations/supabase/client";

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
      return input.id;
    }

    const { data, error } = await supabase
      .from("synthesiser_runs")
      .insert({ ...patch, user_id: userId })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}
