// Stage 6 — background-job model.
//
// Cloudflare Workers kills long-running streaming HTTP responses, which made
// Stage 6 stall mid-generation. This handler now returns immediately:
//   1. Marks stage_6_status = 'generating' in Supabase
//   2. Schedules the actual Claude call via ctx.waitUntil so it runs OUTSIDE
//      the request lifecycle (no per-request timeout pressure)
//   3. Returns { status: 'generating' } to the client
//
// The client polls sessions.stage_6_status every few seconds and loads
// stage_6_output once status flips to 'complete'.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { saveStageOutputInBackground } from "./save-stage-output.server";
import { streamClaude } from "./claude.server";
import { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } from "./stage6-prompt";
import { trimCMMForDownstream } from "./context-trim";

const RunStage6Input = z.object({ sessionId: z.string().uuid() });

export const runStage6 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage6Input.parse(input))
  .handler(async function* ({ data }) {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_2_output, stage_3_output, stage_5_output, stage_6_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 6");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 6");
    if (!session.stage_5_output) throw new Error("Stage 5 output (Insights) missing — cannot run Stage 6");
    if (session.stage_6_output) {
      yield { delta: session.stage_6_output };
      yield { done: true as const, output: session.stage_6_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 6, status: "running", stage_6_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage6UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      stage5Output: session.stage_5_output,
      cmm: trimCMMForDownstream(session.stage_2_output),
      constraintMatrix: session.stage_3_output,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_6_SYSTEM_PROMPT,
        userMessage,
        // Shorter max_tokens (1500) so the stream completes well within
        // intermediary timeouts. Combined with the 8s zero-width-space
        // heartbeat in streamClaude, this keeps the Worker connection alive.
        maxTokens: 1500,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 6",
        stageNumber: "6",
        stageName: "Insight Validation",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 6 failed";
      await supabaseAdmin.from("sessions").update({ stage_6_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    saveStageOutputInBackground(
      data.sessionId,
      { stage_6_output: output, stage_6_error: null },
      "stage_6_error",
      "Stage 6",
    );

    yield { done: true as const, output };
  });
