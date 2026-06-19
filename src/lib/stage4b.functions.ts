import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_4B_SYSTEM_PROMPT, buildStage4bUserMessage } from "./stage4b-prompt";
import { trimStage1ForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";

const RunStage4bInput = z.object({ sessionId: z.string().uuid() });

export const runStage4b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage4bInput.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 4, "Stage 4B");
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, strategic_mode, stage_1_output, stage_4_output, stage_4b_output")
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
      strategicMode: session.strategic_mode,
      sanitisedBrief: trimStage1ForDownstream(session.stage_1_output),
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_4B_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 4B",
        stageNumber: "4b",
        stageName: "Asset Mining & Product Facts",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 4B failed";
      await supabaseAdmin.from("sessions").update({ stage_4b_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_4b_output: output, stage_4b_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 4B output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
