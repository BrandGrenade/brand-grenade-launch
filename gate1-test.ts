import { createClient } from "@supabase/supabase-js";
import { rateDirection, runSeasonedCdPass } from "/dev-server/src/lib/stimulus/rate.server";
import { tiebreakerCandidates, ratingSummaryLine, compositeIndex } from "/dev-server/src/lib/stimulus/rating-score";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = "de40c2e9-85d7-4987-a89a-de85c3457137";

const { data: run } = await db.from("stimulus_runs").select("*").eq("id", RUN).single();
const { data: sess } = await db.from("sessions").select("brand_name, category, stage_18_detonation_line, stage_1_output, selected_smp").eq("id", run!.session_id).single();
const { data: dirs } = await db.from("stimulus_directions").select("id, lens_name, direction, instinct_brief, sort_order, status, rating_status")
  .eq("run_id", RUN).in("status", ["keep","keep_in_play"]).order("sort_order");

console.log("survivors:", dirs!.length);
for (const d of dirs!) {
  if (d.rating_status === "rated") { console.log("already rated", d.lens_name); continue; }
  const t0 = Date.now();
  try {
    const r = await rateDirection({
      brandName: sess!.brand_name, category: sess!.category ?? "", channelName: run!.channel_name,
      smp: run!.smp || sess!.selected_smp || "", strategicTension: (sess!.stage_1_output ?? "").slice(0,3000),
      detonationLine: sess!.stage_18_detonation_line ?? "", lensName: d.lens_name, direction: d.direction ?? "",
      instinctBrief: d.instinct_brief ?? null,
    });
    await db.from("stimulus_directions").update({ ratings: JSON.parse(JSON.stringify(r.ratings)), rating_status: "rated", rating_error: null, rated_at: new Date().toISOString() }).eq("id", d.id);
    console.log(`\n=== ${d.sort_order+1} ${d.lens_name} (${((Date.now()-t0)/1000).toFixed(0)}s) searchCalls=${r.searchCallsObserved}`);
    console.log("queries:", r.observedQueries);
    console.log(ratingSummaryLine(r.ratings), "| index", compositeIndex(r.ratings).toFixed(3));
    console.log("SMP element:", r.ratings.strategic_compliance.smp_element);
    console.log("journey:", r.ratings.strategic_compliance.journey_placement);
    console.log("save-it:", r.ratings.strategic_compliance.what_can_save_it);
    console.log("uniqueness verdict:", r.ratings.creative_uniqueness.verdict.slice(0,300));
    console.log("prior:", JSON.stringify(r.ratings.creative_uniqueness.prior_executions).slice(0,400));
    console.log("ambition:", r.ratings.creative_ambition.judgement.slice(0,220));
    console.log("producibility:", r.ratings.producibility.pass, r.ratings.producibility.note.slice(0,160));
    console.log("integrity flag:", r.ratings.brand_integrity.flag_note);
  } catch (e) { console.log("FAILED", d.lens_name, (e as Error).message.slice(0,300)); }
}

const { data: rated } = await db.from("stimulus_directions").select("id, lens_name, direction, ratings, sort_order").eq("run_id", RUN).eq("rating_status","rated").order("sort_order");
const list = rated!.map(r => ({ ...r, ratings: r.ratings as any }));
console.log("\n--- TIEBREAKER TRIGGER ---");
for (const r of list) console.log(r.sort_order+1, r.lens_name, compositeIndex(r.ratings).toFixed(3));
const dec = tiebreakerCandidates(list);
console.log("fires:", dec.fires, "|", dec.reason);
if (dec.fires) {
  const out = await runSeasonedCdPass({ brandName: sess!.brand_name, channelName: run!.channel_name, smp: run!.smp,
    candidates: dec.candidates.map((c:any) => ({ label: `Direction ${c.sort_order+1}`, lensName: c.lens_name, direction: c.direction, summary: ratingSummaryLine(c.ratings) })) });
  await db.from("stimulus_runs").update({ tiebreaker_output: out, tiebreaker_fired: true, tiebreaker_reason: dec.reason, tiebreaker_at: new Date().toISOString() }).eq("id", RUN);
  console.log("\nCD PASS:\n", out);
}
