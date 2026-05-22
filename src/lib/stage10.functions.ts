import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { saveStageOutputWithRetry } from "./save-stage-output.server";
import { streamClaude } from "./claude.server";
import { STAGE_10_SYSTEM_PROMPT, buildStage10UserMessage } from "./stage10-prompt";

import { countPropositions } from "./count-helpers";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage10 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_8_output, stage_9_output, stage_10_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 10");
    if (!session.stage_9_output) throw new Error("Stage 9 output missing — cannot run Stage 10");
    if (session.stage_10_output) {
      yield { delta: session.stage_10_output };
      yield { done: true as const, output: session.stage_10_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 10, status: "running", stage_10_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output);

    const userMessage = buildStage10UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      stage9Output: session.stage_9_output,
      stage1Output: session.stage_1_output ?? "",
      propositionCount,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_10_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 2500,
        temperature: 0.5,
        sessionId: data.sessionId,
        stageLabel: "Stage 10",
        stageNumber: "10",
        stageName: "Proposition Scoring",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 10 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_10_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    await saveStageOutputWithRetry(
      data.sessionId,
      { stage_10_output: output, stage_10_error: null },
      "stage_10_error",
      "Stage 10",
    );

    yield { done: true as const, output };
  });
