import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import {
  getStage16SystemPrompt,
  buildStage16UserMessage,
  type Stage16Format,
} from "./stage16-prompt";

const FormatSchema = z.enum(["agency", "consulting", "workshop"]);
const Input = z.object({
  sessionId: z.string().uuid(),
  format: FormatSchema,
  force: z.boolean().optional(),
});

const COLUMN_BY_FORMAT: Record<
  Stage16Format,
  "stage_16_agency_output" | "stage_16_consulting_output" | "stage_16_workshop_output"
> = {
  agency: "stage_16_agency_output",
  consulting: "stage_16_consulting_output",
  workshop: "stage_16_workshop_output",
};

const MAX_TOKENS_BY_FORMAT: Record<Stage16Format, number> = {
  consulting: 5000,
  agency: 4000,
  workshop: 4000,
};

const MIN_LENGTH_BY_FORMAT: Record<Stage16Format, number> = {
  consulting: 20000,
  agency: 15000,
  workshop: 18000,
};

const REQUIRED_SECTIONS: Record<Stage16Format, string[]> = {
  consulting: ["PART TEN", "Brand Grenade Strategy"],
  agency: ["PART NINE", "Brand Grenade Strategy"],
  workshop: ["APPENDIX B", "Brand Grenade Strategy"],
};

const COMPLETION_CHARS = new Set([".", "!", "?", '"', "'", ")", "*"]);

function isTruncated(output: string, format: Stage16Format): boolean {
  const trimmed = output.trim();
  if (!trimmed) return true;
  if (trimmed.length < MIN_LENGTH_BY_FORMAT[format]) return true;
  for (const section of REQUIRED_SECTIONS[format]) {
    if (!trimmed.includes(section)) return true;
  }
  const lastChar = trimmed.slice(-1);
  if (!COMPLETION_CHARS.has(lastChar)) return true;
  return false;
}

const CONTINUATION_SYSTEM = `You are continuing a brand strategy document that was cut off mid-generation. Complete the document from exactly where it stopped. Do not repeat content already written. Do not add a preamble or explain that you are continuing. Begin immediately from the next word after the cutoff point. End with the footer 'Brand Grenade Strategy Intelligence System'.`;

function buildContinuationMessage(currentOutput: string): string {
  return `The document stopped here — complete it from this point:

...${currentOutput.slice(-500)}

Complete all remaining sections of the document through to the final footer.`;
}

export const runStage16 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session)
      throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_15_output)
      throw new Error("Stage 15 audit missing — Stage 16 cannot proceed");

    const column = COLUMN_BY_FORMAT[data.format];

    if (data.force) {
      const clearUpdate =
        column === "stage_16_agency_output"
          ? { stage_16_agency_output: null, stage_16_error: null }
          : column === "stage_16_consulting_output"
          ? { stage_16_consulting_output: null, stage_16_error: null }
          : { stage_16_workshop_output: null, stage_16_error: null };
      await supabaseAdmin
        .from("sessions")
        .update(clearUpdate)
        .eq("id", data.sessionId);
    } else {
      const existing = session[column] as string | null | undefined;
      if (existing && !isTruncated(existing, data.format)) {
        if (session.status !== "complete") {
          await supabaseAdmin
            .from("sessions")
            .update({
              status: "complete",
              current_stage: 16,
              stage_16_error: null,
              stage_16_format: data.format,
            })
            .eq("id", data.sessionId);
        }
        yield { delta: existing };
        yield { done: true as const, output: existing, format: data.format };
        return;
      }
    }

    await supabaseAdmin
      .from("sessions")
      .update({
        current_stage: 16,
        status: "running",
        stage_16_error: null,
        stage_16_format: data.format,
      })
      .eq("id", data.sessionId);

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: getStage16SystemPrompt(data.format),
        maxTokens: MAX_TOKENS_BY_FORMAT[data.format],
        userMessage: buildStage16UserMessage({
          brandName: session.brand_name,
          category: session.category,
          formatVariant: data.format,
          stage1Output: session.stage_1_output ?? "",
          stage2Output: session.stage_2_output ?? "",
          stage7Output: session.stage_7_output ?? "",
          stage8Output: session.stage_8_output ?? "",
          stage10Output: session.stage_10_output ?? "",
          stage11Output: session.stage_11_output ?? "",
          stage12Output: session.stage_12_output ?? "",
          stage13Output: session.stage_13_output ?? "",
          stage13bOutput: session.stage_13b_output ?? "",
          stage14Output: session.stage_14_output ?? "",
          stage14bOutput: session.stage_14b_output ?? "",
          stage14cOutput: session.stage_14c_output ?? "",
          stage15Output: session.stage_15_output ?? "",
          selectedSmp: session.selected_smp ?? "",
          selectionRationale: session.selection_rationale_1 ?? "",
        }),
        sessionId: data.sessionId,
        stageLabel: "Stage 16",
        stageNumber: "16",
        stageName: "Document Assembly",
      })) {
        output += delta;
        yield { delta };
      }

      // Truncation detection + up to 2 continuation calls.
      let continuations = 0;
      while (continuations < 2 && isTruncated(output, data.format)) {
        continuations++;
        console.log(
          "Stage 16 truncation detected for format:",
          data.format,
          "Output length:",
          output.length,
          "Last characters:",
          output.slice(-100),
        );
        for await (const delta of streamClaude({
          systemPrompt: CONTINUATION_SYSTEM,
          userMessage: buildContinuationMessage(output),
          maxTokens: 6000,
          temperature: 0.5,
          sessionId: data.sessionId,
          stageLabel: `Stage 16 continuation ${continuations}`,
          stageNumber: "16",
          stageName: "Document Assembly",
        })) {
          // ensure a separator so we don't fuse mid-word
          if (!output.endsWith(" ") && !output.endsWith("\n") && !delta.startsWith(" ") && !delta.startsWith("\n")) {
            output += " ";
            yield { delta: " " };
          }
          output += delta;
          yield { delta };
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Stage 16 (${data.format}) failed`;
      await supabaseAdmin
        .from("sessions")
        .update({ stage_16_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const outputUpdate =
      data.format === "agency"
        ? { stage_16_agency_output: output }
        : data.format === "consulting"
        ? { stage_16_consulting_output: output }
        : { stage_16_workshop_output: output };

    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({
        ...outputUpdate,
        stage_16_error: null,
        status: "complete",
      })
      .eq("id", data.sessionId);
    if (ue)
      throw new Error(
        `Failed to save Stage 16 (${data.format}) output: ${ue.message}`,
      );

    yield {
      done: true as const,
      output,
      format: data.format,
      complete: !isTruncated(output, data.format),
    };
  });
