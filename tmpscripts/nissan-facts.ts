import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data: s } = await supabaseAdmin.from("intelligence_sessions").select("*").eq("id", "22c0ba9b-21af-41ce-8416-a259a4ae4541").single();
const short = (v: unknown) => { const j = JSON.stringify(v); return j && j.length > 300 ? j.slice(0, 300) + "…(" + j.length + ")" : j; };
for (const [k, v] of Object.entries(s as Record<string, unknown>)) console.log("COL", k, short(v));
