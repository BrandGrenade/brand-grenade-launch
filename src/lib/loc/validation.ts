// Unified Six-Dimension Proposition Validation Framework
//
// Scores each LOC proposition on six weighted dimensions with hard
// floors on Truth Strength and Competitive Impossibility. Consumed by
// runLeftOfCentre after all engines return, and by Stage 12 selection.
//
// Weights (sum = 100):
//   Fame                     30
//   Truth Strength           20   (hard floor: >= 5)
//   Competitive Impossibility 15  (hard floor: >= 6 — Stage 10 canonical)
//   Brand Permission         10
//   Clean Air                10
//   Commercial Precedent     5
//   (Remaining 10 reserved / distributed by the model.)
//
// Any proposition below a hard floor is flagged failsFloor=true and
// weightedScore is preserved for transparency but marked disqualified.

import type { EngineName } from "./task-types";
import { LOC_ENGINE_LABEL } from "./task-types";
import type { EngineOutput } from "./engine-prompts";
import { callClaude } from "../claude.server";

export type ValidationDimension =
  | "fame"
  | "truth_strength"
  | "competitive_impossibility"
  | "brand_permission"
  | "clean_air"
  | "commercial_precedent";

export const DIMENSION_WEIGHTS: Record<ValidationDimension, number> = {
  fame: 30,
  truth_strength: 20,
  competitive_impossibility: 15,
  brand_permission: 10,
  clean_air: 10,
  commercial_precedent: 5,
};

export const DIMENSION_LABEL: Record<ValidationDimension, string> = {
  fame: "Fame",
  truth_strength: "Truth Strength",
  competitive_impossibility: "Competitive Impossibility",
  brand_permission: "Brand Permission",
  clean_air: "Clean Air",
  commercial_precedent: "Commercial Precedent",
};

export const HARD_FLOORS: Partial<Record<ValidationDimension, number>> = {
  truth_strength: 5,
  // Aligned to the Stage 10 code-enforced floor (STAGE_10_FLOORS) — the two
  // systems are presented as one framework and must eliminate identically.
  competitive_impossibility: 6,
};

export type ValidationScore = {
  fame: number;
  truth_strength: number;
  competitive_impossibility: number;
  brand_permission: number;
  clean_air: number;
  commercial_precedent: number;
  weightedScore: number; // 0-100
  failsFloor: boolean;
  floorFailures: ValidationDimension[];
  rationale: string;
};

export type EngineValidationEntry = {
  engine: EngineName;
  score: ValidationScore | null;
  error?: string;
};

function clamp10(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

export function computeWeighted(
  raw: Record<ValidationDimension, number>,
): { weightedScore: number; failsFloor: boolean; floorFailures: ValidationDimension[] } {
  let total = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    total += (raw[dim as ValidationDimension] / 10) * weight;
  }
  const floorFailures: ValidationDimension[] = [];
  for (const [dim, floor] of Object.entries(HARD_FLOORS)) {
    if (raw[dim as ValidationDimension] < (floor as number)) {
      floorFailures.push(dim as ValidationDimension);
    }
  }
  return { weightedScore: Math.round(total), failsFloor: floorFailures.length > 0, floorFailures };
}

