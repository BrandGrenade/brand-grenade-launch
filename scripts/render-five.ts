import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { buildPhase1Document } from "../src/lib/phase1-document-builder";
import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
import { buildPhase2Document } from "../src/lib/phase2-document-generator";
import { buildDocument00AMinto } from "../src/lib/intelligence/doc-00A-minto";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const id = process.argv[2];
const { data: s, error } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
if (error || !s) { console.error("session load failed", error); process.exit(1); }
mkdirSync("/tmp/browser/five", { recursive: true });
const out: Record<string, string> = {
  "01_Board_Strategy_Recommendation": buildPhase1Document(s as never, "consulting"),
  "02_Strategy_Executive_Summary": buildExecSummaryDocument(s as never, {} as never),
  "03_Consulting_Delivery": buildConsultingDeliveryDocument(s as never),
  "04_Master_Detonation_Brief": buildPhase2Document(s as never, "master_brief"),
};
const brand = (s as any).brand_name ?? "";
const { data: intel } = await sb.from("intelligence_sessions").select("*").ilike("brand_name", `%${brand.split(" ")[0]}%`).eq("status","complete").order("updated_at",{ascending:false}).limit(1);
if (intel && intel[0]?.final_report) {
  out["05_Strategic_Territory_Intelligence_Report"] = buildDocument00AMinto({
    brandName: intel[0].brand_name, category: intel[0].category ?? "", briefType: "commercial",
    completedAt: intel[0].completed_at ?? null, report: JSON.parse(intel[0].final_report),
  } as never);
} else console.log("!! no intelligence report for", brand);
for (const [k, v] of Object.entries(out)) writeFileSync(`/tmp/browser/five/${k}.html`, v);
console.log(Object.keys(out).join("\n"));
