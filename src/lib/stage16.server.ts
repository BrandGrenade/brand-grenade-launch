// Stage 16 — Document Assembly core.
//
// The generation logic lives here as an async generator so TWO drivers can
// share one implementation:
//   - runStage16 (stage16.functions.ts) streams events to the browser;
//   - /api/public/stage16-tick drains the same generator in the background,
//     streaming keep-alive bytes so the published runtime cannot cancel a
//     multi-minute document mid-stream (the Stage 20B / 22 failure mode).
//
// Queued-for-generation marker on sessions.stage_16_error:
//   "__STAGE_16_RUNNING__:<format>"                 — queued, unclaimed (set by startStage16)
//   "__STAGE_16_RUNNING__:<format>:claimed:<n>"     — claimed, attempt n; updated_at is the heartbeat
//   anything else                                   — terminal error, not running

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import {
  buildSectionUserMessage,
  getSectionsForFormat,
  type SessionForStage16,
  type Stage16Format,
} from "./stage16-sections";
import { deriveRunFacts, runFactsBlock } from "./run-facts";
import { enforcePropositionFraming } from "./proposition-framing";
import {
  VALUATION_DISCLAIMER,
  VALUATION_READER_GUIDE,
  VALUATION_PROPOSITION_PROVENANCE,
  DOCUMENT_FOOTER,
} from "./valuation-front-matter";

export const STAGE_16_RUNNING = "__STAGE_16_RUNNING__";

export type Stage16Sentinel = {
  running: boolean;
  format: Stage16Format | null;
  claimed: boolean;
  attempt: number;
};

export function parseStage16Sentinel(err: string | null): Stage16Sentinel {
  if (!err || !err.startsWith(`${STAGE_16_RUNNING}:`)) {
    return { running: false, format: null, claimed: false, attempt: 0 };
  }
  const parts = err.slice(STAGE_16_RUNNING.length + 1).split(":");
  const format =
    (["agency", "consulting", "workshop", "vision", "valuation"] as const).find(
      (f) => f === parts[0],
    ) ?? null;
  const claimed = parts[1] === "claimed" && /^\d+$/.test(parts[2] ?? "");
  return { running: true, format, claimed, attempt: claimed ? parseInt(parts[2], 10) : 0 };
}

export const COLUMN_BY_FORMAT: Record<
  Stage16Format,
  | "stage_16_agency_output"
  | "stage_16_consulting_output"
  | "stage_16_workshop_output"
  | "stage_16_vision_output"
  | "stage_16_valuation_output"
> = {
  agency: "stage_16_agency_output",
  consulting: "stage_16_consulting_output",
  workshop: "stage_16_workshop_output",
  vision: "stage_16_vision_output",
  valuation: "stage_16_valuation_output",
};

function documentHeader(brand: string, category: string, format: Stage16Format): string {
  const title =
    format === "consulting"
      ? "BOARD STRATEGY RECOMMENDATION"
      : format === "agency"
        ? "STRATEGIC PLATFORM"
        : format === "vision"
          ? "STRATEGY AND CREATIVE VISION"
          : format === "valuation"
            ? "VALUATION INPUT BRIEF"
            : "BRAND STRATEGY WORKSHOP";
  return `# ${title}\n## ${brand} — ${category}\n\n*Brand Grenade Strategy Intelligence System*\n\n---\n`;
}

export type Stage16Event =
  | { delta: string }
  | { section: { index: number; total: number; name: string; title: string } }
  | { done: true; output: string; format: Stage16Format; complete: true };

/**
 * Generates (or returns the cached) Stage 16 document for one format.
 * Callers must have already verified access and the upstream stage.
 *
 * keepSentinel: when driven by the tick, the claimed sentinel string so the
 * per-section persistence keeps the row claimed instead of blanking
 * stage_16_error (which would let a second tick double-run the job).
 */
