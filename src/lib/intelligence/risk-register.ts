// BRAND GRENADE — NEXT-STEP ACCOUNTABILITY (Document 00A)
// ============================================================================
// Two derivations, both built only from the stored report JSON:
//
//  1. Risk register — the measurement framework's early-warning signals,
//     re-presented as a register with a directional likelihood/impact rating
//     per signal. The report records no per-signal ratings, so both are
//     derived deterministically from the signal's own wording (rules below)
//     and are labelled in the document as directional assessments, not
//     observed fact.
//
//  2. Next actions — explicit follow-through actions, each owned by a
//     generic functional role (Category Lead, Brand Team, Marketing
//     Leadership). No named individuals are ever used.

export type Rating = "Low" | "Medium" | "High";

export interface RiskEntry {
  signal: string;
  likelihood: Rating;
  impact: Rating;
}

export interface NextAction {
  action: string;
  owner: "Category Lead" | "Brand Team" | "Marketing Leadership";
}

/* ---- likelihood / impact classification -------------------------------- */

const LIKELIHOOD_HIGH = /\b(will|inevitable|certain|already|ongoing|continu(e|ing)|underway)\b/i;
const LIKELIHOOD_LOW = /\b(unlikely|remote|only if|in the event)\b/i;

const IMPACT_HIGH =
  /\b(share|delist|distribution|volume|price|margin|private label|commoditis|loyalty|switch|churn|boycott|backlash|trust|competitive response|retailer|range|ranging|supply)\b/i;
const IMPACT_LOW = /\b(awareness|recall|sentiment|engagement|social|press|media coverage)\b/i;

function classify(signal: string): { likelihood: Rating; impact: Rating } {
  const likelihood: Rating = LIKELIHOOD_LOW.test(signal)
    ? "Low"
    : LIKELIHOOD_HIGH.test(signal)
      ? "High"
      : "Medium";
  const impact: Rating = IMPACT_HIGH.test(signal)
    ? "High"
    : IMPACT_LOW.test(signal)
      ? "Low"
      : "Medium";
  return { likelihood, impact };
}

/**
 * Early-warning signals as a risk register. Every signal the report recorded
 * is carried through; none are dropped or reworded.
 */
export function buildRiskRegister(signals: string[]): RiskEntry[] {
  return signals
    .map((s) => s.trim())
    .filter(Boolean)
    .map((signal) => ({ signal, ...classify(signal) }));
}

/* ---- next actions ------------------------------------------------------- */

export interface NextActionInput {
  brandName: string;
  primaryName: string;
  verdict: string;
  conditions: string[];
  mustInclude: string[];
  registerSize: number;
}

/**
 * Explicit next actions owned by generic functional roles. Each action is
 * tied to something real in the report: the decision itself, the conditions
 * on claiming, the required inclusions, and the risk register above.
 */
export function buildNextActions(input: NextActionInput): NextAction[] {
  const actions: NextAction[] = [];
  const claiming = input.verdict !== "DO NOT CLAIM";

  if (input.primaryName) {
    actions.push({
      action: claiming
        ? `Confirm the decision to adopt "${input.primaryName}" as the strategic territory for ${input.brandName}, and release it into the Briefing Room for proposition development.`
        : `Confirm the decision not to claim "${input.primaryName}", and direct which alternative territory the Briefing Room should develop instead.`,
      owner: "Marketing Leadership",
    });
  }
  if (input.conditions.length) {
    actions.push({
      action: `Work through the ${input.conditions.length} condition${input.conditions.length === 1 ? "" : "s"} on claiming set out in section 07 and sign each off as met before any external use of the territory.`,
      owner: "Category Lead",
    });
  }
  if (input.mustInclude.length) {
    actions.push({
      action: `Carry the ${input.mustInclude.length} required inclusion${input.mustInclude.length === 1 ? "" : "s"} from section 07 into the creative brief verbatim, and check the returning work against them.`,
      owner: "Brand Team",
    });
  }
  if (input.registerSize) {
    actions.push({
      action: `Stand up tracking against the risk register above: assign each high-impact signal a review cadence, and agree in advance what response each one triggers if it fires.`,
      owner: "Marketing Leadership",
    });
  }
  return actions;
}
