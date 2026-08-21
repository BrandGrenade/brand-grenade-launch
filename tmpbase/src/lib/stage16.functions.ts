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
import { assertSessionAccess } from "@/lib/auth-helpers.server";
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
    await assertSessionAccess(data.sessionId, context.userId);
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

    // Document Assembly may ONLY run after the full pipeline has finished:
    // Phase 2 stages 17–22 must have output and the two Phase 2 human
    // checkpoints (D — territory selection, E — detonation selection) must
    // be confirmed. Without these the vision document fabricates a
    // Detonation section. The vision format is the strictest because it
    // mixes Phase 1 + Phase 2 content; the other three formats also wait so
    // a single click on the deliverables page produces a coherent set.
    const s = session as Record<string, unknown>;
    const phase2Ready =
      typeof s.stage_22_output === "string" && (s.stage_22_output as string).trim().length > 0 &&
      typeof s.stage_17_selected_territory === "string" && (s.stage_17_selected_territory as string).trim().length > 0 &&
      typeof s.stage_18_selected_detonation === "string" && (s.stage_18_selected_detonation as string).trim().length > 0;
    const cachedColumn = COLUMN_BY_FORMAT[data.format];
    const cachedExisting = s[cachedColumn] as string | null | undefined;
    const hasCachedOutput =
      !data.force && typeof cachedExisting === "string" && cachedExisting.trim().length > 1000;
    if (!phase2Ready && !hasCachedOutput) {
      throw new Error(
        "Document Assembly is locked until the full pipeline is complete. " +
          "Finish Phase 2 (Stages 17–22), select a Creative Territory (Checkpoint D), " +
          "and select the Detonation (Checkpoint E) before generating any document format.",
      );
    }

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
              stage_status: "complete:16",
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
      if (data.format === "vision") {
        // Vision is generated as a single unified narrative.
        yield {
          section: {
            index: 0,
            total: 1,
            name: "vision_document",
            title: "STRATEGY AND CREATIVE VISION",
          },
        };

        const { STAGE_16_VISION_PROMPT, getStage16SystemPrompt } = await import(
          "./stage16-prompt"
        );
        void STAGE_16_VISION_PROMPT;
        const systemPrompt = getStage16SystemPrompt("vision");

        const visionUserMessage = `BRAND: ${brand}
CATEGORY: ${category}
SELECTED PROPOSITION: "${selectedSmp}"

COMPLETE PIPELINE INTELLIGENCE — use exclusively as your evidential foundation. Do not invent.

STRATEGIC BRIEF:
${session.stage_1_output ?? ""}

COMPETITIVE INTELLIGENCE:
${session.stage_2_output ?? ""}

STRATEGIC TERRITORIES:
${session.stage_7_output ?? ""}

ALL PROPOSITIONS GENERATED:
${session.stage_8_output ?? ""}

PROPOSITION PRESSURE TESTS:
${session.stage_11_output ?? ""}

SELECTION RATIONALE:
${session.stage_12_output ?? ""}

BRAND FIT ASSESSMENT:
${session.stage_13_output ?? ""}

CREATIVE TERRITORY MAPPING:
${session.stage_14_output ?? ""}

CHANNEL EXPRESSION MAPPING:
${session.stage_14b_output ?? ""}

BRAND WORLD DEFINITION:
${session.stage_14c_output ?? ""}

CONSISTENCY AUDIT:
${session.stage_15_output ?? ""}

MASTER DETONATION LINE — short hero headline selected at Checkpoint E (Stage 18). Output verbatim — exact words, exact casing, no quotes added, no trailing punctuation. If the field below reads "[PENDING…]", write "*[Pending — Detonation not yet selected]*" under the THE DETONATION heading and DO NOT invent a headline:
${(s.stage_18_detonation_line as string | undefined)?.trim() || "[PENDING — Checkpoint E not confirmed]"}

MASTER DETONATION STATEMENT — longer explanatory sentence from Stage 18 (Checkpoint E). If "[PENDING…]", write "*[Pending — Detonation not yet selected]*" and DO NOT invent:
${(s.stage_18_selected_detonation as string | undefined)?.trim() || "[PENDING — Checkpoint E not confirmed]"}

SELECTED CREATIVE TERRITORY — chosen at Checkpoint D (Stage 17). If "[PENDING…]", write "*[Pending — Territory not yet selected]*" and DO NOT invent:
${(s.stage_17_selected_territory as string | undefined)?.trim() || "[PENDING — Checkpoint D not confirmed]"}

STAGE 17 — DETONATION TERRITORY (full output, source of truth for territory directions):
${(s.stage_17_output as string | undefined) ?? "[PENDING — Stage 17 not yet run]"}

STAGE 17B — DETONATION INTELLIGENCE:
${(s.stage_17b_output as string | undefined) ?? "[PENDING — Stage 17B not yet run]"}

STAGE 18 — DETONATION SPRINGBOARDS (creative directions that EXPRESS the master detonation; never present a springboard as the master detonation itself):
${(s.stage_18_output as string | undefined) ?? "[PENDING — Stage 18 not yet run]"}

STAGE 19 — ACTIVATION ARCHITECTURE:
${(s.stage_19_output as string | undefined) ?? "[PENDING — Stage 19 not yet run]"}

STAGE 20 — MASTER DETONATION BRIEF:
${(s.stage_20_output as string | undefined) ?? "[PENDING — Stage 20 not yet run]"}

STAGE 20B — CHANNEL STRATEGY:
${(s.stage_20b_output as string | undefined) ?? "[PENDING — Stage 20B not yet run]"}

STAGE 21 — CHANNEL DETONATION BRIEFS (JSON map of channel → brief):
${typeof s.stage_21_outputs === "object" && s.stage_21_outputs ? JSON.stringify(s.stage_21_outputs, null, 2) : "[PENDING — Stage 21 not yet run]"}

STAGE 22 — BRAND ARCHITECTURE:
${(s.stage_22_output as string | undefined) ?? "[PENDING — Stage 22 not yet run]"}
${(s.stage_22_brand_architecture as string | undefined) ?? ""}
${(s.stage_22_distinctive_assets as string | undefined) ?? ""}

ABSOLUTE RULE: Never invent, infer, or "derive" content for any section whose source above reads "[PENDING…]". For any such section, output a single italic line in its place: "*[Pending — upstream stage not complete]*". Do not write headlines, taglines, ranked springboards, primary recommendations, or executional ideas that are not present verbatim or paraphrased from the supplied source material. Fabrication of Detonation content is the specific failure this rule exists to prevent.

Write the complete STRATEGY AND CREATIVE VISION document now. Begin immediately. Your first character must be #.`;

        let visionBody: string;
        try {
          visionBody = await callClaude({
            systemPrompt,
            userMessage: visionUserMessage,
            maxTokens: 64000,
            sessionId: data.sessionId,
            stageLabel: "Stage 16 — Strategy and Creative Vision",
            stageNumber: "16",
            stageName: "Document Assembly",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "vision call failed";
          visionBody = `*[Strategy and Creative Vision could not be generated: ${msg}]*`;
        }

        const visionBlock = `\n${visionBody.trim()}\n`;
        parts.push(visionBlock);
        yield { delta: visionBlock };
        parts.push(DOCUMENT_FOOTER);
        yield { delta: DOCUMENT_FOOTER };
      } else {
        // Compute the target output column once so we can persist per-section.
        const outputColumnName: "stage_16_agency_output" | "stage_16_consulting_output" | "stage_16_workshop_output" =
          data.format === "agency"
            ? "stage_16_agency_output"
            : data.format === "consulting"
              ? "stage_16_consulting_output"
              : "stage_16_workshop_output";

        const persistPartial16 = async (errorMsg: string | null) => {
          try {
            const snapshot = parts.join("\n");
            await supabaseAdmin
              .from("sessions")
              .update({
                [outputColumnName]: snapshot.length > 0 ? snapshot : null,
                stage_16_error: errorMsg,
              } as never)
              .eq("id", data.sessionId);
          } catch {
            // best-effort
          }
        };

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

          // Persist after EVERY section so a Worker death leaves the last
          // completed section recoverable instead of blanking the run.
          await persistPartial16(null);
        }

        parts.push(DOCUMENT_FOOTER);
        yield { delta: DOCUMENT_FOOTER };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Stage 16 (${data.format}) failed`;
      // Persist whatever we have alongside the error so partial progress is not lost.
      try {
        const snapshot = parts.join("\n");
        const outputColumnName =
          data.format === "agency"
            ? "stage_16_agency_output"
            : data.format === "consulting"
              ? "stage_16_consulting_output"
              : data.format === "vision"
                ? "stage_16_vision_output"
                : "stage_16_workshop_output";
        await supabaseAdmin
          .from("sessions")
          .update({
            [outputColumnName]: snapshot.length > 0 ? snapshot : null,
            stage_16_error: msg,
            status: "interrupted",
          } as never)
          .eq("id", data.sessionId);
      } catch {
        // best-effort
      }
      throw new Error(msg);
    }

    const output = parts.join("\n");

    const outputUpdate =
      data.format === "agency"
        ? { stage_16_agency_output: output }
        : data.format === "consulting"
          ? { stage_16_consulting_output: output }
          : data.format === "vision"
            ? { stage_16_vision_output: output }
            : { stage_16_workshop_output: output };

    const { error: ue } = await supabaseAdmin
      .from("sessions")
      .update({
        ...outputUpdate,
        stage_16_error: null,
        status: "complete",
        stage_status: "complete:16",
      } as never)
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
