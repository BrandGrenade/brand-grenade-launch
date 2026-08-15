// Independent Stage 10 re-scoring for a locked/selected SMP.
//
// A proposition that is refined after Stage 10 has run carries no score of its
// own. Substituting a parent proposition's score is forbidden, and a missing
// score is unacceptable on the flagship recommendation, so we score the exact
// locked line on its own terms using the same six-dimension V6 framework and
// the same code-enforced floors as every other proposition.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { scheduleBackground as scheduleBackgroundImpl } from "./background.server";
import { STAGE_10_SYSTEM_PROMPT } from "./stage10-prompt";
import {
  applyStage10CodeGate,
  computeWeightedComposite,
  evaluateStage10Verdict,
} from "./stage12-filter";

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

/** Per-worker in-flight guard so concurrent triggers cannot double-append. */
const inFlight = new Map<string, Promise<RescoreResult>>();

/**
 * STANDING PLATFORM BEHAVIOUR.
 *
 * Idempotent, content-keyed guarantee that the session's currently
 * selected/locked proposition carries its own independent Stage 10 score.
 * Because the check keys off the exact proposition TEXT, any refinement or
 * edit of the SMP — at any stage, by any path — automatically presents as
 * "unscored" and triggers a fresh scoring pass. Safe to call from anywhere,
 * as often as you like.
 */
export function ensureSmpScored(sessionId: string, force = false): Promise<RescoreResult> {
  const existing = inFlight.get(sessionId);
  if (existing) return existing;
  const run = rescoreLockedSmp(sessionId, force).finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, run);
  return run;
}

/** Fire-and-forget variant for write paths that must not block the user. */
export function ensureSmpScoredInBackground(sessionId: string): void {
  scheduleBackgroundImpl(ensureSmpScored(sessionId), "smp-rescore");
}

/**
 * `force` re-scores even when a score block already exists — used when the
 * scoring anchors themselves change and older scores must be refreshed.
 */
export async function rescoreLockedSmp(
  sessionId: string,
  force = false,
): Promise<RescoreResult> {
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
  if (!force && hasIndependentScore(s10, smp)) return { status: "already_scored", smp };

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

  // Three independent passes, median per dimension. A single LLM pass carries
  // enough sampling variance to flip a borderline dimension across the hard
  // floor; the median is the stable, defensible reading and is never re-rolled.
  const passes = await Promise.all(
    [0, 1, 2].map(async () => {
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
      // The model was asked for one exact proposition, but its output is still
      // untrusted. Never attach a sibling/first score when the header differs.
      const target = key(smp);
      const sc = gated.scores.find((x) => key(x.smpLine) === target);
      return sc ? { gated, score: sc } : null;
    }),
  );
  const valid = passes.filter((p): p is NonNullable<typeof p> => !!p);
  if (valid.length === 0) return { status: "skipped", smp };

  const median = (nums: number[]) => {
    const a = nums.filter((n) => !Number.isNaN(n)).sort((x, y) => x - y);
    return a.length ? a[Math.floor((a.length - 1) / 2)] : NaN;
  };
  const dims = {
    fame: median(valid.map((p) => p.score.fame)),
    truthStrength: median(valid.map((p) => p.score.truthStrength)),
    competitiveImpossibility: median(valid.map((p) => p.score.competitiveImpossibility)),
    brandPermission: median(valid.map((p) => p.score.brandPermission)),
    cleanAir: median(valid.map((p) => p.score.cleanAir)),
    commercialPrecedent: median(valid.map((p) => p.score.commercialPrecedent)),
  };
  const weightedComposite = computeWeightedComposite(dims);
  const { verdict: codeVerdict, reason: codeReason } = evaluateStage10Verdict(dims);
  // Narrative comes from the pass closest to the median composite.
  const chosen = valid
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.score.weightedComposite - weightedComposite) -
        Math.abs(b.score.weightedComposite - weightedComposite),
    )[0];
  const gated = chosen.gated;
  const score = { ...chosen.score, ...dims, weightedComposite, codeVerdict, codeReason };

  // Only the per-SMP block is appended; the code gate's set-level summary is
  // discarded so the original Stage 10 header/verdict remains authoritative.
  const blockStart = gated.output.search(/^\s*\**SMP:/im);
  const blockEnd = gated.output.search(/\n\s*SMPS SCORED:/i);
  const block = gated.output
    .slice(blockStart >= 0 ? blockStart : 0, blockEnd > 0 ? blockEnd : undefined)
    .split("\n")
    .filter((l) => !/^\s*CODE (VERDICT|COMPOSITE|FLAGS|BASIS)\b/i.test(l))
    .join("\n")
    .trim();

  // Deterministic code lines: the shared gate injects these only when its
  // block regex matches, so we guarantee them here rather than risk a
  // document rendering a scored block with no composite.
  const codeLines = `\nCODE VERDICT: ${score.codeVerdict}${score.codeVerdict === "PASS" ? " — clears Stage 10 hard floors." : ` — ${score.codeReason}.`}\nCODE COMPOSITE: ${score.weightedComposite}/100 weighted (Fame 30% · Truth 20% · Competitive Impossibility 15% · Brand Permission 10% · Clean Air 10% · Commercial Precedent 5%).\nCODE BASIS: median of three independent scoring passes on this exact proposition.\n`;

  // Re-read immediately before writing: another trigger may have scored this
  // exact line while these passes were running.
  const { data: fresh } = await supabaseAdmin
    .from("sessions")
    .select("stage_10_output, selected_smp")
    .eq("id", sessionId)
    .maybeSingle();
  const freshS10 = fresh?.stage_10_output ?? s10;
  if ((fresh?.selected_smp ?? smp).trim() !== smp || (!force && hasIndependentScore(freshS10, smp))) {
    return { status: "already_scored", smp };
  }

  // Drop any earlier re-score section for this same wording so repeated
  // triggers replace rather than accumulate.
  const priorTrimmed = freshS10
    .split(RESCORE_MARKER)
    .filter((part, i) => i === 0 || !key(part).includes(key(smp)))
    .join(RESCORE_MARKER)
    .trimEnd();

  const appended = `${priorTrimmed}\n\n${RESCORE_MARKER}\nThis proposition was finalised after the original Stage 10 pass and has been scored independently on its own wording, using the same six-dimension framework and the same hard floors.\n\n${block}\n${codeLines}`;

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
