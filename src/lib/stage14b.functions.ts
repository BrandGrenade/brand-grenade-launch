import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_14B_SYSTEM_PROMPT, buildStage14bUserMessage } from "./stage14b-prompt";
import { trimBrandFitForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";
import { isStageOutputComplete } from "./stage-completion";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage14b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 14, "Stage 14B");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, selected_smp, current_stage, status, stage_status, stage_12_output, stage_13_output, stage_13b_output, stage_14_output, stage_14b_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!isStageOutputComplete(session, "14", 14, session.stage_14_output)) {
      throw new Error("Stage 14 output missing or incomplete — cannot run Stage 14B");
    }
    if (isStageOutputComplete(session, "14b", 14, session.stage_14b_output)) {
      yield { delta: session.stage_14b_output };
      yield { done: true as const, output: session.stage_14b_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 14, status: "running", stage_status: "running:14b", stage_14b_output: null, stage_14b_error: null })
      .eq("id", data.sessionId);

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 14B", stageStatusId: "14b", outputColumn: "stage_14b_output", errorColumn: "stage_14b_error" },
      streamClaude({
        systemPrompt: STAGE_14B_SYSTEM_PROMPT,
        userMessage: buildStage14bUserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          stage12Output: "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output ?? ""),
          stage13bOutput: session.stage_13b_output ?? "",
          stage14Output: session.stage_14_output,
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 14B",
        maxTokens: 64000,
        stageNumber: "14B",
        stageName: "Channel Expression",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({ stage_14b_output: output, stage_14b_error: null, stage_status: "complete:14b" })
      .eq("id", data.sessionId);
    if (ue) throw new Error(`Failed to save Stage 14B output: ${ue.message}`);

    yield { done: true as const, output };
  });
