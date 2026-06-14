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

// ===== Deterministic Universal Proposition Quality Gate enforcer =====
// Mirrors the rejection triggers in src/lib/proposition-quality-gate.ts so
// the server can actually reject and regenerate failing propositions
// instead of trusting the model to do it silently.
const BANNED_WORD_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\breward(s|ed|ing)?\b/i, reason: "contains banned word 'reward'" },
  { pattern: /\bearn(s|ed|ing)?\b/i, reason: "contains banned word 'earn/earned'" },
  { pattern: /\bdeserv(e|es|ed|ing)\b/i, reason: "contains banned word 'deserve/deserved'" },
  { pattern: /\bapolog(y|ise|ize|ies|ised|ized)\b/i, reason: "contains banned word 'apology/apologise'" },
  { pattern: /\bguilt(y|less)?\b/i, reason: "contains banned word 'guilt/guilty'" },
  { pattern: /end of (the |a )?day/i, reason: "contains banned phrase 'end of the day'" },
  { pattern: /day well spent/i, reason: "contains banned phrase 'day well spent'" },
];

function extractHeroProposition(blockMarkdown: string): string | null {
  for (const raw of blockMarkdown.split("\n")) {
    if (PROPOSITION_LINE.test(raw)) {
      return raw
        .replace(/^\s*>\s+/, "")
        .replace(/\*+/g, "")
        .replace(/[.!?"'`]+$/g, "")
        .trim();
    }
  }
  return null;
}

function gateFailures(line: string): string[] {
  const failures: string[] = [];
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) failures.push(`exceeds 8 words (has ${wordCount})`);
  for (const { pattern, reason } of BANNED_WORD_PATTERNS) {
    if (pattern.test(line)) failures.push(reason);
  }
  return failures;
}

async function regenerateTerritoryBlock(args: {
  sessionId: string;
  territoryName: string;
  stage7Output: string;
  brandName: string;
  category: string;
  cmm: string;
  rejectedLines: string[];
  failureReasons: string[];
}): Promise<string> {
  const rejectedBlock = args.rejectedLines.length
    ? `\n\nPREVIOUSLY REJECTED PROPOSITIONS FOR THIS TERRITORY (do NOT reproduce, do NOT paraphrase):\n${args.rejectedLines.map((l) => `  • "${l}"`).join("\n")}\n\nReason(s) for rejection:\n${args.failureReasons.map((r) => `  • ${r}`).join("\n")}`
    : "";

  const userMessage = `Brand: ${args.brandName}
Category: ${args.category}

Source Strategic Territories (full Stage 7 output for context):

${args.stage7Output}

Competitor positions to avoid:

${args.cmm}
${rejectedBlock}

TASK: Generate ONE Strategic Proposition for the territory named below, and ONLY that territory. The proposition MUST pass every criterion of the Universal Proposition Quality Gate, MUST be 8 words or fewer, MUST contain none of the banned words (reward, earn/earned, deserve/deserved, apology/apologise, guilt/guilty), MUST NOT contain the phrases "end of the day" or "day well spent", and MUST be demonstrably different in substance, structure and language from the rejected propositions listed above.

Territory: ${args.territoryName}

Output format — exactly:

## ${args.territoryName}

> **[THE PROPOSITION]**

**Why this proposition works:**

[2-3 sentences]

**What it owns:**

[1-2 sentences]

**What it challenges:**

[One sentence]

**What it makes possible:**

[2-3 sentences]`;

  return await callClaude({
    systemPrompt: STAGE_8_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2000,
    sessionId: args.sessionId,
    stageLabel: `Stage 8 (gate enforcement: ${args.territoryName})`,
    stageNumber: "8",
    stageName: "Proposition Generation",
  });
}

async function enforceQualityGate(args: {
  sessionId: string;
  output: string;
  stage7Output: string;
  brandName: string;
  category: string;
  cmm: string;
}): Promise<{ output: string; replaced: number }> {
  const blocks = splitPropositionBlocks(args.output);
  if (blocks.length === 0) return { output: args.output, replaced: 0 };

  let replaced = 0;
  const newBlocks: typeof blocks = [];
  for (const block of blocks) {
    const hero = extractHeroProposition(block.markdown);
    let failures = hero ? gateFailures(hero) : ["could not extract proposition line"];
    if (failures.length === 0) {
      newBlocks.push(block);
      continue;
    }
    const rejected: string[] = hero ? [hero] : [];
    const allReasons: string[] = [...failures];
    let current = block;
    for (let attempt = 0; attempt < 3 && failures.length > 0; attempt++) {
      await setStatus(
        args.sessionId,
        `Quality gate rejected proposition for "${block.name}" — regenerating (attempt ${attempt + 1}/3)...`,
      );
      try {
        const regenerated = await regenerateTerritoryBlock({
          sessionId: args.sessionId,
          territoryName: block.name,
          stage7Output: args.stage7Output,
          brandName: args.brandName,
          category: args.category,
          cmm: args.cmm,
          rejectedLines: rejected,
          failureReasons: allReasons,
        });
        const regenBlocks = splitPropositionBlocks(regenerated);
        const match =
          regenBlocks.find((b) => b.name.toLowerCase() === block.name.toLowerCase()) ??
          regenBlocks[0];
        if (!match) break;
        const newHero = extractHeroProposition(match.markdown);
        const newFailures = newHero ? gateFailures(newHero) : ["could not extract proposition line"];
        current = { name: block.name, markdown: match.markdown };
        if (newFailures.length === 0) {
          failures = [];
          replaced++;
          break;
        }
        if (newHero) rejected.push(newHero);
        for (const r of newFailures) if (!allReasons.includes(r)) allReasons.push(r);
        failures = newFailures;
      } catch {
        break;
      }
    }
    newBlocks.push(current);
  }

  await setStatus(args.sessionId, null);
  const merged = newBlocks.map((b) => b.markdown).join("\n\n");
  return { output: merged, replaced };
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
    maxTokens: 12000,
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
  .handler(async function* ({ data }) {
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

    let userMessage = buildStage8UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage7Output,
      cmm: session.stage_2_output,
      constraintMatrix: session.stage_3_output,
      territoryCount,
      territoryNames,
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


    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_8_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 8",
        stageNumber: "8",
        stageName: "Proposition Generation",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 8 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_8_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

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
        const sep = "\n\n";
        output += sep;
        yield { delta: sep };
        for await (const delta of streamClaude({
          systemPrompt: STAGE_8_SYSTEM_PROMPT,
          userMessage: continuationMessage,
          maxTokens: 12000,
          sessionId: data.sessionId,
          stageLabel: `Stage 8 (continuation ${attempts})`,
          stageNumber: "8",
          stageName: "Proposition Generation",
        })) {
          output += delta;
          yield { delta };
        }
        propositionCount = countPropositions(output);
      } catch {
        break;
      }
    }
    await setStatus(data.sessionId, null);

    // ----- Enforce Universal Proposition Quality Gate (server-side) -----
    const gateResult = await enforceQualityGate({
      sessionId: data.sessionId,
      output,
      stage7Output,
      brandName: session.brand_name,
      category: session.category,
      cmm: session.stage_2_output ?? "",
    });
    if (gateResult.replaced > 0) {
      output = gateResult.output;
      const banner = `\n\n---\n\n*[Quality Gate: ${gateResult.replaced} proposition${gateResult.replaced === 1 ? "" : "s"} regenerated to meet the Universal Proposition Quality Gate]*\n\n---\n\n`;
      yield { delta: banner };
      yield { delta: output };
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_8_output: output, stage_8_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 8 output: ${updateErr.message}`);

    yield { done: true as const, output };
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
});

/**
 * Regenerate ONLY the propositions whose territory names are NOT in
 * `keepTerritories`. Kept propositions are preserved verbatim; the
 * regenerated ones replace the rest, and the merged output is saved.
 *
 * Order in the saved output follows the current Stage 7 territory order.
 */
export const regenerateStage8Selective = createServerFn({ method: "POST" })
  .inputValidator((i) => SelectiveInput.parse(i))
  .handler(async function* ({ data }) {
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

    let newOutput = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_8_SYSTEM_PROMPT,
        userMessage: `${baseUserMessage}\n\n---\n\n${continuationMessage}\n\nGenerate fresh propositions for the listed remaining territories only. Do not repeat the kept ones.`,
        maxTokens: 12000,
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

    // ----- Enforce Universal Proposition Quality Gate on merged output -----
    const gateResult = await enforceQualityGate({
      sessionId: data.sessionId,
      output: merged,
      stage7Output: session.stage_7_output,
      brandName: session.brand_name,
      category: session.category,
      cmm: session.stage_2_output ?? "",
    });
    if (gateResult.replaced > 0) {
      merged = gateResult.output;
      const banner = `\n\n---\n\n*[Quality Gate: ${gateResult.replaced} proposition${gateResult.replaced === 1 ? "" : "s"} regenerated to meet the Universal Proposition Quality Gate]*\n\n---\n\n`;
      yield { delta: banner };
      yield { delta: merged };
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_8_output: merged, stage_8_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 8 output: ${updateErr.message}`);

    yield { done: true as const, output: merged };
  });
