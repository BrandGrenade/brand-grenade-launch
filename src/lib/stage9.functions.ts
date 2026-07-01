import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } from "./stage9-prompt";
import {
  STAGE_9_LEFT_OF_CENTRE_SYSTEM_PROMPT,
  buildStage9LeftOfCentreUserMessage,
  STAGE_9_LEFT_OF_CENTRE_DIVIDER,
} from "./stage9-leftofcentre-prompt";
import {
  CONDITIONALLY_BANNED_STAGE9,
  UNIVERSAL_BANNED_STAGE9,
  conditionalStage9WordAllowedInLeftOfCentre,
} from "./stage9-banned-words";
import {
  findBannedWordHits,
  generateWithBannedWordGate,
  type BannedWordHit,
  type OutputGateMode,
} from "./output-banned-word-gate";

import { countPropositions } from "./count-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

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


export const runStage9 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "B");
    await assertUpstreamStageOutput(data.sessionId, 9);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, brief_text, stage_2_output, stage_4b_output, stage_6_output, stage_7_output, stage_8_output, stage_9_output, stage_9_leftofcentre_output, checkpoint_b_confirmed, is_preflight_test")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 9");
    if (session.stage_9_output) {
      const cached = `${session.stage_9_output}${session.stage_9_leftofcentre_output ?? ""}`;
      yield { delta: cached };
      yield { done: true as const, output: cached, coreOutput: session.stage_9_output, leftOfCentreOutput: session.stage_9_leftofcentre_output ?? "" };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 9, status: "running", stage_9_error: null })
      .eq("id", data.sessionId);

    const propositionCount = countPropositions(session.stage_8_output);

    const userMessage = buildStage9UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage8Output: session.stage_8_output,
      cmm: session.stage_2_output ?? "",
      stage7DominantSignal: session.stage_7_output ?? undefined,
      propositionCount,
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
        rule: "stage9-core-conditional",
        stageLabel: "Stage 9",
        columnLabel: "stage_9_output",
      }),
    ];

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
            systemPrompt: STAGE_9_SYSTEM_PROMPT,
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
      await supabaseAdmin
        .from("sessions")
        .update({ stage_9_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    await setRetryStatus(data.sessionId, null);

    // ===== TIER 3 — LEFT-OF-CENTRE ALTERNATIVES (Breach / Fuse / Flashpoint) =====
    // Additive layer: runs AFTER the core Stage 9 generator on the same session
    // inputs. Stored separately in stage_9_leftofcentre_output so core Stage 9
    // and the conditional-word exemption can be checked independently.
    let leftOfCentre = "";
    try {
      const locDivider = STAGE_9_LEFT_OF_CENTRE_DIVIDER;

      const locUserMessage = buildStage9LeftOfCentreUserMessage({
        brandName: session.brand_name,
        category: session.category,
        stage2Output: session.stage_2_output ?? "",
        stage4bOutput: session.stage_4b_output ?? undefined,
        stage6Output: session.stage_6_output ?? undefined,
        stage7Output: session.stage_7_output ?? undefined,
        stage8Output: session.stage_8_output ?? undefined,
        briefText: session.brief_text ?? undefined,
      });

      const validateLeftOfCentre = (text: string): BannedWordHit[] => {
        const universalHits = findBannedWordHits({
          text,
          terms: UNIVERSAL_BANNED_STAGE9,
          rule: "stage9-universal",
          stageLabel: "Stage 9",
          columnLabel: "stage_9_leftofcentre_output",
        });
        const conditionalHits = findBannedWordHits({
          text,
          terms: CONDITIONALLY_BANNED_STAGE9,
          rule: "stage9-leftofcentre-competitor-owned-conditional",
          stageLabel: "Stage 9",
          columnLabel: "stage_9_leftofcentre_output",
        }).filter(
          (hit) =>
            !conditionalStage9WordAllowedInLeftOfCentre({
              word: hit.word,
              brandName: session.brand_name,
              briefText: session.brief_text ?? "",
              stage2Output: session.stage_2_output ?? "",
            }),
        );
        return [...universalHits, ...conditionalHits];
      };

      const gatedLoc = await generateWithBannedWordGate({
        stageLabel: "Stage 9",
        columnLabel: "stage_9_leftofcentre_output",
        mode,
        maxAttempts: 3,
        validate: validateLeftOfCentre,
        generate: (attempt, retryNote) =>
          collectClaudeText({
            systemPrompt: STAGE_9_LEFT_OF_CENTRE_SYSTEM_PROMPT,
            userMessage: `${locUserMessage}${retryNote ?? ""}`,
            maxTokens: 16000,
            sessionId: data.sessionId,
            stageLabel: attempt === 1 ? "Stage 9 (Left-of-Centre)" : `Stage 9 (Left-of-Centre sanitiser retry ${attempt})`,
            stageNumber: "9",
            stageName: "Left-of-Centre Alternatives",
          }),
      });
      leftOfCentre = `${locDivider}${gatedLoc.output}`;
      yield { delta: leftOfCentre };
    } catch (e) {
      if (mode === "test") {
        const msg = e instanceof Error ? e.message : "Stage 9 left-of-centre failed";
        await supabaseAdmin
          .from("sessions")
          .update({ stage_9_error: msg })
          .eq("id", data.sessionId);
        throw e instanceof Error ? e : new Error(msg);
      }
      const note = `\n\n[LEFT-OF-CENTRE ALTERNATIVES layer failed: ${e instanceof Error ? e.message : "unknown error"} — core Stage 9 output above is unaffected.]\n`;
      leftOfCentre += note;
      yield { delta: note };
    }

    const combined = output + leftOfCentre;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_9_output: output, stage_9_leftofcentre_output: leftOfCentre, stage_9_error: null } as never)
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 9 output: ${updateErr.message}`);

    yield { done: true as const, output: combined, coreOutput: output, leftOfCentreOutput: leftOfCentre };
  });
