import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { callClaude } from "../src/lib/claude.server";
import { STAGE_8_SYSTEM_PROMPT, buildStage8UserMessage } from "../src/lib/stage8-prompt";

const SID = "df21eef0-0e66-4a00-90a6-a4a1e6242391";
const { data: s, error } = await supabaseAdmin.from("sessions")
  .select("brand_name, category, stage_2_output, stage_3_output, stage_7_output, stage_8_output, selected_smp")
  .eq("id", SID).single();
if (error) throw error;
await Bun.write("/tmp/verify/backup_stage8.txt", s!.stage_8_output ?? "");
const names = (s!.stage_7_output as string).split("\n").flatMap((l) => {
  const m = l.match(/^##\s+(.+?)\s*$/); return m ? [m[1].replace(/^\*+|\*+$/g,"").trim()] : [];
}).slice(0,5);
const out = await callClaude({
  systemPrompt: STAGE_8_SYSTEM_PROMPT,
  userMessage: buildStage8UserMessage({
    brandName: s!.brand_name, category: s!.category,
    stage7Output: s!.stage_7_output as string, cmm: s!.stage_2_output ?? "",
    constraintMatrix: s!.stage_3_output ?? "", territoryCount: names.length, territoryNames: names,
  }),
  maxTokens: 32000, sessionId: SID, stageLabel: "Stage 8 verification", stageNumber: "8", stageName: "Propositions",
});
await supabaseAdmin.from("sessions").update({ stage_8_output: out, stage_8_error: null }).eq("id", SID);
console.log("chars", out.length, "| gains:", (out.match(/What the buyer gains/gi) || []).length, "| territories:", names.length);
console.log(out.split("\n").filter((l)=>/What the buyer gains/i.test(l)).join("\n---\n"));
