import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { saveStageOutputInBackground } from "./save-stage-output.server";
import { streamClaude } from "./claude.server";
import { STAGE_13B_SYSTEM_PROMPT, buildStage13bUserMessage } from "./stage13b-prompt";
import { trimBrandFitForDownstream } from "./context-trim";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage13b = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, stage_2_output, stage_12_output, stage_13_output, stage_13b_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_13_output) throw new Error("Stage 13 output missing — cannot run Stage 13B");
    if (session.stage_13b_output) {
      yield { delta: session.stage_13b_output };
      yield { done: true as const, output: session.stage_13b_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 13, status: "running", stage_13b_error: null })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_13B_SYSTEM_PROMPT,
        userMessage: buildStage13bUserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          stage13Output: trimBrandFitForDownstream(session.stage_13_output),
          stage12Output: "",
          cmm: "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 13B",
        maxTokens: 2000,
        stageNumber: "13B",
        stageName: "Historical Validation",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 13B failed";
      await supabaseAdmin.from("sessions").update({ stage_13b_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    saveStageOutputInBackground(
      data.sessionId,
      { stage_13b_output: output, stage_13b_error: null },
      "stage_13b_error",
      "Stage 13B",
    );

    yield { done: true as const, output };
  });
