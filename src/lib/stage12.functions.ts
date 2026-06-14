import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_12_SYSTEM_PROMPT, buildStage12UserMessage } from "./stage12-prompt";
import {
  filterValidatedFromStage11,
  parseStage10Scores,
  buildFrozenScoresBlock,
} from "./stage12-filter";

const Input = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().max(5000).optional(),
  previousOutput: z.string().max(50000).optional(),
});

export const runStage12 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_2_output, stage_10_output, stage_11_output, stage_12_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_11_output) throw new Error("Stage 11 output missing — cannot run Stage 12");
    const feedback = data.feedback?.trim();

    if (session.stage_12_output && !feedback) {
      yield { delta: session.stage_12_output };
      yield { done: true as const, output: session.stage_12_output };
      return;
    }

    const previousOutput = data.previousOutput?.trim() || session.stage_12_output || null;

    if (feedback) {
      await supabaseAdmin
        .from("sessions")
        .update({ stage_12_output: null, stage_12_error: null })
        .eq("id", data.sessionId);
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 12, status: "running", stage_12_error: null })
      .eq("id", data.sessionId);

    const stage10Output = session.stage_10_output ?? "";
    const { filteredOutput, validated, eliminated } = filterValidatedFromStage11(session.stage_11_output);
    if (validated.length === 0) {
      throw new Error("Stage 11 produced no VALIDATED SMPs — cannot run Stage 12. Re-run Stage 11 or revisit Stage 8.");
    }
    const scores = parseStage10Scores(stage10Output);
    const frozenScoresBlock = buildFrozenScoresBlock(validated, scores);

    let userMessage = buildStage12UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage11FilteredOutput: filteredOutput,
      frozenScoresBlock,
      stage10Output,
      cmm: session.stage_2_output ?? "",
      stage1Output: session.stage_1_output ?? "",
      validatedCount: validated.length,
      eliminatedCount: eliminated.length,
    });
    if (feedback) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback,
        previousOutput,
        stageLabel: "Stage 12 — Strategic Master Propositions",
      });
      userMessage = `${prefix}${userMessage}${suffix}`;
    }


    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_12_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 6000,
        skipUniversalWrapper: true,
        sessionId: data.sessionId,
        stageLabel: "Stage 12",
        stageNumber: "12",
        stageName: "Proposition Selection",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 12 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_12_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_12_output: output, stage_12_error: null, status: "awaiting_checkpoint" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 12 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });

const SaveSelection = z.object({
  sessionId: z.string().uuid(),
  smpLine: z.string().min(1).max(1000),
  fieldName: z.string().min(1).max(500),
});

export const saveSelectedSMP = createServerFn({ method: "POST" })
  .inputValidator((i) => SaveSelection.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        selected_smp: data.smpLine,
        selected_smp_field_name: data.fieldName,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to save SMP selection: ${error.message}`);
    return { ok: true };
  });

const SaveRationale = z.object({
  sessionId: z.string().uuid(),
  rationale: z.record(z.string(), z.string().max(5000)),
});

export const saveSelectionRationale = createServerFn({ method: "POST" })
  .inputValidator((i) => SaveRationale.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        selection_rationale: data.rationale,
        checkpoint_c_confirmed: true,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to save selection rationale: ${error.message}`);
    return { ok: true };
  });
