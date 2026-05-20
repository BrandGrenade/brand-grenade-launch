import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_3_SYSTEM_PROMPT, buildStage3UserMessage } from "./stage3-prompt";
import { trimStage1ForDownstream } from "./context-trim";

const RunStage3Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage3 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage3Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_1_output, stage_2_output, stage_3_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 3");
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 3");

    if (session.stage_3_output) return { output: session.stage_3_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 3, status: "running", stage_3_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage3UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      sanitisedBrief: trimStage1ForDownstream(session.stage_1_output),
      cmm: session.stage_2_output,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_3_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 1200,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 3",
      stageNumber: "3",
      stageName: "Strategic Frameworks",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 3 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_3_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_3_output: output, stage_3_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 3 output: ${updateErr.message}`);

    return { output };
  });
