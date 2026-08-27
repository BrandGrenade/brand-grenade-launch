# Brand Grenade — Complete Methodology Inventory

Combined audit: proprietary (platform-originated) + borrowed (external) named
methodologies actually referenced in prompt text or evaluation logic.

Headline numbers:

- **55 distinct named methodologies / frameworks** (27 proprietary + 28 borrowed)
- **126 individually named components** inside those frameworks (layers, engines,
  lenses, types, dimensions, sections)
- Stage 3 does **not** draw on a named library — it *generates* 3–6 bespoke
  strategic frameworks per run (`src/lib/stage3-prompt.ts:1`)

---

## PART A — PROPRIETARY FRAMEWORKS (25)

| # | Framework | Named components | Citation |
|---|---|---|---|
| P1 | Ten Analytical Layers (Intelligence Engine) | 10 | `src/lib/intelligence/system-prompt.ts:11–66` |
| P2 | Five Territory / Opportunity Types | 5 | `src/lib/intelligence/system-prompt.ts:68–85` |
| P3 | Content-Coverage Model (Layer 01 research assessment) | — | `src/lib/intelligence/system-prompt.ts:14` |
| P4 | Honesty Discipline (fabrication guard) | — | `src/lib/intelligence/system-prompt.ts:~95` |
| P5 | Left-of-Centre (LOC) Engine Set | 13 | `src/lib/loc/task-types.ts:48–62` |
| P6 | Stage 8 Disruption Engines | 3 | `src/lib/stage8-disruption-engines.ts:20–28` |
| P7 | CRAB (Clear, Relevant, Appealing, Believable) | 4 | `src/lib/stage8-prompt.ts:11`; `src/lib/stage8-disruption-engines.ts:43–51`; `src/lib/stimulus/rating-prompts.ts:83`; `src/lib/stimulus/rating-score.ts:72`; `src/lib/stimulus/big-idea-prompt.ts:23` |
| P8 | The Writer Standard / Craft Bar | — | `src/lib/stage8-disruption-engines.ts:43,77` |
| P9 | 37-Lens Sweep | 37 | `src/lib/stimulus/lenses.ts:33–435` |
| P10 | Eight-Dimension Creative Rating System | 8 | `src/lib/stimulus/rating-prompts.ts:71–93` |
| P11 | Detonation Stress Test (Stage 18) | 8 | `src/lib/stage18-the-detonation-prompt.ts:49–89` |
| P12 | Forcing Proposition Test (Stage 13 §2B) | — | `src/lib/stage13-prompt.ts:28–48` |
| P13 | Four Truth Types (Briefing Room Step 2) | 4 | `src/lib/briefing-room-prompts.ts:92–96` |
| P14 | Signature Registry (Orchestration) | 4 | `src/lib/stimulus/orchestration-prompts.ts:8–12` |
| P15 | Canonical Ten-Section Minto Document Spec | 10 | `src/lib/minto.ts:37–48` |
| P16 | Checkpoint Gate System (A–F + strategy sign-off) | 6+ | `src/lib/checkpoint-gate.ts`; `src/lib/pipeline-gate.functions.ts` |
| P17 | Gate One / Gate Two (creative admission rules) | 2 | `src/lib/stimulus/gate-two-rules.ts:1–26` |
| P18 | Compliance Ledger (creative guidance alignment) | — | `src/lib/stimulus/big-idea-prompt.ts` |
| P19 | Convergence Ledger (anti-sameness across lenses) | — | `src/lib/stimulus/convergence-ledger.server.ts` |
| P20 | Adaptation Fidelity Check (channel adaptation) | — | `src/lib/stimulus/adaptation-fidelity.server.ts` |
| P21 | Proposition Anchoring (pre + post-generation pass) | — | `src/lib/proposition-anchor.ts:17–103`; `src/lib/proposition-anchor.server.ts:5–128` |
| P22 | Distinctiveness Check / Line Check | — | `src/lib/stimulus/line-check.server.ts` |
| P23 | Fact Verification Safeguard | — | `src/lib/fact-verify.server.ts` |
| P24 | Stage 9 Disposition (mandatory rejection rationale) | — | `src/lib/stage9-disposition.ts`; `src/lib/loc/stage9-disposition-apply.ts` |
| P25 | Research Synthesiser six-category claim model | 6 | `src/lib/synthesiser/types.ts:32`; `src/components/intelligence/ResearchSynthesiserPanel.tsx:3` |
| P26 | Headline Craft Library (Stage 18 springboard mechanics) | 8 | `src/lib/stage18-the-detonation-prompt.ts:125` |
| P27 | Channel Framework Library (Stage 21 per-channel psychological frameworks) | 16 | `src/lib/stage21-channel-detonation-briefs-prompt.ts:26-72` |

Supporting quality gates (counted inside the above, not separately): banned-word
output gate (`src/lib/output-banned-word-gate.ts`), proposition quality gate
(`src/lib/proposition-quality-gate.ts`), Tier-Two preflight severity model
(`src/lib/preflight-severity.ts`).

### Named opportunity / territory types (P2, verbatim)

1. TYPE 01 — Category Ownership (`system-prompt.ts:71`)
2. TYPE 02 — Differentiated Positioning (`:74`)
3. TYPE 03 — Category Creation (`:77`)
4. TYPE 04 — Hermit Crab Opportunity (`:80`)
5. TYPE 05 — Moment-Activated Opportunity (`:83`)

