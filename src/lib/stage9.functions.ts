import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } from "./stage9-prompt";
import {
  STAGE_9_LEFT_OF_CENTRE_SYSTEM_PROMPT,
  buildStage9LeftOfCentreUserMessage,
  STAGE_9_LEFT_OF_CENTRE_DIVIDER,
} from "./stage9-leftofcentre-prompt";

import { countPropositions } from "./count-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const Input = z.object({ sessionId: z.string().uuid() });


async function setRetryStatus(sessionId: string, message: string | null) {
  try {
    await supabaseAdmin
      .from("sessions")
      .update({ retry_status: message })
      .eq("id", sessionId);
  } catch {
    // best-effort
  }
}


export const runStage9 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "B");
    await assertUpstreamStageOutput(data.sessionId, 9);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, brief_text, stage_2_output, stage_4b_output, stage_6_output, stage_7_output, stage_8_output, stage_9_output, checkpoint_b_confirmed")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 9");
    if (session.stage_9_output) {
      yield { delta: session.stage_9_output };
      yield { done: true as const, output: session.stage_9_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 9, status: "running", stage_9_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output);

    const userMessage = buildStage9UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      cmm: session.stage_2_output ?? "",
      stage7DominantSignal: session.stage_7_output ?? undefined,
      propositionCount,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_9_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 9",
        stageNumber: "9",
        stageName: "Distinctiveness Check",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 9 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_9_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    await setRetryStatus(data.sessionId, null);

    // ===== TIER 3 — LEFT-OF-CENTRE ALTERNATIVES (Breach / Fuse / Flashpoint) =====
    // Additive layer: runs AFTER the core Stage 9 generator on the same session
    // inputs. Appended to stage_9_output with a clear divider. Failure here does
    // NOT fail Stage 9 — core output is preserved either way.
    let leftOfCentre = "";
    try {
      const locDivider = STAGE_9_LEFT_OF_CENTRE_DIVIDER;
      yield { delta: locDivider };
      leftOfCentre += locDivider;

      const locUserMessage = buildStage9LeftOfCentreUserMessage({
        brandName: session.brand_name,
        category: session.category,
        stage2Output: session.stage_2_output ?? "",
        stage4bOutput: session.stage_4b_output ?? undefined,
        stage6Output: session.stage_6_output ?? undefined,
        stage7Output: session.stage_7_output ?? undefined,
        stage8Output: session.stage_8_output ?? undefined,
        briefText: session.brief_text ?? undefined,
      });

      for await (const delta of streamClaude({
        systemPrompt: STAGE_9_LEFT_OF_CENTRE_SYSTEM_PROMPT,
        userMessage: locUserMessage,
        maxTokens: 16000,
        sessionId: data.sessionId,
        stageLabel: "Stage 9 (Left-of-Centre)",
        stageNumber: "9",
        stageName: "Left-of-Centre Alternatives",
      })) {
        leftOfCentre += delta;
        yield { delta };
      }
    } catch (e) {
      const note = `\n\n[LEFT-OF-CENTRE ALTERNATIVES layer failed: ${e instanceof Error ? e.message : "unknown error"} — core Stage 9 output above is unaffected.]\n`;
      leftOfCentre += note;
      yield { delta: note };
    }

    const combined = output + leftOfCentre;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_9_output: combined, stage_9_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 9 output: ${updateErr.message}`);

    yield { done: true as const, output: combined };
  });
