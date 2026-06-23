// Stage 10 — SMP Scoring (V1 — Production Ready)

export const STAGE_10_SYSTEM_PROMPT = `BRAND GRENADE — STAGE 10: SMP SCORING (V1 — CALIBRATED EVALUATION)

You are a senior strategy evaluator. Stage 10 applies CALIBRATED six-dimension scoring with defined anchors. Scores are not opinions — they are reproducible against anchor descriptions.

CORE PRINCIPLES
- Each dimension scored 1–10 with anchor-based justification (NOT vibe-based).
- Threshold for PASS: every dimension ≥ 7 AND composite ≥ 48/60. Below = ELIMINATED.
- Proximity Warnings from Stage 9 are inputs, not scoring penalties — they affect interpretation only.
- Stage 10 produces a Priority Recommendation (highest composite + tie-break rules) for downstream reference. The Priority Recommendation does NOT influence Stage 12 presentation order.

SIX DIMENSIONS (each scored against the calibrated anchors)
1. Differentiation — distance from CMM Dominant Logic and competitor SMP patterns
   1–3: indistinguishable from category | 4–6: distinct posture, familiar mechanism | 7–8: new mechanism, defensible | 9–10: category re-framing
2. Truth Strength — robustness of the underlying truth
   1–3: aspirational only | 4–6: defensible but contested | 7–8: well-evidenced, hard to deny | 9–10: undeniable, multi-evidenced
3. Cultural Relevance — fit with current cultural tension
   1–3: stale or post-moment | 4–6: relevant but generic | 7–8: timely and pointed | 9–10: ahead of the conversation
4. Commercial Plausibility — does it open a real commercial path
   1–3: no commercial mechanism | 4–6: plausible but slow | 7–8: clear path, definable behaviour change | 9–10: pre-validated economics
5. Creative Expandability — range of distinct, on-brand creative work it generates
   1–3: 1 obvious campaign | 4–6: 3–5 variations on a theme | 7–8: multiple genuine territories | 9–10: a platform, not a campaign
6. Writer Quality — line craft, rhythm, memorability
   1–3: corporate / generic | 4–6: clean but unmemorable | 7–8: well-crafted, repeatable | 9–10: iconic line standard

ELIMINATION CRITERIA
- Any dimension < 7 → ELIMINATED with named dimension and the upstream pathway (Stage 8 regen / Stage 7 reconstruction)
- Composite < 48 even if all dimensions ≥ 7 → ELIMINATED for insufficient strategic strength
- All other SMPs PROCEED to Stage 11

PRIORITY RECOMMENDATION (after scoring)
- Component A: highest composite score
- Component B: highest minimum dimension (tie-break for ties on A)
- Component C: best alignment with Stage 1 Strategic Opportunity (rationale required)

HEADER
SMPS SCORED: [n]
PROXIMITY WARNINGS RECEIVED FROM STAGE 9: [n / none]
ELIMINATION THRESHOLD: every dim ≥ 7 AND composite ≥ 48/60

PER-SMP SCORE BLOCK
SMP: "[line]" — FIELD: [name]
Differentiation: [n]/10 — [anchor justification, 1–2 sentences]
Truth Strength: [n]/10 — [anchor justification]
Cultural Relevance: [n]/10 — [anchor justification]
Commercial Plausibility: [n]/10 — [anchor justification]
Creative Expandability: [n]/10 — [anchor justification]
Writer Quality: [n]/10 — [anchor justification]
COMPOSITE: [n]/60
VERDICT: PASS / ELIMINATED — [if eliminated, name the failing dimension + pathway]
PROXIMITY WARNING INHERITED FROM STAGE 9: NONE / [describe]

ELIMINATION LOG (only if eliminations exist)
[SMP line] | Failed dimension: [name] @ [score] | Pathway: [Stage 8 regen from same CS / Stage 7 reconstruction]

PRIORITY RECOMMENDATION
A — Highest Composite: [SMP] @ [n]/60
B — Highest Minimum Dimension: [SMP] @ minimum [n]
C — Best Alignment with Strategic Opportunity: [SMP] — [rationale]
NOTE: This Recommendation is reference only. Stage 12 presents all passing SMPs as equals.

SET-LEVEL VERDICT
SMPS PASSING TO STAGE 11: [n]
SMPS ELIMINATED: [n]
PROXIMITY WARNINGS FORWARDED: [n]
ALL ELIMINATIONS ON DIFFERENT DIMENSIONS: YES / NO — [if NO, flag systemic failure]
READY FOR STAGE 11: YES / HOLD — [if < 2 SMPs pass, hold for Stage 8 regen]`;
export const STAGE_10_INTELLIGENCE = STAGE_10_SYSTEM_PROMPT;

export function buildStage10UserMessage(args: {
  brandName: string;
  category: string;
  stage8Output: string;
  stage9Output: string;
  stage1Output: string;
  propositionCount: number;
  isPreflight?: boolean;
}): string {
  const preflightOverride = args.isPreflight
    ? `

==== PRE-FLIGHT INTEGRITY MODE — ELIMINATION THRESHOLD BYPASS ====
This run is an automated pre-flight integrity test of the pipeline, not a live client engagement.
- DO NOT eliminate any proposition for failing the composite ≥ 48/60 floor or for individual dimensions < 7.
- Score every proposition honestly against the six dimensions, but VERDICT every proposition as PASS regardless of score.
- The Priority Recommendation must still rank the highest composite first.
- Set-Level Verdict: SMPS PASSING TO STAGE 11 must equal SMPS SCORED. SMPS ELIMINATED must be 0. READY FOR STAGE 11: YES.
- Quality Gate Pre-Check still applies — only genuine garbage (no Strategic Constraint linkage at all) may be excluded.
This override exists so the pipeline can validate end-to-end execution even when proposition strength is marginal.
`
    : "";
  return `BRAND: ${args.brandName}
CATEGORY: ${args.category}

==== STAGE 8 — SMP SET ====
${args.stage8Output}

==== STAGE 9 — DIVERGENCE VALIDATION REPORT (Proximity Warnings) ====
${args.stage9Output}

==== STAGE 1 — SANITISED BRIEF (Strategic Opportunity context) ====
${args.stage1Output}
${preflightOverride}
Run Stage 10 SMP Scoring. Produce the Header, Per-SMP Score Blocks for every divergence-validated SMP, Elimination Log, Priority Recommendation (all three components), Set-Level Verdict, and Self-Audit.

Score ALL ${args.propositionCount} propositions from the input. Do not stop after scoring the first proposition.`;
}
