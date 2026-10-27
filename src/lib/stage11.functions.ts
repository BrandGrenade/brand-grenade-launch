import { resolveStructuredRecord, saveStructuredStage } from "./structured-stage-save";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import {
  STAGE_11_SYSTEM_PROMPT,
  STAGE_11_LOGIC_VERSION,
  buildStage11UserMessage,
} from "./stage11-prompt";
import { countPropositions } from "./count-helpers";
import { filterStructuredStream, resolveCurrentProposition, splitStructured, structuredInstruction } from "./structured-output";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage11 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 11);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_8_output, stage_10_output, stage_11_output, is_preflight_test, stage_10_structured, brief_type, current_proposition, current_proposition_source, current_proposition_date, brand_positioning")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_10_output) throw new Error("Stage 10 output missing — cannot run Stage 11");
    if (session.stage_11_output) {
      yield { delta: session.stage_11_output };
      yield { done: true as const, output: session.stage_11_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 11, status: "running", stage_11_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output ?? session.stage_10_output);

    const userMessage = buildStage11UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage10Output: session.stage_10_output,
      cmm: session.stage_2_output ?? "",
      propositionCount,
      isPreflight: session.is_preflight_test === true,
    });

    const s10 = (session as { stage_10_structured?: { scores?: { smp: string; code_verdict?: string }[] } | null }).stage_10_structured;
    // T1: Deal briefs also test the current proposition (baseline only) in this same call.
    const current = (session as { brief_type?: string | null }).brief_type === "deal" ? resolveCurrentProposition(session) : undefined;
    const sink = { raw: "" };
    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 11", outputColumn: "stage_11_output", errorColumn: "stage_11_error" },
      filterStructuredStream(streamClaude({
        systemPrompt: STAGE_11_SYSTEM_PROMPT,
        userMessage: userMessage + structuredInstruction("11", current),
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 11",
        stageNumber: "11",
        stageName: "Integrity Testing",
      }), sink),
    )) {
        output += delta;
        yield { delta };
      }


    const { error: updateErr } = await saveStructuredStage(
      () => supabaseAdmin
      .from("sessions")
      .update({
        stage_11_output: output,
        stage_11_error: null,
        stage_status: "complete:11",
        // Stamp the pressure-test logic generation so pre- and post-V2 runs
        // are never treated as comparable.
        stage_11_logic_version: STAGE_11_LOGIC_VERSION,
        ...(() => {
          const v = resolveStructuredRecord("11", splitStructured(sink.raw).block, output, {
            expectedCount: s10?.scores?.length ?? propositionCount,
            stage10Eliminated: (s10?.scores ?? []).filter((r) => r.code_verdict === "ELIMINATED").map((r) => r.smp),
            current,
          });
          return { stage_11_structured: v.structured, stage_11_structured_error: v.error };
        })(),
      } as never)
      .eq("id", data.sessionId),
      (message) => supabaseAdmin.from("sessions").update({ stage_11_error: message }).eq("id", data.sessionId),
      "Stage 11 structured output save",
    );
    if (updateErr) throw new Error(`Failed to save Stage 11 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
