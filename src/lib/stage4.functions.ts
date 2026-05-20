import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_4_SYSTEM_PROMPT, buildStage4UserMessage } from "./stage4-prompt";

const RunStage4Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage4 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage4Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_1_output, stage_2_output, stage_3_output, stage_4_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 4");
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 4");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 4");

    if (session.stage_4_output) return { output: session.stage_4_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 4, status: "running", stage_4_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage4UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      sanitisedBrief: session.stage_1_output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_4_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 8192,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 4",
      stageNumber: "4",
      stageName: "Strategic Universes",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 4 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_4_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_4_output: output, stage_4_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 4 output: ${updateErr.message}`);

    return { output };
  });
