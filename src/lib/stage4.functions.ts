import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import {
  STAGE_4_SYSTEM_PROMPT,
  buildStage4UserMessage,
  buildStage4ContinuationMessage,
} from "./stage4-prompt";
import { trimStage1ForDownstream } from "./context-trim";
import { countSections } from "./count-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const RunStage4Input = z.object({ sessionId: z.string().uuid() });
const UNIVERSE_HEADING = /^##\s+\S/;
function countUniverses(text: string): number {
  return text.split("\n").filter((l) => UNIVERSE_HEADING.test(l)).length;
}
async function setStatus(sessionId: string, message: string | null) {
  try {
    await supabaseAdmin.from("sessions").update({ retry_status: message }).eq("id", sessionId);
  } catch { /* best-effort */ }
}

export const runStage4 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage4Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 4);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_2_output, stage_3_output, stage_4_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 4");
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 4");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 4");
    if (session.stage_4_output) {
      yield { delta: session.stage_4_output };
      yield { done: true as const, output: session.stage_4_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 4, status: "running", stage_4_error: null })
      .eq("id", data.sessionId);

    const constraintSetCount = countSections(session.stage_3_output, 4);
    const userMessage = buildStage4UserMessage({
      brandName: session.brand_name,
      category: session.category,
      sanitisedBrief: trimStage1ForDownstream(session.stage_1_output),
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
      constraintSetCount,
    });

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 4", outputColumn: "stage_4_output", errorColumn: "stage_4_error" },
      streamClaude({
        systemPrompt: STAGE_4_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 4",
        stageNumber: "4",
        stageName: "Strategic Universes",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    let universeCount = countUniverses(output);
    let attempts = 0;
    while (universeCount < 3 && attempts < 3) {
      attempts++;
      await setStatus(data.sessionId, `${universeCount} of 3 strategic universes generated. Continuing generation...`);
      try {
        const sep = "\n\n";
        output += sep;
        yield { delta: sep };
        for await (const delta of streamClaude({
          systemPrompt: STAGE_4_SYSTEM_PROMPT,
          userMessage: buildStage4ContinuationMessage({ previousOutput: output, currentCount: universeCount }),
          maxTokens: 64000,
          sessionId: data.sessionId,
          stageLabel: `Stage 4 (continuation ${attempts})`,
          stageNumber: "4",
          stageName: "Strategic Universes",
        })) {
          output += delta;
          yield { delta };
        }
        universeCount = countUniverses(output);
      } catch { break; }
    }
    await setStatus(data.sessionId, null);

    const stillInsufficient = universeCount < 3;
    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_4_output: output,
        stage_4_error: stillInsufficient
          ? `Stage 4 produced only ${universeCount} universe(s) after ${attempts} continuation attempt(s). Manual retry recommended.`
          : null,
        stage_status: stillInsufficient ? "interrupted:4" : "complete:4",
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 4 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
