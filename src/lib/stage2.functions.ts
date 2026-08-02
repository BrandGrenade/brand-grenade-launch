import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_2_SYSTEM_PROMPT, buildStage2UserMessage } from "./stage2-prompt";
import { trimStage1ForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const RunStage2Input = z.object({ sessionId: z.string().uuid() });

export const runStage2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage2Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
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
        systemPrompt: STAGE_2_SYSTEM_PROMPT,
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


    // Mandatory fact-verification pass. Stage 2 makes claims about competitor
    // ownership, category regulation, market structure, and category history
    // that read as established fact. Run a real web-search verification pass
    // before saving, so unverifiable claims are flagged for human review.
    yield { delta: "\n\n_[Running live fact-verification web search against category-fact claims…]_\n\n" };
    let finalOutput = output;
    try {
      const { verifyRealFacts } = await import("./fact-verify.server");
      const verification = await verifyRealFacts({
        output,
        brandName: session.brand_name,
        category: session.category,
        stageLabel: "Stage 2",
      });
      finalOutput = verification.rewrittenOutput;
      const flagged = verification.results.filter((r) => r.verdict !== "verified").length;
      yield {
        delta: `_[Fact verification complete: ${verification.results.length} claim(s) checked, ${flagged} flagged for human confirmation.]_\n\n`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fact verification failed";
      finalOutput = `${output}\n\n---\n\n## ⚠️ Fact Verification Review — VERIFICATION CALL FAILED\n\nThe automated web-search fact-check did not complete (${msg.slice(0, 200)}). Every claim in this stage's output presented as a real-world verifiable fact must be confirmed manually before being treated as established fact.\n`;
      yield { delta: "_[Fact verification could not run — output flagged for full manual review.]_\n\n" };
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_2_output: finalOutput, stage_2_error: null, stage_status: "complete:2" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 2 output: ${updateErr.message}`);

    yield { done: true as const, output: finalOutput };
  });

