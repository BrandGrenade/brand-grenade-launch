import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { saveStageOutputWithRetry } from "./save-stage-output.server";
import { streamClaude } from "./claude.server";
import { STAGE_13_SYSTEM_PROMPT, buildStage13UserMessage } from "./stage13-prompt";

const BrandIntelInput = z.object({
  sessionId: z.string().uuid(),
  brandIntelligence: z.record(z.string(), z.string().max(20000)),
});

export const saveBrandIntelligence = createServerFn({ method: "POST" })
  .inputValidator((i) => BrandIntelInput.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ brand_intelligence: data.brandIntelligence })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to save brand intelligence: ${error.message}`);
    return { ok: true };
  });

const Input = z.object({ sessionId: z.string().uuid() });

function intelToText(intel: unknown): string {
  if (!intel || typeof intel !== "object") return "";
  const entries = Object.entries(intel as Record<string, unknown>);
  return entries
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `## ${k}\n${v as string}`)
    .join("\n\n");
}

export const runStage13 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, selected_smp_field_name, stage_2_output, stage_10_output, stage_11_output, stage_12_output, stage_13_output, brand_intelligence"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.selected_smp) throw new Error("Selected SMP missing — Stage 12 must be confirmed");
    if (!session.brand_intelligence) throw new Error("Brand Intelligence not supplied");
    if (session.stage_13_output) {
      yield { delta: session.stage_13_output };
      yield { done: true as const, output: session.stage_13_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 13, status: "running", stage_13_error: null })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_13_SYSTEM_PROMPT,
        userMessage: buildStage13UserMessage({
          brandName: session.brand_name,
          category: session.category,
          selectedSMP: session.selected_smp,
          selectedSMPFieldName: session.selected_smp_field_name ?? "",
          stage12Output: "",
          stage10Output: "",
          stage11Output: "",
          cmm: "",
          brandIntelligence: intelToText(session.brand_intelligence),
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 13",
        maxTokens: 2000,
        stageNumber: "13",
        stageName: "Brand Fit Validation",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 13 failed";
      await supabaseAdmin.from("sessions").update({ stage_13_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    await saveStageOutputWithRetry(
      data.sessionId,
      { stage_13_output: output, stage_13_error: null },
      "stage_13_error",
      "Stage 13",
    );

    yield { done: true as const, output };
  });
