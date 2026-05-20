import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } from "./stage9-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage9 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_7_output, stage_8_output, stage_9_output, checkpoint_b_confirmed")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 9");
    if (!session.checkpoint_b_confirmed) throw new Error("Checkpoint B not confirmed — cannot run Stage 9");
    if (session.stage_9_output) return { output: session.stage_9_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 9, status: "running", stage_9_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage9UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      cmm: session.stage_2_output ?? "",
      stage7DominantSignal: session.stage_7_output ?? undefined,
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
          temperature: 0.4,
          system: STAGE_9_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await supabaseAdmin.from("sessions").update({ stage_9_error: `Network: ${msg}` }).eq("id", data.sessionId);
      throw new Error(`Claude API request failed: ${msg}`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      const msg = `Claude API ${resp.status}: ${body.slice(0, 500)}`;
      await supabaseAdmin.from("sessions").update({ stage_9_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const json = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const output = (json.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n")
      .trim();
    if (!output) {
      const msg = "Claude returned an empty Stage 9 response";
      await supabaseAdmin.from("sessions").update({ stage_9_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_9_output: output, stage_9_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 9 output: ${updateErr.message}`);

    return { output };
  });
