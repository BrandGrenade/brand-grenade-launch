import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_1_SYSTEM_PROMPT, buildStage1UserMessage } from "./stage1-prompt";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";

const BriefFieldsSchema = z
  .object({
    briefTitle: z.string().max(500).default(""),
    brandName: z.string().max(500).default(""),
    category: z.string().max(500).default(""),
    date: z.string().max(40).default(""),
    submittedBy: z.string().max(500).default(""),
    sections: z.record(z.string(), z.string().max(20000)).default({}),
    supportingMaterials: z.array(z.string().max(500)).default([]),
  })
  .optional();

const CreateSessionInput = z.object({
  brandName: z.string().min(1).max(200),
  category: z.string().min(1).max(200),
  strategicMode: z.string().min(1).max(200),
  briefText: z.string().min(20).max(50000),
  devMode: z.boolean().optional(),
  briefFields: BriefFieldsSchema,
});

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const briefVersions = data.briefFields
      ? [
          {
            version: 1,
            fields: data.briefFields,
            submitted_at: new Date().toISOString(),
          },
        ]
      : [];
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        brand_name: data.brandName,
        category: data.category,
        strategic_mode: data.strategicMode,
        brief_text: data.briefText,
        brief_versions: briefVersions,
        status: "running",
        current_stage: 1,
        dev_mode: data.devMode ?? false,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return { sessionId: row.id as string };
  });



const RunStage1Input = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().max(10000).optional(),
  previousOutput: z.string().max(50000).optional(),
});

function extractTensionScore(text: string): number | null {
  const m = text.match(/Strategic\s+Tension\s+Score\s*[:\-]?\s*\**\s*(\d{1,2})\s*\/\s*10/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

export const runStage1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage1Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, strategic_mode, brief_text, stage_1_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);

    const feedback = data.feedback?.trim();

    if (session.stage_1_output && !feedback) {
      const score = extractTensionScore(session.stage_1_output);
      yield { delta: session.stage_1_output };
      yield {
        done: true as const,
        output: session.stage_1_output,
        tensionScore: score,
        stage1bRequired: score !== null && score < 7,
      };
      return;
    }

    const previousOutput = data.previousOutput?.trim() || session.stage_1_output || null;

    if (feedback) {
      await supabaseAdmin
        .from("sessions")
        .update({ stage_1_output: null, stage_1_tension_score: null, stage_1_error: null })
        .eq("id", data.sessionId);
    }

    let userMessage = buildStage1UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      briefText: session.brief_text,
    });
    if (feedback) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback,
        previousOutput,
        stageLabel: "Stage 1 — Brief Analysis",
      });
      userMessage = `${prefix}${userMessage}${suffix}`;
    }


    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_1_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 1",
        stageNumber: "1",
        stageName: "Brief Analysis",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 1 failed";
      await supabaseAdmin.from("sessions").update({ stage_1_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const tensionScore = extractTensionScore(output);
    // Strict gate: a Stage 1 pass requires an extractable numeric tension
    // score of 7 or higher. A null score (unparseable) is treated as a fail
    // and routes the user into Stage 1B for brief enhancement.
    const stage1bRequired = !(tensionScore !== null && tensionScore >= 7);

    let lastSaveErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabaseAdmin
        .from("sessions")
        .update({ stage_1_output: output, stage_1_tension_score: tensionScore, stage_1b_required: stage1bRequired, stage_1_error: null })
        .eq("id", data.sessionId);
      if (!error) { lastSaveErr = null; break; }
      lastSaveErr = error;
      console.error(`[stage1] save attempt ${attempt + 1} failed: ${error.message}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 5000));
    }
    if (lastSaveErr) throw new Error(`Failed to save Stage 1 output after 3 attempts: ${lastSaveErr.message}`);

    yield { done: true as const, output, tensionScore, stage1bRequired };
  });
