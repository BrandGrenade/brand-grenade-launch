import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_7_SYSTEM_PROMPT, buildStage7UserMessage } from "./stage7-prompt";
import { trimValidatedInsightsForDownstream } from "./context-trim";

const RunStage7Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage7 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage7Input.parse(input))
  .handler(async function* ({ data }) {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_2_output, stage_3_output, stage_4_output, stage_6_output, stage_7_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 7");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 7");
    if (!session.stage_4_output) throw new Error("Stage 4 output (SIS) missing — cannot run Stage 7");
    if (!session.stage_6_output) throw new Error("Stage 6 output (validated insights) missing — cannot run Stage 7");
    if (session.stage_7_output) {
      yield { delta: session.stage_7_output };
      yield { done: true as const, output: session.stage_7_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 7, status: "running", stage_7_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage7UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      stage6Output: trimValidatedInsightsForDownstream(session.stage_6_output),
      sis: session.stage_4_output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_7_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 3500,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 7",
        stageNumber: "7",
        stageName: "Territory Synthesis",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 7 failed";
      await supabaseAdmin.from("sessions").update({ stage_7_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_7_output: output, stage_7_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 7 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
