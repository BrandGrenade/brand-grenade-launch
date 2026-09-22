import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { buildDocument00AMinto } from "../src/lib/intelligence/doc-00A-minto";
import { researchEvidenceFromSession } from "../src/lib/intelligence/research-evidence";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s } = await sb
  .from("intelligence_sessions")
  .select("*")
  .eq("id", "22c0ba9b-21af-41ce-8416-a259a4ae4541")
  .maybeSingle();
if (!s) { console.error("no session"); process.exit(1); }
const row = s as Record<string, unknown>;
const meta = (row["report_metadata"] ?? {}) as Record<string, unknown>;
const report = JSON.parse(row["final_report"] as string);

console.log("status:", row["status"], "stage:", row["stage_status"]);
console.log("revision:", meta["doc00a_revision"], "runRef:", meta["doc00a_run_ref"], "at:", meta["doc00a_regenerated_at"]);
console.log("primary:", report.recommended_primary_territory_id, "gateway_territory_id:", report.gateway_territory_id);
for (const t of report.territories ?? []) {
  console.log(`  ${t.id} | ${t.name} | rec=${t.strategic_recommendation} | gateway=${t?.timing_sequencing?.is_gateway_territory}`);
}

const html = buildDocument00AMinto({
  sourceRunId: row["id"],
  brandName: row["brand_name"],
  category: row["category"] ?? "",
  briefType: "commercial",
  completedAt: row["completed_at"],
  report,
  research: researchEvidenceFromSession(row as never),
  revision: meta["doc00a_revision"] ?? null,
  runRef: meta["doc00a_run_ref"] ?? null,
  regeneratedAt: meta["doc00a_regenerated_at"] ?? null,
} as never);
writeFileSync("/tmp/doc00a-nissan-rev1.html", html);
console.log("document bytes:", html.length);

const text = html.replace(/<[^>]+>/g, " ");
const count = (re: RegExp) => (text.match(re) || []).length;
console.log("-- language checks (rendered text) --");
console.log("internal culture/staff/employee:", count(/internal culture|staff culture|employee culture|the people building/gi));
console.log("'unoccupied' occurrences:", count(/unoccupied/gi));
console.log("'no evidence' occurrences:", count(/no evidence/gi));
console.log("40,290 (superseded BYD figure):", count(/40,?290/g));
console.log("52,415 (corrected BYD figure):", count(/52,?415/g));
console.log("modelled-estimate labels:", count(/modelled estimate/gi));
console.log("bare unlabelled '18-24 months':", count(/18[-–]24 months(?![^.]{0,80}modelled)/gi));
console.log("revision line present:", /revision 1/i.test(text));
for (const m of text.match(/[^.]*unoccupied[^.]*\./gi) ?? []) console.log("  UNOCCUPIED CTX:", m.trim().slice(0, 220));
