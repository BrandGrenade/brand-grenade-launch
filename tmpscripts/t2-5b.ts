import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
const { data: runs } = await db.from("stimulus_runs").select("id, session_id").limit(5000);
const bySess = new Map<string, string[]>();
for (const r of runs ?? []) bySess.set(r.session_id, [...(bySess.get(r.session_id) ?? []), r.id]);
const { data: dirs } = await db.from("stimulus_directions").select("id, run_id").limit(20000);
const cnt = new Map<string, number>();
for (const d of dirs ?? []) cnt.set(d.run_id, (cnt.get(d.run_id) ?? 0) + 1);
const tot = [...bySess.entries()].map(([s, rs]) => [s, rs.reduce((a, r) => a + (cnt.get(r) ?? 0), 0)] as const)
  .sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(tot.map(([s, n]) => `${s}: ${n}`).join("\n"));
