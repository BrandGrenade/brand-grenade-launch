import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } from "./stage6-prompt";
import { trimCMMForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";

const RunStage6Input = z.object({ sessionId: z.string().uuid() });

export const runStage6 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage6Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, strategic_mode, stage_2_output, stage_3_output, stage_5_output, stage_6_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 6");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 6");
    if (!session.stage_5_output) throw new Error("Stage 5 output (Insights) missing — cannot run Stage 6");
    if (session.stage_6_output) {
      yield { delta: session.stage_6_output };
      yield { done: true as const, output: session.stage_6_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 6, status: "running", stage_6_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage6UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      stage5Output: session.stage_5_output,
      cmm: trimCMMForDownstream(session.stage_2_output),
      constraintMatrix: session.stage_3_output,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_6_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 6",
        stageNumber: "6",
        stageName: "Insight Validation",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 6 failed";
      await supabaseAdmin.from("sessions").update({ stage_6_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_6_output: output, stage_6_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 6 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
