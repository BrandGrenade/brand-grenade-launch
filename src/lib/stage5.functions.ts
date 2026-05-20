import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_5_SYSTEM_PROMPT, buildStage5UserMessage } from "./stage5-prompt";
import { trimCMMForDownstream, trimSISForDownstream } from "./context-trim";

const RunStage5Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage5 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage5Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_1_output, stage_2_output, stage_4_output, stage_5_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 5");
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 5");
    if (!session.stage_4_output) throw new Error("Stage 4 output (SIS) missing — cannot run Stage 5");

    if (session.stage_5_output) return { output: session.stage_5_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 5, status: "running", stage_5_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage5UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      sanitisedBrief: session.stage_1_output,
      cmm: trimCMMForDownstream(session.stage_2_output),
      sis: trimSISForDownstream(session.stage_4_output),
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_5_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 1500,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 5",
      stageNumber: "5",
      stageName: "Insight Generation",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 5 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_5_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_5_output: output, stage_5_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 5 output: ${updateErr.message}`);

    return { output };
  });
