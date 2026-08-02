import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_4B_SYSTEM_PROMPT, buildStage4bUserMessage } from "./stage4b-prompt";
import { trimStage1ForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";
import { getObjectiveDirective } from "./strategic-objective.server";

const RunStage4bInput = z.object({ sessionId: z.string().uuid() });

export const runStage4b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage4bInput.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 4, "Stage 4B");
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_4_output, stage_4b_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 4B");
    if (!session.stage_4_output) throw new Error("Stage 4 output missing — cannot run Stage 4B");
    if (session.stage_4b_output) {
      yield { delta: session.stage_4b_output };
      yield { done: true as const, output: session.stage_4b_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 4, status: "running", stage_4b_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage4bUserMessage({
      brandName: session.brand_name,
      category: session.category,
      sanitisedBrief: trimStage1ForDownstream(session.stage_1_output),
    });

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 4B", outputColumn: "stage_4b_output", errorColumn: "stage_4b_error" },
      streamClaude({
        systemPrompt: STAGE_4B_SYSTEM_PROMPT + (await getObjectiveDirective(data.sessionId, "stage4b")),
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 4B",
        stageNumber: "4b",
        stageName: "Asset Mining & Product Facts",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    // Mandatory fact-verification pass, via the shared dispatcher in
    // fact-verify.server.ts (FACT_VERIFIED_STAGES.stage4b). Every claim the
    // stage labels "Real Fact" is extracted and web-searched; anything that
    // cannot be corroborated is downgraded and flagged before Stage 5 sees it.
    yield { delta: "\n\n_[Running live fact-verification web search against real-fact claims…]_\n\n" };
    let finalOutput = output;
    {
      const { runStageFactVerification } = await import("./fact-verify.server");
      const v = await runStageFactVerification({
        stageKey: "stage4b",
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
      .update({ stage_4b_output: finalOutput, stage_4b_error: null, stage_status: "complete:4b" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 4B output: ${updateErr.message}`);

    yield { done: true as const, output: finalOutput };
  });

