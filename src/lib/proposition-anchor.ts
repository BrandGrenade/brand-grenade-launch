import { PROPOSITION_VOLUME_CLAIM } from "@/lib/platform-metrics";
// UNIVERSAL PROPOSITION ANCHOR REQUIREMENT
//
// ONE shared rule governing EVERY mechanism in this platform that generates
// a proposition:
//   • Stage 8 base generator
//   • Stage 8 Disruption engines (Breach / Fuse / Flashpoint)
//   • All 13 Left-of-Centre engines
//   • Any proposition-generating mechanism added in future
//
// THE RULE
// No proposition may be output without an explicit ANCHOR — a stated
// connection to a real, specific, named capability that actually exists.
// A line with nothing real behind it (evocative brand voice, no mechanism
// to defend it) must never reach a human for selection.
//
// IMPLEMENTATION CONTRACT
// Do NOT paste anchoring text into individual engine prompts. Every
// generation path imports ANCHOR_PROMPT_RULE from here for the prompt side,
// and calls enforcePropositionAnchor() from ./proposition-anchor.server for
// the gate side. A new engine inherits the rule automatically by passing
// through the same gate.
//
// This module is prompt/text/pure-logic only, so it is safe to import from
// anywhere. The LLM-backed post-generation anchoring step lives in
// ./proposition-anchor.server.ts.

/**
 * The real, named capability register. These are mechanisms that genuinely
 * exist — an anchor may cite one of these, or a genuinely real, named
 * capability of the brand the proposition is written for (product facts,
 * distinctive assets, operating model). Never a claim invented to justify
 * a line after the fact.
 */
export const REAL_CAPABILITY_REGISTER: readonly string[] = [
  // Architecture
  "Multi-practice architecture — independent practices reasoning on the same problem in parallel, not one team's single view.",
  "Thirteen named Left-of-Centre engines firing in parallel on every brief, each with its own distinct mechanism rather than one house style.",
  "Brief isolation — five of the thirteen engines are structurally denied the brand, category and brief context, so they cannot be seeded or flattered by the client's own framing.",
  "Engine-level divergence by construction: candidates come from mechanisms that disagree, so the set is not four rewrites of one idea.",
  "Stage 8 runs a base generator plus three independent Disruption engines (Breach, Fuse, Flashpoint) on every territory, producing four competing candidates side by side instead of one pre-selected winner.",

  // Search volume and selection
  PROPOSITION_VOLUME_CLAIM +
    " Rather than a handful of variations on the first good line.",
  "Nine analytical approaches at Stage 3 generating nine distinct strategic frameworks, each carried through to its own territory universe.",
  "Every candidate is shown with the earlier, weaker draft it replaced and what was cut — the editing pass is visible, not hidden.",
  "Human checkpoints are mandatory between stages — no output advances without a person confirming it, so nothing ships on model confidence alone.",

  // Validation and elimination
  "Six-dimension validation with adversarial pressure testing — Fame, Truth Strength, Competitive Impossibility, Brand Permission, Clean Air, Commercial Precedent.",
  "Hard elimination floors — a candidate below the floor on any single dimension is disqualified outright, not averaged back into contention.",
  "Historical territory validation — propositions are checked against precedent territories rather than judged only on how they read today.",
  "Competitive Impossibility as an explicit test — a line a competitor could also credibly run is failed, not merely marked down.",
  "Clean Air testing — the territory is checked for whether the category is already crowded there before the line is allowed forward.",
  "A universal anchor gate every proposition passes through — a line with no real named mechanism behind it is withheld from human selection rather than dressed up.",
  "Fact verification against the brief and product facts, so a proposition cannot rest on a capability the brand does not actually have.",
  "Banned-word and output gates that reject category-standard strategy language before a human ever reads the line.",

  // Speed (real, but the least distinctive — see anchoring guidance)
  "2–4 hour delivery against conventional strategy cycles measured in weeks.",
];

/**
 * Anchoring guidance shared by the prompt rule and the gate.
 *
 * The speed fact is real but retrofits onto almost any line, which pulls
 * every engine's output toward time-compression themes. It is only a valid
 * anchor when the proposition is genuinely ABOUT time, and never when a
 * mechanism-specific capability also defends the line.
 */
