import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_14C_SYSTEM_PROMPT, buildStage14cUserMessage } from "./stage14c-prompt";
import { trimBrandFitForDownstream } from "./context-trim";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage14c = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, selected_smp, stage_4_output, stage_6_output, stage_7_output, stage_12_output, stage_13_output, stage_13b_output, stage_14_output, stage_14b_output, stage_14c_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_14b_output) throw new Error("Stage 14B output missing — cannot run Stage 14C");
    if (session.stage_14c_output) return { output: session.stage_14c_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 14, status: "running", stage_14c_error: null })
      .eq("id", data.sessionId);

    try {
      const output = await callClaude({
        systemPrompt: STAGE_14C_SYSTEM_PROMPT,
        userMessage: buildStage14cUserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          stage14bOutput: session.stage_14b_output,
          stage14Output: session.stage_14_output ?? "",
          stage7Output: session.stage_7_output ?? "",
          stage6Output: session.stage_6_output ?? "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output ?? ""),
          stage13bOutput: session.stage_13b_output ?? "",
          stage4Output: session.stage_4_output ?? "",
          stage12Output: "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 14C",
        maxTokens: 1500,
      stageNumber: "14C",
      stageName: "Brand World Definition",
      });
      const { error: ue } = await supabaseAdmin
        .from("sessions")
        .update({ stage_14c_output: output, stage_14c_error: null })
        .eq("id", data.sessionId);
      if (ue) throw new Error(`Failed to save Stage 14C output: ${ue.message}`);
      return { output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 14C failed";
      await supabaseAdmin.from("sessions").update({ stage_14c_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }
  });
