import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_8_SYSTEM_PROMPT, buildStage8UserMessage } from "./stage8-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage8 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_3_output, stage_7_output, stage_8_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output missing — cannot run Stage 8");
    if (!session.stage_3_output) throw new Error("Stage 3 output missing — cannot run Stage 8");
    if (!session.stage_7_output) throw new Error("Stage 7 output missing — cannot run Stage 8");
    if (session.stage_8_output) return { output: session.stage_8_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 8, status: "running", stage_8_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage8UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage7Output: session.stage_7_output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_8_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 8192,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 8",
      stageNumber: "8",
      stageName: "Proposition Generation",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 8 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_8_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_8_output: output, stage_8_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 8 output: ${updateErr.message}`);

    return { output };
  });

const ConfirmB = z.object({ sessionId: z.string().uuid() });
export const confirmCheckpointB = createServerFn({ method: "POST" })
  .inputValidator((i) => ConfirmB.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ checkpoint_b_confirmed: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to confirm Checkpoint B: ${error.message}`);
    return { ok: true };
  });
