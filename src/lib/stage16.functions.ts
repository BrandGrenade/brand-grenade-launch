import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import {
  getStage16SystemPrompt,
  buildStage16UserMessage,
  type Stage16Format,
} from "./stage16-prompt";
import {
  trimBrandFitForDownstream,
  extractStrategicLineageStatement,
  extractStage14Dimensions12,
  extractStage14CCore,
} from "./context-trim";

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
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_15_output) throw new Error("Stage 15 audit missing — Stage 16 cannot proceed");

    const column = COLUMN_BY_FORMAT[data.format];
    const existing = session[column] as string | null | undefined;
    if (existing) {
      if (session.status !== "complete") {
        await supabaseAdmin
          .from("sessions")
          .update({ status: "complete", current_stage: 16, stage_16_error: null, stage_16_format: data.format })
          .eq("id", data.sessionId);
      }
      yield { delta: existing };
      yield { done: true as const, output: existing, format: data.format };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 16, status: "running", stage_16_error: null, stage_16_format: data.format })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: getStage16SystemPrompt(data.format),
        maxTokens: 3000,
        userMessage: buildStage16UserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp ?? "",
          format: data.format,
          payload: {
            "SELECTED SMP": session.selected_smp ?? "",
            "STAGE 12 — SELECTION RATIONALE (FIELD 1)": session.selection_rationale_1 ?? "",
            "STAGE 12 — SELECTION RATIONALE (FIELD 2)": session.selection_rationale_2 ?? "",
            "STAGE 12 — SELECTION RATIONALE (FIELD 3)": session.selection_rationale_3 ?? "",
            "STAGE 13 — BRAND FIT SUMMARY": trimBrandFitForDownstream(
              session.stage_13_output ?? ""
            ),
            "STAGE 13B — STRATEGIC LINEAGE STATEMENT": extractStrategicLineageStatement(
              session.stage_13b_output ?? ""
            ),
            "STAGE 14 — DIMENSIONS 1 & 2": extractStage14Dimensions12(
              session.stage_14_output ?? ""
            ),
            "STAGE 14C — BRAND WORLD CORE": extractStage14CCore(session.stage_14c_output ?? ""),
            "STAGE 15 — CLEARANCE STATUS": session.stage_15_clearance_status ?? "",
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
      await supabaseAdmin.from("sessions").update({ stage_16_error: msg }).eq("id", data.sessionId);
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
    if (ue) throw new Error(`Failed to save Stage 16 (${data.format}) output: ${ue.message}`);

    yield { done: true as const, output, format: data.format };
  });
