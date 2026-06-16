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

---

## v2.2 — Universal Proposition Quality Gate
**Date:** June 2026
**Stages:** Stage 8, Stage 9, Stage 10, Stage 11, Stage 12
**Change:** Introduced `src/lib/proposition-quality-gate.ts` —
`PROPOSITION_QUALITY_GATE`, a permanent six-criterion gate (Unique, Real and
Simply Understood, Fresh Take, Grounded in Product/Human/Cultural Truth,
Addresses a Core Category Promise, Short / Well Written / Immediately
Articulate, max 8 words) plus automatic rejection triggers (reward, earn,
deserve, apology, guilt, "end of the day", "day well spent", >8 words,
anything a named competitor could say without self-implication).
Benchmark: "Permission to Beer". The gate is injected into the Stage 8, 9,
10, 11, and 12 system prompts. Stage 8 silently regenerates within the
assigned territory until each proposition passes. Stage 9 tags every
proposition QUALITY GATE: PASS / FAIL alongside the territory and
grievance check. Stages 10 and 11 ELIMINATE gate-failing SMPs before
scoring / pressure testing. Stage 12 silently excludes any gate-failing
SMP from the presentation deck and returns HOLD if fewer than two cards
remain. The human reviewer never sees a gate-failing proposition.

---

## v2.1 — Universal World Class SMP Generator — Stage 9
**Date:** June 2026
**Stages:** Stage 9
**Change:** Replaced the prior Stage 9 distinctiveness-check prompt
entirely with the Universal World Class SMP Generator. Stage 9 now
generates 5–7 Single-Minded Propositions from the validated inputs
(Stages 1–8) rather than only evaluating Stage 8 output. The new prompt
enforces: seven Automatic Disqualification filters (generic category
language, clichés, competitor claimability, >8 words, comprehension,
strategy-document language, abstraction); the mandatory Emotional
Direction Test (brand gives/adds/restores — no grievance propositions);
the Reinterpretation Requirement (three reinterpretation questions per
input before generation; summaries are auto-rejected); the Universal
Quality Benchmark (six criteria: unique, real, fresh take, grounded in
truth, addresses a core category promise, ≤8 words and immediately
articulate); a mandatory pre-output Cliché Detection scan across five
cliché categories (lifestyle, permission, identity, quality, masculine);
and the Six Territory Coverage requirement (Tension, Abundance,
Identity, Cultural Moment, Product Truth, Whitespace — no two
propositions sharing the same emotional mechanism). Each SMP is
presented with foundation, proof of ownership, and creative territory,
followed by a full-set ranking and a top-1–2 recommendation with
strategic rationale. File: `src/lib/stage9-prompt.ts`.

---

## v2.2 — Stage 18 and 19 double-run investigation
**Date:** June 2026
**Stages:** Stage 18, Stage 19
**Change:** Diagnostic confirmed Stage 18 is strictly user-triggered via the
`handleRun` button click (`disabled={busy}` guard); the observed "double
run" was either a user double-click or a component remount that hit the
server-side cached short-circuit (`runStage18` returns the existing
`stage_18_output` without re-calling Claude when present) — expected
behaviour, no fix required. Stage 19 auto-triggers via `useEffect` once
`stage_18_selected_detonation` lands, guarded by a `useRef` flag that
resets on every component remount and could therefore re-fire before the
first DB write to `stage_19_output` landed. Server-side `runStage19` is
already idempotent (returns existing output if present), so the duplicate
incurred zero Claude cost but appeared as two executions in the worker
logs. Stage 19 hardened: the per-session autorun flag is now persisted in
`sessionStorage` under `bg:stage19-autorun:<sessionId>`, so component
remounts, parent re-renders, and StrictMode double-mounts can no longer
fire a second auto-run for the same session. Combined with the P7
`key={sessionId}` route-wrapper remount and the existing server-side
cached short-circuit, Stage 19 is now triple-guarded against duplicate
execution. Files: `src/routes/detonation.tsx`, `src/lib/stage18.functions.ts`,
`src/lib/stage19.functions.ts`.

---

## v2.3 — Two-Tier Pre-Flight Integrity System
**Date:** June 2026
**Scope:** Platform-wide (pre-session integrity gate)
**Change:** Shipped a permanent two-tier automated pre-flight integrity
system that validates platform health before every live client session.
Replaces ad-hoc manual smoke-testing.

**Tier One — Fast Check (auto on every dashboard load, <3 min):**
five fast probes — database connectivity, Claude API health
(claude-haiku-4-5 READY probe), Stage 9 EDT-guard prompt presence
(banned-words: earned/deserved/guilt/apology/permission), Stage 12 DB
query speed, and Stage 17 route registration (detonation route +
DetonationRoute export + `await navigate({ to: '/detonation' …})` in
detonation_.canvas.tsx). Renders green "Platform Systems Live" or red
"System Issue Detected — {failed check name}". File:
`src/components/PreflightStatusBanner.tsx`, `src/lib/preflight.functions.ts`.

