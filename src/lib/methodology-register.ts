// METHODOLOGY REGISTER — the audited, de-duplicated list of distinct named
// methodologies the platform actually applies, each traceable to the code that
// applies it.
//
// This file replaces the hand-typed "55" that previously backed the public
// "50+ methodologies" claim. That figure came from docs/methodology-inventory.md,
// which double-counted: the Channel Framework Library (P27) was counted as one
// framework AND its 23 constituent behavioural frameworks were counted again
// individually in Part B; the canonical Minto document spec was counted
// separately from the Minto Pyramid; and several Cialdini principles from a
// single framework were counted as separate methodologies.
//
// Counting rule enforced here:
//   1. One entry per distinct underlying methodology, not per invocation.
//   2. No container entries that merely group other entries.
//   3. Named sub-components (principles, lenses, layers, engines) are recorded
//      in `components`, never counted as separate methodologies.
//   4. QA / governance guards are real platform machinery but are NOT
//      methodologies — they live in GOVERNANCE_MECHANISMS and are excluded
//      from the headline count.
//   5. Every entry must cite the file that applies it.

export type MethodologyOrigin = "proprietary" | "borrowed";

export interface MethodologyEntry {
  /** Canonical name. */
  name: string;
  origin: MethodologyOrigin;
  /** Number of individually named sub-components, where the framework has them. */
  components?: number;
  /** File(s) in this codebase that actually apply it. */
  source: string;
}

/* ── Proprietary: platform-originated methodologies ─────────────────── */

export const PROPRIETARY_METHODOLOGIES: MethodologyEntry[] = [
  {
    name: "Ten Analytical Layers (Intelligence Engine)",
    origin: "proprietary",
    components: 10,
    source: "src/lib/intelligence/system-prompt.ts",
  },
  {
    name: "Five Territory / Opportunity Types",
    origin: "proprietary",
    components: 5,
    source: "src/lib/intelligence/system-prompt.ts",
  },
  {
    name: "Left-of-Centre Engine Set",
    origin: "proprietary",
    components: 13,
    source: "src/lib/loc/task-types.ts",
  },
  {
    name: "Stage 8 Disruption Engines",
    origin: "proprietary",
    components: 3,
    source: "src/lib/stage8-disruption-engines.ts",
  },
  {
    name: "37-Lens Creative Sweep",
    origin: "proprietary",
    components: 37,
    source: "src/lib/stimulus/lenses.ts",
  },
  {
    name: "Eight-Dimension Creative Rating System",
    origin: "proprietary",
    components: 8,
    source: "src/lib/stimulus/rating-prompts.ts",
  },
  {
    name: "Six-Dimension Strategic Scoring Rubric",
    origin: "proprietary",
    components: 6,
    source: "src/lib/platform-metrics.ts; src/lib/stage12-filter.ts",
  },
  {
    name: "Detonation Stress Test",
    origin: "proprietary",
    components: 8,
    source: "src/lib/stage18-the-detonation-prompt.ts",
  },
  {
    name: "Forcing Proposition Test",
    origin: "proprietary",
    source: "src/lib/stage13-prompt.ts",
  },
  {
    name: "Four Truth Types (brief interrogation)",
    origin: "proprietary",
    components: 4,
    source: "src/lib/briefing-room-prompts.ts",
  },
  {
    name: "Signature Registry (creative orchestration)",
    origin: "proprietary",
    components: 4,
    source: "src/lib/stimulus/orchestration-prompts.ts",
  },
  {
    name: "Proposition Anchoring (pre- and post-generation)",
    origin: "proprietary",
    source: "src/lib/proposition-anchor.ts",
  },
  {
    name: "Research Synthesiser six-category claim model",
    origin: "proprietary",
    components: 6,
    source: "src/lib/synthesiser/types.ts",
  },
  {
    name: "Headline Craft Library",
    origin: "proprietary",
    components: 8,
    source: "src/lib/stage18-the-detonation-prompt.ts",
  },
  {
    name: "Fatal / Flagged attackability model",
    origin: "proprietary",
    components: 7,
    source: "src/lib/stage11-prompt.ts",
  },
  {
    name: "Checkpoint Gate System (A–F)",
    origin: "proprietary",
    components: 6,
    source: "src/lib/checkpoint-gate.ts",
  },
];

/* ── Borrowed: externally originated, named in prompt logic ─────────── */

