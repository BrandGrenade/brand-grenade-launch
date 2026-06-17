import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_15_SYSTEM_PROMPT, buildStage15UserMessage } from "./stage15-prompt";
import {
  trimBrandFitForDownstream,
  firstParagraph,
  extractStrategicContinuityStatement,
} from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

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
    if (!session.stage_14c_output) throw new Error("Stage 14C output missing — cannot run Stage 15");
    if (session.stage_15_output) {
      yield { delta: session.stage_15_output };
      yield { done: true as const, output: session.stage_15_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 15, status: "running", stage_15_error: null })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_15_SYSTEM_PROMPT,
        maxTokens: 14000,
        userMessage: buildStage15UserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          payload: {
            "SELECTED SMP": session.selected_smp ?? "",
            "STAGE 12 — SELECTION RATIONALE (PRIMARY)": session.selection_rationale_1 ?? "",
            "STAGE 13 — BRAND FIT VERDICT": trimBrandFitForDownstream(session.stage_13_output ?? ""),
            "STAGE 14 — TERRITORY SUMMARY": firstParagraph(session.stage_14_output ?? ""),
            "STAGE 14C — STRATEGIC CONTINUITY STATEMENT": extractStrategicContinuityStatement(
              session.stage_14c_output ?? ""
            ),
          },
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 15",
        stageNumber: "15",
        stageName: "Coherence Audit",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 15 failed";
      await supabaseAdmin.from("sessions").update({ stage_15_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({ stage_15_output: output, stage_15_error: null })
      .eq("id", data.sessionId);
    if (ue) throw new Error(`Failed to save Stage 15 output: ${ue.message}`);

    yield { done: true as const, output };
  });
