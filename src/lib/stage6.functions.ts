import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from \"./claude.server\";
import { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } from "./stage6-prompt";

const RunStage6Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage6 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage6Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_2_output, stage_3_output, stage_5_output, stage_6_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 6");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 6");
    if (!session.stage_5_output) throw new Error("Stage 5 output (Insights) missing — cannot run Stage 6");

    if (session.stage_6_output) return { output: session.stage_6_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 6, status: "running", stage_6_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage6UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      stage5Output: session.stage_5_output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_6_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 8192,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 6",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 6 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_6_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_6_output: output, stage_6_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 6 output: ${updateErr.message}`);

    return { output };
  });
