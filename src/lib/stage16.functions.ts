import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import {
  buildSectionUserMessage,
  getSectionsForFormat,
  type SessionForStage16,
  type Stage16Format,
} from "./stage16-sections";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const FormatSchema = z.enum(["agency", "consulting", "workshop", "vision"]);
const Input = z.object({
  sessionId: z.string().uuid(),
  format: FormatSchema,
  force: z.boolean().optional(),
});

const COLUMN_BY_FORMAT: Record<
  Stage16Format,
  | "stage_16_agency_output"
  | "stage_16_consulting_output"
  | "stage_16_workshop_output"
  | "stage_16_vision_output"
> = {
  agency: "stage_16_agency_output",
  consulting: "stage_16_consulting_output",
  workshop: "stage_16_workshop_output",
  vision: "stage_16_vision_output",
};

function documentHeader(brand: string, category: string, format: Stage16Format): string {
  const title =
    format === "consulting"
      ? "BOARD STRATEGY RECOMMENDATION"
      : format === "agency"
        ? "STRATEGIC PLATFORM"
        : format === "vision"
          ? "STRATEGY AND CREATIVE VISION"
          : "BRAND STRATEGY WORKSHOP";
  return `# ${title}\n## ${brand} — ${category}\n\n*Brand Grenade Strategy Intelligence System*\n\n---\n`;
}

const DOCUMENT_FOOTER = `\n---\n\n*Brand Grenade Strategy Intelligence System*\n*Confidential*\n`;

export const runStage16 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 16);
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
    const existing = (session as Record<string, unknown>)[column] as string | null | undefined;

    // Reuse cached output unless forced.
    if (!data.force && existing && existing.trim().length > 1000) {
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
      yield { done: true as const, output: existing, format: data.format, complete: true };
      return;
    }

    if (data.force) {
      const clearUpdate =
        column === "stage_16_agency_output"
          ? { stage_16_agency_output: null, stage_16_error: null }
          : column === "stage_16_consulting_output"
            ? { stage_16_consulting_output: null, stage_16_error: null }
            : column === "stage_16_vision_output"
              ? { stage_16_vision_output: null, stage_16_error: null }
              : { stage_16_workshop_output: null, stage_16_error: null };
      await supabaseAdmin
        .from("sessions")
        .update(clearUpdate as never)
        .eq("id", data.sessionId);
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

    const brand = session.brand_name ?? "Untitled Brand";
    const category = session.category ?? "";
    const selectedSmp = session.selected_smp ?? "";

    const sessionForSections: SessionForStage16 = {
      brand_name: session.brand_name,
      category: session.category,
      selected_smp: session.selected_smp,
      selection_rationale_1: session.selection_rationale_1 ?? null,
      stage_1_output: session.stage_1_output ?? null,
      stage_2_output: session.stage_2_output ?? null,
      stage_5_output: session.stage_5_output ?? null,
      stage_7_output: session.stage_7_output ?? null,
      stage_8_output: session.stage_8_output ?? null,
      stage_10_output: session.stage_10_output ?? null,
      stage_11_output: session.stage_11_output ?? null,
      stage_12_output: session.stage_12_output ?? null,
      stage_13_output: session.stage_13_output ?? null,
      stage_14_output: session.stage_14_output ?? null,
      stage_14b_output: session.stage_14b_output ?? null,
      stage_14c_output: session.stage_14c_output ?? null,
      stage_15_output: session.stage_15_output ?? null,
    };

    const sections = getSectionsForFormat(data.format, sessionForSections);
    const parts: string[] = [];
    const header = documentHeader(brand, category, data.format);
    parts.push(header);
    yield { delta: header };

    try {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        // Emit section-start event so the UI can show "Writing: X (Section i+1 of N)".
        yield {
          section: {
            index: i,
            total: sections.length,
            name: section.name,
            title: section.title,
          },
        };

        const userMessage = buildSectionUserMessage(section, brand, category);
        let body: string;
        try {
          body = await callClaude({
            systemPrompt: section.systemPrompt,
            userMessage,
            maxTokens: section.maxTokens,
            sessionId: data.sessionId,
            stageLabel: `Stage 16 — ${section.name}`,
            stageNumber: "16",
            stageName: "Document Assembly",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "section call failed";
          // Don't fail the entire document for one section — note the gap and move on.
          body = `*[Section "${section.title}" could not be generated: ${msg}]*`;
        }

        let sectionBlock = `\n# ${section.title}\n\n${body.trim()}\n`;

        if (section.includesPropositionReveal && selectedSmp) {
          // Replace the "PROPOSITION REVEAL:" placeholder if the model produced it,
          // otherwise append the reveal at the end of the section body.
          const revealBlock = `\n\n> # "${selectedSmp}"\n\n`;
          if (/PROPOSITION REVEAL:\s*/i.test(sectionBlock)) {
            sectionBlock = sectionBlock.replace(
              /PROPOSITION REVEAL:\s*/i,
              revealBlock,
            );
          } else {
            sectionBlock += revealBlock;
          }
        }

        parts.push(sectionBlock);
        yield { delta: sectionBlock };
      }

      parts.push(DOCUMENT_FOOTER);
      yield { delta: DOCUMENT_FOOTER };
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Stage 16 (${data.format}) failed`;
      await supabaseAdmin
        .from("sessions")
        .update({ stage_16_error: msg })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const output = parts.join("\n");

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
      complete: true,
    };
  });
