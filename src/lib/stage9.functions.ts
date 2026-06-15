import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude, callClaude } from "./claude.server";
import { STAGE_9_SYSTEM_PROMPT, buildStage9UserMessage } from "./stage9-prompt";

import { countPropositions } from "./count-helpers";

const Input = z.object({ sessionId: z.string().uuid() });

// ===== Deterministic Emotional Direction Test enforcer =====
// Mirrors the Stage 8 banned-word gate. Stage 9 prompt instructs Claude to
// rewrite grievance/permission-cliché language silently, but this server-side
// scan guarantees enforcement before persistence. If banned tokens appear, we
// trigger a full rewrite pass with explicit instruction to write from the
// "giving direction" (what the brand gives, adds, or restores). Max 2 rewrite
// attempts before flagging for human review.
const STAGE_9_BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\breward(s|ed|ing)?\b/i, reason: "banned word 'reward'" },
  { pattern: /\bearn(s|ed|ing)?\b/i, reason: "banned word 'earn/earned'" },
  { pattern: /\bdeserv(e|es|ed|ing)\b/i, reason: "banned word 'deserve/deserved'" },
  { pattern: /\bapolog(y|ise|ize|ies|ised|ized)\b/i, reason: "banned word 'apology/apologise'" },
  { pattern: /\bguilt(y|less)?\b/i, reason: "banned word 'guilt/guilty'" },
  { pattern: /\byou\s+deserve\b/i, reason: "banned phrase 'you deserve'" },
  { pattern: /\byou\s+earned\b/i, reason: "banned phrase 'you earned'" },
  { pattern: /end of (the |a )?day/i, reason: "banned phrase 'end of day'" },
  { pattern: /day well spent/i, reason: "banned phrase 'day well spent'" },
  { pattern: /treat yourself/i, reason: "banned phrase 'treat yourself'" },
  { pattern: /permission to\b/i, reason: "banned phrase 'permission to'" },
  { pattern: /no compromise/i, reason: "banned phrase 'no compromise'" },
  { pattern: /no guilt/i, reason: "banned phrase 'no guilt'" },
];

// Strip any preamble/meta-commentary that appears before the first proposition
// marker. Stage 9 must output ONLY the propositions + ranking + recommendation;
// any preface text (e.g. "the brief arrives wearing a grievance…") would
// otherwise let descriptive uses of banned words slip past the scan.
function extractStage9PropositionRegion(text: string): string {
  const markers: RegExp[] = [
    /^\s*##\s+\S/m,
    /^\s*\*?\*?1\.\s+/m,
    /^\s*(SMP|Proposition)\s*1\b/im,
  ];
  let earliest = -1;
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index !== undefined && (earliest === -1 || m.index < earliest)) {
      earliest = m.index;
    }
  }
  return earliest > 0 ? text.slice(earliest) : text;
}

