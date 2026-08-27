// PLATFORM METRICS — single source of truth for every publicly asserted
// number about how the platform scores work.
//
// Rule: no marketing surface or client-facing document may hardcode a
// numeric claim about scoring dimensions, proposition volume, stage counts
// or checkpoint counts. Import from here (or from stage-manifest.ts for
// stage totals) so the claim can never drift from the code that produces it.

import { LOC_ENGINES } from "./loc/task-types";
import { TOTAL_PIPELINE_STEPS } from "./stage-manifest";

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

/* ── Governance ─────────────────────────────────────────────────────── */

/** Hard architectural governance gates (A–F). */
export const GOVERNANCE_GATE_COUNT = HUMAN_CHECKPOINT_COUNT;

/**
 * Individual human confirmations observed across a typical full run
 * (governance gates plus run-specific creative approvals). Observed on
 * completed sessions; not a rubric constant.
 */
export const HUMAN_CONFIRMATIONS_TYPICAL_RUN = 15;

export const GOVERNANCE_CLAIM = `${GOVERNANCE_GATE_COUNT} hard governance gates (A–F), with ${HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human confirmations across a typical full run.`;

/* ── Methodologies and engines ──────────────────────────────────────── */

/** Distinct named methodologies/frameworks inventoried in docs/methodology-inventory.md. */
export const METHODOLOGY_COUNT = 55;
/** Conservative public-facing figure, floored to the nearest ten. */
export const METHODOLOGY_HEADLINE = `${Math.floor(METHODOLOGY_COUNT / 10) * 10}+`;

/** Stage 8 disruption engines — canonical key list (re-exported by stage8-disruption-engines.ts). */
export const STAGE_8_DISRUPTION_ENGINE_KEYS = [
  "breach",
  "fuse",
  "flashpoint",
] as const;

/** 13 Left-of-Centre engines + 3 Stage 8 disruption engines. */
export const LATERAL_ENGINE_COUNT =
  LOC_ENGINES.length + STAGE_8_DISRUPTION_ENGINE_KEYS.length;

/* ── Run duration ───────────────────────────────────────────────────── */

/**
 * ASSERTED, NOT DERIVED. No aggregated run-duration telemetry exists yet.
 * Observed system processing time only — human judgement and checkpoints
 * sit outside this window.
 */
export const PROCESSING_HOURS_MIN = 2;
export const PROCESSING_HOURS_MAX = 4;
export const PROCESSING_TIME_CLAIM = `${PROCESSING_HOURS_MIN}–${PROCESSING_HOURS_MAX} hours of system processing time (observed, not telemetry-aggregated) — human judgement and checkpoints continue throughout.`;

/* ── Pipeline step counts ───────────────────────────────────────────── */

/**
 * The manifest maximum: every executable step including sub-stages (1B, 4B,
 * 13B, 14B/14C, 17B, 20B). Derived from STAGE_MANIFEST — never asserted.
 */
export const PIPELINE_STEPS_MAX = TOTAL_PIPELINE_STEPS;

/**
 * OBSERVED, NOT DERIVED AT RUNTIME. Measured across the 13 sessions that have
 * reached Stage 22 (Brand Architecture): min 15, median 27, max 28. The
 * typical band excludes partial/abandoned runs. Re-measure before changing.
 * Documents never use this band — they count that session's own steps via
 * countStagesRun().
 */
export const TYPICAL_PIPELINE_STEPS_MIN = 26;
export const TYPICAL_PIPELINE_STEPS_MAX = 28;
export const TYPICAL_PIPELINE_STEPS_MEDIAN = 27;

/** Honest public framing: a ceiling plus the observed completion band. */
export const PIPELINE_STEPS_CLAIM = `up to ${PIPELINE_STEPS_MAX} pipeline steps, with completed runs to date landing at ${TYPICAL_PIPELINE_STEPS_MIN}–${TYPICAL_PIPELINE_STEPS_MAX} (median ${TYPICAL_PIPELINE_STEPS_MEDIAN})`;
