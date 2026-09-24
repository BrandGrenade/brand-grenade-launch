import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data: runs } = await supabaseAdmin.from("synthesiser_runs").select("*").ilike("brand_name", "%nissan%");
console.log("SYNTH_RUNS", JSON.stringify(runs, null, 1));
const { data: s } = await supabaseAdmin.from("intelligence_sessions").select("*").eq("id", "22c0ba9b-21af-41ce-8416-a259a4ae4541").single();
const cols = ["territory_input","additional_context","input_primary_consumer","input_brand_health","input_competitive_audit","input_cultural_trends","input_audience_segmentation","input_bg_intel_pack"];
for (const c of cols) { const t = (s as any)[c] ?? ""; console.log(c, "chars=", t.length, "urls=", new Set(t.match(/https?:\/\/[^\s)\]]+/g) ?? []).size, "sourceTags=", (t.match(/\[?Source:/gi) ?? []).length); }
const all = cols.map((c) => (s as any)[c] ?? "").join("\n");
const urls = [...new Set(all.match(/https?:\/\/[^\s)\]]+/g) ?? [])];
console.log("UNIQUE_URLS", urls.length); console.log(urls.join("\n"));
const src = [...new Set((all.match(/Source:\s*([^\]\n;]+)/gi) ?? []).map((x) => x.replace(/Source:\s*/i, "").trim()))];
console.log("UNIQUE_SOURCE_NAMES", src.length); console.log(src.slice(0, 80).join("\n"));
console.log("META_KEYS", Object.keys((s as any).report_metadata ?? {}));
