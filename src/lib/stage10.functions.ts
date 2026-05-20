import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_10_SYSTEM_PROMPT, buildStage10UserMessage } from "./stage10-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage10 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_8_output, stage_9_output, stage_10_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 10");
    if (!session.stage_9_output) throw new Error("Stage 9 output missing — cannot run Stage 10");
    if (session.stage_10_output) return { output: session.stage_10_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 10, status: "running", stage_10_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage10UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      stage9Output: session.stage_9_output,
      stage1Output: session.stage_1_output ?? "",
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
          temperature: 0.3,
          system: STAGE_10_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await supabaseAdmin.from("sessions").update({ stage_10_error: `Network: ${msg}` }).eq("id", data.sessionId);
      throw new Error(`Claude API request failed: ${msg}`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      const msg = `Claude API ${resp.status}: ${body.slice(0, 500)}`;
      await supabaseAdmin.from("sessions").update({ stage_10_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const json = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const output = (json.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n")
      .trim();
    if (!output) {
      const msg = "Claude returned an empty Stage 10 response";
      await supabaseAdmin.from("sessions").update({ stage_10_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_10_output: output, stage_10_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 10 output: ${updateErr.message}`);

    return { output };
  });
