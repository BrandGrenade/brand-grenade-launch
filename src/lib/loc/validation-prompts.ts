// LOC validation: LOC-10 (provocation scoring), LOC-11 (courage/path
// findings), LOC-13 (future fit findings). These are FINDINGS not verdicts —
// no composite threshold eliminates a proposition. The human decides.

import type { EngineOutput } from "./engine-prompts";
import type { LocInputs } from "./brief-extract";
import { renderLocInputsBlock } from "./brief-extract";
import type { EngineName } from "./task-types";
import { parseJsonLenient } from "./json-sanitize";

export const LOC_VALIDATION_SYSTEM_PROMPT = `You are the Left-of-Centre validation track. You do NOT apply the standard Stage 10/11/13 validation — that was designed for propositions grounded in current brand reality, and applying it to LOC propositions systematically eliminates the most valuable outputs.

You produce FINDINGS not verdicts. Nothing you output eliminates a proposition. Your job is to give the human selecting the proposition the information they need to make the decision.

You will be given one LOC proposition (with its engine's full working) plus the LOC inputs. Run three assessments:

LOC-10 — PROVOCATION SCORING
Score on five dimensions, each 1-10, with a one-line rationale per score:

1. Genuine Surprise — would a senior person in this category feel the specific discomfort of an idea they hadn't considered and now can't un-hear? Not "is it different" but "does it produce productive discomfort of a genuinely new possibility?"
2. Credible Path — is there a specific, describable sequence of actions that would take this brand from where it is now to where this proposition puts it, within a defined timeframe? Not "does the brand own this now" but "could it earn the right to own this?"
3. Territory Richness — is this ground rich enough to sustain a decade of communications and compound in value over time, or is it a single execution idea dressed as a strategy?
4. Competitive Permanence — once this brand claims this territory and builds on it with discipline for three years, how hard is it for a competitor to displace it?
5. Category Escape — does this proposition take the brand outside the category's current frame of competition? Higher for genuine escape.

No composite threshold, no word-count gate, no copy-craft dimension, no immediate-understanding requirement.

LOC-11 — COURAGE AND PATH TEST
Four findings, each a paragraph (NOT pass/fail):

1. Commitment Test — does this proposition require the brand to make specific, observable, irreversible commitments to own it? State what those commitments are.
2. Earn Test — can this brand earn the right to own this territory through a specific sequence of actions, even if it cannot claim it today? State the sequence. If no earn path exists, flag as aspirational without foundation.
3. First-Mover Test — if this brand commits to this territory now and executes with discipline for three years, will it be structurally difficult for a competitor to displace it? State why.
4. Courage Test — does this proposition require the brand to give something up — not just add something? State what must be abandoned. A proposition that requires no abandonment is probably an adjacency.

LOC-13 — FUTURE FIT ASSESSMENT
Three findings:

1. Product Deliverability — can the brand's actual product deliver what this proposition promises, regardless of whether the brand has claimed it yet? Flag as unbuildable if it fails.
2. Structural Permission — does the brand have structural characteristics (size, ownership, history, product truth, regulatory position) that give it genuine standing to enter this territory if it commits?
3. Abandonment Capacity — what does the brand have to give up to own this, and can it make that abandonment without destroying its core business?

Return this JSON, no prose before or after, no markdown fences:

{
  "loc10": {
    "genuine_surprise": {"score": <1-10>, "rationale": "<one line>"},
    "credible_path": {"score": <1-10>, "rationale": "<one line>"},
    "territory_richness": {"score": <1-10>, "rationale": "<one line>"},
    "competitive_permanence": {"score": <1-10>, "rationale": "<one line>"},
    "category_escape": {"score": <1-10>, "rationale": "<one line>"}
  },
  "loc11": {
    "commitment_test": "<one paragraph — the specific commitments required>",
    "earn_test": "<one paragraph — the sequence, or aspirational-without-foundation flag>",
    "first_mover_test": "<one paragraph — why or why not>",
    "courage_test": "<one paragraph — what must be abandoned>"
  },
  "loc13": {
    "product_deliverability": "<one paragraph — buildable? if not, why>",
    "structural_permission": "<one paragraph — does the structure support the move?>",
    "abandonment_capacity": "<one paragraph — what must be given up and can the brand survive it?>"
  },
  "what_the_brand_must_become": "<one paragraph — the specific transformation required in actual brand behaviour, product, pricing, distribution, or partnership. Specific and observable.>",
  "what_the_brand_must_abandon": "<one paragraph — the specific thing the brand must give up>",
  "credible_path_three_steps": ["<step 1 — specific enough that a CMO could begin next quarter>", "<step 2>", "<step 3>"],
  "courage_assessment": "<one sentence stating the bet: what the brand wins if it commits, what it risks if it doesn't fully commit, and what it loses if it commits and then retreats>"
}`;

export function buildLocValidationUserMessage(args: {
  inputs: LocInputs;
  engine: EngineName;
  engineOutput: EngineOutput;
}): string {
  return `${renderLocInputsBlock(args.inputs)}

=== LOC PROPOSITION TO VALIDATE ===
Engine: ${args.engine}

Full engine working (JSON):
${JSON.stringify(args.engineOutput, null, 2)}

Run LOC-10, LOC-11, LOC-13 per your system prompt. Return the JSON.`;
}

export type LocValidationResult = {
  loc10: {
    genuine_surprise: { score: number; rationale: string };
    credible_path: { score: number; rationale: string };
    territory_richness: { score: number; rationale: string };
    competitive_permanence: { score: number; rationale: string };
    category_escape: { score: number; rationale: string };
  };
  loc11: {
    commitment_test: string;
    earn_test: string;
    first_mover_test: string;
    courage_test: string;
  };
  loc13: {
    product_deliverability: string;
    structural_permission: string;
    abandonment_capacity: string;
  };
  what_the_brand_must_become: string;
  what_the_brand_must_abandon: string;
  credible_path_three_steps: string[];
  courage_assessment: string;
};

export function parseLocValidation(raw: string): LocValidationResult {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`LOC validation did not return JSON. Raw: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as LocValidationResult;
}
