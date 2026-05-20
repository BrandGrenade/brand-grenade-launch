import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_2_SYSTEM_PROMPT, buildStage2UserMessage } from "./stage2-prompt";

const RunStage2Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage2 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage2Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, strategic_mode, stage_1_output, stage_1b_output, stage_2_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output)
      throw new Error("Stage 1 output missing — cannot run Stage 2");

    // Idempotent.
    if (session.stage_2_output) return { output: session.stage_2_output };

    // Mark current_stage = 2 / running.
    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 2, status: "running", stage_2_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage2UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      sanitisedBrief: session.stage_1_output,
      stage1bOutput: session.stage_1b_output ?? null,
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
          max_tokens: 8192,
          temperature: 0.7,
          system: STAGE_2_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_2_error: `Network: ${msg}` })
        .eq("id", data.sessionId);
      throw new Error(`Claude API request failed: ${msg}`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      const msg = `Claude API ${resp.status}: ${body.slice(0, 500)}`;
      await supabaseAdmin
        .from("sessions")
        .update({ stage_2_error: msg })
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
      const msg = "Claude returned an empty Stage 2 response";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_2_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_2_output: output, stage_2_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 2 output: ${updateErr.message}`);

    return { output };
  });
