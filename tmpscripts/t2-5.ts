import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
const { data, error } = await db.from("stimulus_directions").select("id, run_id").limit(20000);
if (error) throw error;
const byRun = new Map<string, string[]>();
for (const r of data ?? []) byRun.set(r.run_id, [...(byRun.get(r.run_id) ?? []), r.id]);
const top = [...byRun.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,5);
console.log(top.map(([k,v])=>`${k}: ${v.length}`).join("\n"));
