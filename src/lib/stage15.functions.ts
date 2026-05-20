import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_15_SYSTEM_PROMPT, buildStage15UserMessage } from "./stage15-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage15 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_14c_output) throw new Error("Stage 14C output missing — cannot run Stage 15");
    if (session.stage_15_output) return { output: session.stage_15_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 15, status: "running", stage_15_error: null })
      .eq("id", data.sessionId);

    try {
      const output = await callClaude({
        systemPrompt: STAGE_15_SYSTEM_PROMPT,
        maxTokens: 8192,
        userMessage: buildStage15UserMessage({
          brandName: session.brand_name,
          selectedSMP: session.selected_smp ?? "",
          payload: {
            "STAGE 1 — SANITISED BRIEF": session.stage_1_output ?? "",
            "STAGE 1B — BRIEF ESCALATION": session.stage_1b_output ?? "",
            "STAGE 2 — CATEGORY MEMORY OBJECT (CMM)": session.stage_2_output ?? "",
            "STAGE 3 — CONSTRAINT MATRIX": session.stage_3_output ?? "",
            "STAGE 4 — STRATEGIC INTERPRETATION SET (SIS)": session.stage_4_output ?? "",
            "STAGE 5 — INSIGHT GENERATION": session.stage_5_output ?? "",
            "STAGE 6 — VALIDATED INSIGHTS": session.stage_6_output ?? "",
            "STAGE 7 — STRATEGIC FIELD SET": session.stage_7_output ?? "",
            "STAGE 8 — DRAFT SMP SET": session.stage_8_output ?? "",
            "STAGE 9 — DIVERGENCE VALIDATION": session.stage_9_output ?? "",
            "STAGE 10 — SCORED SMP SET": session.stage_10_output ?? "",
            "STAGE 11 — PRESSURE TEST REPORT": session.stage_11_output ?? "",
            "STAGE 12 — SELECTION RATIONALE": session.stage_12_output ?? "",
            "STAGE 13 — BRAND FIT ASSESSMENT": session.stage_13_output ?? "",
            "STAGE 13B — STRL REPORT": session.stage_13b_output ?? "",
            "STAGE 14 — CREATIVE TERRITORY MAP": session.stage_14_output ?? "",
            "STAGE 14B — CREATIVE EXPRESSION MAP": session.stage_14b_output ?? "",
            "STAGE 14C — STRATEGIC UNIVERSE DEFINITION": session.stage_14c_output ?? "",
          },
        }),
      });
      const { error: ue } = await supabaseAdmin
        .from("sessions")
        .update({ stage_15_output: output, stage_15_error: null })
        .eq("id", data.sessionId);
      if (ue) throw new Error(`Failed to save Stage 15 output: ${ue.message}`);
      return { output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 15 failed";
      await supabaseAdmin.from("sessions").update({ stage_15_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }
  });
