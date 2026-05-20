import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_13B_SYSTEM_PROMPT, buildStage13bUserMessage } from "./stage13b-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage13b = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, stage_2_output, stage_12_output, stage_13_output, stage_13b_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_13_output) throw new Error("Stage 13 output missing — cannot run Stage 13B");
    if (session.stage_13b_output) return { output: session.stage_13b_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 13, status: "running", stage_13b_error: null })
      .eq("id", data.sessionId);

    try {
      const output = await callClaude({
        systemPrompt: STAGE_13B_SYSTEM_PROMPT,
        userMessage: buildStage13bUserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          stage13Output: session.stage_13_output,
          stage12Output: session.stage_12_output ?? "",
          cmm: session.stage_2_output ?? "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 13B",
      stageNumber: "13B",
      stageName: "Historical Validation",
      });
      const { error: ue } = await supabaseAdmin
        .from("sessions")
        .update({ stage_13b_output: output, stage_13b_error: null })
        .eq("id", data.sessionId);
      if (ue) throw new Error(`Failed to save Stage 13B output: ${ue.message}`);
      return { output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 13B failed";
      await supabaseAdmin.from("sessions").update({ stage_13b_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }
  });
