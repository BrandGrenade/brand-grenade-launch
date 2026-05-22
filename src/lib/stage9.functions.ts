import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { saveStageOutputWithRetry } from "./save-stage-output.server";
import { streamClaude } from "./claude.server";
import { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } from "./stage9-prompt";

import { countPropositions } from "./count-helpers";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage9 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_7_output, stage_8_output, stage_9_output, checkpoint_b_confirmed")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 9");
    if (!session.checkpoint_b_confirmed) throw new Error("Checkpoint B not confirmed — cannot run Stage 9");
    if (session.stage_9_output) {
      yield { delta: session.stage_9_output };
      yield { done: true as const, output: session.stage_9_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 9, status: "running", stage_9_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output);

    const userMessage = buildStage9UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      cmm: session.stage_2_output ?? "",
      stage7DominantSignal: session.stage_7_output ?? undefined,
      propositionCount,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_9_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 3000,
        temperature: 0.4,
        sessionId: data.sessionId,
        stageLabel: "Stage 9",
        stageNumber: "9",
        stageName: "Distinctiveness Check",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 9 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_9_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    await saveStageOutputWithRetry(
      data.sessionId,
      { stage_9_output: output, stage_9_error: null },
      "stage_9_error",
      "Stage 9",
    );

    yield { done: true as const, output };
  });