const VALIDATION_SYSTEM_PROMPT = `You are a strategic validation judge for a brand strategy engine.

You will be given up to 13 proposition candidates, each produced by a distinct Left-of-Centre generative engine. Your job is to score EVERY proposition on six dimensions using a 0–10 integer scale.

DIMENSIONS AND WEIGHTS
1. Fame (weight 30) — Would this generate unpaid conversation, press, or cultural traction? 10 = category-defining; 0 = invisible.
2. Truth Strength (weight 20) — Is the underlying human truth durable, specific, non-generic? 10 = undeniable; 0 = platitude. HARD FLOOR at 5.
3. Competitive Impossibility (weight 15) — Could a direct competitor say this credibly next week? 10 = only this brand can own it; 0 = anyone could say it. HARD FLOOR at 6.
4. Brand Permission (weight 10) — Does the brand have credible right to make this claim today? 10 = obvious fit; 0 = would ring false.
5. Clean Air (weight 10) — Is this territory unclaimed in the category? 10 = pristine; 0 = crowded.
6. Commercial Precedent (weight 5) — Has anything like this ever paid off commercially in any category? 10 = strong precedent; 0 = no evidence it works.

OUTPUT
Return ONLY valid JSON in this exact shape, no prose, no code fence:

{
  "scores": [
    {
      "engine": "<engine key>",
      "fame": 0,
      "truth_strength": 0,
      "competitive_impossibility": 0,
      "brand_permission": 0,
      "clean_air": 0,
      "commercial_precedent": 0,
      "rationale": "one sentence, plain English, no hedging"
    }
  ]
}

All six scores are integers 0–10. Include one entry per engine key you receive. Do not omit any engine. Do not add extra keys.`;

function buildValidationUserMessage(args: {
  brandName: string;
  category: string;
  propositions: { engine: EngineName; line: string; descriptor: string }[];
}): string {
  const items = args.propositions
    .map(
      (p) =>
        `- engine: ${p.engine}
  label: ${LOC_ENGINE_LABEL[p.engine]}
  line: ${p.line}
  descriptor: ${p.descriptor}`,
    )
    .join("\n\n");
  return `BRAND: ${args.brandName}
CATEGORY: ${args.category}

Score every proposition below. Return JSON only.

${items}`;
}

type RawScoreObj = {
  engine?: string;
  fame?: unknown;
  truth_strength?: unknown;
  competitive_impossibility?: unknown;
  brand_permission?: unknown;
  clean_air?: unknown;
  commercial_precedent?: unknown;
  rationale?: unknown;
};

function extractJson(raw: string): { scores?: RawScoreObj[] } | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function runValidationPass(args: {
  sessionId: string;
  brandName: string;
  category: string;
  engineOutputs: { engine: EngineName; output: EngineOutput }[];
}): Promise<EngineValidationEntry[]> {
  const propositions = args.engineOutputs.map((e) => ({
    engine: e.engine,
    line: e.output.proposition?.trim() || "(no line)",
    descriptor: e.output.descriptor?.trim() || "",
  }));

  const raw = await callClaude({
    systemPrompt: VALIDATION_SYSTEM_PROMPT,
    userMessage: buildValidationUserMessage({
      brandName: args.brandName,
      category: args.category,
      propositions,
    }),
    maxTokens: 8000,
    sessionId: args.sessionId,
    stageLabel: "LOC Validation",
    stageNumber: "9-loc-validation",
    stageName: "LOC Validation",
  });

  const parsed = extractJson(raw);
  const byEngine = new Map<string, RawScoreObj>();
  if (parsed?.scores && Array.isArray(parsed.scores)) {
    for (const s of parsed.scores) {
      if (typeof s?.engine === "string") byEngine.set(s.engine, s);
    }
  }

  const results: EngineValidationEntry[] = args.engineOutputs.map(({ engine }) => {
    const s = byEngine.get(engine);
    if (!s) {
      return { engine, score: null, error: "Validator returned no entry for this engine." };
    }
    const raw: Record<ValidationDimension, number> = {
      fame: clamp10(s.fame),
      truth_strength: clamp10(s.truth_strength),
      competitive_impossibility: clamp10(s.competitive_impossibility),
      brand_permission: clamp10(s.brand_permission),
      clean_air: clamp10(s.clean_air),
      commercial_precedent: clamp10(s.commercial_precedent),
    };
    const { weightedScore, failsFloor, floorFailures } = computeWeighted(raw);
    return {
      engine,
      score: {
        ...raw,
        weightedScore,
        failsFloor,
        floorFailures,
        rationale: typeof s.rationale === "string" ? s.rationale.trim() : "",
      },
    };
  });

  return results;
}
