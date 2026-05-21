import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import {
  getStage16SystemPrompt,
  buildStage16UserMessage,
  type Stage16Format,
} from "./stage16-prompt";

const FormatSchema = z.enum(["agency", "consulting", "workshop"]);
const Input = z.object({
  sessionId: z.string().uuid(),
  format: FormatSchema,
});

const COLUMN_BY_FORMAT: Record<
  Stage16Format,
  "stage_16_agency_output" | "stage_16_consulting_output" | "stage_16_workshop_output"
> = {
  agency: "stage_16_agency_output",
  consulting: "stage_16_consulting_output",
  workshop: "stage_16_workshop_output",
};

export const runStage16 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session)
      throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_15_output)
      throw new Error("Stage 15 audit missing — Stage 16 cannot proceed");

    const column = COLUMN_BY_FORMAT[data.format];
    const existing = session[column] as string | null | undefined;
    if (existing) {
      if (session.status !== "complete") {
        await supabaseAdmin
          .from("sessions")
          .update({
            status: "complete",
            current_stage: 16,
            stage_16_error: null,
            stage_16_format: data.format,
          })
          .eq("id", data.sessionId);
      }
      yield { delta: existing };
      yield { done: true as const, output: existing, format: data.format };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({
        current_stage: 16,
        status: "running",
        stage_16_error: null,
        stage_16_format: data.format,
      })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: getStage16SystemPrompt(data.format),
        maxTokens: 8000,
        userMessage: buildStage16UserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          format: data.format,
          payload: {
            "BRIEF ANALYSIS": session.stage_1_output,
            "BRIEF TENSION CHECK": session.stage_1b_output,
            "CATEGORY INTELLIGENCE": session.stage_2_output,
            "STRATEGIC FRAMEWORKS": session.stage_3_output,
            "STRATEGIC UNIVERSES": session.stage_4_output,
            "INSIGHT GENERATION": session.stage_5_output,
            "INSIGHT VALIDATION": session.stage_6_output,
            "TERRITORY SYNTHESIS": session.stage_7_output,
            "PROPOSITION GENERATION": session.stage_8_output,
            "DISTINCTIVENESS CHECK": session.stage_9_output,
            "PROPOSITION SCORING": session.stage_10_output,
            "INTEGRITY TESTING": session.stage_11_output,
            "PROPOSITION SELECTION": session.stage_12_output,
            "BRAND FIT VALIDATION": session.stage_13_output,
            "HISTORICAL TERRITORY EVIDENCE": session.stage_13b_output,
            "TERRITORY MAPPING": session.stage_14_output,
            "CHANNEL EXPRESSIONS": session.stage_14b_output,
            "BRAND WORLD DEFINITION": session.stage_14c_output,
            "COHERENCE AUDIT": session.stage_15_output,
            "SELECTION RATIONALE 1": session.selection_rationale_1,
            "SELECTION RATIONALE 2": session.selection_rationale_2,
            "SELECTION RATIONALE 3": session.selection_rationale_3,
            "SELECTION RATIONALE 4": session.selection_rationale_4,
            "SELECTION RATIONALE 5": session.selection_rationale_5,
            "SELECTION RATIONALE 6": session.selection_rationale_6,
            "SELECTED PROPOSITION FIELD": session.selected_smp_field_name,
            "BRAND POSITIONING (INTAKE)": session.brand_positioning,
            "BRAND PRODUCT TRUTH (INTAKE)": session.brand_product_truth,
            "BRAND AUDIENCE RELATIONSHIP (INTAKE)":
              session.brand_audience_relationship,
            "BRAND TONE OF VOICE (INTAKE)": session.brand_tone_of_voice,
            "BRAND CONSTRAINTS (INTAKE)": session.brand_constraints,
            "BRAND ORGANISATIONAL CONTEXT (INTAKE)":
              session.brand_organisational_context,
          },
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 16",
        stageNumber: "16",
        stageName: "Document Assembly",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Stage 16 (${data.format}) failed`;
      await supabaseAdmin
        .from("sessions")
        .update({ stage_16_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const outputUpdate =
      data.format === "agency"
        ? { stage_16_agency_output: output }
        : data.format === "consulting"
        ? { stage_16_consulting_output: output }
        : { stage_16_workshop_output: output };

    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({
        ...outputUpdate,
        stage_16_error: null,
        status: "complete",
      })
      .eq("id", data.sessionId);
    if (ue)
      throw new Error(
        `Failed to save Stage 16 (${data.format}) output: ${ue.message}`,
      );

    yield { done: true as const, output, format: data.format };
  });
