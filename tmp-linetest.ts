import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateOne, carriesCampaignLine } from "@/lib/stage21.functions";

const SID = "08fbc851-9b4d-4511-b5bc-b274228a13f9";
const { STAGE21_SELECT } = await import("@/lib/stage21.functions") as any;
const { data, error } = await supabaseAdmin.from("sessions").select("*").eq("id", SID).single();
if (error) throw error;
const s: any = data;
console.log("locked line:", JSON.stringify(s.locked_campaign_line));
const chans = Object.keys(s.stage_21_outputs ?? {});
console.log("channels:", chans);
const target = chans.find((c) => /transit/i.test(c));
console.log("target:", target);
if (!target) process.exit(1);
console.log("old carries line?", carriesCampaignLine(s.stage_21_outputs[target], s.locked_campaign_line));
const ctx = ""; // rebuilt below
const { extractStage20BChannelEntries } = await import("@/lib/phase2-shared");
const entries = extractStage20BChannelEntries(s.stage_20b_output);
const e = entries.find((x: any) => x.name === target) ?? { name: target, role: "", content: ctx };
const out = await generateOne(SID, e.name, e.role, e.content, s, "");
console.log("NEW carries line?", carriesCampaignLine(out, s.locked_campaign_line));
console.log(out.slice(0, 800));
await Bun.write("/tmp/intransit-new.md", out);
