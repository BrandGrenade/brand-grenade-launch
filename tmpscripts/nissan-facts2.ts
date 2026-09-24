import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("intelligence_sessions").select("*").eq("id", "22c0ba9b-21af-41ce-8416-a259a4ae4541").single();
const s = data as any;
const cols = ["input_primary_consumer","input_brand_health","input_competitive_audit","input_cultural_trends","input_audience_segmentation","input_bg_intel_pack"];
const allStatus: Record<string, number> = {}; const docsAll: Record<string, number> = {}; let total = 0;
for (const c of cols) {
  const t: string = s[c] ?? "";
  const entries = t.split(/\n(?=\d+\. )/).filter((e) => /^\d+\. /.test(e));
  const st: Record<string, number> = {}; const docs: Record<string, number> = {};
  for (const e of entries) {
    const m = e.match(/Status:\s*([^\n]+)/i); const k = m ? m[1].trim().slice(0, 40) : "(no status line)";
    st[k] = (st[k] ?? 0) + 1; allStatus[k] = (allStatus[k] ?? 0) + 1;
    for (const d of e.matchAll(/Per ([^,\n]+?\.pdf)/g)) { docs[d[1]] = (docs[d[1]] ?? 0) + 1; }
  }
  total += entries.length;
  console.log("FIELD", c, "entries", entries.length, JSON.stringify(st), JSON.stringify(docs));
  for (const [d, n] of Object.entries(docs)) docsAll[d] = (docsAll[d] ?? 0) + n;
}
console.log("TOTAL_ENTRIES", total, JSON.stringify(allStatus)); console.log("DOCS", JSON.stringify(docsAll));
console.log("SAMPLE", (s.input_brand_health as string).slice(0, 900));
const fr = JSON.parse(s.final_report);
console.log("REPORT_KEYS", Object.keys(fr));
const terr = fr.territories ?? fr.ranked_territories ?? [];
console.log("TERR_COUNT", terr.length);
if (terr[0]) { console.log("TERR_KEYS", Object.keys(terr[0])); for (const t of terr) console.log("T", t.territory_id ?? t.id, "|", t.territory_name ?? t.name, "|", t.territory_type, "|", short(t.scores ?? t.scoring ?? t.score)); }
function short(v: unknown) { const j = JSON.stringify(v); return j && j.length > 400 ? j.slice(0, 400) + "…" : j; }
console.log("COMPLETENESS", short(fr.completeness_assessment));
const md = s.report_metadata; console.log("META", short({ revisions: md.territory_revisions?.length, redirects: md.redirect_log?.length, regen: md.doc00a_regenerations?.length, rev: md.doc00a_revision, ref: md.doc00a_run_ref, count: md.territory_count }));
console.log("REDIRECT_TIMES", JSON.stringify((md.redirect_log ?? []).map((r: any) => r.at)));
console.log("REV_TIMES", short((md.territory_revisions ?? []).map((r: any) => ({ at: r.at ?? r.revised_at, id: r.territory_id }))));
console.log("REGEN", short(md.doc00a_regenerations));
