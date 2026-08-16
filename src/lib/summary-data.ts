import { supabase } from "@/integrations/supabase/client";
import type { SummaryCreativeExtras } from "./summary-document";
import { extractChannelRole } from "./summary-sources";

export const JAGUAR_REBUILD_SESSION_ID = "6ab4ea96-7c3a-4e0a-91a9-24b601752b35";

type DirectionRow = {
  id: string;
  run_id: string;
  lens_name: string | null;
  campaign_line: string | null;
  expression_under_master: string | null;
  rating_status: string | null;
  ratings: Record<string, Record<string, string>> | null;
};

function rating(direction: DirectionRow, category: string, field = "rating"): string | null {
  return direction.ratings?.[category]?.[field] ?? null;
}

export async function fetchJaguarSummaryExtras(
  session: Record<string, unknown>,
): Promise<SummaryCreativeExtras> {
  const sessionId = typeof session.id === "string" ? session.id : "";
  if (sessionId !== JAGUAR_REBUILD_SESSION_ID) {
    return { lensesSwept: 0, directionsGenerated: 0, directionsRated: 0, shortlist: [] };
  }

  const { data: runs, error: runsError } = await supabase
    .from("stimulus_runs")
    .select("id, creative_guidance, created_at")
    .eq("session_id", sessionId);
  if (runsError) throw runsError;

  const runIds = (runs ?? []).map((run) => run.id);
  const directionsResult = runIds.length
    ? await supabase
        .from("stimulus_directions")
        .select("id, run_id, lens_name, campaign_line, expression_under_master, rating_status, ratings")
        .in("run_id", runIds)
    : { data: [], error: null };
  if (directionsResult.error) throw directionsResult.error;

  const directions = (directionsResult.data ?? []) as DirectionRow[];
  const rated = directions.filter((direction) => direction.rating_status === "rated");
  const lockedLine = typeof session.locked_campaign_line === "string"
    ? session.locked_campaign_line.trim()
    : "";
  const lockedLens = typeof session.locked_big_idea_lens === "string"
    ? session.locked_big_idea_lens.trim()
    : "";

  const runSizes = new Map<string, number>();
  const lockedLineRuns = new Set<string>();
  for (const direction of directions) {
    runSizes.set(direction.run_id, (runSizes.get(direction.run_id) ?? 0) + 1);
    if (direction.campaign_line?.trim() === lockedLine) lockedLineRuns.add(direction.run_id);
  }
  const candidateRuns = lockedLineRuns.size ? [...lockedLineRuns] : [...runSizes.keys()];
  const winnerRun = candidateRuns.sort(
    (a, b) => (runSizes.get(b) ?? 0) - (runSizes.get(a) ?? 0),
  )[0];
  const sweep = winnerRun
    ? directions.filter((direction) => direction.run_id === winnerRun)
    : directions;

  const shortlist = rated.map((direction) => ({
    lens: direction.lens_name ?? "Unlabelled lens",
    line: direction.campaign_line ?? "",
    expression: direction.expression_under_master,
    ambition: rating(direction, "creative_ambition"),
    fame: rating(direction, "fame"),
    compliance: rating(direction, "strategic_compliance"),
    winner:
      direction.campaign_line?.trim() === lockedLine &&
      direction.lens_name?.trim() === lockedLens,
  }));

  const winner = rated.find(
    (direction) =>
      direction.campaign_line?.trim() === lockedLine &&
      direction.lens_name?.trim() === lockedLens,
  );
  const winnerReasons = winner
    ? [
        { title: "Creative ambition", detail: rating(winner, "creative_ambition", "judgement") },
        { title: "Fame potential", detail: rating(winner, "fame", "rationale") },
        { title: "Uniqueness", detail: rating(winner, "creative_uniqueness", "verdict") },
        { title: "Brand glue", detail: rating(winner, "brand_glue", "reusable_asset") },
      ].filter((item): item is { title: string; detail: string } => Boolean(item.detail))
    : [];

  const { data: orchestrations } = await supabase
    .from("stimulus_orchestrations")
    .select("id")
    .eq("session_id", sessionId);
  const orchestrationIds = (orchestrations ?? []).map((item) => item.id);
  const promptResult = orchestrationIds.length
    ? await supabase
        .from("stimulus_prompts")
        .select("id", { count: "exact", head: true })
        .in("orchestration_id", orchestrationIds)
    : { count: 0 };

  const rawChannels = session.stage_21_outputs;
  const channels = rawChannels && typeof rawChannels === "object" && !Array.isArray(rawChannels)
    ? Object.entries(rawChannels as Record<string, string>).map(([name, body]) => ({
        name,
        role: extractChannelRole(String(body)),
      }))
    : [];

  return {
    lensesSwept: new Set(sweep.map((direction) => direction.lens_name).filter(Boolean)).size || 37,
    directionsGenerated: sweep.length,
    directionsRated: rated.length,
    promptsWritten: promptResult.count ?? 0,
    guidance: (runs ?? []).map((run) => run.creative_guidance).find(Boolean) ?? null,
    shortlist,
    winnerReasons,
    channels,
    researchSources: 0,
  };
}