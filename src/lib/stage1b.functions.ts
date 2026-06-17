import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_1B_SYSTEM_PROMPT, buildStage1bUserMessage } from "./stage1b-prompt";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";

const RunStage1bInput = z.object({ sessionId: z.string().uuid() });

export const runStage1b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage1bInput.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 1, "Stage 1B");
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brief_text, stage_1_output, stage_1b_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 1B");
    if (session.stage_1b_output) {
      yield { delta: session.stage_1b_output };
      yield { done: true as const, output: session.stage_1b_output };
      return;
    }

    const userMessage = buildStage1bUserMessage({
      stage1Output: session.stage_1_output,
      briefText: session.brief_text,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_1B_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 1B",
        stageNumber: "1B",
        stageName: "Brief Enhancement",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 1B failed";
      throw e instanceof Error ? e : new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_1b_output: output })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 1B output: ${updateErr.message}`);

    yield { done: true as const, output };
  });

const ResubmitBriefInput = z.object({
  sessionId: z.string().uuid(),
  additionalBrief: z.string().min(20).max(50000),
});

export const resubmitBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ResubmitBriefInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brief_text")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);

    const enriched = `${session.brief_text}\n\n---\nADDITIONAL BRIEF INFORMATION (Stage 1B responses):\n${data.additionalBrief}`;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        brief_text: enriched,
        stage_1_output: null,
        stage_1_tension_score: null,
        stage_1b_required: false,
        stage_1b_output: null,
        stage_1_error: null,
        current_stage: 1,
        status: "running",
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to resubmit brief: ${updateErr.message}`);

    return { ok: true };
  });
