// Stage 20 — Independent Brief Quality Scorer
// Runs AFTER the Master Detonation Brief is generated. Scores five dimensions
// 1–10 against a deterministic rubric, computes composite / 50, and returns
// PASS (>=40) or REVIEW. Replaces the previous placeholder that hard-coded
// 45/50. Model-self-reported scores from the generation step are ignored.

import { callClaude } from "./claude.server";
import type { BriefQualityScore } from "./phase2-shared";

const SCORER_SYSTEM_PROMPT = `You are an independent Brief Quality Assessor for the Brand Grenade Master Detonation Brief. You did not write this brief. Your only job is to score it against a fixed rubric with the eye of a jury foreman at Cannes Lions cross-checked against a CMO who has just been handed the work.

You will score five dimensions from 1 to 10. Be discriminating. A 10 is reserved for work that would win. A 5 is average category work. A 1 is a brief that gives creative teams nothing. Do not default to the middle. Do not inflate. Different briefs must produce different scores.

DIMENSION 1 — EMOTIONAL CLARITY
Does the brief specify the precise emotional response the audience must have?
1-3: Only generic positive/negative words ("feel good", "be motivated", "trust us").
4-6: Names an emotional category but not the specific texture of the feeling.
7-8: Names the specific emotional state and the moment it occurs.
9-10: Names the specific state, the trigger moment, the precise texture (e.g. "the half-second of recognition followed by quiet vindication"), and it is unmistakably tied to this SMP.

DIMENSION 2 — FAME INVITATION
Does the brief give creative teams permission to make work that earns cultural conversation beyond paid media?
1-3: Product features and rational claims only. No cultural tension. No human truth.
4-6: Contains a human truth but not sharp enough to travel.
7-8: Names a cultural tension the category has avoided; creative latitude is high.
9-10: Names a truth the category has never named, phrased so a creative team can already see the earned headlines.

DIMENSION 3 — DISTINCTIVE ASSET INTEGRATION
Does the brief specify which brand assets appear in every execution and how they build memory structures over time?
1-3: No mention of assets, or a vague "follow brand guidelines".
4-6: Names assets but no rule for how they must operate in the work.
7-8: Specifies which named assets must appear and what they must never do.
9-10: Specifies the assets, how they should function emotionally, how they connect to the proposition, and how they compound across executions.

DIMENSION 4 — PSYCHOLOGICAL LEVERAGE
Does the brief instruct creative teams in how the work must operate on how people actually process communication (fast, emotional, associative)?
1-3: Instructs teams to argue a case, list benefits, or explain features.
4-6: Gestures at emotion but no mechanism of persuasion.
7-8: Names the specific emotional trigger and the associative connection the work must create.
9-10: Names the trigger, the moment of recognition, the associative link, and why that mechanism is uniquely correct for this audience now.

DIMENSION 5 — CREATIVE SHARE OF VOICE AMBITION
Does the brief set a specific ambition for the quality multiplier this work must achieve above category average?
1-3: No stated ambition; comparative benchmark absent.
4-6: General ambition ("break through", "stand out") with no reference point.
7-8: Names a specific benchmark or multiplier and gives a reason it is achievable.
9-10: Names the specific standard (a named campaign, a specific award tier, a quantified multiplier) and justifies why the proposition and territory make it achievable.

SCORING PROCEDURE:
1. Read the brief in full.
2. Score each dimension 1-10 using the rubric above. Give a one-sentence justification for each score citing the exact language in the brief that earned or lost points.
3. Sum the five scores. That is the composite / 50.
4. Status: PASS if composite >= 40, otherwise REVIEW.
5. If REVIEW, list the specific dimensions below 7 and the one strengthening instruction each would need.

OUTPUT FORMAT — STRICT:
Return ONE and only ONE JSON object inside a fenced code block labelled json. No prose before or after the block. No additional keys. Shape exactly:

\`\`\`json
{
  "emotional_clarity": { "score": <1-10 integer>, "justification": "<one sentence>" },
  "fame_invitation": { "score": <1-10 integer>, "justification": "<one sentence>" },
  "distinctive_asset_integration": { "score": <1-10 integer>, "justification": "<one sentence>" },
  "psychological_leverage": { "score": <1-10 integer>, "justification": "<one sentence>" },
  "creative_sov_ambition": { "score": <1-10 integer>, "justification": "<one sentence>" },
  "composite": <sum of the five scores>,
  "status": "PASS" | "REVIEW",
  "failing_dimensions": [
    { "dimension": "<name>", "instruction": "<what must be strengthened, one sentence>" }
  ]
}
\`\`\`

If status is PASS, "failing_dimensions" must be an empty array.
Do not round up. Do not default to 9/10 across the board. The composite MUST equal the sum of the five dimension scores.`;

export type ScoredDimension = { score: number; justification: string };
export type FailingDimension = { dimension: string; instruction: string };
export type ScorerResult = {
  score: BriefQualityScore;
  justifications: {
    emotional_clarity: string;
    fame_invitation: string;
    distinctive_asset_integration: string;
    psychological_leverage: string;
    creative_sov_ambition: string;
  };
  failing: FailingDimension[];
};

const DIM_KEYS = [
  "emotional_clarity",
  "fame_invitation",
  "distinctive_asset_integration",
  "psychological_leverage",
  "creative_sov_ambition",
] as const;

function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}

function coerceInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.min(10, Math.round(v)));
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return Math.max(1, Math.min(10, n));
  }
  return null;
}

/** Strip any existing BRIEF QUALITY SCORE block from a brief body. */
export function stripQualityScoreBlock(text: string): string {
  const idx = text.search(/BRIEF\s+QUALITY\s+SCORE/i);
  if (idx < 0) return text.trimEnd();
  return text.slice(0, idx).trimEnd();
}

/** Run the independent scorer against a brief body. Throws on parse failure. */
export async function scoreStage20Brief(args: {
  briefBody: string;
  sessionId?: string;
}): Promise<ScorerResult> {
  const cleanBrief = stripQualityScoreBlock(args.briefBody);
  const userMessage = `Score the following Master Detonation Brief against the rubric. Return the JSON object only.\n\n=== BRIEF START ===\n${cleanBrief}\n=== BRIEF END ===`;

  const raw = await callClaude({
    systemPrompt: SCORER_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4000,
    sessionId: args.sessionId,
    stageLabel: "Stage 20 (scorer)",
    stageNumber: "20",
    stageName: "Master Detonation Brief Scorer",
    skipUniversalWrapper: true,
    temperature: 0.2,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonBlock(raw));
  } catch (e) {
    throw new Error(
      `Scorer returned non-JSON output: ${e instanceof Error ? e.message : String(e)}. Raw head: ${raw.slice(0, 200)}`,
    );
  }

  const dims: Record<string, ScoredDimension> = {};
  for (const key of DIM_KEYS) {
    const entry = parsed[key] as { score?: unknown; justification?: unknown } | undefined;
    const score = coerceInt(entry?.score);
    if (score === null) {
      throw new Error(`Scorer missing valid score for ${key}`);
    }
    const justification =
      typeof entry?.justification === "string" ? entry.justification.trim() : "";
    dims[key] = { score, justification };
  }

  const composite =
    dims.emotional_clarity.score +
    dims.fame_invitation.score +
    dims.distinctive_asset_integration.score +
    dims.psychological_leverage.score +
    dims.creative_sov_ambition.score;
  const status: "PASS" | "REVIEW" = composite >= 40 ? "PASS" : "REVIEW";

  const failingRaw = Array.isArray(parsed.failing_dimensions)
    ? (parsed.failing_dimensions as Array<Record<string, unknown>>)
    : [];
  const failing: FailingDimension[] = failingRaw
    .map((f) => ({
      dimension: typeof f.dimension === "string" ? f.dimension : "",
      instruction: typeof f.instruction === "string" ? f.instruction : "",
    }))
    .filter((f) => f.dimension && f.instruction);

  return {
    score: {
      emotional_clarity: dims.emotional_clarity.score,
      fame_invitation: dims.fame_invitation.score,
      distinctive_asset_integration: dims.distinctive_asset_integration.score,
      psychological_leverage: dims.psychological_leverage.score,
      creative_sov_ambition: dims.creative_sov_ambition.score,
      composite,
      status,
    },
    justifications: {
      emotional_clarity: dims.emotional_clarity.justification,
      fame_invitation: dims.fame_invitation.justification,
      distinctive_asset_integration: dims.distinctive_asset_integration.justification,
      psychological_leverage: dims.psychological_leverage.justification,
      creative_sov_ambition: dims.creative_sov_ambition.justification,
    },
    failing,
  };
}

/** Format the scorer result as the canonical BRIEF QUALITY SCORE block. */
export function formatScorerBlock(result: ScorerResult): string {
  const s = result.score;
  const lines = [
    "BRIEF QUALITY SCORE",
    `Emotional Clarity: ${s.emotional_clarity}/10`,
    `Fame Invitation: ${s.fame_invitation}/10`,
    `Distinctive Asset Integration: ${s.distinctive_asset_integration}/10`,
    `Psychological Leverage: ${s.psychological_leverage}/10`,
    `Creative SoV Ambition: ${s.creative_sov_ambition}/10`,
    `COMPOSITE: ${s.composite}/50`,
    `STATUS: ${s.status}`,
  ];
  if (result.failing.length > 0) {
    lines.push("", "DIMENSIONS TO STRENGTHEN:");
    for (const f of result.failing) {
      lines.push(`- ${f.dimension}: ${f.instruction}`);
    }
  }
  return lines.join("\n");
}

/** Build a rewrite instruction to hand to the brief generator when the
 *  composite is below 40. Names the failing dimensions and their strengthening
 *  instructions from the scorer. */
export function buildRewriteInstruction(result: ScorerResult): string {
  const lines = [
    "==== SCORER REWRITE INSTRUCTION — MANDATORY ====",
    "The independent scorer returned the following failing dimensions on the previous draft of this brief. Rewrite the brief so these specific weaknesses are visibly resolved. Every other section must remain strategically consistent with the SMP and selected Detonation. Do not soften. Do not generalise.",
    "",
  ];
  for (const f of result.failing) {
    lines.push(`- ${f.dimension}: ${f.instruction}`);
  }
  lines.push("", "==== END SCORER REWRITE INSTRUCTION ====");
  return lines.join("\n");
}

/** Attach a real scored block to a brief body (stripping any prior block). */
export function attachScorerBlock(briefBody: string, result: ScorerResult): string {
  const clean = stripQualityScoreBlock(briefBody);
  return `${clean}\n\n${formatScorerBlock(result)}\n`;
}
