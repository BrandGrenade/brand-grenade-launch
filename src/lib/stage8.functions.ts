import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude, callClaude } from "./claude.server";
import {
  STAGE_8_SYSTEM_PROMPT,
  buildStage8UserMessage,
  buildStage8ContinuationMessage,
} from "./stage8-prompt";
import { STAGE_7_SYSTEM_PROMPT, buildStage7UserMessage } from "./stage7-prompt";
import { trimValidatedInsightsForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const Input = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().max(10000).optional(),
  previousOutput: z.string().max(50000).optional(),
});

const TERRITORY_HEADING = /^##\s+(.+?)\s*$/;
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
    maxTokens: 64000,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 8);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, stage_2_output, stage_3_output, stage_4b_output, stage_7_output, stage_8_output"
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output missing — cannot run Stage 8");
    if (!session.stage_3_output) throw new Error("Stage 3 output missing — cannot run Stage 8");
    if (!session.stage_7_output) throw new Error("Stage 7 output missing — cannot run Stage 8");
    const feedback = data.feedback?.trim();

    const previousOutput = data.previousOutput?.trim() || session.stage_8_output || null;

    if (session.stage_8_output && !feedback) {
      yield { delta: session.stage_8_output };
      yield { done: true as const, output: session.stage_8_output };
      return;
    }

    if (feedback) {
      await supabaseAdmin
        .from("sessions")
        .update({ stage_8_output: null, stage_8_error: null })
        .eq("id", data.sessionId);
    }

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
        const msg = `Stage 7 still produced only ${territoryNames.length} strategic territories after re-run. Flagged for review.`;
        await supabaseAdmin
          .from("sessions")
          .update({ stage_8_error: msg, status: "interrupted" })
          .eq("id", data.sessionId);
        throw new Error(msg);
      }
    }

    // HARD CAP: never let Stage 8 consume more than 5 territories in one run.
    // Stage 7 also enforces this; this is a defensive belt-and-braces guard.
    const MAX_TERRITORIES = 5;
    if (territoryNames.length > MAX_TERRITORIES) {
      console.warn(
        `[stage8] session=${data.sessionId} received ${territoryNames.length} territories — capping to first ${MAX_TERRITORIES}`,
      );
      territoryNames = territoryNames.slice(0, MAX_TERRITORIES);
    }

    const territoryCount = territoryNames.length;

    await supabaseAdmin
      .from("sessions")
      .update({
        current_stage: 8,
        status: "running",
        stage_status: "running:8",
        stage_8_error: null,
        stage_7_territory_count: territoryCount,
      })
      .eq("id", data.sessionId);

    let userMessage = buildStage8UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage7Output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
      territoryCount,
      territoryNames,
      stage4bOutput: session.stage_4b_output ?? undefined,
    });
    if (feedback) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback,
        previousOutput,
        stageLabel: "Stage 8 — Strategic Propositions",
      });
      userMessage = `${prefix}${userMessage}${suffix}`;
    }

    // ---------------------------------------------------------------
    // Wall-clock budget (guards against silent Worker death).
    // Cloudflare Workers have a finite request budget; if we blow past
    // ~4 min the invocation will be killed with no partial write. Track
    // start time so continuation attempts hard-fail loudly instead of
    // looping into a silent kill.
    // ---------------------------------------------------------------
    const wallClockStart = Date.now();
    const WALL_CLOCK_BUDGET_MS = 240_000; // 4 minutes total
    const budgetExceeded = () => Date.now() - wallClockStart > WALL_CLOCK_BUDGET_MS;

    // Persist whatever we have so far. Called after each streaming pass
    // AND from the catch handler so a Worker death leaves recoverable state.
    const persistPartial = async (partial: string, errorMsg: string | null) => {
      try {
        await supabaseAdmin
          .from("sessions")
          .update({
            stage_8_output: partial.length > 0 ? partial : null,
            stage_8_error: errorMsg,
            stage_status: errorMsg ? "interrupted:8" : "running:8",
          })
          .eq("id", data.sessionId);
      } catch {
        // best-effort — do not mask the real error
      }
    };

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_8_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 8",
        stageNumber: "8",
        stageName: "Proposition Generation",
      })) {
        output += delta;
        yield { delta };
      }
      await persistPartial(output, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 8 failed";
      await persistPartial(output, `Stage 8 (initial pass) failed: ${msg}`);
      await supabaseAdmin
        .from("sessions")
        .update({ status: "interrupted" })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    let propositionCount = countPropositions(output);
    let attempts = 0;
    const MAX_CONTINUATION_ATTEMPTS = 3;
    while (propositionCount < territoryCount && attempts < MAX_CONTINUATION_ATTEMPTS) {
      attempts++;

      if (budgetExceeded()) {
        const msg =
          `Stage 8 wall-clock budget exceeded (${Math.round((Date.now() - wallClockStart) / 1000)}s) ` +
          `with ${propositionCount}/${territoryCount} propositions written. Partial output saved; retry to continue.`;
        console.error(`[stage8] session=${data.sessionId} ${msg}`);
        await persistPartial(output, msg);
        await supabaseAdmin
          .from("sessions")
          .update({ status: "interrupted" })
          .eq("id", data.sessionId);
        await setStatus(data.sessionId, null);
        throw new Error(msg);
      }

      const done = territoryNames.slice(0, propositionCount);
      const remaining = territoryNames.slice(propositionCount);
      if (remaining.length === 0) break;

      await setStatus(
        data.sessionId,
        `${propositionCount} of ${territoryCount} propositions generated. Continuing generation...`
      );

      const continuationMessage = buildStage8ContinuationMessage({ done, remaining });
      try {
        const sep = "\n\n";
        output += sep;
        yield { delta: sep };
        for await (const delta of streamClaude({
          systemPrompt: STAGE_8_SYSTEM_PROMPT,
          userMessage: continuationMessage,
          maxTokens: 64000,
          sessionId: data.sessionId,
          stageLabel: `Stage 8 (continuation ${attempts})`,
          stageNumber: "8",
          stageName: "Proposition Generation",
        })) {
          output += delta;
          yield { delta };
        }
        // Persist after EVERY continuation iteration so a silent Worker
        // death mid-loop leaves the last completed pass recoverable.
        await persistPartial(output, null);
        propositionCount = countPropositions(output);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stage 8 continuation failed";
        console.error(`[stage8] session=${data.sessionId} continuation ${attempts} failed: ${msg}`);
        await persistPartial(output, `Stage 8 continuation ${attempts} failed: ${msg}`);
        break;
      }
    }

    if (propositionCount < territoryCount) {
      const msg =
        `Stage 8 exhausted ${MAX_CONTINUATION_ATTEMPTS} continuation attempts with ` +
        `${propositionCount}/${territoryCount} propositions generated. Partial output saved.`;
      console.error(`[stage8] session=${data.sessionId} ${msg}`);
      await persistPartial(output, msg);
      await supabaseAdmin
        .from("sessions")
        .update({ status: "interrupted" })
        .eq("id", data.sessionId);
      await setStatus(data.sessionId, null);
      throw new Error(msg);
    }

    await setStatus(data.sessionId, null);

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_8_output: output, stage_8_error: null, stage_status: "complete:8" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 8 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });

