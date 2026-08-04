import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } from "./stage9-prompt";
import {
  CONDITIONALLY_BANNED_STAGE9,
  UNIVERSAL_BANNED_STAGE9,
  conditionalStage9WordAllowedInLeftOfCentre,
  competitorOwnedConditionalStage9Words,
} from "./stage9-banned-words";

import {
  findBannedWordHits,
  generateWithBannedWordGate,
  type BannedWordHit,
  type OutputGateMode,
} from "./output-banned-word-gate";

import { countPropositions } from "./count-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";
import { getObjectiveDirective } from "./strategic-objective.server";

const Input = z.object({ sessionId: z.string().uuid() });

async function collectClaudeText(args: Parameters<typeof streamClaude>[0]): Promise<string> {
  let text = "";
  for await (const delta of streamClaude(args)) text += delta;
  return text;
}

async function setRetryStatus(sessionId: string, message: string | null) {
  try {
    await supabaseAdmin
      .from("sessions")
      .update({ retry_status: message })
      .eq("id", sessionId);
  } catch {
    // best-effort
  }
}

// Stage 9 core generator ONLY. The Left-of-Centre engines have moved to
// their own parallel track (src/lib/loc.functions.ts) triggered at Briefing
// Room handoff time. Stage 9 no longer generates LOC inline; it only reads
// stage_9_leftofcentre_output from the DB if the LOC track has finished.
export const runStage9 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionAccess(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "B");
    await assertUpstreamStageOutput(data.sessionId, 9);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, brief_text, stage_2_output, stage_7_output, stage_8_output, stage_9_output, stage_9_leftofcentre_output, loc_decision_packages, checkpoint_b_confirmed, is_preflight_test",
      )
      .eq("id", data.sessionId)
      .single();

    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 9");
    if (session.stage_9_output) {
      const cached = `${session.stage_9_output}${session.stage_9_leftofcentre_output ?? ""}`;
      yield { delta: cached };
      yield {
        done: true as const,
        output: cached,
        coreOutput: session.stage_9_output,
        leftOfCentreOutput: session.stage_9_leftofcentre_output ?? "",
      };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 9, status: "running", stage_9_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output);

    const coreCompetitorOwnedConditional = competitorOwnedConditionalStage9Words({
      brandName: session.brand_name,
      briefText: session.brief_text ?? "",
      stage2Output: session.stage_2_output ?? "",
    });

    const userMessage = buildStage9UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      cmm: session.stage_2_output ?? "",
      stage7DominantSignal: session.stage_7_output ?? undefined,
      propositionCount,
      competitorOwnedConditionalWords: coreCompetitorOwnedConditional,
    });

    const mode: OutputGateMode = session.is_preflight_test === true ? "test" : "live";
    const validateCore = (text: string): BannedWordHit[] => [
      ...findBannedWordHits({
        text,
        terms: UNIVERSAL_BANNED_STAGE9,
        rule: "stage9-universal",
        stageLabel: "Stage 9",
        columnLabel: "stage_9_output",
      }),
      ...findBannedWordHits({
        text,
        terms: CONDITIONALLY_BANNED_STAGE9,
        rule: "stage9-core-competitor-owned-conditional",
        stageLabel: "Stage 9",
        columnLabel: "stage_9_output",
      }).filter(
        (hit) =>
          !conditionalStage9WordAllowedInLeftOfCentre({
            word: hit.word,
            brandName: session.brand_name,
            briefText: session.brief_text ?? "",
            stage2Output: session.stage_2_output ?? "",
          }),
      ),
    ];

    const stage9Directive = await getObjectiveDirective(data.sessionId, "stage9");

    let output = "";
    try {
      const gated = await generateWithBannedWordGate({
        stageLabel: "Stage 9",
        columnLabel: "stage_9_output",
        mode,
        maxAttempts: 3,
        validate: validateCore,
        generate: (attempt, retryNote) =>
          collectClaudeText({
            systemPrompt: STAGE_9_SYSTEM_PROMPT + stage9Directive,
            userMessage: `${userMessage}${retryNote ?? ""}`,
            maxTokens: 64000,
            sessionId: data.sessionId,
            stageLabel: attempt === 1 ? "Stage 9" : `Stage 9 (sanitiser retry ${attempt})`,
            stageNumber: "9",
            stageName: "Distinctiveness Check",
          }),
      });
      output = gated.output;
      yield { delta: output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 9 failed";
      await supabaseAdmin.from("sessions").update({ stage_9_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    await setRetryStatus(data.sessionId, null);

    // Read pre-generated LOC output from DB (parallel track). Do NOT
    // regenerate here — LOC is authoritative from its own runner. If it
    // hasn't finished yet the Stage 9 UI shows a "LOC still generating"
    // affordance separately.
    const { data: locRow } = await supabaseAdmin
      .from("sessions")
      .select("stage_9_leftofcentre_output, loc_decision_packages")
      .eq("id", data.sessionId)
      .single<{
        stage_9_leftofcentre_output: string | null;
        loc_decision_packages: unknown;
      }>();
    const leftOfCentre = locRow?.stage_9_leftofcentre_output ?? "";
    if (leftOfCentre) yield { delta: leftOfCentre };

    // ── ITEM 6 — LOC candidates routed through the SAME Stage 9 logic ──
    // Batched (chunks of 5, fired in parallel) rather than one enlarged call,
    // so token budget and wall clock stay safe. Merged into stage_9_output so
    // Stage 10 scores Funnel and LOC propositions on equal footing.
    let locDistinctiveness = "";
    try {
      const { runStage9LocBatches, extractLocCandidates } = await import(
        "./stage9-loc-batch.server"
      );
      const candidates = extractLocCandidates(locRow?.loc_decision_packages);
      if (candidates.length > 0) {
        await setRetryStatus(
          data.sessionId,
          `Running Stage 9 distinctiveness pass over ${candidates.length} Left-of-Centre candidates...`,
        );
        locDistinctiveness = await runStage9LocBatches({
          sessionId: data.sessionId,
          brandName: session.brand_name,
          category: session.category,
          cmm: session.stage_2_output ?? "",
          stage7DominantSignal: session.stage_7_output ?? undefined,
          candidates,
          competitorOwnedConditionalWords: coreCompetitorOwnedConditional,
        });
        if (locDistinctiveness) {
          output = `${output}${locDistinctiveness}`;
          yield { delta: locDistinctiveness };
        }
      }
    } catch (e) {
      console.error(
        `[stage9] session=${data.sessionId} LOC distinctiveness batch failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    await setRetryStatus(data.sessionId, null);

    const combined = output + leftOfCentre;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        stage_9_output: output,
        stage_9_error: null,
        stage_status: "complete:9",
      } as never)
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 9 output: ${updateErr.message}`);


    yield {
      done: true as const,
      output: combined,
      coreOutput: output,
      leftOfCentreOutput: leftOfCentre,
    };
  });
