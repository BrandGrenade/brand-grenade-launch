import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_14C_SYSTEM_PROMPT, buildStage14cUserMessage } from "./stage14c-prompt";
import { trimBrandFitForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage14c = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 14, "Stage 14C");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, selected_smp, stage_4_output, stage_6_output, stage_7_output, stage_12_output, stage_13_output, stage_13b_output, stage_14_output, stage_14b_output, stage_14c_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_14b_output) throw new Error("Stage 14B output missing — cannot run Stage 14C");
    if (session.stage_14c_output) {
      yield { delta: session.stage_14c_output };
      yield { done: true as const, output: session.stage_14c_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 14, status: "running", stage_14c_error: null })
      .eq("id", data.sessionId);

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 14C", outputColumn: "stage_14c_output", errorColumn: "stage_14c_error" },
      streamClaude({
        systemPrompt: STAGE_14C_SYSTEM_PROMPT,
        userMessage: buildStage14cUserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          stage14bOutput: session.stage_14b_output,
          stage14Output: session.stage_14_output ?? "",
          stage7Output: session.stage_7_output ?? "",
          stage6Output: session.stage_6_output ?? "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output ?? ""),
          stage13bOutput: session.stage_13b_output ?? "",
          stage4Output: session.stage_4_output ?? "",
          stage12Output: "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 14C",
        maxTokens: 64000,
        stageNumber: "14C",
        stageName: "Brand World Definition",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({ stage_14c_output: output, stage_14c_error: null })
      .eq("id", data.sessionId);
    if (ue) throw new Error(`Failed to save Stage 14C output: ${ue.message}`);

    yield { done: true as const, output };
  });
