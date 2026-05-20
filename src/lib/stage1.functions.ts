import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_1_SYSTEM_PROMPT, buildStage1UserMessage } from "./stage1-prompt";

const CreateSessionInput = z.object({
  brandName: z.string().min(1).max(200),
  category: z.string().min(1).max(200),
  strategicMode: z.string().min(1).max(200),
  briefText: z.string().min(20).max(50000),
  devMode: z.boolean().optional(),
});

export const createSession = createServerFn({ method: "POST" })
  .inputValidator((input) => CreateSessionInput.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        brand_name: data.brandName,
        category: data.category,
        strategic_mode: data.strategicMode,
        brief_text: data.briefText,
        status: "running",
        current_stage: 1,
        dev_mode: data.devMode ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return { sessionId: row.id as string };
  });

const RunStage1Input = z.object({
  sessionId: z.string().uuid(),
});

interface Stage1Result {
  output: string;
  tensionScore: number | null;
  stage1bRequired: boolean;
}

function extractTensionScore(text: string): number | null {
  // Looks for "Strategic Tension Score: N/10" (case-insensitive, tolerates **).
  const m = text.match(/Strategic\s+Tension\s+Score\s*[:\-]?\s*\**\s*(\d{1,2})\s*\/\s*10/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

export const runStage1 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage1Input.parse(input))
  .handler(async ({ data }): Promise<Stage1Result> => {
    // Load session
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, strategic_mode, brief_text, stage_1_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);

    // Idempotent: if already complete, return cached result
    if (session.stage_1_output) {
      const score = extractTensionScore(session.stage_1_output);
      return {
        output: session.stage_1_output,
        tensionScore: score,
        stage1bRequired: score !== null && score < 7,
      };
    }

    const userMessage = buildStage1UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      briefText: session.brief_text,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_1_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 4096,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 1",
      stageNumber: "1",
      stageName: "Brief Analysis",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 1 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_1_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const tensionScore = extractTensionScore(output);
    const stage1bRequired = tensionScore !== null && tensionScore < 7;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_1_output: output,
        stage_1_tension_score: tensionScore,
        stage_1b_required: stage1bRequired,
        stage_1_error: null,
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 1 output: ${updateErr.message}`);

    return { output, tensionScore, stage1bRequired };
  });
