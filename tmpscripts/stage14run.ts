import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { callClaude } from "../src/lib/claude.server";
import { STAGE_14_SYSTEM_PROMPT, buildStage14UserMessage } from "../src/lib/stage14-prompt";
import { trimBrandFitForDownstream } from "../src/lib/context-trim";
import { extractBuyerGainForSmp } from "../src/lib/buyer-gain";
const SID="df21eef0-0e66-4a00-90a6-a4a1e6242391";
const { data: s } = await supabaseAdmin.from("sessions")
 .select("brand_name, category, selected_smp, stage_8_output, stage_13_output, stage_13b_output").eq("id",SID).single();
const gain = extractBuyerGainForSmp(s!.stage_8_output, s!.selected_smp);
const out = await callClaude({
  systemPrompt: STAGE_14_SYSTEM_PROMPT,
  userMessage: buildStage14UserMessage({
    brandName: s!.brand_name, category: s!.category, selectedSMP: s!.selected_smp ?? "",
    buyerGain: gain, stage12Output: "",
    stage13Output: trimBrandFitForDownstream(s!.stage_13_output ?? ""),
    stage13bOutput: s!.stage_13b_output as string, cmm: "",
  }),
  maxTokens: 32000, sessionId: SID, stageLabel: "Stage 14 verification", stageNumber: "14", stageName: "Territory Mapping",
});
await supabaseAdmin.from("sessions").update({ stage_14_output: out, stage_14_error: null }).eq("id",SID);
console.log("chars", out.length);
const i = out.search(/WHAT THE BUYER GAINS/i);
console.log(out.slice(i, i+700));