const ConfirmB = z.object({ sessionId: z.string().uuid() });
export const confirmCheckpointB = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ConfirmB.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ checkpoint_b_confirmed: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to confirm Checkpoint B: ${error.message}`);
    return { ok: true };
  });

// Split a Stage 8 markdown output into proposition blocks, one per `## ` heading.
function splitPropositionBlocks(text: string): Array<{ name: string; markdown: string }> {
  const lines = text.split("\n");
  const blocks: Array<{ name: string; markdown: string[] }> = [];
  let current: { name: string; markdown: string[] } | null = null;
  for (const raw of lines) {
    const m = raw.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) blocks.push(current);
      const name = m[1]
        .replace(/^\*+|\*+$/g, "")
        .replace(/^FIELD\s*\d+\s*[—\-:]\s*/i, "")
        .trim();
      current = { name, markdown: [raw] };
    } else if (current) {
      current.markdown.push(raw);
    }
  }
  if (current) blocks.push(current);
  return blocks.map((b) => ({
    name: b.name,
    markdown: b.markdown.join("\n").replace(/\s+$/g, ""),
  }));
}

const SelectiveInput = z.object({
  sessionId: z.string().uuid(),
  keepTerritories: z.array(z.string()).default([]),
  feedback: z.string().max(10000).optional(),
  previousOutput: z.string().max(100000).optional(),
});

