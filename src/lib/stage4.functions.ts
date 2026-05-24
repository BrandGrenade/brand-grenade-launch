import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import {
  STAGE_4_SYSTEM_PROMPT,
  buildStage4UserMessage,
  buildStage4ContinuationMessage,
} from "./stage4-prompt";
import { trimStage1ForDownstream } from "./context-trim";
import { countSections } from "./count-helpers";

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
  .inputValidator((input) => RunStage4Input.parse(input))
  .handler(async function* ({ data }) {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, strategic_mode, stage_1_output, stage_2_output, stage_3_output, stage_4_output")
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
      strategicMode: session.strategic_mode,
      sanitisedBrief: trimStage1ForDownstream(session.stage_1_output),
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
      constraintSetCount,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_4_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 4",
        stageNumber: "4",
        stageName: "Strategic Universes",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 4 failed";
      await supabaseAdmin.from("sessions").update({ stage_4_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
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
          maxTokens: 12000,
          temperature: 0.7,
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
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 4 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