export const BORROWED_METHODOLOGIES: MethodologyEntry[] = [
  {
    name: "Mental availability and distinctive assets (Ehrenberg-Bass)",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Dual-process / System 1 processing (Kahneman)",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Influence principles (Cialdini)",
    origin: "borrowed",
    components: 7,
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Jobs to be Done",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Prospect theory / loss aversion",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Mental accounting",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Endowment effect",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Choice architecture / nudge theory",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Behaviour motivation-and-prompt model (Fogg)",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Peak-end rule",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Flow / peak experience",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Agenda setting theory",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Social identity / in-group belonging",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Parasocial relationship theory",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Elaboration Likelihood Model",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Self-perception theory",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Classical conditioning / association transfer",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Effort reduction",
    origin: "borrowed",
    source: "src/lib/stage21-channel-detonation-briefs-prompt.ts",
  },
  {
    name: "Semiotics",
    origin: "borrowed",
    source: "src/lib/stage17-detonation-territory-prompt.ts",
  },
  {
    name: "Share of Voice / excess share of voice",
    origin: "borrowed",
    source: "src/lib/stage18-the-detonation-prompt.ts",
  },
  {
    name: "Minto Pyramid Principle",
    origin: "borrowed",
    components: 10,
    source: "src/lib/minto.ts",
  },
  {
    name: "Behavioural archetypes (non-demographic segmentation)",
    origin: "borrowed",
    source: "src/lib/stage14c-prompt.ts",
  },
  {
    name: "Brand architecture: driver / endorser / sub-brand",
    origin: "borrowed",
    source: "src/lib/intelligence/system-prompt.ts",
  },
  {
    name: "CRAB (Clear, Relevant, Appealing, Believable)",
    origin: "borrowed",
    components: 4,
    source: "src/lib/stage8-prompt.ts; src/lib/stimulus/rating-prompts.ts",
  },
];

/**
 * QA and governance guards. Real, running platform machinery — deliberately
 * NOT counted as methodologies in any public claim.
 */
export const GOVERNANCE_MECHANISMS: MethodologyEntry[] = [
  { name: "Content-Coverage Model", origin: "proprietary", source: "src/lib/intelligence/system-prompt.ts" },
  { name: "Honesty Discipline (fabrication guard)", origin: "proprietary", source: "src/lib/intelligence/system-prompt.ts" },
  { name: "The Writer Standard / Craft Bar", origin: "proprietary", source: "src/lib/stage8-disruption-engines.ts" },
  { name: "Gate One / Gate Two admission rules", origin: "proprietary", source: "src/lib/stimulus/gate-two-rules.ts" },
  { name: "Compliance Ledger", origin: "proprietary", source: "src/lib/stimulus/big-idea-prompt.ts" },
  { name: "Convergence Ledger", origin: "proprietary", source: "src/lib/stimulus/convergence-ledger.server.ts" },
  { name: "Adaptation Fidelity Check", origin: "proprietary", source: "src/lib/stimulus/adaptation-fidelity.server.ts" },
  { name: "Distinctiveness / Line Check", origin: "proprietary", source: "src/lib/stimulus/line-check.server.ts" },
  { name: "Fact Verification Safeguard", origin: "proprietary", source: "src/lib/fact-verify.server.ts" },
  { name: "Stage 9 Disposition (mandatory rejection rationale)", origin: "proprietary", source: "src/lib/stage9-disposition.ts" },
];

export const METHODOLOGY_REGISTER: MethodologyEntry[] = [
  ...PROPRIETARY_METHODOLOGIES,
  ...BORROWED_METHODOLOGIES,
];

export const PROPRIETARY_METHODOLOGY_COUNT = PROPRIETARY_METHODOLOGIES.length;
export const BORROWED_METHODOLOGY_COUNT = BORROWED_METHODOLOGIES.length;
export const GOVERNANCE_MECHANISM_COUNT = GOVERNANCE_MECHANISMS.length;

/** Distinct methodologies, de-duplicated. Derived — never asserted. */
export const REGISTER_METHODOLOGY_COUNT = METHODOLOGY_REGISTER.length;

/** Conservative public figure: rounded DOWN to the nearest five. */
export const REGISTER_METHODOLOGY_HEADLINE = `${
  Math.floor(REGISTER_METHODOLOGY_COUNT / 5) * 5
}+`;
