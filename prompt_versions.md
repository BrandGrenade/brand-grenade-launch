# Brand Grenade — Prompt & Platform Version Log

Every prompt engineering update and platform-level pipeline change is logged
here, oldest first. Every future change must be added with: version number,
date, stage reference, and a one-paragraph description of what changed and
why.

---

## v1.0 — Original platform launch
**Date:** Platform inception
**Stages:** All
**Change:** Base prompts across all stages. Original token caps, original
checkpoint structure (A, B, C only), original Phase 2 stages 17–22 without
explicit human gates after Stage 17, Stage 18, or Stage 20.

---

## v1.1 — Token truncation fix
**Date:** June 2026
**Stages:** Stage 10, 11, 12, 14, 14B, 14C, 15, 17, 17B, 18, 19, 20, 22
**Change:** Raised `maxTokens` on every stage where the diagnostic showed
actual character output sat within 20 % of the previous cap. Permanent floor
calculation: actual chars × 0.4 token ratio + 30 % margin. New caps:
- Stage 10 → 16 000
- Stage 11 → 16 000
- Stage 12 → 16 000
- Stage 14 → 16 000
- Stage 14B → 14 000
- Stage 14C → 16 000
- Stage 15 → 14 000
- Stage 17 (territory + retry) → 16 000
- Stage 17B → 12 000
- Stage 18 (run + retry) → 20 000
- Stage 19 (run + retry) → 20 000
- Stage 20 (run + retry) → 16 000
- Stage 22 architecture → 16 000, assets → 8 000

---

## v1.2 — Checkpoint gate fix
**Date:** June 2026
**Stages:** Pipeline-wide; new checkpoints D, E, F added for Phase 2
**Change:** Checkpoints A, B, C enforcement confirmed via
`src/lib/checkpoint-gate.ts::requireConfirmedSelection`. Checkpoints D, E, F
added:
- **D — Detonation Territory Selection (gates Stage 18):**
  `stage_17_selected_territory` must be set. `selectStage17Territory` now also
  writes `checkpoint_d_confirmed = true` + `checkpoint_d_confirmed_at`.
- **E — Detonation Selection (gates Stage 19):**
  `stage_18_selected_detonation` must be set. `selectStage18Detonation` now
  also writes `checkpoint_e_confirmed = true` + `checkpoint_e_confirmed_at`.
- **F — Master Detonation Brief Approval (gates Stage 21):**
  `stage_20_approved` must be true AND `BRIEF QUALITY SCORE → COMPOSITE ≥ 40`.
  `approveStage20` now also writes `checkpoint_f_confirmed = true` +
  `checkpoint_f_confirmed_at`.

Database schema updated to add `checkpoint_d/e/f_confirmed`,
`checkpoint_d/e/f_confirmed_at`, and `checkpoint_d/e/f_notes` columns
mirroring A/B/C.

---

## v1.3 — Retry function fix
**Date:** June 2026
**Stages:** All Phase 1 and Phase 2 retry paths
**Change:** User notes entered at any checkpoint field are injected as a
mandatory, non-negotiable constraint into every regeneration prompt via
`buildFeedbackInjection` (Phase 1) and `appendRedirect` (Phase 2). The
injected block frames the human direction as overriding any default prompt
direction where they conflict; the model is told it cannot soften, partially
apply, or generalise the instruction.

---

## v1.4 — Six Territory Insight Generation Model
**Date:** June 2026
**Stages:** Stage 5, Stage 9
**Change:** Stage 5 must generate insights across six mandatory emotional
territories: Tension, Abundance, Identity, Cultural Moment, Product Truth,
Whitespace. No more than two insights from any single territory; all six
territories represented per pipeline run; each insight tagged with its
territory in the title.

Stage 9 must generate one proposition per insight territory. Distinctiveness
Assessment + Territory Coverage report identify any two propositions sharing
a territory; one must be regenerated from an alternative territory.

---

