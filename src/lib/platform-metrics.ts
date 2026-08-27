// PLATFORM METRICS — single source of truth for every publicly asserted
// number about how the platform scores work.
//
// Rule: no marketing surface or client-facing document may hardcode a
// numeric claim about scoring dimensions, proposition volume, stage counts
// or checkpoint counts. Import from here (or from stage-manifest.ts for
// stage totals) so the claim can never drift from the code that produces it.

/**
 * Stage 10 strategic scoring rubric. Mirrored by DIMENSIONS in
 * minto-content.ts (which imports this list) and by the weighting block in
 * stage12-prompt.ts / stage12-filter.ts.
 */
export const STRATEGY_SCORING_DIMENSION_NAMES = [
  "Fame",
  "Truth Strength",
  "Competitive Impossibility",
  "Brand Permission",
  "Clean Air",
  "Commercial Precedent",
] as const;

/**
 * Creative Stimulus Engine, Gate One rating rubric.
 * Source: src/lib/stimulus/rating-prompts.ts (RATING_SYSTEM_PROMPT).
 */
export const CREATIVE_SCORING_DIMENSION_NAMES = [
  "Strategic Compliance",
  "Brand Glue",
  "CRAB",
  "Fame",
  "Creative Uniqueness",
  "Creative Ambition",
  "Producibility",
  "Brand Integrity Check",
] as const;

export const STRATEGY_SCORING_DIMENSIONS =
  STRATEGY_SCORING_DIMENSION_NAMES.length; // 6
export const CREATIVE_SCORING_DIMENSIONS =
  CREATIVE_SCORING_DIMENSION_NAMES.length; // 8

/**
 * Additional rubrics that are deliberately NOT summed into the two headline
 * figures: LOC six-dimension weighted validation, Stage 21 fidelity,
 * line-check and fact-verification. Named so copy can reference them
 * honestly without inventing a composite.
 */
export const VALIDATION_RUBRIC_NAMES = [
  "Left-of-Centre weighted validation",
  "Stage 21 fidelity gate",
  "Line check",
  "Fact verification",
] as const;

/**
 * Observed proposition volume across real completed sessions.
 * Stage 10 scored candidates + Left-of-Centre candidates, per session.
 * Shortlist range is what Stage 12 carries to human judgement.
 */
export const PROPOSITIONS_PER_BRIEF_MIN = 6;
export const PROPOSITIONS_PER_BRIEF_MAX = 23;
export const PROPOSITIONS_SHORTLIST_MIN = 3;
export const PROPOSITIONS_SHORTLIST_MAX = 5;

export const PROPOSITIONS_HEADLINE_CEILING =
  Math.floor(PROPOSITIONS_PER_BRIEF_MAX / 10) * 10; // 20

export const PROPOSITION_VOLUME_CLAIM = `Up to ~${PROPOSITIONS_HEADLINE_CEILING} divergent propositions generated and scored per brief, shortlisted to ${PROPOSITIONS_SHORTLIST_MIN}–${PROPOSITIONS_SHORTLIST_MAX} for human judgement.`;

/** Architectural human checkpoint gates A–F. Run-specific approvals (creative
 * direction sign-offs) are counted separately and are not part of this figure. */
export const HUMAN_CHECKPOINT_COUNT = 6;
