import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("intelligence_sessions").select("*").eq("id", "22c0ba9b-21af-41ce-8416-a259a4ae4541").single();
const s = data as any;
const all = ["input_primary_consumer","input_brand_health","input_competitive_audit","input_cultural_trends","input_audience_segmentation","input_bg_intel_pack"].map((c) => s[c] ?? "").join("\n");
console.log("FOURPART", (all.match(/Four-Part Research Pass/g) ?? []).length, "EIGHTGAP", (all.match(/eight|Eight-gap|lapsed/gi) ?? []).length, "NAVARA_DOC", (all.match(/Navara heritage|Avis/gi) ?? []).length);
const fr = JSON.parse(s.final_report);
for (const t of fr.territories) {
  const pick: any = {}; for (const k of ["disposition","absorbed_into","type","white_space","brand_permission","first_mover","hermit_crab","cultural_adaptation","audience_readiness","historical_validation","budget_scale_threshold","negative_space_flags","timing_sequencing","longevity_saturation","strategic_recommendation"]) { const v = t[k]; pick[k] = typeof v === "object" && v ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, typeof b === "string" ? b.slice(0, 40) : b])) : (typeof v === "string" ? v.slice(0, 50) : v); }
  console.log("T", t.id, JSON.stringify(pick).slice(0, 1500));
}
const md = s.report_metadata; console.log("REDIRECT", JSON.stringify(md.redirect_log).slice(0, 800));
const { data: jobs } = await supabaseAdmin.from("intelligence_sessions").select("id, created_at, started_at, completed_at").ilike("brand_name", "%nissan%");
console.log("NISSAN_SESSIONS", JSON.stringify(jobs));
