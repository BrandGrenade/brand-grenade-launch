import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_14B_SYSTEM_PROMPT, buildStage14bUserMessage } from "./stage14b-prompt";
import { trimBrandFitForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage14b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 14, "Stage 14B");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, selected_smp, stage_12_output, stage_13_output, stage_13b_output, stage_14_output, stage_14b_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_14_output) throw new Error("Stage 14 output missing — cannot run Stage 14B");
    if (session.stage_14b_output) {
      yield { delta: session.stage_14b_output };
      yield { done: true as const, output: session.stage_14b_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 14, status: "running", stage_14b_error: null })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_14B_SYSTEM_PROMPT,
        userMessage: buildStage14bUserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          stage12Output: "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output ?? ""),
          stage13bOutput: session.stage_13b_output ?? "",
          stage14Output: session.stage_14_output,
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 14B",
        maxTokens: 64000,
        stageNumber: "14B",
        stageName: "Channel Expression",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 14B failed";
      await supabaseAdmin.from("sessions").update({ stage_14b_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({ stage_14b_output: output, stage_14b_error: null })
      .eq("id", data.sessionId);
    if (ue) throw new Error(`Failed to save Stage 14B output: ${ue.message}`);

    yield { done: true as const, output };
  });
