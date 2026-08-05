import { supabaseAdmin } from "/dev-server/src/integrations/supabase/client.server";
import { generateOne } from "/dev-server/src/lib/stage21.functions";
const SID="08fbc851-9b4d-4511-b5bc-b274228a13f9";
const { data: s } = await supabaseAdmin.from("sessions").select("*").eq("id",SID).single();
const outs = (s as any).stage_21_outputs ?? {};
const channels = Object.keys(outs).slice(0,2);
console.log("regenerating:", channels);
const fresh: Record<string,string> = {};
for (const c of channels) {
  const t = await generateOne(SID, c, "", "", s as any, "");
  fresh[c]=t;
  console.log("=== ", c, t.length, "chars");
}
await supabaseAdmin.from("sessions").update({ stage_21_outputs: { ...outs, ...fresh } }).eq("id",SID);
const { runChannelFidelityCheck } = await import("/dev-server/src/lib/stage21-fidelity.server");
const rep = await runChannelFidelityCheck({ sessionId: SID, leadExpression: (s as any).stage_20l_output, outputs: fresh });
console.log(JSON.stringify(rep,null,1).slice(0,2500));
await Bun.write("/tmp/ch.json", JSON.stringify(fresh));
