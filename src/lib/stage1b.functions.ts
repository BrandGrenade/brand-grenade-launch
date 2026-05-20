import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_1B_SYSTEM_PROMPT, buildStage1bUserMessage } from "./stage1b-prompt";

const RunStage1bInput = z.object({
  sessionId: z.string().uuid(),
});

export const runStage1b = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage1bInput.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brief_text, stage_1_output, stage_1b_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 1B");

    // Idempotent.
    if (session.stage_1b_output) return { output: session.stage_1b_output };

    const userMessage = buildStage1bUserMessage({
      stage1Output: session.stage_1_output,
      briefText: session.brief_text,
    });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        temperature: 0.7,
        system: STAGE_1B_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${body.slice(0, 500)}`);
    }

    const json = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const output = (json.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n")
      .trim();

    if (!output) throw new Error("Claude returned an empty Stage 1B response");

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_1b_output: output })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 1B output: ${updateErr.message}`);

    return { output };
  });

// Resubmit brief with additional info → clears Stage 1 + 1B outputs so the
// pipeline re-runs Stage 1 with the enriched brief before reaching Stage 2.
const ResubmitBriefInput = z.object({
  sessionId: z.string().uuid(),
  additionalBrief: z.string().min(20).max(50000),
});

export const resubmitBrief = createServerFn({ method: "POST" })
  .inputValidator((input) => ResubmitBriefInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
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
