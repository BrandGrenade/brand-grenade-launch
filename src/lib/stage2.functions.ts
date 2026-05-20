import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_2_SYSTEM_PROMPT, buildStage2UserMessage } from "./stage2-prompt";

const RunStage2Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage2 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage2Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_1_output, stage_1b_output, stage_2_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output)
      throw new Error("Stage 1 output missing — cannot run Stage 2");

    // Idempotent.
    if (session.stage_2_output) return { output: session.stage_2_output };

    // Mark current_stage = 2 / running.
    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 2, status: "running", stage_2_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage2UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      sanitisedBrief: session.stage_1_output,
      stage1bOutput: session.stage_1b_output ?? null,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_2_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 2000,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 2",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 2 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_2_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_2_output: output, stage_2_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 2 output: ${updateErr.message}`);

    return { output };
  });
