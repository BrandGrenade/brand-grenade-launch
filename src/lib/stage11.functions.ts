import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_11_SYSTEM_PROMPT, buildStage11UserMessage } from "./stage11-prompt";
import { countPropositions } from "./count-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage11 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 11);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_8_output, stage_10_output, stage_11_output, is_preflight_test")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_10_output) throw new Error("Stage 10 output missing — cannot run Stage 11");
    if (session.stage_11_output) {
      yield { delta: session.stage_11_output };
      yield { done: true as const, output: session.stage_11_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 11, status: "running", stage_11_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output ?? session.stage_10_output);

    const userMessage = buildStage11UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage10Output: session.stage_10_output,
      cmm: session.stage_2_output ?? "",
      propositionCount,
      isPreflight: session.is_preflight_test === true,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_11_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 11",
        stageNumber: "11",
        stageName: "Integrity Testing",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 11 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_11_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_11_output: output, stage_11_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 11 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
