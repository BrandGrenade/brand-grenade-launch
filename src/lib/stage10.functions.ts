import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_10_SYSTEM_PROMPT, buildStage10UserMessage } from "./stage10-prompt";
import { applyStage10CodeGate } from "./stage12-filter";

import { countPropositions } from "./count-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage10 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 10);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_8_output, stage_9_output, stage_10_output, is_preflight_test")
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
      isPreflight: session.is_preflight_test === true,
    });

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 10", outputColumn: "stage_10_output", errorColumn: "stage_10_error" },
      streamClaude({
        systemPrompt: STAGE_10_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 10",
        stageNumber: "10",
        stageName: "Proposition Scoring",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    // v5.5: enforce the Stage 10 selection gate in code BEFORE saving so
    // Stage 11 / Stage 12 see CODE VERDICT, recomputed unweighted /70 and the
    // weighted ranking /110 as authoritative. Preflight mode bypasses floors.
    const gated = applyStage10CodeGate(output, {
      isPreflight: session.is_preflight_test === true,
    });
    const finalOutput = gated.output;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_10_output: finalOutput, stage_10_error: null, stage_status: "complete:10" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 10 output: ${updateErr.message}`);

    yield { done: true as const, output: finalOutput };
  });