function scanStage9ForGrievance(text: string): string[] {
  const region = extractStage9PropositionRegion(text);
  const failures: string[] = [];
  for (const { pattern, reason } of STAGE_9_BANNED_PATTERNS) {
    if (pattern.test(region)) failures.push(reason);
  }
  return failures;
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

function buildStage9RewriteMessage(args: {
  originalUserMessage: string;
  flaggedOutput: string;
  failures: string[];
  attempt: number;
}): string {
  return `${args.originalUserMessage}

==== EMOTIONAL DIRECTION TEST — REWRITE REQUIRED (attempt ${args.attempt}/2) ====

Your previous Stage 9 output FAILED the Emotional Direction Test. The following grievance/permission-cliché language was detected and MUST NOT appear in the rewrite:

${args.failures.map((r) => `  • ${r}`).join("\n")}

MANDATORY REWRITE INSTRUCTION
Regenerate the FULL Stage 9 deliverable (5–7 SMPs, ranking, recommendation) from the GIVING DIRECTION only. The proposition must stand on what the brand gives, adds, or restores — never on what the category took, denied, or made the audience earn. Reject any framing that requires the audience to feel wronged, deceived, cheated, managed, or owed permission before they feel the brand.

OUTPUT FORMAT — STRICT
Output ONLY the propositions, then the ranking, then the recommendation. Do NOT write any preamble, framing paragraph, "a note before the propositions", methodology note, acknowledgement that the brief contained a grievance, or any explanation of what you detected, rejected, or rewrote. Do not mention the Emotional Direction Test, the rewrite, or the previously rejected output anywhere in your response. Begin your response with the first proposition heading. The reader must not be able to tell a rewrite occurred.

Banned words and phrases (do not use any form, in any section, including ranking and recommendation): reward, earn/earned, deserve/deserved, apology/apologise, guilt/guilty, "you deserve", "you earned", "end of day", "day well spent", "treat yourself", "permission to", "no compromise", "no guilt".


The previously rejected output (do NOT reproduce or paraphrase):

<<<REJECTED_OUTPUT_START>>>
${args.flaggedOutput}
<<<REJECTED_OUTPUT_END>>>

Produce the complete Stage 9 deliverable now, from the giving direction, with zero banned tokens.`;
}

export const runStage9 = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data }) {
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "B");
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_7_output, stage_8_output, stage_9_output, checkpoint_b_confirmed")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_8_output) throw new Error("Stage 8 output missing — cannot run Stage 9");
    if (session.stage_9_output) {
      yield { delta: session.stage_9_output };
      yield { done: true as const, output: session.stage_9_output };
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

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_9_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 9",
        stageNumber: "9",
        stageName: "Distinctiveness Check",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 9 failed";
      await supabaseAdmin
        .from("sessions")
        .update({ stage_9_error: msg })
        .eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    // ===== Emotional Direction Test enforcement =====
    let failures = scanStage9ForGrievance(output);
    let rewriteAttempts = 0;
    const MAX_REWRITES = 2;

    while (failures.length > 0 && rewriteAttempts < MAX_REWRITES) {
      rewriteAttempts++;
      const statusMsg = `Emotional Direction Test caught grievance language (${failures.join(", ")}) — rewriting from the giving direction (attempt ${rewriteAttempts}/${MAX_REWRITES})...`;
      await setRetryStatus(data.sessionId, statusMsg);
      // Status is communicated via retry_status (out-of-band). Do NOT yield
      // an [EDT-GUARD] delta — the client-facing stream must contain only the
      // final clean deliverable, with no hint that a rewrite occurred.

      const rewriteMessage = buildStage9RewriteMessage({
        originalUserMessage: userMessage,
        flaggedOutput: output,
        failures,
        attempt: rewriteAttempts,
      });

      try {
        const rewritten = await callClaude({
          systemPrompt: STAGE_9_SYSTEM_PROMPT,
          userMessage: rewriteMessage,
          maxTokens: 12000,
          sessionId: data.sessionId,
          stageLabel: `Stage 9 (EDT rewrite ${rewriteAttempts}/${MAX_REWRITES})`,
          stageNumber: "9",
          stageName: "Distinctiveness Check",
        });
        output = rewritten;
        yield { delta: rewritten };
        failures = scanStage9ForGrievance(output);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stage 9 EDT rewrite failed";
        await supabaseAdmin
          .from("sessions")
          .update({ stage_9_error: msg })
          .eq("id", data.sessionId);
        await setRetryStatus(data.sessionId, null);
        throw e instanceof Error ? e : new Error(msg);
      }
    }

    await setRetryStatus(data.sessionId, null);

    if (failures.length > 0) {
      const msg = `Emotional Direction Test could not produce a clean rewrite after ${MAX_REWRITES} attempts. Remaining violations: ${failures.join(", ")}. Flagged for human review.`;
      await supabaseAdmin
        .from("sessions")
        .update({
          stage_9_output: output,
          stage_9_error: msg,
          status: "needs_review",
        })
        .eq("id", data.sessionId);
      throw new Error(msg);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_9_output: output, stage_9_error: null })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 9 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
