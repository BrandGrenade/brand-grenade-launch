# Jaguar — Brand Strategy and Creative Intelligence Summary: structural rebuild (outline for approval)

Jaguar only. A Jaguar-specific document spec and builder; no other session's documents change until this is approved as the template.

## Channel check (done, not guessed)

Stage 21 for Jaguar produced six real channel briefs:
Targeted Premium Film in Broadcast and Streaming · Independent Automotive Press and Critic Reviews · Social and Short-form on Design and Automotive Feeds · Peer Owner Communities and Word of Mouth · Partnership and Cultural Adjacency · Search and Configurator.
(A seventh row, "Campaign big idea (pre-channel)", is the pre-channel idea record, not a channel.)
No separate mainstream/broadcast channel was scoped for this session — the Targeted Premium Film in Broadcast and Streaming brief is the broadcast line and already covers it. The document will say so explicitly rather than leaving the gap ambiguous.

## Proposed section-by-section outline

Cover: brand, document title, SMP, date, confidential.

| # | Section | Contains (one line) |
|---|---------|---------------------|
| — | Table of Contents | Real titles, page one, in the exact order below. |
| 01 | Background | Why this project exists: 2024 repositioning fallout, Type 01 unseen and unreleased, Bentley-tier price ambition, the tension the engagement was set to resolve. Prose. |
| 02 | What We Know About the Brand | Established brand facts and inherited conditions. Bullets. |
| 03 | How This Was Built — Pipeline Activity | Grouped stat block: **Strategy** (stages, methodologies, propositions, scoring dimensions) · **Intelligence** (research passes, sources, validation checks) · **Creative** (lens sweep count × shortlisted candidates) · **Executional** (channel prompts, offline briefs, documents produced) · plus human checkpoints. Bullets/stats only. |
| 04 | Category Intelligence | What the category believes and how it behaves. Descriptor line + bullets. |
| 05 | The Category Insight | Headed and led explicitly as a *category-level* insight, then the insight and its validation. Prose. |
| 06 | Territory Synthesis | Descriptor line ("the strategic ground the insight opens"), then the territories considered and the one taken. |
| 07 | Proposition Generation | Total propositions generated across the funnel and LOC engines stated up front, then the shortlist carried forward. Bullets. |
| 08 | Distinctiveness Check | Descriptor line, then the ownability read against named competitors. |
| 09 | Proposition Scoring | Full scoring table plus Stage 10 rationale kept as full prose — not bulleted. |
| 10 | The Winning Proposition | The SMP arrives here, at the point it was actually reached. Declared explicitly with the case for why it won. Prose. |
| 11 | What Was Rejected, and Why | Every non-selected proposition with its one-line reason. Bullets. |
| 12 | Integrity Testing | Descriptor line, then the pressure tests and verdicts. |
| 13 | Brand Fit Validation | Stage 13 brand-fit reasoning and guardrails in full prose — not bulleted. |
| 14 | Territory Mapping | Descriptor line, then how the proposition maps across territory. |
| 15 | Coherence and Consistency Audit | Descriptor line, then the audit findings and verdict. |
| 16 | Creative Intelligence — The Sweep | The 37-lens sweep explained in one line, then the shortlisted creative candidates. Bullets. |
| 17 | The Winning Creative Idea | Locked campaign line plus the complete locked creative idea narrative, verbatim and untruncated. Full prose. |
| 18 | Why This Idea Won | The case for the locked idea against its shortlist rivals. Prose. |
| 19 | Channels This Strategy Activates Through | The six Stage 21 channels as bullets, each with one line of strategic role, plus the explicit note that broadcast is covered by the Targeted Premium Film brief. |
| 20 | Brand Architecture and Distinctive Assets | Descriptor line, then architecture and distinctive assets in play. |
| 21 | Next Step | What happens next. Short. |

No appendix — the workflow is the body, in sequence.

## Notes on treatment

- Plain-language descriptor line under every system-jargon heading (Territory Synthesis, Insight Generation, Coherence Audit, Distinctiveness Check, Integrity Testing).
- Compression is selective: bullets for stats, rejected propositions, channels, category beliefs; full prose preserved for Stage 10 rationale, Stage 13 reasoning and guardrails, and the locked creative narrative.
- SMP on the cover only, then not restated until section 10.

## Technical approach (for reference)

A new `jaguar_exec_summary` entry in `src/lib/document-spec.ts` with this ordered section list, and a dedicated builder that draws from the existing extractors in `exec-summary-sections.ts` / `minto-content.ts` plus the Room 04 stimulus tables for the creative sections. The existing exec-summary builder and all other sessions stay untouched. The completeness/integrity gate (`document-gate.ts`) is pointed at the new spec so the 21 sections are enforced the same way.

Confirm the outline and I'll build it.
