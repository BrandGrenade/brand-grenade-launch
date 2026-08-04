import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_2_SYSTEM_PROMPT, buildStage2UserMessage } from "./stage2-prompt";
import { trimStage1ForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";
import { getObjectiveDirective } from "./strategic-objective.server";

const RunStage2Input = z.object({ sessionId: z.string().uuid() });

export const runStage2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage2Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionAccess(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "A");
    await assertUpstreamStageOutput(data.sessionId, 2);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_1b_output, stage_2_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 2");
    if (session.stage_2_output) {
      yield { delta: session.stage_2_output };
      yield { done: true as const, output: session.stage_2_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 2, status: "running", stage_2_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage2UserMessage({
      brandName: session.brand_name,
      category: session.category,
      sanitisedBrief: trimStage1ForDownstream(session.stage_1_output),
    });

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 2", outputColumn: "stage_2_output", errorColumn: "stage_2_error" },
      streamClaude({
        systemPrompt: STAGE_2_SYSTEM_PROMPT + (await getObjectiveDirective(data.sessionId, "stage2")),
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 2",
        stageNumber: "2",
        stageName: "Category Intelligence",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    // Mandatory fact-verification pass, via the shared dispatcher in
    // fact-verify.server.ts (FACT_VERIFIED_STAGES.stage2). Stage 2 asserts
    // market size, regulation and behavioural statistics as established
    // category fact; each is web-searched before the output is saved.
    yield { delta: "\n\n_[Running live fact-verification web search against category-fact claims…]_\n\n" };
    let finalOutput = output;
    {
      const { runStageFactVerification } = await import("./fact-verify.server");
      const v = await runStageFactVerification({
        stageKey: "stage2",
        output,
        brandName: session.brand_name,
        category: session.category,
      });
      finalOutput = v.output;
      yield {
        delta: v.ranSearch
          ? `_[Fact verification complete: ${v.checked} claim(s) checked, ${v.flagged} flagged for human confirmation.]_\n\n`
          : "_[Fact verification could not run — output flagged for full manual review.]_\n\n",
      };
    }


    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_2_output: finalOutput, stage_2_error: null, stage_status: "complete:2" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 2 output: ${updateErr.message}`);

    yield { done: true as const, output: finalOutput };
  });

