import { createClient } from "@supabase/supabase-js";
import { buildBoardStrategyDocument } from "../src/lib/board-strategy-document";
import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
import { buildPhase2Document } from "../src/lib/phase2-document-generator";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s } = await sb.from("sessions").select("*").eq("id","6ab4ea96-7c3a-4e0a-91a9-24b601752b35").single();
const docs: Record<string,string> = {
  board: buildBoardStrategyDocument(s as never),
  exec: buildExecSummaryDocument(s as never, {} as never),
  consulting: buildConsultingDeliveryDocument(s as never),
  master: buildPhase2Document(s as never, "master_brief"),
  arch: buildPhase2Document(s as never, "brand_architecture"),
};
const STALE = /Real power never announces/i;
const LOCK = /Stealth\. By Design\./i;
for (const [k,v] of Object.entries(docs)) {
  const txt = v.replace(/<[^>]+>/g," ");
  console.log(k, "stale:", STALE.test(txt), "lockedLine:", LOCK.test(txt), "len", v.length);
  if (STALE.test(txt)) console.log("   ctx:", txt.match(/.{200}Real power never announces.{100}/i)?.[0]);
}
