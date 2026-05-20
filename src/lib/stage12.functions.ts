import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_12_SYSTEM_PROMPT, buildStage12UserMessage } from "./stage12-prompt";

const Input = z.object({ sessionId: z.string().uuid() });

export const runStage12 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_2_output, stage_10_output, stage_11_output, stage_12_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_11_output) throw new Error("Stage 11 output missing — cannot run Stage 12");
    if (session.stage_12_output) return { output: session.stage_12_output };

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 12, status: "running", stage_12_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage12UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage11Output: session.stage_11_output,
      stage10Output: session.stage_10_output ?? "",
      cmm: session.stage_2_output ?? "",
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
          temperature: 0.5,
          system: STAGE_12_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await supabaseAdmin.from("sessions").update({ stage_12_error: `Network: ${msg}` }).eq("id", data.sessionId);
      throw new Error(`Claude API request failed: ${msg}`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      const msg = `Claude API ${resp.status}: ${body.slice(0, 500)}`;
      await supabaseAdmin.from("sessions").update({ stage_12_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const json = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const output = (json.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n")
      .trim();
    if (!output) {
      const msg = "Claude returned an empty Stage 12 response";
      await supabaseAdmin.from("sessions").update({ stage_12_error: msg }).eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_12_output: output, stage_12_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 12 output: ${updateErr.message}`);

    return { output };
  });

// Save the human's SMP selection (proposition line + field name).
const SaveSelection = z.object({
  sessionId: z.string().uuid(),
  smpLine: z.string().min(1).max(1000),
  fieldName: z.string().min(1).max(500),
});

export const saveSelectedSMP = createServerFn({ method: "POST" })
  .inputValidator((i) => SaveSelection.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        selected_smp: data.smpLine,
        selected_smp_field_name: data.fieldName,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to save SMP selection: ${error.message}`);
    return { ok: true };
  });

// Save the six-field rationale and confirm Checkpoint C.
const SaveRationale = z.object({
  sessionId: z.string().uuid(),
  rationale: z.record(z.string(), z.string().max(5000)),
});

export const saveSelectionRationale = createServerFn({ method: "POST" })
  .inputValidator((i) => SaveRationale.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        selection_rationale: data.rationale,
        checkpoint_c_confirmed: true,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to save selection rationale: ${error.message}`);
    return { ok: true };
  });
