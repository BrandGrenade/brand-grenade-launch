import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { buildPhase1Document } from "../src/lib/phase1-document-builder";
import { buildSummaryDocument } from "../src/lib/summary-document";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
mkdirSync("/tmp/render", { recursive: true });
const bad = [
  /each of the following propositions/i, /read each proposition/i,
  /these (two|three|four|five|six) propositions/i, /Q[1-6]\s*\((Longevity|Creative Ambition|Commercial Courage|Credibility|Discomfort|Selection)\)/i,
  /\/\s*100\b/, /\/\s*60\b(?!\s*\(superseded)/, /\/\s*110\b(?!\s*\(superseded)/,
];
for (const id of ["c5142f1d-a381-44aa-9b88-c21875cc7996","6ab4ea96-7c3a-4e0a-91a9-24b601752b35"]) {
  const { data: s } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
  if (!s) continue;
  const docs: Record<string,string> = {
    agency: buildPhase1Document(s as never, "agency"),
    workshop: buildPhase1Document(s as never, "workshop"),
    consulting: buildPhase1Document(s as never, "consulting"),
    summary: buildSummaryDocument(s as never, undefined as never),
  };
  for (const [k,v] of Object.entries(docs)) {
    writeFileSync(`/tmp/render/${(s as any).brand_name.slice(0,6)}_${k}.html`, v);
    const txt = v.replace(/<[^>]+>/g," ");
    const hits = bad.filter(re=>re.test(txt)).map(re=>String(re));
    const proof = txt.match(/SYSTEM PROOF[^<]{0,200}/)?.[0]?.replace(/\s+/g," ") ?? "(none)";
    console.log((s as any).brand_name.slice(0,10), k, "chars", v.length, "| violations:", hits.length? hits.join(" ; "):"none");
    console.log("     ", proof.slice(0,190));
  }
}
