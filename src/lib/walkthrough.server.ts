// Data assembly for the Demo Mode walkthrough.
//
// Read-only. Everything here is a SELECT through the caller's own
// (RLS-scoped) Supabase client — the walkthrough can never surface a
// session the signed-in user could not already open in the working tool,
// and it never writes anything.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type IntelligenceRow = Database["public"]["Tables"]["intelligence_sessions"]["Row"];
export type BriefingRow = Database["public"]["Tables"]["briefing_room_workspaces"]["Row"];
export type SynthRow = Database["public"]["Tables"]["synthesiser_runs"]["Row"];
export type StimulusRunRow = Database["public"]["Tables"]["stimulus_runs"]["Row"];
export type DirectionRow = Database["public"]["Tables"]["stimulus_directions"]["Row"];
export type OrchestrationRow = Database["public"]["Tables"]["stimulus_orchestrations"]["Row"];
export type PromptRow = Database["public"]["Tables"]["stimulus_prompts"]["Row"];

export type WalkthroughSessionSummary = {
  id: string;
  brand_name: string;
  category: string;
  current_stage: number;
  status: string;
  created_at: string;
  locked_big_idea: string | null;
  stage_20_output_present: boolean;
};

export type WalkthroughPayload = {
  session: SessionRow;
  intelligence: IntelligenceRow | null;
  briefing: BriefingRow | null;
  synthesiser: SynthRow | null;
  creativeRun: StimulusRunRow | null;
  directions: DirectionRow[];
  orchestration: OrchestrationRow | null;
  prompts: PromptRow[];
};

export async function listSessionsForWalkthrough(
  supabase: DB,
): Promise<WalkthroughSessionSummary[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, brand_name, category, current_stage, status, created_at, locked_big_idea, stage_20_output, is_preflight_test",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => !r.is_preflight_test)
    .map((r) => ({
      id: r.id as string,
      brand_name: (r.brand_name as string) ?? "Untitled",
      category: (r.category as string) ?? "",
      current_stage: (r.current_stage as number) ?? 0,
      status: (r.status as string) ?? "",
      created_at: r.created_at as string,
      locked_big_idea: (r.locked_big_idea as string | null) ?? null,
      stage_20_output_present: Boolean(r.stage_20_output),
    }));
}

/** Pick the sweep run that actually carries the story: locked first, then
 *  the run with the most generated lenses, then most recent. */
function pickCreativeRun(
  runs: StimulusRunRow[],
  counts: Map<string, number>,
  lockedRunId: string | null,
): StimulusRunRow | null {
  if (!runs.length) return null;
  if (lockedRunId) {
    const locked = runs.find((r) => r.id === lockedRunId);
    if (locked) return locked;
  }
  const sorted = [...runs].sort((a, b) => {
    const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return sorted[0] ?? null;
}

export async function loadWalkthrough(supabase: DB, sessionId: string): Promise<WalkthroughPayload> {
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) throw new Error("Session not found, or you do not have access to it.");

  const brand = (session.brand_name ?? "").trim();

  const [intelRes, briefingRes, synthRes, runsRes, orchRes] = await Promise.all([
    supabase
      .from("intelligence_sessions")
      .select("*")
      .ilike("brand_name", brand || "\u0000")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("briefing_room_workspaces")
      .select("*")
      .ilike("brand_name", brand || "\u0000")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("synthesiser_runs")
      .select("*")
      .ilike("brand_name", brand || "\u0000")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("stimulus_runs")
      .select("*")
      .eq("session_id", sessionId)
      .eq("run_mode", "big_idea")
      .order("created_at", { ascending: false }),
    supabase
      .from("stimulus_orchestrations")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const runs = (runsRes.data ?? []) as StimulusRunRow[];
  let directions: DirectionRow[] = [];
  let creativeRun: StimulusRunRow | null = null;

  if (runs.length) {
    const { data: allDirections } = await supabase
      .from("stimulus_directions")
      .select("*")
      .in(
        "run_id",
        runs.map((r) => r.id),
      )
      .order("sort_order", { ascending: true });
    const rows = (allDirections ?? []) as DirectionRow[];
    const counts = new Map<string, number>();
    for (const d of rows) {
      if (d.direction && d.direction.trim()) counts.set(d.run_id, (counts.get(d.run_id) ?? 0) + 1);
    }
    creativeRun = pickCreativeRun(
      runs,
      counts,
      (session.locked_big_idea_run_id as string | null) ?? null,
    );
    directions = creativeRun ? rows.filter((d) => d.run_id === creativeRun!.id) : [];
  }

  const orchestration = ((orchRes.data ?? [])[0] as OrchestrationRow | undefined) ?? null;
  let prompts: PromptRow[] = [];
  if (orchestration) {
    const { data: promptRows } = await supabase
      .from("stimulus_prompts")
      .select("*")
      .eq("orchestration_id", orchestration.id)
      .order("sort_order", { ascending: true });
    prompts = (promptRows ?? []) as PromptRow[];
  }

  const intelligence =
    ((intelRes.data ?? []).find((r) => r.status === "complete" && r.final_report) as
      | IntelligenceRow
      | undefined) ??
    ((intelRes.data ?? [])[0] as IntelligenceRow | undefined) ??
    null;

  const briefing =
    ((briefingRes.data ?? []).find((r) => r.tensions) as BriefingRow | undefined) ??
    ((briefingRes.data ?? [])[0] as BriefingRow | undefined) ??
    null;

  const synthesiser = ((synthRes.data ?? [])[0] as SynthRow | undefined) ?? null;

  return {
    session: session as SessionRow,
    intelligence,
    briefing,
    synthesiser,
    creativeRun,
    directions,
    orchestration,
    prompts,
  };
}
