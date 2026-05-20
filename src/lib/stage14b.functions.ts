import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_14B_SYSTEM_PROMPT, buildStage14bUserMessage } from "./stage14b-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage14b = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, selected_smp, stage_12_output, stage_13_output, stage_13b_output, stage_14_output, stage_14b_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_14_output) throw new Error("Stage 14 output missing — cannot run Stage 14B");
    if (session.stage_14b_output) return { output: session.stage_14b_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 14, status: "running", stage_14b_error: null })
      .eq("id", data.sessionId);

    try {
      const output = await callClaude({
        systemPrompt: STAGE_14B_SYSTEM_PROMPT,
        userMessage: buildStage14bUserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          stage12Output: session.stage_12_output ?? "",
          stage13Output: session.stage_13_output ?? "",
          stage13bOutput: session.stage_13b_output ?? "",
          stage14Output: session.stage_14_output,
        }),
      });
      const { error: ue } = await supabaseAdmin
        .from("sessions")
        .update({ stage_14b_output: output, stage_14b_error: null })
        .eq("id", data.sessionId);
      if (ue) throw new Error(`Failed to save Stage 14B output: ${ue.message}`);
      return { output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 14B failed";
      await supabaseAdmin.from("sessions").update({ stage_14b_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }
  });
