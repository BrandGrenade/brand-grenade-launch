import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_15_SYSTEM_PROMPT, buildStage15UserMessage } from "./stage15-prompt";
import { trimBrandFitForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";
import { isStageOutputComplete } from "./stage-completion";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage15 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 15);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!isStageOutputComplete(session, "14c", 14, session.stage_14c_output)) {
      throw new Error("Stage 14C output missing or incomplete — cannot run Stage 15");
    }
    if (isStageOutputComplete(session, "15", 15, session.stage_15_output)) {
      yield { delta: session.stage_15_output };
      yield { done: true as const, output: session.stage_15_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 15, status: "running", stage_status: "running:15", stage_15_output: null, stage_15_error: null })
      .eq("id", data.sessionId);

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 15", stageStatusId: "15", outputColumn: "stage_15_output", errorColumn: "stage_15_error" },
      streamClaude({
        systemPrompt: STAGE_15_SYSTEM_PROMPT,
        maxTokens: 64000,
        userMessage: buildStage15UserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          payload: {
            "SELECTED SMP": session.selected_smp ?? "",
            "STAGE 12 — SELECTION RATIONALE (PRIMARY)": session.selection_rationale_1 ?? "",
            "STAGE 13 — BRAND FIT VERDICT": trimBrandFitForDownstream(session.stage_13_output ?? ""),
            "STAGE 14 — CREATIVE TERRITORY (FULL)": session.stage_14_output ?? "",
            "STAGE 14B — TERRITORY DEVELOPMENT (FULL)": session.stage_14b_output ?? "",
            "STAGE 14C — BRAND WORLD DEFINITION (FULL)": session.stage_14c_output ?? "",
          },
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 15",
        stageNumber: "15",
        stageName: "Coherence Audit",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({ stage_15_output: output, stage_15_error: null, stage_status: "complete:15" })
      .eq("id", data.sessionId);
    if (ue) throw new Error(`Failed to save Stage 15 output: ${ue.message}`);

    yield { done: true as const, output };
  });
