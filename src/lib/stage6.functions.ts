import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } from "./stage6-prompt";

const RunStage6Input = z.object({
  sessionId: z.string().uuid(),
});

export const runStage6 = createServerFn({ method: "POST" })
  .inputValidator((input) => RunStage6Input.parse(input))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

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

    if (session.stage_6_output) return { output: session.stage_6_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 6, status: "running", stage_6_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage6UserMessage({
      brandName: session.brand_name,
      category: session.category,
      strategicMode: session.strategic_mode,
      stage5Output: session.stage_5_output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
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
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          temperature: 0.5,
          system: STAGE_6_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_6_error: `Network: ${msg}` })
        .eq("id", data.sessionId);
      throw new Error(`Claude API request failed: ${msg}`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      const msg = `Claude API ${resp.status}: ${body.slice(0, 500)}`;
      await supabaseAdmin
        .from("sessions")
        .update({ stage_6_error: msg })
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
      const msg = "Claude returned an empty Stage 6 response";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_6_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_6_output: output, stage_6_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 6 output: ${updateErr.message}`);

    return { output };
  });
