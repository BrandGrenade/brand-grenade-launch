import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
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

const COLUMN_BY_FORMAT: Record<Stage16Format, "stage_16_agency_output" | "stage_16_consulting_output" | "stage_16_workshop_output"> = {
  agency: "stage_16_agency_output",
  consulting: "stage_16_consulting_output",
  workshop: "stage_16_workshop_output",
};

export const runStage16 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string; format: Stage16Format }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_15_output) throw new Error("Stage 15 audit missing — Stage 16 cannot proceed");

    const column = COLUMN_BY_FORMAT[data.format];
    const existing = session[column] as string | null | undefined;
    if (existing) return { output: existing, format: data.format };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 16, status: "running", stage_16_error: null, stage_16_format: data.format })
      .eq("id", data.sessionId);

    try {
      const output = await callClaude({
        systemPrompt: getStage16SystemPrompt(data.format),
        maxTokens: 2000,
        userMessage: buildStage16UserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          format: data.format,
          payload: {
            "STAGE 1 — SANITISED BRIEF": session.stage_1_output ?? "",
            "STAGE 2 — CATEGORY MEMORY OBJECT": session.stage_2_output ?? "",
            "STAGE 3 — CONSTRAINT MATRIX": session.stage_3_output ?? "",
            "STAGE 4 — STRATEGIC INTERPRETATION SET": session.stage_4_output ?? "",
            "STAGE 6 — VALIDATED INSIGHTS": session.stage_6_output ?? "",
            "STAGE 7 — STRATEGIC FIELD SET": session.stage_7_output ?? "",
            "STAGE 8 — DRAFT SMP SET": session.stage_8_output ?? "",
            "STAGE 9 — DIVERGENCE VALIDATION": session.stage_9_output ?? "",
            "STAGE 10 — SCORED SMP SET (ELIMINATION LOG + PRIORITY)": session.stage_10_output ?? "",
            "STAGE 11 — PRESSURE TEST REPORT": session.stage_11_output ?? "",
            "STAGE 12 — SELECTION RATIONALE & CHECKPOINT C": session.stage_12_output ?? "",
            "STAGE 13 — BRAND FIT ASSESSMENT": session.stage_13_output ?? "",
            "STAGE 13B — STRL REPORT": session.stage_13b_output ?? "",
            "STAGE 14 — CREATIVE TERRITORY MAP": session.stage_14_output ?? "",
            "STAGE 14B — CREATIVE EXPRESSION MAP": session.stage_14b_output ?? "",
            "STAGE 14C — STRATEGIC UNIVERSE DEFINITION": session.stage_14c_output ?? "",
            "STAGE 15 — CONSISTENCY AUDIT REPORT": session.stage_15_output ?? "",
          },
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 16",
      stageNumber: "16",
      stageName: "Document Assembly",
      });

      // Mark pipeline complete when all three variants exist.
      const others = (Object.values(COLUMN_BY_FORMAT) as Array<
        "stage_16_agency_output" | "stage_16_consulting_output" | "stage_16_workshop_output"
      >).filter((c) => c !== column);
      const otherFilled = others.every((c) => !!session[c]);

      const { error: ue } = await supabaseAdmin
        .from("sessions")
        .update({
          [column]: output,
          stage_16_error: null,
          ...(otherFilled ? { status: "complete" } : {}),
        })
        .eq("id", data.sessionId);
      if (ue) throw new Error(`Failed to save Stage 16 (${data.format}) output: ${ue.message}`);
      return { output, format: data.format };
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Stage 16 (${data.format}) failed`;
      await supabaseAdmin.from("sessions").update({ stage_16_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }
  });
