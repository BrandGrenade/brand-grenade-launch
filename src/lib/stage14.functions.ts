import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { saveStageOutputInBackground } from "./save-stage-output.server";
import { streamClaude } from "./claude.server";
import { STAGE_14_SYSTEM_PROMPT, buildStage14UserMessage } from "./stage14-prompt";
import { trimBrandFitForDownstream } from "./context-trim";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage14 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, stage_2_output, stage_12_output, stage_13_output, stage_13b_output, stage_14_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_13b_output) throw new Error("Stage 13B output missing — cannot run Stage 14");
    if (session.stage_14_output) {
      yield { delta: session.stage_14_output };
      yield { done: true as const, output: session.stage_14_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 14, status: "running", stage_14_error: null })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_14_SYSTEM_PROMPT,
        userMessage: buildStage14UserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          stage12Output: "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output ?? ""),
          stage13bOutput: session.stage_13b_output,
          cmm: "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 14",
        maxTokens: 3000,
        stageNumber: "14",
        stageName: "Territory Mapping",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 14 failed";
      await supabaseAdmin.from("sessions").update({ stage_14_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    saveStageOutputInBackground(
      data.sessionId,
      { stage_14_output: output, stage_14_error: null },
      "stage_14_error",
      "Stage 14",
    );

    yield { done: true as const, output };
  });