export const ANCHOR_SEARCH_GUIDANCE = `HOW TO ANCHOR (search widely, do not default)

Search the WHOLE register before choosing. Anchor to the capability that most specifically defends THIS line — the one whose removal would break it. Prefer a capability that matches the mechanism the line came from: an inversion line should usually anchor to something structural (brief isolation, engine divergence, elimination floors), not to delivery speed.

Speed is the weakest anchor. "2–4 hour delivery" is real, but it can be retrofitted onto nearly any proposition, which is not the same as defending one. Use it ONLY when the proposition is genuinely about time, pace or the cost of waiting — and never when a more specific capability also defends the line. If you find yourself reaching for speed because nothing else fits, that is a signal the line is unanchored, not that speed is the anchor.

Two propositions in the same set should not share the same anchor unless they genuinely rest on the same mechanism.`;


export const MIN_ANCHOR_CHARS = 25;

/** Language that signals an anchor is decorative rather than real. */
const HOLLOW_ANCHOR_PATTERNS: RegExp[] = [
  /^\s*(n\/?a|none|tbc|tbd|unknown|not applicable)\s*[.!]?\s*$/i,
  /\b(could|might|may|would)\s+(be|have|offer|provide|suggest)\b/i,
  /\b(brand voice|tone of voice|feels? right|resonat\w*|evocative|aspiration\w*)\b/i,
  /\b(generally|broadly|arguably|in principle|in theory)\b/i,
];

export type AnchorVerdict = {
  anchored: boolean;
  /** The capability the proposition is anchored to (short name). */
  capability: string;
  /** One line: how this proposition is defended by that capability. */
  anchor: string;
  /** Why the gate passed or failed. */
  reason: string;
  /** "engine" = supplied at generation; "post" = added post-generation. */
  source: "engine" | "post" | "none";
};

/**
 * Cheap structural check applied to every anchor, whether it came from the
 * engine or from the post-generation anchoring step. Does not call a model.
 */
export function structuralAnchorCheck(anchor: string | null | undefined): {
  ok: boolean;
  reason: string;
} {
  const a = (anchor ?? "").trim();
  if (!a) return { ok: false, reason: "No anchor supplied." };
  if (a.length < MIN_ANCHOR_CHARS)
    return { ok: false, reason: `Anchor too thin (${a.length} chars) to name a real capability.` };
  for (const p of HOLLOW_ANCHOR_PATTERNS) {
    if (p.test(a))
      return { ok: false, reason: `Anchor is hedged or decorative, not a real named mechanism.` };
  }
  return { ok: true, reason: "Anchor names a specific capability." };
}

const REGISTER_BLOCK = REAL_CAPABILITY_REGISTER.map((c) => `- ${c}`).join("\n");

/**
 * THE shared prompt block. Injected verbatim into every generation prompt
 * that CAN see brand/capability context. Never rewrite it per engine.
 */
export const ANCHOR_PROMPT_RULE = `UNIVERSAL ANCHOR REQUIREMENT (applies to every proposition this platform generates — no exceptions)

No proposition may be output without an ANCHOR: one line naming the real, specific capability that makes the line defensible. Not a feeling. Not brand voice. A mechanism that actually exists and can be pointed at.

An anchor is valid only if it:
1. Names ONE specific capability, in plain words — not a category of capability.
2. Is REAL — verifiable in the brand's product facts, distinctive assets, or operating model, or one of the platform capabilities listed below.
3. Defends THIS line specifically — remove the capability and the line stops being true.

Reference capabilities that are genuinely real:
${REGISTER_BLOCK}

${ANCHOR_SEARCH_GUIDANCE}

If no real capability defends the line, you do NOT dress it up. You say so plainly and write a different line that a real capability does defend. A proposition with nothing real behind it is a failure, not a stylistic choice — it will be rejected by the shared anchor gate before a human ever sees it.`;

/** Anchor field spec for text-format engines (Stage 8 family). */
export const ANCHOR_TEXT_FIELD_SPEC = `Anchor: [one line — name the ONE real, specific capability that makes this line defensible, and how it defends it. Must satisfy the UNIVERSAL ANCHOR REQUIREMENT.]`;

/** Anchor field spec for JSON-contract engines (LOC family). */
export const ANCHOR_JSON_FIELD_SPEC = `"anchor": "<MANDATORY — one line naming the ONE real, specific capability that makes this proposition defensible, and how it defends it. Not brand voice, not a feeling, not a hedged possibility. Must satisfy the UNIVERSAL ANCHOR REQUIREMENT.>"`;

/** Standard display suffix for a proposition withheld by the gate. */
export function renderAnchorFailure(reason: string): string {
  return `_WITHHELD BY ANCHOR GATE — ${reason}_`;
}
