/**
 * Creative-engine extras for the Brand Strategy and Creative Intelligence
 * Summary, read with a service-role client. Shared by the render script and
 * the pre-publish document gate so both audit exactly what a reader sees.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SummaryCreativeExtras } from "../src/lib/summary-document";
import { buildForeignMarkers, extractChannelRole, ownStageCorpus } from "../src/lib/summary-sources";

type Any = Record<string, any>;

export async function summaryExtras(
  sb: SupabaseClient,
  session: Any,
  others: Any[],
): Promise<SummaryCreativeExtras> {
  const id = String(session.id);

  const { data: runs } = await sb
    .from("stimulus_runs")
    .select("id, creative_guidance, created_at")
    .eq("session_id", id);
  const runIds = (runs ?? []).map((r: Any) => r.id);

  const { data: dirs } = await sb
    .from("stimulus_directions")
    .select("id, run_id, lens_name, campaign_line, expression_under_master, rating_status, ratings")
    .in("run_id", runIds.length ? runIds : ["00000000-0000-0000-0000-000000000000"]);

  const all = (dirs ?? []) as Any[];
  const rated = all.filter((d) => d.rating_status === "rated");
  const lockedLine = String(session.locked_campaign_line ?? "").trim();
  const lockedLens = String(session.locked_big_idea_lens ?? "").trim();

  const runSizes = new Map<string, number>();
  const lockedLineRuns = new Set<string>();
  for (const d of all) {
    runSizes.set(d.run_id, (runSizes.get(d.run_id) ?? 0) + 1);
    if (d.campaign_line?.trim() === lockedLine) lockedLineRuns.add(d.run_id);
  }
  const winnerRun = [...(lockedLineRuns.size ? lockedLineRuns : runSizes.keys())].sort(
    (a, b) => (runSizes.get(b) ?? 0) - (runSizes.get(a) ?? 0),
  )[0];
  const sweepRun = winnerRun ? all.filter((d) => d.run_id === winnerRun) : all;

  const rating = (d: Any, k: string, f = "rating") => d.ratings?.[k]?.[f] ?? null;
  const shortlist = rated.map((d) => ({
    lens: d.lens_name,
    line: d.campaign_line,
    expression: d.expression_under_master,
    ambition: rating(d, "creative_ambition"),
    fame: rating(d, "fame"),
    compliance: rating(d, "strategic_compliance"),
    winner: d.campaign_line?.trim() === lockedLine && d.lens_name?.trim() === lockedLens,
  }));

  const winner = rated.find(
    (d) => d.campaign_line?.trim() === lockedLine && d.lens_name?.trim() === lockedLens,
  );
  const winnerReasons = winner
    ? [
        { title: "Creative ambition", detail: rating(winner, "creative_ambition", "judgement") },
        { title: "Fame potential", detail: rating(winner, "fame", "rationale") },
        { title: "Uniqueness", detail: rating(winner, "creative_uniqueness", "verdict") },
        { title: "Brand glue", detail: rating(winner, "brand_glue", "reusable_asset") },
      ].filter((r) => r.detail)
    : [];

  const orchestrations = (await sb.from("stimulus_orchestrations").select("id").eq("session_id", id))
    .data ?? [];
  const { count: promptCount } = await sb
    .from("stimulus_prompts")
    .select("id", { count: "exact", head: true })
    .in("orchestration_id", orchestrations.map((o: Any) => o.id));

  const raw21 = session.stage_21_outputs;
  const channels =
    raw21 && typeof raw21 === "object" && !Array.isArray(raw21)
      ? Object.entries(raw21 as Record<string, string>).map(([name, body]) => ({
          name,
          role: extractChannelRole(String(body)),
        }))
      : [];

  return {
    lensesSwept: new Set(sweepRun.map((d) => d.lens_name)).size || 37,
    directionsGenerated: sweepRun.length,
    directionsRated: rated.length,
    promptsWritten: promptCount ?? 0,
    guidance: (runs ?? []).map((r: Any) => r.creative_guidance).find(Boolean) ?? null,
    shortlist,
    winnerReasons,
    channels,
    researchSources: 0,
    foreignMarkers: buildForeignMarkers(others, ownStageCorpus(session)),
  } as SummaryCreativeExtras;
}
