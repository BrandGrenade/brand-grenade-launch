import { createClient } from "@supabase/supabase-js";
import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import { buildPhase2Document } from "../src/lib/phase2-document-generator";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s } = await sb.from("sessions").select("*").eq("id","6ab4ea96-7c3a-4e0a-91a9-24b601752b35").single();
for (const [name, html] of Object.entries({exec: buildExecSummaryDocument(s as never, {} as never), arch: buildPhase2Document(s as never, "brand_architecture")})) {
  const txt = html.replace(/<[^>]+>/g, " ").replace(/\s+/g," ");
  const i = txt.search(/Real power never announces/i);
  console.log("=====", name, i);
  console.log(txt.slice(Math.max(0,i-600), i+300));
}
console.log("STAGE22 UPDATED:", (s as any).stage_22_completed_at ?? (s as any).updated_at);
