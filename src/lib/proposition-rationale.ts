// BRAND GRENADE — PROPOSITION REASONING (shared, document-independent)
// ============================================================================
// Session-authored reasoning that must travel with a locked proposition into
// EVERY deliverable that discusses how that proposition was arrived at, or why
// it was selected over the alternatives.
//
// This sits at the same shared derivation layer as the provenance correction
// (`smpScoreProvenance` in minto-content.ts), so any document builder that
// renders provenance or selection reasoning picks it up automatically — there
// are no document-level copies of this text anywhere.
//
// Text is stored verbatim. It is never rewritten, shortened or paraphrased by
// any renderer.

import { callout } from "./doc-system";

export interface PropositionReasoning {
  /** Paragraphs that accompany the human-gate / "how it was arrived at" story. */
  arrivedAt: string[];
  /** Paragraphs that accompany "why this over the alternatives". */
  overAlternatives: string[];
}

function key(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REASONING: Array<{ match: string; reasoning: PropositionReasoning }> = [
  {
    match: key("Stealth. By Design."),
    reasoning: {
      arrivedAt: [
        "“A jaguar never announces itself” is an intrinsic truth about the animal — and that truth aligns precisely with three separate realities the brand is facing: the engineering truth of a silent EV, and the commercial truth that the car hasn't been seen yet, so there's no product to hype.",
        "The system's own output used the word “stealth,” but not as a proposition — it was identified through human judgement as the single word that could bring these three truths together at once. Stealth is the animal. Stealth is the vehicle. And stealth turns the absence of a visible product into a deliberate, positive marketing strategy, rather than a gap to apologise for.",
        "“By Design” does the same work in the same register: it speaks to the animal's physical restraint, to the engineered silence of the product, and to the deliberate choice not to launch with fanfare or overhype.",
        "This was chosen because it single-mindedly positions the vehicle and its reason for being in one line that is instantly understood, yet still feels aspirational — which is exactly where the brand needs to sit. It's creative, ownable, and genuinely campaignable.",
      ],
      overAlternatives: [
        "Beauty as a tiebreaker loses because it's still a comparative claim — it only exists in response to the category, as the metric left standing once the numbers converge. It's a stronger car, not a stronger idea. Leadership brands don't compete on a shared scale, however favourably; they act as a lighthouse — illuminating and attracting on their own terms, never in comparison to another lighthouse. “Stealth. By Design.” isn't a better answer to the category's question. It's a flag planted in the ground, standing entirely apart from the comparison. That's why it wins over beauty — not because it scores higher, but because it refuses to compete on the category's terms at all.",
      ],
    },
  },
];

/** Reasoning recorded for a locked proposition, or null when none exists. */
export function propositionReasoning(smp: string): PropositionReasoning | null {
  const k = key(smp);
  if (!k) return null;
  const hit = REASONING.find((r) => k === r.match || k.includes(r.match) || r.match.includes(k));
  return hit ? hit.reasoning : null;
}

const paras = (lines: string[]) => lines.map((l) => `<p>${l}</p>`).join("");

/** Paragraphs for the human-gate / "how this was arrived at" story ("" if none). */
export function arrivedAtReasoningHtml(smp: string): string {
  const r = propositionReasoning(smp);
  return r?.arrivedAt.length ? paras(r.arrivedAt) : "";
}

/** Plain text of the same, for documents that build prose rather than HTML. */
export function arrivedAtReasoningText(smp: string): string {
  return propositionReasoning(smp)?.arrivedAt.join(" ") ?? "";
}

/** Callout for "why this proposition over the alternatives" ("" if none). */
export function overAlternativesHtml(smp: string): string {
  const r = propositionReasoning(smp);
  if (!r?.overAlternatives.length) return "";
  return callout("Why this proposition over the alternatives", paras(r.overAlternatives));
}
