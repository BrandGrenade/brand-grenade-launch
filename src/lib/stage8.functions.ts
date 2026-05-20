import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import {
  STAGE_8_SYSTEM_PROMPT,
  buildStage8UserMessage,
  buildStage8ContinuationMessage,
} from "./stage8-prompt";
import { STAGE_7_SYSTEM_PROMPT, buildStage7UserMessage } from "./stage7-prompt";
import { trimValidatedInsightsForDownstream } from "./context-trim";

const Input = z.object({ sessionId: z.string().uuid() });

const TERRITORY_HEADING = /^##\s+(.+?)\s*$/;
// SMP propositions are emitted as > blockquote lines.
const PROPOSITION_LINE = /^\s*>\s+\S/;

function extractTerritoryNames(stage7Output: string): string[] {
  const names: string[] = [];
  for (const raw of stage7Output.split("\n")) {
    const m = raw.match(TERRITORY_HEADING);
    if (m) {
      const name = m[1]
        .replace(/^\*+|\*+$/g, "")
        .replace(/^FIELD\s*\d+\s*[—\-:]\s*/i, "")
        .trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function countPropositions(text: string): number {
  return text.split("\n").filter((l) => PROPOSITION_LINE.test(l)).length;
}

async function setStatus(sessionId: string, message: string | null) {
  try {
    await supabaseAdmin
      .from("sessions")
      .update({ retry_status: message })
      .eq("id", sessionId);
  } catch {
    // best-effort
  }
}

async function rerunStage7WithEnforcement(sessionId: string): Promise<string> {
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "brand_name, category, strategic_mode, stage_2_output, stage_3_output, stage_4_output, stage_6_output"
    )
    .eq("id", sessionId)
    .single();
  if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

  const userMessage = buildStage7UserMessage({
    brandName: session.brand_name,
    category: session.category,
    strategicMode: session.strategic_mode,
    stage6Output: trimValidatedInsightsForDownstream(session.stage_6_output ?? ""),
    sis: session.stage_4_output ?? "",
    cmm: session.stage_2_output ?? "",
    constraintMatrix: session.stage_3_output ?? "",
    enforceMinimum: true,
  });

  const output = await callClaude({
    systemPrompt: STAGE_7_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 3000,
    temperature: 0.7,
    sessionId,
    stageLabel: "Stage 7 (re-run for minimum territories)",
    stageNumber: "7",
    stageName: "Territory Synthesis",
  });

  await supabaseAdmin
    .from("sessions")
    .update({ stage_7_output: output, stage_7_error: null })
    .eq("id", sessionId);

  return output;
}

export const runStage8 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ output: string }> => {
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, stage_2_output, stage_3_output, stage_7_output, stage_8_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output missing — cannot run Stage 8");
    if (!session.stage_3_output) throw new Error("Stage 3 output missing — cannot run Stage 8");
    if (!session.stage_7_output) throw new Error("Stage 7 output missing — cannot run Stage 8");
    if (session.stage_8_output) return { output: session.stage_8_output };

    // ---- FIX 3 / CHANGE A: count territories before Stage 8 runs ----
    let stage7Output = session.stage_7_output;
    let territoryNames = extractTerritoryNames(stage7Output);

    if (territoryNames.length < 2) {
      await setStatus(
        data.sessionId,
        "Stage 7 produced insufficient strategic territories for proposition generation. Re-running Stage 7 with enhanced instruction..."
      );
      stage7Output = await rerunStage7WithEnforcement(data.sessionId);
      territoryNames = extractTerritoryNames(stage7Output);
      await setStatus(data.sessionId, null);

      if (territoryNames.length < 3) {
        const msg = `Stage 7 still produced only ${territoryNames.length} strategic territories after re-run. Flagged for human review.`;
        await supabaseAdmin
          .from("sessions")
          .update({ stage_8_error: msg, status: "needs_review" })
          .eq("id", data.sessionId);
        throw new Error(msg);
      }
    }

    const territoryCount = territoryNames.length;

    await supabaseAdmin
      .from("sessions")
      .update({
        current_stage: 8,
        status: "running",
        stage_8_error: null,
        stage_7_territory_count: territoryCount,
      })
      .eq("id", data.sessionId);

    // ---- CHANGE B: pass territory count + names to Stage 8 ----
    const userMessage = buildStage8UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage7Output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
      territoryCount,
      territoryNames,
    });

    let output: string;
    try {
      output = await callClaude({
        systemPrompt: STAGE_8_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 3500,
        temperature: 0.7,
        sessionId: data.sessionId,
        stageLabel: "Stage 8",
        stageNumber: "8",
        stageName: "Proposition Generation",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 8 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_8_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    // ---- CHANGE C: completion check + continuation (max 3 attempts) ----
    let propositionCount = countPropositions(output);
    let attempts = 0;
    while (propositionCount < territoryCount && attempts < 3) {
      attempts++;
      const done = territoryNames.slice(0, propositionCount);
      const remaining = territoryNames.slice(propositionCount);
      if (remaining.length === 0) break;

      await setStatus(
        data.sessionId,
        `${propositionCount} of ${territoryCount} propositions generated. Continuing generation...`
      );

      const continuationMessage = buildStage8ContinuationMessage({ done, remaining });
      try {
        const continuation = await callClaude({
          systemPrompt: STAGE_8_SYSTEM_PROMPT,
          userMessage: continuationMessage,
          maxTokens: 3500,
          temperature: 0.7,
          sessionId: data.sessionId,
          stageLabel: `Stage 8 (continuation ${attempts})`,
          stageNumber: "8",
          stageName: "Proposition Generation",
        });
        output = `${output}\n\n${continuation}`;
        propositionCount = countPropositions(output);
      } catch (e) {
        // Continuation failed — stop trying, fall through with what we have.
        break;
      }
    }
    await setStatus(data.sessionId, null);

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_8_output: output, stage_8_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 8 output: ${updateErr.message}`);

    return { output };
  });

const ConfirmB = z.object({ sessionId: z.string().uuid() });
export const confirmCheckpointB = createServerFn({ method: "POST" })
  .inputValidator((i) => ConfirmB.parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ checkpoint_b_confirmed: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to confirm Checkpoint B: ${error.message}`);
    return { ok: true };
  });
