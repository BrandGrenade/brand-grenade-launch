// Fixed boundary disclaimer for the Valuation Input Brief. Inserted verbatim
// by this assembler and NEVER passed through callClaude, so it cannot be
// paraphrased, softened or dropped by the model.
export const VALUATION_DISCLAIMER = `## IMPORTANT — SCOPE AND BOUNDARY OF THIS DOCUMENT

This document is a qualitative strategic input, not a valuation. It contains no monetary value, royalty rate, discount rate or other financial estimate, and none should be inferred from it.

No ISO 10668, USPAP or other certified valuation methodology has been applied in producing this document. Brand Grenade is not a valuation firm and does not provide valuation, audit, accounting, tax or legal advice.

The certified figure, the choice and application of valuation method, the modelling, and the professional sign-off remain entirely the responsibility of the receiving valuation firm.

Every finding below is a restatement of analysis already generated and human-checkpointed within the Brand Grenade strategy pipeline, with its source stage cited.

---
`;

// Front matter for a reader outside the platform. Code-inserted, never
// model-generated, so the scale explanation and the weights are identical in
// every brief and cannot drift.
export const VALUATION_READER_GUIDE = `## HOW TO READ THIS DOCUMENT

This brief assesses one locked brand proposition against six dimensions. In plain terms:

- **Fame** — how likely the line is to be noticed, repeated and remembered, and whether the brand travels with it.
- **Truth Strength** — how far the claim is grounded in something the brand demonstrably is or does, rather than something it asserts.
- **Competitive Impossibility** — how hard it would be for a named rival to make the same claim credibly.
- **Brand Permission** — whether the brand's own history and documented behaviour entitle it to the claim.
- **Clean Air** — how much of the territory is unoccupied by competitors today.
- **Commercial Precedent** — whether comparable positions have been shown to work commercially.

Each dimension is scored out of 10. The overall figure is a weighted composite out of 90, calculated with these fixed weights:

- Fame — 30%
- Truth Strength — 20%
- Competitive Impossibility — 15%
- Brand Permission — 10%
- Clean Air — 10%
- Commercial Precedent — 5%

A perfect card therefore scores 90, not 100. Any composite a source labels "/100" is legacy labelling of the same 90-point figure.

**Hard floor** means an eliminating threshold rather than a scoring penalty: a proposition scoring below 5 on Truth Strength, or below 6 on Competitive Impossibility, is eliminated outright no matter how strong its other dimensions are. A score described as sitting "at the hard floor" is therefore at the minimum the framework will accept, not merely a low score.

These scores are internal relative rankings produced within Brand Grenade's own assessment framework. They are comparative judgements about propositions inside this analysis. They are not externally validated metrics, not market research, not survey data and not benchmarked against any third-party index, and they should not be treated as measured quantities.

---
`;

// Code-inserted provenance note for Section One. The locked proposition is a
// human-evolved line finalised after the Stage 9–11 funnel closed and scored
// independently afterwards; without this statement a reader compares its
// composite against the funnel survivors' composites and reads the locked line
// as an unjustified choice of a weaker option. Inserted only when the Stage 10
// output actually carries the independent re-score block.
export const VALUATION_PROPOSITION_PROVENANCE = `**A note on the locked proposition before the scores below.** The locked proposition is a human-evolved line, developed after the Stage 9–11 assessment funnel had closed. It was not one of the candidates competing in that funnel, and it is not one of the scored survivors listed in the evidence appendix. It was written afterwards and then scored independently, on its own wording, against the same six dimensions and the same hard floors.

Its composite therefore sits on a different footing to the funnel survivors' composites. The two sets of figures were produced in separate passes, on separate candidate pools, and reading the locked line's composite as though it lost a contest against higher-scoring survivors is not the correct reading — those lines and this one were never scored in competition with one another. The scores below describe the locked proposition on its own terms.

`;

export const DOCUMENT_FOOTER = `\n---\n\n*Brand Grenade Strategy Intelligence System*\n*Confidential*\n`;

