import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_13B_SYSTEM_PROMPT, buildStage13bUserMessage } from "./stage13b-prompt";
import { trimBrandFitForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";
import { getObjectiveDirective } from "./strategic-objective.server";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage13b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 13, "Stage 13B");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, stage_2_output, stage_12_output, stage_13_output, stage_13b_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_13_output) throw new Error("Stage 13 output missing — cannot run Stage 13B");
    if (session.stage_13b_output) {
      yield { delta: session.stage_13b_output };
      yield { done: true as const, output: session.stage_13b_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 13, status: "running", stage_13b_error: null })
      .eq("id", data.sessionId);

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 13B", outputColumn: "stage_13b_output", errorColumn: "stage_13b_error" },
      streamClaude({
        systemPrompt: STAGE_13B_SYSTEM_PROMPT + (await getObjectiveDirective(data.sessionId, "stage13b")),
        userMessage: buildStage13bUserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output),
          stage12Output: "",
          cmm: "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 13B",
        maxTokens: 64000,
        stageNumber: "13B",
        stageName: "Historical Validation",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({ stage_13b_output: output, stage_13b_error: null, stage_status: "complete:13b" })
      .eq("id", data.sessionId);
    if (ue) throw new Error(`Failed to save Stage 13B output: ${ue.message}`);

    yield { done: true as const, output };
  });
