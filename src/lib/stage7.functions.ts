import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import {
  STAGE_7_SYSTEM_PROMPT,
  buildStage7UserMessage,
  extractStage6UniverseNames,
} from "./stage7-prompt";
import { trimValidatedInsightsForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const RunStage7Input = z.object({
  sessionId: z.string().uuid(),
});

/** Names present as "## …" headings in a given block of text. */
function headingsIn(text: string): string[] {
  const names: string[] = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = m[1].trim();
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

/**
 * Trim a Stage 7 markdown output to at most `max` territory blocks.
 * A "block" starts at each top-level "## " heading and runs until the next.
 * Content before the first heading (preamble) is preserved.
 */
function capStage7Territories(text: string, max: number, sessionId: string): string {
  const lines = text.split("\n");
  const blockStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) blockStarts.push(i);
  }
  if (blockStarts.length <= max) return text;
  console.warn(
    `[stage7] session=${sessionId} produced ${blockStarts.length} territories — trimming to first ${max}`,
  );
  const cutAt = blockStarts[max]; // start of the (max+1)th block
  return lines.slice(0, cutAt).join("\n").trimEnd() + "\n";
}

/** Universes from Stage 6 that have no matching "## …" heading in Stage 7 output. */
function findMissingUniverses(stage6Universes: string[], stage7Output: string): string[] {
  const produced = headingsIn(stage7Output).map((s) => s.toLowerCase());
  return stage6Universes.filter((u) => {
    const low = u.toLowerCase();
    // Match if the territory heading either equals or contains the universe name
    // (territory names may rephrase the universe name slightly).
    return !produced.some((p) => p === low || p.includes(low) || low.includes(p));
  });
}

export const runStage7 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage7Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 7);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, stage_2_output, stage_3_output, stage_4_output, stage_6_output, stage_7_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 7");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 7");
    if (!session.stage_4_output) throw new Error("Stage 4 output (SIS) missing — cannot run Stage 7");
    if (!session.stage_6_output) throw new Error("Stage 6 output (validated insights) missing — cannot run Stage 7");
    if (session.stage_7_output) {
      yield { delta: session.stage_7_output };
      yield { done: true as const, output: session.stage_7_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 7, status: "running", stage_7_error: null })
      .eq("id", data.sessionId);

    const stage6Full = trimValidatedInsightsForDownstream(session.stage_6_output);
    const stage6Universes = extractStage6UniverseNames(stage6Full);

    // Diagnostic: prove the full Stage 6 output reaches the Stage 7 prompt.
    console.log(
      `[stage7] session=${data.sessionId} stage6_db_chars=${session.stage_6_output.length} ` +
        `stage6_to_prompt_chars=${stage6Full.length} universes=${stage6Universes.length} ` +
        `[${stage6Universes.join(" | ")}]`,
    );

    const userMessage = buildStage7UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage6Output: stage6Full,
      sis: session.stage_4_output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
      enforceMinimum: true,
    });

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 7", outputColumn: "stage_7_output", errorColumn: "stage_7_error" },
      streamClaude({
        systemPrompt: STAGE_7_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 7",
        stageNumber: "7",
        stageName: "Territory Synthesis",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    // Completeness check + automatic continuation for missing universes.
    // The model occasionally stops after the first territory because the
    // template uses "---" as a separator. If any Stage 6 universe is not
    // represented as a "##" heading in the output, re-prompt for exactly
    // those missing universes and append the continuation.
    let missing = findMissingUniverses(stage6Universes, output);
    let continuationAttempts = 0;
    while (missing.length > 0 && continuationAttempts < 3) {
      continuationAttempts += 1;
      console.log(
        `[stage7] session=${data.sessionId} missing_after_attempt_${continuationAttempts - 1}=${missing.length} [${missing.join(" | ")}] — requesting continuation`,
      );
      const continuationMessage = buildStage7UserMessage({
        brandName: session.brand_name,
        category: session.category,
        stage6Output: stage6Full,
        sis: session.stage_4_output,
        cmm: session.stage_2_output,
        constraintMatrix: session.stage_3_output,
        enforceMinimum: true,
        missingUniverses: missing,
      });
      let continuation = "";
      try {
        for await (const delta of withStreamSafety(
          { sessionId: data.sessionId, stageLabel: `Stage 7 (continuation ${continuationAttempts})`, outputColumn: "stage_7_output", errorColumn: "stage_7_error" },
          streamClaude({
            systemPrompt: STAGE_7_SYSTEM_PROMPT,
            userMessage: continuationMessage,
            maxTokens: 64000,
            sessionId: data.sessionId,
            stageLabel: "Stage 7",
            stageNumber: "7",
            stageName: "Territory Synthesis",
          }),
        )) {
          continuation += delta;
          yield { delta };
        }
      } catch (contErr) {
        const msg = contErr instanceof Error ? contErr.message : String(contErr);
        // Break-and-proceed ONLY when we already have content from the first
        // pass. First-pass empty responses are thrown by the outer stream
        // above and never reach this catch, so output.length > 0 here — but
        // assert defensively. An empty continuation = "nothing more to add".
        const isEmpty = /empty response/i.test(msg);
        if (isEmpty && output.trim().length > 0) {
          console.warn(
            `[stage7] session=${data.sessionId} continuation ${continuationAttempts} returned empty — treating as "no more universes to add", proceeding with ${headingsIn(output).length} territories in hand`,
          );
          // Clear the error the safety wrapper persisted; this is not a fault.
          await supabaseAdmin
            .from("sessions")
            .update({ stage_7_error: null })
            .eq("id", data.sessionId);
          break;
        }
        throw contErr;
      }
      if (continuation.trim().length === 0) {
        console.warn(
          `[stage7] session=${data.sessionId} continuation ${continuationAttempts} yielded zero chars — stopping continuation loop`,
        );
        break;
      }
      // Stitch with a clean separator.
      output = `${output.trimEnd()}\n\n---\n\n${continuation.trimStart()}`;
      missing = findMissingUniverses(stage6Universes, output);
    }

    if (missing.length > 0) {
      console.warn(
        `[stage7] session=${data.sessionId} still missing after ${continuationAttempts} continuation(s): [${missing.join(" | ")}]`,
      );
    }

    // HARD CAP: downstream (Stage 8+) assumes ≤5 strategic territories.
    // Trim to the first 5 `##` heading blocks before saving so Stage 8 is
    // never handed more than it can process in a single Worker budget.
    const MAX_TERRITORIES = 5;
    output = capStage7Territories(output, MAX_TERRITORIES, data.sessionId);

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_7_output: output, stage_7_error: null, stage_status: "complete:7" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 7 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
