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
import { callClaude } from "./claude.server";
import { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } from "./stage6-prompt";
import { trimCMMForDownstream } from "./context-trim";

const RunStage6Input = z.object({ sessionId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminAny = supabaseAdmin as any;

function scheduleBackground(p: Promise<unknown>): void {
  const ctx = (globalThis as unknown as { __cfCtx?: { waitUntil?: (p: Promise<unknown>) => void } })
    .__cfCtx;
  const wu = ctx?.waitUntil?.bind(ctx);
  const wrapped = p.catch((e) => console.error("[stage6 bg]", e));
  if (typeof wu === "function") wu(wrapped);
  else void wrapped;
}

async function runStage6Background(sessionId: string): Promise<void> {
  try {
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, strategic_mode, stage_2_output, stage_3_output, stage_5_output")
      .eq("id", sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 6");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 6");
    if (!session.stage_5_output) throw new Error("Stage 5 output (Insights) missing — cannot run Stage 6");

    const userMessage = buildStage6UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      stage5Output: session.stage_5_output,
      cmm: trimCMMForDownstream(session.stage_2_output),
      constraintMatrix: session.stage_3_output,
    });

    const output = await callClaude({
      systemPrompt: STAGE_6_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2500,
      temperature: 0.7,
      sessionId,
      stageLabel: "Stage 6",
      stageNumber: "6",
      stageName: "Insight Validation",
    });

    await adminAny
      .from("sessions")
      .update({
        stage_6_output: output,
        stage_6_status: "complete",
        stage_6_error: null,
      })
      .eq("id", sessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stage 6 failed";
    console.error(`[stage6] background generation failed: ${msg}`);
    await adminAny
      .from("sessions")
      .update({ stage_6_status: "error", stage_6_error: msg })
      .eq("id", sessionId);
  }
}

export const runStage6 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage6Input.parse(input))
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_6_output, stage_6_status")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

    // Already done — let the client load existing output.
    if (session.stage_6_output) {
      return { status: "complete" as const };
    }
    // Already running — do not double-schedule.
    if (session.stage_6_status === "generating") {
      return { status: "generating" as const };
    }

    await adminAny
      .from("sessions")
      .update({
        current_stage: 6,
        status: "running",
        stage_6_status: "generating",
        stage_6_error: null,
      })
      .eq("id", data.sessionId);

    scheduleBackground(runStage6Background(data.sessionId));

    return { status: "generating" as const };
  });
