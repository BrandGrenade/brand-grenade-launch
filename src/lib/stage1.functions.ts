import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_1_SYSTEM_PROMPT, buildStage1UserMessage } from "./stage1-prompt";

const CreateSessionInput = z.object({
  brandName: z.string().min(1).max(200),
  category: z.string().min(1).max(200),
  strategicMode: z.string().min(1).max(200),
  briefText: z.string().min(20).max(50000),
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

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

    let resp: Response;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          temperature: 0.7,
          system: STAGE_1_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_1_error: `Network: ${msg}` })
        .eq("id", data.sessionId);
      throw new Error(`Claude API request failed: ${msg}`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      const msg = `Claude API ${resp.status}: ${body.slice(0, 500)}`;
      await supabaseAdmin
        .from("sessions")
        .update({ stage_1_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const json = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const output = (json.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n")
      .trim();

    if (!output) {
      const msg = "Claude returned an empty response";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_1_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
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