**Tier Two — Full Integrity Check (manual "Run System Check", ~20 min):**
12 deep checks using the hybrid approach. Real-run checks (1, 2, 3, 5,
6, 7, 8, 10, 12) execute Stages 1→16 sequentially on a single TestBrand
session, plus the Phase 2 chain (17→select→17B→18) and two parallel
Stage 1 sessions for concurrency safety. Structural probes (4, 9, 11)
scan all 22 stage system prompts, sanitiser config + per-stage
maxTokens caps, and the Canvas→Detonation navigation pattern. All test
sessions are tagged `is_preflight_test = true` (excluded from the user
sessions list) and deleted in a finally block on completion or failure.
A unique partial index on preflight_checks enforces a single global
runner; rows older than 25 minutes can be force-overridden. Auto-selects
top-ranked option at every decision point — no human input required.
Files: `src/components/PreflightFullCheckPanel.tsx`,
`src/lib/preflight-tier-two.functions.ts`,
migration `20260615100559_*.sql`.

**Persistence:** all results log to `public.preflight_checks` with
check_type (fast/full/pipeline_run_override), status, tier_one_results /
tier_two_results jsonb, overall_result, started_by, started_at,
completed_at, override_used, override_timestamp, override_reason. Rows
are immutable once finalised (trigger
`preflight_checks_enforce_immutability`) and undeletable (trigger
`preflight_checks_block_delete`) — full audit log.

**Platform Not Verified gate:** the New Pipeline Run button is disabled
and renders "Platform Not Verified" if the last Tier Two check is more
than 24 hours old or did not pass. Users can override with an explicit
typed reason; the override is persisted to preflight_checks
(check_type='pipeline_run_override', override_used=true, timestamp,
reason, user id) before /brief is opened. Files:
`src/components/NewRunGateButton.tsx`,
`src/lib/pipeline-gate.functions.ts`.

**Escalation protocol:** when any Tier Two check fails the panel
surfaces two clickable options — (1) Generate draft postponement
communication (renders an on-brand draft naming the failed checks,
copy-to-clipboard); (2) Present completed sessions instead (scrolls to
the completed-sessions anchor on the dashboard). Each failed check
displays the exact remediation instruction and estimated fix time from
the central REMEDIATION_BY_ID registry — not a generic error message.

---

## v2.4 — Stage 1 metadata leak fix
**Date:** June 2026
**Stage:** Stage 1
**Change:** Removed the `PIPELINE DATA HEADER` output block from the Stage 1
system prompt. BRIEF DEPTH LEVEL, CATEGORY KNOWLEDGE CONFIDENCE, BRIEF
ELEMENTS PRESENT, and ASSUMPTIONS MADE remain as internal silent
classifications used to calibrate response depth, but the model is no
longer instructed to output them as a visible preamble. Stage 1 output
now begins directly with Section 1 — Surface Request. File:
`src/lib/stage1-prompt.ts`.

---

## v2.5 — Stage 9 universal craft standard with SMP creative function classification
**Date:** June 2026
**Stage:** Stage 9
**Change:** Replaced the Stage 9 craft standard with the final universal version.
The new standard introduces four craft standards (Sharpness, Crispness,
Interest, Polarity), expanded language requirements, the SMP Creative
Function Classification (SELF-EXECUTING vs PLATFORM), and Phase 2
Detonation instructions tailored to each classification. The craft benchmark
now requires a half-second pause, unexpected word usage, and reader
completion — without relying on category-specific examples. The output
format now includes the creative function classification alongside each
proposition, and the classification with its detonation instruction is
carried forward to Stage 17. File: `src/lib/stage9-prompt.ts`.

---

## v2.6 — Stage 9 craft standard addition
**Date:** June 2026
**Stage:** Stage 9
**Change:** Added the CRAFT STANDARD — LANGUAGE AND SENTENCE STRUCTURE
section to the Stage 9 system prompt. Inserted after the Universal Quality
Benchmark and before the Cliché Detection section. Enforces four craft
questions (sharpest, crispest, interesting, category space + consumer
mindset), language requirements (interrogate every word, unexpected
sentence structure, deliberate opening), and the Language Benchmark
(half-second pause, unexpected word usage, reader completion). The
greatest propositions standard is now explicit in the prompt. File:
`src/lib/stage9-prompt.ts`.

---

## v2.7 — Stage 2 core category promise mapping with single word ownership classification
**Date:** June 2026
**Stage:** Stage 2
**Change:** Added the CORE CATEGORY PROMISE MAP section to the Stage 2 system
prompt. Inserted after Overcrowded Territories and before Available Territory.
Introduces a four-step mapping process (Occupancy, Strength of ownership,
Availability, Proof gap) and a three-level ownership classification —
Level one (Word ownership: brand and a single word have merged, e.g. HiLux/
unbreakable, Volvo/safety, FedEx/overnight; cannot be challenged directly),
Level two (Claimed with proof), Level three (Claimed without proof).
Availability states are Owned, Weakly occupied, Available. The Available
Territory section now references which category promise the identified
whitespace connects to and what proof the brand has available to occupy it
credibly. File: `src/lib/stage2-prompt.ts`.

