import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SESSION = "22c0ba9b-21af-41ce-8416-a259a4ae4541";
const { data } = await sb
  .from("intelligence_report_versions")
  .select("id, created_at, reason, territory_count, final_report")
  .eq("session_id", SESSION)
  .eq("reason", "before-doc00a-regeneration")
  .order("created_at", { ascending: false })
  .limit(1);
const v = data?.[0];
if (!v) { console.error("no snapshot"); process.exit(1); }
const rep = JSON.parse(v.final_report as string);
console.log("restoring snapshot", v.created_at, "territories", rep.territories.map((t: any) => `${t.id}:${t.name}`));
const { data: cur } = await sb.from("intelligence_sessions").select("report_metadata").eq("id", SESSION).maybeSingle();
const meta = { ...((cur?.report_metadata as Record<string, unknown>) ?? {}) };
delete meta["doc00a_revision"];
delete meta["doc00a_run_ref"];
delete meta["doc00a_regenerated_at"];
delete meta["doc00a_regenerations"];
const { error } = await sb
  .from("intelligence_sessions")
  .update({ final_report: v.final_report, report_metadata: meta, status: "complete", stage_status: "complete:10", last_error: null })
  .eq("id", SESSION);
console.log("restored", error ?? "ok");
