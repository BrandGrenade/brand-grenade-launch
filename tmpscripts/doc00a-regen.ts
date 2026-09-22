import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { buildDocument00AMinto } from "../src/lib/intelligence/doc-00A-minto";
import { researchEvidenceFromSession } from "../src/lib/intelligence/research-evidence";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s } = await sb.from("intelligence_sessions").select("*").eq("id","22c0ba9b-21af-41ce-8416-a259a4ae4541").maybeSingle();
if(!s){console.error("no session");process.exit(1);}
const report = JSON.parse((s as any).final_report);
console.log("territories:", report.territories.map((t:any)=>`${t.id}:${t.name}|gateway=${t?.timing_sequencing?.is_gateway_territory}|rec=${t.strategic_recommendation}`).join("\n"));
console.log("primary:", report.recommended_primary_territory_id);
const html = buildDocument00AMinto({ sourceRunId:(s as any).id, brandName:(s as any).brand_name, category:(s as any).category??"", briefType:"commercial", completedAt:(s as any).completed_at, report, research: researchEvidenceFromSession(s as never) } as never);
writeFileSync("/tmp/doc00a.html", html);
console.log("bytes", html.length);
for (const k of ["culture","internal","staff","employee","unoccupied","no evidence","18-24","18–24"]) {
  const n = (html.match(new RegExp(k,"gi"))||[]).length; console.log(k, n);
}
