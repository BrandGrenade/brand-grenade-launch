// Cross-category case reference library.
// Cases are proof-of-structural-principle only — engines must state the
// principle, then explicitly set the cases aside before generating.

import type { LocTaskType } from "./task-types";

export type CaseReference = {
  case: string;
  principle: string;
};

export const LOC_CASE_LIBRARY: Record<LocTaskType, CaseReference[]> = {
  total_revitalisation: [
    {
      case: "Old Spice / Wieden+Kennedy 2010",
      principle:
        "Complete personality inversion while retaining the name is available to a brand with strong name recognition but weak contemporary relevance; the inversion must be total, not partial.",
    },
    {
      case: "Burberry / Christopher Bailey 2001",
      principle:
        "A creative director appointment can function as a strategic repositioning signal when the brand's heritage contains latent equity the current execution has suppressed.",
    },
    {
      case: "Converse post-bankruptcy 2003",
      principle:
        "Cultural reclamation through authenticity is available when the brand's heritage has been adopted by a subculture the brand itself had stopped serving.",
    },
  ],
  relevance_extension: [
    {
      case: "Guinness / AMV BBDO 'Good Things Come to Those Who Wait'",
      principle:
        "The brand's most apparent weakness (the slow pour) can become its most powerful equity if reframed as the proof of worth rather than the cost of access.",
    },
    {
      case: "VB 'Aussie As' 2024",
      principle:
        "Widening the depicted audience without changing the equity is available when the core truth is not inherently exclusive; the move is in the casting, not the claim.",
    },
    {
      case: "Nike 'Find Your Greatness' / W+K 2012",
      principle:
        "Relocating the definition of greatness from elite performance to ordinary unwitnessed effort extends a brand's equity to an audience that previously felt excluded from it.",
    },
  ],
  challenger_disruption: [
    {
      case: "Avis 'We Try Harder' / DDB 1962",
      principle:
        "Naming your structural disadvantage before anyone else does and reframing it as a moral obligation generates more belief than claiming strength; the move requires the brand to behave the admission into truth.",
    },
    {
      case: "innocent smoothies early brand voice",
      principle:
        "Treating the category's conventions as absurd rather than as competitors generates cultural conversation the category cannot respond to without appearing humourless.",
    },
    {
      case: "Dove Real Beauty / Ogilvy 2004",
      principle:
        "Relocating from the product category to the human condition the product exists inside makes every category competitor irrelevant because they are answering a different question.",
    },
  ],
  category_relocation: [
    {
      case: "Red Bull",
      principle:
        "A brand can escape its product category entirely by claiming ownership of the human performance state the product enables; the category becomes irrelevant when the brand owns the condition.",
    },
    {
      case: "Patagonia 'Don't Buy This Jacket'",
      principle:
        "A brand can relocate from product seller to values owner when its product truth is consistent with the values it claims; the relocation requires the brand to act the values into existence, not merely assert them.",
    },
    {
      case: "Apple 'Think Different' / TBWA 1997",
      principle:
        "A brand can claim ownership of a human quality (creative nonconformity) rather than a product category when that quality is genuinely embodied in the product's design and the people who use it.",
    },
  ],
  permission_expansion: [
    {
      case: "Amazon from books to everything",
      principle:
        "The underlying promise (customer obsession, infinite selection, frictionless access) was always larger than the category; the expansion was permission to fulfil the promise rather than a new promise.",
    },
    {
      case: "Virgin across categories",
      principle:
        "A brand built on a personality and a values stance rather than a product category has structural permission to enter any category where the incumbent is complacent and the values stance creates genuine contrast.",
    },
  ],
  crisis_repositioning: [
    {
      case: "Tylenol post-1982 poisoning crisis",
      principle:
        "Total transparency combined with structural action (product redesign) converts a crisis into an equity deposit; the move requires the brand to do something irreversible that proves the values are real.",
    },
    {
      case: "Domino's 'Pizza Turnaround' 2010",
      principle:
        "Publicly admitting the product was wrong and documenting the fix in advertising converts the crisis into a credibility mechanism; the admission must be specific and the fix must be real and demonstrable.",
    },
  ],
  cultural_moment_capitalisation: [
    {
      case: "Nike and Colin Kaepernick 2018",
      principle:
        "A brand can claim a cultural moment only when its existing values stance makes the claim structurally credible; a brand without the standing will be exposed as opportunistic and the move will invert.",
    },
    {
      case: "Ben & Jerry's social positions",
      principle:
        "Consistent values-based cultural participation over time creates the standing to move quickly when a moment arrives; the standing cannot be manufactured at the moment of need.",
    },
  ],
};

export function formatCasesForPrompt(cases: CaseReference[]): string {
  return cases
    .map((c, i) => `  ${i + 1}. ${c.case}\n     Structural principle: ${c.principle}`)
    .join("\n\n");
}
