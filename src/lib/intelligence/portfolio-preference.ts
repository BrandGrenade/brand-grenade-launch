// Why a portfolio-coherence recommendation can be preferred over a
// higher-scoring single-brand defence.
//
// When the recommended territory is a federated/portfolio play and another
// territory scores at least as highly on every shown dimension, the report has
// to say plainly why the higher-scoring option was not taken. This is that
// reasoning, stated once, at the derivation layer, so every section that needs
// it renders identical wording.

type Loose = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Verbatim reasoning. Do not paraphrase — it is a stated client position. */
export const PORTFOLIO_OVER_SINGLE_BRAND_RATIONALE =
  "Portfolio coherence was preferred over the higher-scoring single-brand defence for two reasons: cost and risk. " +
  "Launching a new brand nationally is expensive — product, packaging, sales effort and marketing all have to be built from nothing. " +
  "The risk is structural: forcing a single national brand onto a category built on state loyalty risks alienating existing, " +
  "passionate consumers who are loyal to their home-state brand — and if that loyalty proves as strong as the evidence suggests, " +
  "the company would be genuinely exposed by abandoning it. A coherent federated portfolio strategy keeps that existing brand " +
  "advocacy fully intact, while adding a new layer of trust across the group. This is why the recommendation optimises for " +
  "coherence across the whole portfolio over the isolated strength of a single defensive play.";

function isPortfolioPlay(t: Loose | null): boolean {
  if (!t) return false;
  const hay = [str(t.name), str(t.description), str(t.recommendation_rationale)].join(" ").toLowerCase();
  return /(federated|portfolio|masterbrand architecture|endorser|house of brands)/.test(hay);
}

function isSingleBrandDefence(t: Loose): boolean {
  const hay = [str(t.name), str(t.description), str(t.type)].join(" ").toLowerCase();
  return /(hermit crab|defence|defense|single[- ]brand|institution|masterbrand)/.test(hay);
}

/**
 * True when the recommendation is a portfolio play and at least one other
 * territory outscores it on the dimensions the document shows.
 */
export function portfolioPreferenceApplies(
  primary: Loose | null,
  others: Loose[],
): boolean {
  if (!isPortfolioPlay(primary)) return false;
  const pp = num((primary?.brand_permission as Loose | undefined)?.score);
  const pf = num((primary?.first_mover as Loose | undefined)?.score);
  if (pp == null || pf == null) return false;
  return others.some((t) => {
    if (!isSingleBrandDefence(t)) return false;
    const p = num((t.brand_permission as Loose | undefined)?.score);
    const f = num((t.first_mover as Loose | undefined)?.score);
    return p != null && f != null && p >= pp && f >= pf && (p > pp || f > pf);
  });
}