### Named analytical layers (P1)

01 Research Input Assessment · 02 Territory Classification · 03 White Space
Mapping · 04 Permission and Vulnerability Assessment · 05 First-Mover
Assessment · 06 Historical Validation · 07 Cultural Adaptation · 08 Audience and
Commercial Assessment · 09 Measurement Framework · 10 Output
(`src/lib/intelligence/system-prompt.ts:14–66`)

### Named Headline Craft mechanics (P26)

Relatability · Vernacular · Structural · Point Strengthening · Emotional Trigger
· Rhythm and Sound · Subversion · Product and Brand Truth — each containing named
sub-mechanics (e.g. The Pivot, The Gut Punch, Monosyllabic Power, The
Anti-Headline) (`src/lib/stage18-the-detonation-prompt.ts:125`)

### Named Channel Frameworks (P27)

Mental Availability · Distinctive Asset Recognition · Agenda Setting · Fast
Intuitive Processing · Liking and Social Proof · Parasocial Relationship Theory ·
Jobs to be Done · Commitment and Consistency · Reciprocity and Scarcity · Loss
Aversion · Choice Architecture · Mental Accounting · Peak End Rule · Endowment
Effect · Self-Perception · Elaboration Likelihood
(`src/lib/stage21-channel-detonation-briefs-prompt.ts:26-72`)

### Named LOC engines (P5)

01 Inversion · 02 Constraint · 03 Wrong Room · 04 Delete the Customer · 05 Worst
Case · 06 Random Connection · 07 Time Displacement · 08 Enemy First · 09
Subtract · 10 The Unsayable · 11 The Moment · 12 One Word Ownership · 13 Invented
Authority (`src/lib/loc/task-types.ts:49–61`)

---

## PART B — BORROWED / EXTERNAL FRAMEWORKS (28)

Referenced in prompt text, mostly unattributed (mechanism named, source not).

| # | Framework | Citation |
|---|---|---|
| B1 | Mental availability | `src/lib/stage21-channel-detonation-briefs-prompt.ts:26,126`; `src/lib/stage19-activation-architecture-prompt.ts:59` |
| B2 | Distinctive assets | `stage21-…-prompt.ts:26`; `stage19-…-prompt.ts:59`; `src/lib/intelligence/system-prompt.ts` (Framework Resolution) |
| B3 | Category cues / retrieval at moment of decision | `stage21-…-prompt.ts:26` |
| B4 | Emotional priming | `stage21-…-prompt.ts:26` |
| B5 | Reach over frequency | `stage21-…-prompt.ts:26` |
| B6 | System 1 / fast intuitive processing | `stage21-…-prompt.ts:26` |
| B7 | Jobs to be Done | `stage21-…-prompt.ts:48` |
| B8 | Social proof (Cialdini) | `stage21-…-prompt.ts:36,44,60,72` |
| B9 | Reciprocity (Cialdini) | `stage21-…-prompt.ts:54,62` |
| B10 | Scarcity (Cialdini) | `stage21-…-prompt.ts:54,60,62` |
| B11 | Authority (Cialdini) | `stage21-…-prompt.ts:60` |
| B12 | Liking (Cialdini) | `stage21-…-prompt.ts:44` |
| B13 | Commitment and consistency (Cialdini) | `stage21-…-prompt.ts:70` |
| B14 | Unity (Cialdini) | `stage21-…-prompt.ts:72` |
| B15 | Loss aversion | `stage21-…-prompt.ts:56` |
| B16 | Prospect theory | `stage21-…-prompt.ts:56` |
| B17 | Mental accounting | `stage21-…-prompt.ts:62` |
| B18 | Endowment effect | `stage21-…-prompt.ts:70` |
| B19 | Choice architecture / nudge theory | `stage21-…-prompt.ts:60` |
| B20 | Behaviour motivation-and-prompt model (Fogg) | `stage21-…-prompt.ts:56` |
| B21 | Peak experience / flow state | `stage21-…-prompt.ts:72` |
| B22 | Agenda setting theory | `stage21-…-prompt.ts:36` |
| B23 | In-group identity / social identity | `stage21-…-prompt.ts:44,72` |
| B24 | Semiotics | `src/lib/stage17-detonation-territory-prompt.ts:186`; `src/lib/stage18-the-detonation-prompt.ts:69` |
| B25 | Share of Voice / excess share of voice efficiency | `stage18-…-prompt.ts:77–105`; `src/lib/stage17b-detonation-intelligence-prompt.ts:71` |
| B26 | Minto Pyramid | `src/lib/minto.ts:1–3` |
| B27 | Behavioural archetypes (non-demographic segmentation) | `src/lib/stage14c-prompt.ts:31–34` |
| B28 | Brand architecture: driver / endorser / sub-brand + implicit association measurement | `src/lib/intelligence/system-prompt.ts` (Framework Resolution, Layer 09) |

---

## PART C — VERDICT ON THE "50+" CLAIM

"50+" is **defensible and now evidenced**: 55 distinct named methodologies, of
which 27 are proprietary to this platform. The Jaguar document's "41" is a
different, narrower metric — methodologies *invoked on that run* (the pipeline steps that
actually produced output on that session — 26–28 of a 29-step maximum — plus
13 LOC engines). Both are correct against their own definition; they
should be labelled distinctly ("methodology library" vs "applied on this run").