/**
 * Regenerate ONLY the propositions whose territory names are NOT in
 * `keepTerritories`. Kept propositions are preserved verbatim; the
 * regenerated ones replace the rest, and the merged output is saved.
 *
 * Order in the saved output follows the current Stage 7 territory order.
 */
export const regenerateStage8Selective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SelectiveInput.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "brand_name, category, stage_2_output, stage_3_output, stage_7_output, stage_8_output",
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_7_output) throw new Error("Stage 7 output missing");
    if (!session.stage_8_output) throw new Error("Stage 8 output missing");

    const allTerritories = extractTerritoryNames(session.stage_7_output);
    const existingBlocks = splitPropositionBlocks(session.stage_8_output);
    const existingByName = new Map(existingBlocks.map((b) => [b.name, b]));

    const keepSet = new Set(data.keepTerritories);
    const toRegenerate = allTerritories.filter((n) => !keepSet.has(n));

    if (toRegenerate.length === 0) {
      yield { delta: session.stage_8_output };
      yield { done: true as const, output: session.stage_8_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 8, status: "running", stage_8_error: null })
      .eq("id", data.sessionId);

    const baseUserMessage = buildStage8UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage7Output: session.stage_7_output,
      cmm: session.stage_2_output ?? "",
      constraintMatrix: session.stage_3_output ?? "",
      territoryCount: allTerritories.length,
      territoryNames: allTerritories,
    });

    const done = allTerritories.filter((n) => keepSet.has(n));
    const continuationMessage = buildStage8ContinuationMessage({
      done,
      remaining: toRegenerate,
    });

    const feedback = data.feedback?.trim();
    const previousOutput = data.previousOutput?.trim() || session.stage_8_output || null;
    let userMessage = `${baseUserMessage}\n\n---\n\n${continuationMessage}\n\nGenerate fresh propositions for the listed remaining territories only. Do not repeat the kept ones.`;
    if (feedback) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback,
        previousOutput,
        stageLabel: "Stage 8 — Strategic Propositions (selective regenerate)",
      });
      userMessage = `${prefix}${userMessage}${suffix}`;
    }

    let newOutput = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_8_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 8 (selective regenerate)",
        stageNumber: "8",
        stageName: "Proposition Generation",
      })) {
        newOutput += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 8 selective regenerate failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_8_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const newBlocks = splitPropositionBlocks(newOutput);
    const newByName = new Map(newBlocks.map((b) => [b.name, b]));
    const positionalQueue = newBlocks.slice();

    const mergedBlocks: Array<{ name: string; markdown: string }> = [];
    for (const name of allTerritories) {
      if (keepSet.has(name) && existingByName.has(name)) {
        mergedBlocks.push(existingByName.get(name)!);
        continue;
      }
      const matched = newByName.get(name);
      if (matched) {
        mergedBlocks.push(matched);
        const idx = positionalQueue.indexOf(matched);
        if (idx >= 0) positionalQueue.splice(idx, 1);
      } else if (positionalQueue.length > 0) {
        const next = positionalQueue.shift()!;
        mergedBlocks.push({ name, markdown: next.markdown });
      } else if (existingByName.has(name)) {
        mergedBlocks.push(existingByName.get(name)!);
      }
    }

    let merged = mergedBlocks.map((b) => b.markdown).join("\n\n");



    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_8_output: merged, stage_8_error: null, stage_status: "complete:8" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 8 output: ${updateErr.message}`);

    yield { done: true as const, output: merged };
  });