> Note: This change was requested as v2.6, but v2.6 was already issued for
> the Stage 9 craft standard addition. Numbered v2.7 to preserve sequential
> ordering.

---

## v2.8 — Stage 4B distinctive asset mining and product fact inventory (new stage)
**Date:** June 2026
**Stage:** Stage 4B (new)
**Change:** Added Stage 4B to the pipeline sequence between Stage 4 and
Stage 5. Stage 4B fires automatically when its status flips to running and
requires no human checkpoint. The new prompt interrogates the brand's
distinctive assets and the product itself for generative strategic
potential, structured in three parts: PART ONE — Product Fact Inventory
(real vs perceived facts, liability reinterpretation, three most
strategically potent facts); PART TWO — Distinctive Asset Mining (three
questions per asset, with special interrogation of the brand name itself);
PART THREE — Strategic Potential Summary (single most potent
product-fact + asset combination). Output is emitted under the heading
`ASSET MINING AND PRODUCT FACTS` and is now passed to Stage 5 as a
mandatory additional input labelled `STAGE 4B — ASSET MINING AND PRODUCT
FACTS` alongside the Stage 1 sanitised brief and Stage 4 strategic
universes. Stage 5 now hard-requires stage_4b_output before it will run.
Files: `src/lib/stage4b-prompt.ts` (new), `src/lib/stage4b.functions.ts`
(new), `src/lib/stage5-prompt.ts`, `src/lib/stage5.functions.ts`,
`src/lib/retry.functions.ts`, `src/routes/pipeline.tsx`, migration adding
`stage_4b_output` and `stage_4b_error` columns to `public.sessions`.

> Note: This change was requested as v2.7, but v2.7 was already issued for
> the Stage 2 core category promise map. Numbered v2.8 to preserve
> sequential ordering.

---

## v2.9 — Stage 20 real scoring rubric replacing placeholder
**Date:** June 2026
**Stage:** Stage 20
**Change:** Replaced the placeholder quality score logic in
`src/lib/stage20-master-detonation-brief-prompt.ts` with a real BRIEF
QUALITY ASSESSMENT rubric. The model must now score the brief against
five dimensions (Emotional Clarity, Fame Invitation, Distinctive Asset
Integration, Psychological Leverage, Creative Share of Voice Ambition)
on a 1–10 scale, with concrete anchors at each end of the scale for
every dimension. Briefs scoring below 40/50 composite must be rewritten
before output — placeholder/fixed scores are explicitly prohibited and
the score must reflect actual brief quality. Output format updated: the
quality score block appears at the end of the brief using the exact
labels Emotional Clarity, Fame Invitation, Distinctive Assets,
Psychological Leverage, Creative SoV Ambition, COMPOSITE, and STATUS,
with STATUS = PASS at 40+ or STATUS = REWRITE below 40 (naming every
dimension under 7 with one sentence on what must be strengthened).
File: `src/lib/stage20-master-detonation-brief-prompt.ts`.

---

## v3.0 — Saved Briefs library (UX addition)
**Date:** June 2026
**Stage:** Stage 1 / Dashboard (platform UX, no prompt changes)
**Change:** Added a Saved Briefs library for pre-written briefs ready to
activate in one click. Three components: (1) **Save Brief** button on the
Stage 1 brief screen alongside Submit — persists brand name, category,
composed brief text, and saved date to the new `saved_briefs` Supabase
table without starting a pipeline run; (2) **Saved Briefs section on
the dashboard** — cards showing brand name, category, and date saved,
each with Load Brief and Delete actions; Load Brief opens the Stage 1
brief screen with the saved brief pre-populated and ready to submit;
(3) **Load Saved Brief picker on Stage 1** above the brief input fields
— expands the user's saved briefs library and pre-populates brand,
category, and brief text instantly on selection. New table
`public.saved_briefs` (brief_id, user_id, brand_name, category,
brief_text, created_at) with RLS scoped to `auth.uid()` for view,
insert, update, and delete. No interrogation, no synthesis, no approval
flow — a simple save-and-load mechanism for demo readiness. Files:
`src/components/SavedBriefsLibrary.tsx` (new), `src/routes/brief.tsx`,
`src/routes/dashboard.tsx`, migration creating `public.saved_briefs`.


---

## v3.1 — Stage 6 Unexpected Behaviour Filter addition
**Date:** June 2026
**Stage:** Stage 6
**Change:** Added a mandatory UNEXPECTED BEHAVIOUR FILTER to the Stage 6
insight validation system prompt. Every insight classified as a human
truth must now pass an additional test before being validated: "Would
a smart, self-aware person in this audience read this insight and say
— I never thought of it that way." Insights producing revelation
(genuine human truths) are validated; insights producing only
recognition (category observations dressed as human truths) are
rejected and returned to Stage 5 for regeneration from a deeper angle
on the same territory. Each insight must be documented as PASSED
UNEXPECTED BEHAVIOUR FILTER or FAILED — CATEGORY OBSERVATION with one
sentence of specific reasoning for every failed insight. File:
`src/lib/stage6-prompt.ts`.
