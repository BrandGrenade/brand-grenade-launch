// Independent Stage 10 re-scoring for a locked/selected SMP.
//
// A proposition that is refined after Stage 10 has run carries no score of its
// own. Substituting a parent proposition's score is forbidden, and a missing
// score is unacceptable on the flagship recommendation, so we score the exact
// locked line on its own terms using the same six-dimension V6 framework and
// the same code-enforced floors as every other proposition.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { STAGE_10_SYSTEM_PROMPT } from "./stage10-prompt";
import { applyStage10CodeGate } from "./stage12-filter";

const RESCORE_MARKER = "==== STAGE 10 RE-SCORE — LOCKED PROPOSITION ====";

function key(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when Stage 10 already carries a score block for this exact line. */
export function hasIndependentScore(stage10Output: string, selectedSmp: string): boolean {
  const k = key(selectedSmp);
  if (!k) return false;
  return stage10Output
    .split("\n")
    .some((l) => /^\s*\**SMP:/i.test(l) && key(l).includes(k));
}

export interface RescoreResult {
  status: "already_scored" | "rescored" | "skipped";
  smp?: string;
  composite?: string | null;
  dimensions?: Record<string, number>;
  verdict?: string | null;
}

export async function rescoreLockedSmp(sessionId: string): Promise<RescoreResult> {
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "id, brand_name, category, selected_smp, selected_smp_field_name, stage_1_output, stage_8_output, stage_9_output, stage_11_output, stage_10_output, is_preflight_test",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session) return { status: "skipped" };

  const smp = (session.selected_smp ?? "").trim();
  const s10 = session.stage_10_output ?? "";
  if (!smp || !s10.trim()) return { status: "skipped" };
  if (hasIndependentScore(s10, smp)) return { status: "already_scored", smp };

  const field = session.selected_smp_field_name || "Selected proposition";
  const userMessage = `BRAND: ${session.brand_name}
CATEGORY: ${session.category}

==== PROPOSITION TO SCORE ====
"${smp}" — FIELD: ${field}

This proposition was finalised AFTER the original Stage 10 scoring pass, so it
has never been scored on its own terms. Score it now — independently, on the
exact wording above, not on any earlier or parent proposition.

==== STAGE 1 — SANITISED BRIEF ====
${session.stage_1_output ?? ""}

==== STAGE 8 — PROPOSITION SET THIS LINE CAME FROM ====
${(session.stage_8_output ?? "").slice(0, 20000)}

==== STAGE 9 — DIVERGENCE VALIDATION REPORT ====
${(session.stage_9_output ?? "").slice(0, 15000)}

==== STAGE 11 — PRESSURE TESTS ON THIS PROPOSITION ====
${(session.stage_11_output ?? "").slice(0, 15000)}

Score with the same evidence base and calibration the sibling propositions
received — this is a like-for-like pass, not a stricter one.

Emit exactly ONE per-SMP score block for this proposition using the six
dimensions (Fame, Truth Strength, Competitive Impossibility, Brand Permission,
Clean Air, Commercial Precedent). Use the exact line above in the SMP: header.
Do NOT emit a VERDICT line and do NOT emit a composite — both are computed in
code. Do not score any other proposition.`;

  const raw = await callClaude({
    systemPrompt: STAGE_10_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4000,
    sessionId,
    stageLabel: "Stage 10 re-score",
    stageNumber: "10",
    stageName: "Locked Proposition Re-score",
  });

  const gated = applyStage10CodeGate(raw, {
    isPreflight: session.is_preflight_test === true,
  });
  const score = gated.scores.find((s) => key(s.smpLine).includes(key(smp))) ?? gated.scores[0];
  if (!score) return { status: "skipped", smp };

  // Only the per-SMP block is appended; the code gate's set-level summary is
  // discarded so the original Stage 10 header/verdict remains authoritative.
  const blockStart = gated.output.search(/^\s*\**SMP:/im);
  const blockEnd = gated.output.search(/\n\s*SMPS SCORED:/i);
  const block = gated.output
    .slice(blockStart >= 0 ? blockStart : 0, blockEnd > 0 ? blockEnd : undefined)
    .trim();

  // Deterministic code lines: the shared gate injects these only when its
  // block regex matches, so we guarantee them here rather than risk a
  // document rendering a scored block with no composite.
  const codeLines = /CODE COMPOSITE:/i.test(block)
    ? ""
    : `\nCODE VERDICT: ${score.codeVerdict}${score.codeVerdict === "PASS" ? " — clears Stage 10 hard floors." : ` — ${score.codeReason}.`}\nCODE COMPOSITE: ${score.weightedComposite}/100 weighted (Fame 30% · Truth 20% · Competitive Impossibility 15% · Brand Permission 10% · Clean Air 10% · Commercial Precedent 5%).\n`;

  const appended = `${s10.trimEnd()}\n\n${RESCORE_MARKER}\nThis proposition was finalised after the original Stage 10 pass and has been scored independently on its own wording, using the same six-dimension framework and the same hard floors.\n\n${block}\n${codeLines}`;

  await supabaseAdmin
    .from("sessions")
    .update({ stage_10_output: appended })
    .eq("id", sessionId);

  return {
    status: "rescored",
    smp,
    composite: `${score.weightedComposite}/100`,
    dimensions: {
      fame: score.fame,
      truthStrength: score.truthStrength,
      competitiveImpossibility: score.competitiveImpossibility,
      brandPermission: score.brandPermission,
      cleanAir: score.cleanAir,
      commercialPrecedent: score.commercialPrecedent,
    },
    verdict: score.codeVerdict,
  };
}