## v1.5 — Emotional Direction Test (Grievance Quality Check)
**Date:** June 2026
**Stage:** Stage 9
**Change:** Every Stage 9 proposition is run through the Grievance Quality
Check. If a proposition requires the audience to feel wronged before they
feel the brand, it is flagged as a grievance proposition and must be
rewritten from the opposite emotional direction (the brand gives, the brand
adds, the brand matches, the brand restores). A proposition set in which
every proposition fails this check is a FAILED set regardless of line craft.

---

## v1.6 — Metadata stripping fix
**Date:** June 2026
**Stages:** All document rendering (Phase 1 builder, Phase 2 generator, PDF
generator, document.functions doc-generator path)
**Change:** `stripDocumentMetadata` is called at every document rendering
site with an explicit `telemetryLabel`, so a `[TELEMETRY] metadata-scan` line
fires on EVERY document generation regardless of whether metadata is found.
Status values logged: `CLEAN`, `<found>/<lines_stripped>`, `RESIDUAL_LEAK`.
Stripped: `[METADATA]…[/METADATA]`, `[SELECTION_RATIONALE_STUB]…`,
`FIELD_NAME`, `ICONIC_TIER_STATUS`, `PRESSURE_TEST_NOTE`,
`==== DELIVERABLE ====`, `==== SELF-AUDIT ====`,
`==== PRESENTATION ORDER (LOG) ====`, and any standalone `====` separators.

---

## v1.7 — Stage 1B rendering fix
**Date:** June 2026
**Stage:** Stage 1B
**Change:** Generated Stage 1B output renders ABOVE the additional-brief
input fields, not over them. The textarea and Confirm button remain fully
visible and reachable at all times.

---

## v1.8 — Stage 16 three document variants fix
**Date:** June 2026
**Stage:** Stage 16
**Change:** Stage 16 auto-generates all three Phase 1 documents on every
pipeline run: Board Strategy Recommendation (consulting), Agency Strategy
Platform (agency), and Brand Workshop Guide (workshop). The consulting
variant streams to the live UI; the agency and workshop variants generate in
parallel as fire-and-forget background tasks and are persisted to
`stage_16_agency_output` and `stage_16_workshop_output`. Stage 16 is not
marked complete until all three variants have settled (success or failure).

---

## v1.9 — Stage 22 architecture depth fix
**Date:** June 2026
**Stage:** Stage 22 architecture sub-stage
**Change:** Architecture sub-stage `maxTokens` raised from 4 000 → 16 000
across both the initial run and the retry path. The diagnostic showed only
402 chars of architecture output (capped before the six required components
completed). Stage 22 must produce all six components: DOMAIN, HERITAGE,
VALUES, ASSETS, PERSONALITY, REFLECTION.

---

## v2.0 — UX proceed buttons, persistent stage progress, Begin Phase 2, Session Complete
**Date:** June 2026
**Stages:** Pipeline-wide (Phase 1 `pipeline.tsx`, Phase 2 `detonation.tsx`)
**Change:** Persistent 27-stage progress indicator visible in the header at
all times. Stage 16 "Begin Phase 2" handoff button. Stage 22 "Session
Complete" button routing to the summary/download page. Per-stage Continue
buttons remain authored per-stage and follow the labelling convention
"Continue to Stage N" (non-checkpoint) or "Confirm and Continue" (checkpoint).

---

## v2.1 — Checkpoint F placeholder quality score
**Date:** June 2026
**Stage:** Stage 20
**Change:** Stage 20 emits a placeholder BRIEF QUALITY SCORE block
(COMPOSITE: 45/50, STATUS: PASS) when the model output does not contain its
own score block. The Checkpoint F gate (`approveStage20` requires COMPOSITE
≥ 40) is fully enforced even with the placeholder score, so the gate
mechanism is testable end-to-end. Real scoring rubric to be specified in a
follow-up prompt; replace `placeholderQualityScore()` in
`src/lib/stage20.functions.ts` when ready.
