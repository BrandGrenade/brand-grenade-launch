import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { regenerateDocument00ARun } from "../src/lib/doc00a-regenerate.server";
import { buildDocument00AMinto } from "../src/lib/intelligence/doc-00A-minto";
import { researchEvidenceFromSession } from "../src/lib/intelligence/research-evidence";

const sessionId = "22c0ba9b-21af-41ce-8416-a259a4ae4541";
const result = await regenerateDocument00ARun({
  sessionId,
  instructions: "Layout-only revision. Preserve the currently reconciled strategic content, all four live territory identities, Built Different as the sole recommended primary and gateway territory, the explicit exclusion of internal-culture language, and all human-corrected evidence including BYD 52,415. Do not absorb, retire, rename, add, or materially rewrite any territory. This run exists to issue Document 00A revision 2 through the genuine platform regeneration path after template layout corrections.",
});
if (!result.success) throw new Error(result.error ?? "Document 00A regeneration failed");

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s, error } = await sb.from("intelligence_sessions").select("*").eq("id", sessionId).maybeSingle();
if (error || !s?.final_report) throw error ?? new Error("Nissan session not found after regeneration");
const report = JSON.parse(s.final_report);
const meta = s.report_metadata && typeof s.report_metadata === "object" ? s.report_metadata as Record<string, unknown> : {};
const html = buildDocument00AMinto({
  sourceRunId: s.id,
  brandName: s.brand_name ?? "Nissan",
  category: s.category ?? "",
  briefType: meta.brief_type === "government" ? "government" : "commercial",
  completedAt: s.completed_at ?? s.updated_at,
  report,
  research: researchEvidenceFromSession(s as Record<string, unknown>),
  revision: typeof meta.doc00a_revision === "number" ? meta.doc00a_revision : null,
  runRef: typeof meta.doc00a_run_ref === "string" ? meta.doc00a_run_ref : null,
  regeneratedAt: typeof meta.doc00a_regenerated_at === "string" ? meta.doc00a_regenerated_at : null,
});
writeFileSync("/tmp/doc00a-layout/nissan-document-00a-revision-2.html", html);
console.log(JSON.stringify({ result, bytes: html.length, territories: report.territories?.map((t: any) => ({ id: t.id, name: t.name, gateway: t.timing_sequencing?.is_gateway_territory })), primary: report.recommended_primary_territory_id }));
