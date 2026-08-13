import { createClient } from "@supabase/supabase-js";
import { deriveMintoContent } from "../src/lib/minto-content";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s } = await sb.from("sessions").select("*").eq("id","6ab4ea96-7c3a-4e0a-91a9-24b601752b35").single();
const d = deriveMintoContent(s as never, { appendix: { mode: "condensed" } });
for (const k of Object.keys(d.content)) {
  const v = (d.content as any)[k] as string;
  console.log("###", k, /Real power never announces/i.test(v) ? "*** CONTAINS STALE LINE ***" : "");
}
console.log("\nIMPLICATIONS:\n", d.content.implications.replace(/<[^>]+>/g," ").slice(0,1200));