export async function* generateStage16Format(args: {
  sessionId: string;
  format: Stage16Format;
  force?: boolean;
  keepSentinel?: string;
}): AsyncGenerator<Stage16Event, void> {
  const { sessionId, format } = args;
  const keepSentinel = args.keepSentinel ?? null;
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
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
  const cachedColumn = COLUMN_BY_FORMAT[format];
  const cachedExisting = s[cachedColumn] as string | null | undefined;
  const hasCachedOutput =
    !args.force && typeof cachedExisting === "string" && cachedExisting.trim().length > 1000;
  if (!phase2Ready && !hasCachedOutput) {
    throw new Error(
      "Document Assembly is locked until the full pipeline is complete. " +
        "Finish Brand Detonation (Stages 17–22), select a Creative Territory (Checkpoint D), " +
        "and select the Detonation (Checkpoint E) before generating any document format.",
    );
  }

  const column = COLUMN_BY_FORMAT[format];
  const existing = (session as Record<string, unknown>)[column] as string | null | undefined;

  // Reuse cached output unless forced.
  if (!args.force && existing && existing.trim().length > 1000) {
    if (session.status !== "complete") {
      await supabaseAdmin
        .from("sessions")
        .update({
          status: "complete",
          current_stage: 16,
          stage_16_error: null,
          stage_16_format: format,
          stage_status: "complete:16",
        })
        .eq("id", sessionId);
    }
    yield { delta: existing };
    yield { done: true as const, output: existing, format, complete: true };
    return;
  }

  if (args.force) {
    const clearUpdate =
      column === "stage_16_agency_output"
        ? { stage_16_agency_output: null, stage_16_error: keepSentinel }
        : column === "stage_16_consulting_output"
          ? { stage_16_consulting_output: null, stage_16_error: keepSentinel }
          : column === "stage_16_vision_output"
            ? { stage_16_vision_output: null, stage_16_error: keepSentinel }
            : column === "stage_16_valuation_output"
              ? { stage_16_valuation_output: null, stage_16_error: keepSentinel }
              : { stage_16_workshop_output: null, stage_16_error: keepSentinel };
    await supabaseAdmin
      .from("sessions")
      .update(clearUpdate as never)
      .eq("id", sessionId);
  }

  await supabaseAdmin
    .from("sessions")
    .update({
      current_stage: 16,
      status: "running",
      stage_16_error: keepSentinel,
      stage_16_format: format,
    })
    .eq("id", sessionId);

  // Authoritative run-level counts — identical for every format rendered
  // from this session, so vision / consulting / agency cannot disagree.
  const runFacts = deriveRunFacts(s, format);

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
    // Stage 9 (Distinctiveness Check) is the sole permitted source for the
    // Valuation Input Brief's defensibility narrative.
    stage_9_output: session.stage_9_output ?? null,
    stage_10_output: session.stage_10_output ?? null,
    stage_11_output: session.stage_11_output ?? null,
    stage_12_output: session.stage_12_output ?? null,
    stage_13_output: session.stage_13_output ?? null,
    stage_14_output: session.stage_14_output ?? null,
    stage_14b_output: session.stage_14b_output ?? null,
    stage_14c_output: session.stage_14c_output ?? null,
    stage_15_output: session.stage_15_output ?? null,
    stage_17_selected_territory: (s.stage_17_selected_territory as string | null) ?? null,
    stage_18_detonation_line: (s.stage_18_detonation_line as string | null) ?? null,
    stage_18_selected_detonation: (s.stage_18_selected_detonation as string | null) ?? null,
    stage_19_output: (s.stage_19_output as string | null) ?? null,
    stage_22_output: (s.stage_22_output as string | null) ?? null,
    locked_campaign_line: (s.locked_campaign_line as string | null) ?? null,
    locked_big_idea: (s.locked_big_idea as string | null) ?? null,
    run_facts: runFacts,
  };

  const sections = getSectionsForFormat(format, sessionForSections);
  const parts: string[] = [];
  const header = documentHeader(brand, category, format);
  parts.push(header);
  yield { delta: header };

  // Hard-coded, code-inserted boundary disclaimer and reader guide — never
  // model-generated, so scale, weights and boundary language cannot drift.
  if (format === "valuation") {
    const frontMatter = `\n${VALUATION_DISCLAIMER}\n${VALUATION_READER_GUIDE}\n`;
    parts.push(frontMatter);
    yield { delta: frontMatter };
  }

  // True when Stage 10 carries the independent re-score of a human-evolved
  // proposition, i.e. the locked line was not a funnel candidate.
  const lockedLineIsHumanEvolved =
    /====\s*STAGE 10 RE-SCORE/i.test(String(session.stage_10_output ?? ""));

  try {
    if (format === "vision") {
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

${runFactsBlock(runFacts)}
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
          sessionId,
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
      const outputColumnName:
        | "stage_16_agency_output"
        | "stage_16_consulting_output"
        | "stage_16_workshop_output"
        | "stage_16_valuation_output" =
        format === "agency"
          ? "stage_16_agency_output"
          : format === "consulting"
            ? "stage_16_consulting_output"
            : format === "valuation"
              ? "stage_16_valuation_output"
              : "stage_16_workshop_output";

      const persistPartial16 = async (errorMsg: string | null) => {
        try {
          const snapshot = parts.join("\n");
          await supabaseAdmin
            .from("sessions")
            .update({
              [outputColumnName]: snapshot.length > 0 ? snapshot : null,
              stage_16_error: errorMsg ?? keepSentinel,
            } as never)
            .eq("id", sessionId);
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
            sessionId,
            stageLabel: `Stage 16 — ${section.name}`,
            stageNumber: "16",
            stageName: "Document Assembly",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "section call failed";
          // Don't fail the entire document for one section — note the gap and move on.
          body = `*[Section "${section.title}" could not be generated: ${msg}]*`;
        }

        if (format === "agency" && section.propositionCount != null) {
          body = enforcePropositionFraming(
            body,
            section.propositionCount,
            `Stage 16 Agency section “${section.title}”`,
          );
        }

        // Valuation Section One opens with the code-written provenance note,
        // placed after the model's one-sentence summary line if it wrote one.
        if (
          format === "valuation" &&
          section.name === "strength_index" &&
          lockedLineIsHumanEvolved
        ) {
          const trimmed = body.trim();
          const firstBreak = trimmed.indexOf("\n\n");
          const opener = firstBreak > 0 ? trimmed.slice(0, firstBreak).trim() : "";
          const isSummaryLine =
            opener.length > 0 && opener.length < 400 && /^\*\*/.test(opener);
          body = isSummaryLine
            ? `${opener}\n\n${VALUATION_PROPOSITION_PROVENANCE}${trimmed.slice(firstBreak).trim()}`
            : `${VALUATION_PROPOSITION_PROVENANCE}${trimmed}`;
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
    const msg = e instanceof Error ? e.message : `Stage 16 (${format}) failed`;
    // Persist whatever we have alongside the error so partial progress is not lost.
    try {
      const snapshot = parts.join("\n");
      const outputColumnName =
        format === "agency"
          ? "stage_16_agency_output"
          : format === "consulting"
            ? "stage_16_consulting_output"
            : format === "vision"
              ? "stage_16_vision_output"
              : format === "valuation"
                ? "stage_16_valuation_output"
                : "stage_16_workshop_output";
      await supabaseAdmin
        .from("sessions")
        .update({
          [outputColumnName]: snapshot.length > 0 ? snapshot : null,
          stage_16_error: msg,
          status: "interrupted",
        } as never)
        .eq("id", sessionId);
    } catch {
      // best-effort
    }
    throw new Error(msg);
  }

  const output = parts.join("\n");

  const outputUpdate =
    format === "agency"
      ? { stage_16_agency_output: output }
      : format === "consulting"
        ? { stage_16_consulting_output: output }
        : format === "vision"
          ? { stage_16_vision_output: output }
          : format === "valuation"
            ? { stage_16_valuation_output: output }
            : { stage_16_workshop_output: output };

  const { error: ue } = await supabaseAdmin
    .from("sessions")
    .update({
      ...outputUpdate,
      stage_16_error: null,
      status: "complete",
      stage_status: "complete:16",
    } as never)
    .eq("id", sessionId);
  if (ue)
    throw new Error(
      `Failed to save Stage 16 (${format}) output: ${ue.message}`,
    );

  yield {
    done: true as const,
    output,
    format,
    complete: true,
  };
}
