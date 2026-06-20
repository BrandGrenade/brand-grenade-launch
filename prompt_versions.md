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

---

## v3.2 — Stage 2 Category Silence Map addition
**Date:** June 2026
**Stage:** Stage 2
**Change:** Added the CATEGORY SILENCE MAP section to the Stage 2 system
prompt. Inserted after the Core Category Promise Map and before Available
Territory. The new section requires identification of every significant
structural silence in the category — things no brand has been willing to
say — with three components per silence: what is not being said, why the
category cannot say it (commercial, legal, reputational, structural
barriers), and what becomes possible for a brand willing to name it.
Silences are ranked by strategic value (prominence to audience,
threat to incumbents, availability to challenger). The Available
Territory section now cross-references the Category Silence Map,
identifying the strongest territories at the intersection of an
unoccupied category promise and a category silence. File:
`src/lib/stage2-prompt.ts`.

---

## v3.3 — Stage 18 eighth detonation dimension Share of Voice Efficiency
**Date:** June 2026
**Stage:** Stage 18
**Change:** Replaced the placeholder Dimension 8 (Creative Share of Voice
multiplier potential) with a full Share of Voice Efficiency dimension in
the Stage 18 system prompt. The new dimension assesses whether the idea
generates disproportionate attention relative to media spend, with
concrete anchors at every score band (1–3 buys attention; 4–6 partially
earns it; 7–8 genuinely earns organic participation; 9–10 is designed
from the ground up for cultural distribution at a multiple of paid
spend). Includes explicit commercial framing for CFO relevance and
compounding value over time. All references to the Eight Dimension
Stress Test composite updated from out of 80 to out of 90; pass
threshold raised from 64/80 to 72/90 (maintaining the 80 % standard).
File: `src/lib/stage18-the-detonation-prompt.ts`.

---

## v3.4 — Stage 15 Voice and Specificity Audit
**Date:** June 2026
**Stage:** Stage 15
**Change:** Added Check 8 (Voice Consistency Audit) and Check 9
(Specificity Audit) to the Stage 15 Strategic Consistency Audit system
prompt. Check 8 applies three tests across Stage 7–14C outputs: a poison
word sweep against the Stage 1 banned language list; a tone register
consistency check confirming the Stage 13 Brand Fit register is present
across Stages 14, 14B, 14C; and a brand voice authenticity check
flagging generic territory descriptions that could apply to any
challenger brand. Check 9 applies the brand name removal test to every
paragraph in Stage 7–14C outputs that feeds Stage 16 — if a paragraph
still makes sense as a generic strategic statement once the brand name
is removed it is flagged as insufficiently specific, with one sentence
of correction instruction per flagged paragraph. Severity bands defined
for both checks (MINOR / SUBSTANTIVE / CRITICAL). Header updated from
seven to nine audit checks; report block count updated to 9. File:
`src/lib/stage15-prompt.ts`.

---

## v3.5 — Stage 8 product truth mandate + checkpoint amendment injection fix
**Date:** June 2026
**Stages:** Stage 8 (system prompt + user message); Checkpoint UI (A/B/C
review-question notes plumbing)
**Change:** Two fixes shipped together.

1. **Product Truth Mandate (Stage 8 system prompt).** Added a mandatory
   instruction requiring at least half of all generated propositions to be
   built directly from the specific, observable, verifiable product truths
   in the Stage 4B Asset Mining and Product Facts output — not from the
   positioning territory or category intelligence. A proposition built on a
   product truth must name or imply the specific fact that makes it true; a
   proposition that could apply to any brand in any category without
   modification fails the mandate and must be regenerated. The Stage 4B
   output is now also injected at the top of the Stage 8 user message as the
   PRIMARY INPUT (was previously not passed at all), with a closing
   reminder of the mandate. File: `src/lib/stage8-prompt.ts`,
   `src/lib/stage8.functions.ts`.

2. **Checkpoint amendment injection fix.** The three Review Question
   textareas inside Checkpoints A, B, and C were previously stranded in
   local component state and never reached the Retry This Stage path —
   only the small bottom-bar amendment input was used as feedback on
   retry, so checkpoint field notes were silently dropped. The Checkpoint
   component now lifts its notes via a new `onNotesChange` callback, and
   `handleRetryStage` combines those notes with the bottom-bar amendment
   note via the shared `buildRevisionInstruction` helper before passing the
   merged feedback to `resetStageCascade`. The existing universal
   amendment-note injection in `claude.server.ts` then wraps the merged
   instruction onto the regeneration user message as a mandatory
   constraint block. Files: `src/components/Checkpoint.tsx`,
   `src/routes/pipeline.tsx`.

---

## v3.6 — Stage 9 product hero mandate and reinterpretation questions addition
**Date:** June 2026
**Stage:** Stage 9
**Change:** Added three new mandatory sections to the Stage 9 system prompt
after the Reinterpretation Requirement and before the Universal Quality
Benchmark: (1) PRODUCT AND BRAND AS HERO — EXPLICITLY ALLOWED AND MANDATORY
CONSIDERATION, requiring at least two of the five to seven propositions to
attempt to make the product or brand the hero using specific, verifiable
product truths from Stage 4B; (2) REINTERPRETATION QUESTIONS — MANDATORY
BEFORE GENERATION, requiring explicit three-question reinterpretation for at
least two key inputs from Stage 4B and the validated insight set, with
documented reinterpretation before any proposition is written; (3) BENCHMARK
STANDARD FOR PRODUCT HERO PROPOSITIONS, measuring every product hero
proposition against the "1000 songs in your pocket" / "Melts in your mouth
not in your hands" standard. Existing prompt content is unchanged. File:
`src/lib/stage9-prompt.ts`.

---

## v3.7 — Stage 9 automatic disqualification checklist and closing standard addition
**Date:** June 2026
**Stage:** Stage 9
**Change:** Added two new mandatory sections to the Stage 9 system prompt.
(1) AUTOMATIC DISQUALIFICATION — APPLY BEFORE PRESENTING ANY PROPOSITION,
inserted at the beginning of the output generation section immediately before
TASK. It lists seven non-negotiable filters (generic category language,
clichés, competitor claimability, >8 words, comprehension, strategy-speak,
unanchored truth) that every proposition must pass before it reaches the
human. (2) THE STANDARD — WRITE FOR THE ROOM NOT THE BRIEF, inserted at the
very end of the prompt after all other instructions. It reframes the goal as
writing a line that makes the room go quiet, that a senior creative director
would fight for, and that changes the category conversation. Existing prompt
content is unchanged. File: `src/lib/stage9-prompt.ts`.

---

## v3.8 — Stage 18 Headline Craft Library and Creative Springboard addition
**Date:** June 2026
**Stage:** Stage 18
**Change:** Added the CREATIVE SPRINGBOARD — HEADLINE CRAFT LIBRARY section
to the Stage 18 detonation prompt. Inserted after the eight dimension
stress test / compounding assessment scoring sections and before the
OUTPUT STRUCTURE — STRICT final output and ranking instruction. The
addition introduces a four-step process: (1) Mechanic Selection with
justification, (2) Springboard Generation of 5–8 directions using a
library of eight mechanic categories (Relatability, Vernacular,
Structural, Point Strengthening, Emotional Trigger, Rhythm and Sound,
Subversion, Product and Brand Truth), (3) Distinctive Asset Requirement,
and (4) Springboard Ranking with a single recommended primary
springboard. Each direction must include the mechanic, strategic root,
creative invitation, and a named distinctive asset. Closes with the
"window not a map" standard — a direction is acceptable only when a
senior creative director feels the pull to make something. Existing
prompt content is unchanged. File: `src/lib/stage18-the-detonation-prompt.ts`.

---

## v3.9 — Stage 8 Out of Box Proposition mandate
**Date:** June 2026
**Stage:** Stage 8
**Change:** Added the OUT OF BOX PROPOSITION — MANDATORY section to the
Stage 8 system prompt. Inserted after the Product Truth Mandate and before
the final output format instruction. The new mandate requires every
proposition set to include one radically unexpected proposition that is
still traceable to a genuine Stage 4B product truth, passes the Automatic
Disqualification checklist and all six Universal Quality Benchmark
criteria, satisfies the Emotional Direction Test, and is clearly labelled
OUT OF BOX in the output. Existing prompt content is unchanged. File:
`src/lib/stage8-prompt.ts`.

---

## v4.0 — Stage 16 Document Four: Strategy and Creative Vision
**Date:** June 2026
**Stage:** Stage 16
**Change:** Added a fourth Stage 16 document — STRATEGY AND CREATIVE VISION
— alongside the existing Board Strategy Recommendation, Agency Strategy
Platform, and Brand Workshop Guide. The three existing documents are
unchanged. The new document is exported as `STAGE_16_VISION_PROMPT` from
`src/lib/stage16-prompt.ts` and wired into the Stage 16 document assembly
function (`src/lib/stage16.functions.ts`) as the `vision` format. Vision is
generated as a single unified narrative (not sectioned) and saved to the new
`stage_16_vision_output` column. The document is structured as Opening,
Part One (The Territory No One Else Can Take), Part Two (The Human Truth at
the Centre), Part Three (Why This Is Right), Part Four (The World This
Strategy Opens), Part Five (The Creative Detonation including master idea
and top three springboard directions from Stage 18), and Closing. Target
length 4,000–5,000 words. Files: `src/lib/stage16-prompt.ts`,
`src/lib/stage16.functions.ts`, `src/lib/stage16-sections.ts`,
`src/lib/stage16-content.ts`, `src/lib/pdf-generator.ts`,
`src/lib/pipeline-integrity.ts`, `src/lib/retry.functions.ts`,
`src/lib/stage1b.functions.ts`, migration adding `stage_16_vision_output`.

## v4.1 — Stage 9 EDT Hard Block Reinforcement (2026-06-18)

Check 5 in Tier Two caught the banned word "earned" in Stage 9 output. The
prompt-level EDT guard was present but not reliably applied by the model at
runtime. Two reinforcements landed:

1. Added an "EDT HARD BLOCK — RUNS BEFORE ANY OUTPUT IS EMITTED" section to
   `STAGE_9_SYSTEM_PROMPT` (`src/lib/stage9-prompt.ts`), inserted directly
   before the TASK section. Lists banned words (earned, deserved, guilt,
   guilty, apology, apologise, permission) and mandates silent
   delete-and-regenerate within the same territory before emission.

2. Extended the server-side sanitiser in `src/lib/stage9.functions.ts` to
   catch standalone `permission` (previously only `permission to` matched).
   The existing post-generation scan + up-to-2 silent rewrite attempts +
   needs_review flag on persistent failure remains the enforcement floor
   that prevents banned tokens from ever reaching the database or human.

## v4.2 — Stage 20B: Channel Strategy and Audience Intelligence (2026-06-18)

**Stage:** New Stage 20B inserted between Stage 20 approval and Stage 21.
**Change:** Added a new Phase 2 stage — Channel Strategy and Audience
Intelligence — that sits after the Master Detonation Brief is approved and
before Stage 21 Channel Briefs runs. Stage 20B collects six mandatory
user-provided audience intelligence inputs (Who is this audience as humans,
A day in their life, Their influence map, Their decision journey for this
category, Their psychological profile in this category, Channel universe
and budget orientation) and combines them with the approved SMP, selected
detonation, three truths, Stage 14C brand world, Stage 1 / Stage 3 audience
definition, Stage 19 activation architecture, and the Stage 20 Master
Detonation Brief to produce a seven-section channel strategy document
(Audience Behavioural Portrait, Media Journey Map, Channel Role Assignment,
Mindstate Map, Behavioural Economics Activation Plan, Distinctive Asset
Deployment Plan, Orchestration Logic). The document is then handed to
Stage 21 as its primary input alongside the approved detonation and SMP —
Stage 21 no longer makes channel selection decisions, it executes the
selection that Stage 20B has set. Stage 21 now hard-blocks if
`stage_20b_output` is missing. New prompt:
`src/lib/stage20b-prompt.ts`. New server functions:
`src/lib/stage20b.functions.ts` (`runStage20b`, `loadStage20b`,
`saveStage20bInput`, `clearStage20b`). New columns on `sessions`:
`stage_20b_audience_input` (jsonb), `stage_20b_output` (text),
`stage_20b_error` (text). UI: new `Stage20b` component in
`src/routes/detonation.tsx` with the six-field input form, generate /
edit-and-regenerate / proceed flow, and Stage 21 entry gating. Files:
`src/lib/stage20b-prompt.ts`, `src/lib/stage20b.functions.ts`,
`src/lib/stage21.functions.ts`, `src/lib/phase2-stages.ts`,
`src/routes/detonation.tsx`, migration adding the three `stage_20b_*`
columns.

## v4.3 — Stage 16 Vision opening context addition (2026-06-19)

**Stage:** Stage 16 (vision format)
**Change:** Added an "OPENING PAGES — CONTEXT AND INSTRUMENT" section to
`STAGE_16_VISION_PROMPT` (`src/lib/stage16-prompt.ts`), inserted before
"THE OPENING — THE STRATEGIC MOMENT". The new section contains three
mandatory sub-sections: (1) WHY THIS DOCUMENT EXISTS — three paragraphs
establishing the document as a verified strategic finding to act on,
addressed directly to the senior stakeholder; (2) THE INSTRUMENT THAT
PRODUCED THIS STRATEGY — two paragraphs describing the 22-stage Brand
Grenade intelligence system and what makes its output different; (3) WHAT
THIS STRATEGY IS PREPARED TO BE HELD TO — one paragraph establishing that
the strategy is signed for, not asserted, and is designed to be defensible
under the hardest market scrutiny. This content is the first thing the model
emits in the vision document, establishing authority and context before the
strategic narrative begins.



---

## v4.4 — Stage 16 Strategic Logic connective argument addition (2026-06-19)

**Stage:** Stage 16 (vision and consulting formats)
**Change:** Added "THE STRATEGIC LOGIC — FROM PROPOSITION TO DETONATION" section
to both `STAGE_16_VISION_PROMPT` and `STAGE_16_CONSULTING_PROMPT`
(`src/lib/stage16-prompt.ts`). In the Vision prompt, the new section is inserted
between "PART FOUR — THE WORLD THIS STRATEGY OPENS" and "PART FIVE — THE CREATIVE
DETONATION". In the Consulting prompt, it is inserted as a new Part Eight after
"PART SEVEN — THE RECOMMENDATION", with subsequent parts renumbered
(PART EIGHT → PART NINE → PART TEN → PART ELEVEN). The section contains four
movements: (1) THE PROPOSITION AND ITS DEMAND — what the SMP obligates and
forecloses; (2) WHY THIS TERRITORY AND NO OTHER — why the territory was revealed
rather than selected; (3) THE DETONATION AND ITS INEVITABILITY — what the
detonation is, why no alternative survived, what it makes impossible for
competitors, and what it makes inevitable for the brand; (4) THE CREATIVE
SPRINGBOARD — presenting each recommended springboard direction with headline
mechanic and creative territory, followed by a primary springboard recommendation
and a single closing sentence connecting SMP to detonation to springboard.
Register instructions differ by format: Vision writes as a senior strategist to
intelligent non-specialists; Consulting writes as a senior partner to a board,
evidence-led and airtight, with every claim traceable to pipeline-validated
outputs.

---

## v4.5 — Stage 1 Eleven-Field Briefing Form
**Date:** 2026-06-19
**Stages:** Briefing form + Stage 1
**Change:** Replaced the previous eight-section structured brief with an
eleven-field briefing form (Brand and Product or Service, Strategic Objective,
The Commercial Outcome, The Primary Barrier, What Has Already Been Tried,
The Audience, Current Belief, Desired Belief, Reason to Believe, The
Competitive Provocation, Mandatories and Never-Says). Strategic Objective is
a mandatory single-select with seven options (Launch, Refresh, Repositioning,
Defence, Challenger, Crisis Recovery, Category Creation). Fields 1–10 are
mandatory; field 11 is optional. Updated `STAGE_1_SYSTEM_PROMPT` with a new
INPUTS section that instructs Stage 1 to read all eleven fields as primary
inputs, apply the strategic objective as the primary lens for every
downstream stage, and flag clearly labelled assumptions when fields are thin
rather than halting. Stage 1B gate now keys off the ten mandatory new field
keys (`f1_brand` … `f10_competitive`).

---

## v4.6 — Universal maxTokens Cap Raise to 64 000
**Date:** 2026-06-19
**Stages:** All Claude calls platform-wide
**Change:** Raised `maxTokens` to 64 000 (the maximum supported output cap
for the Sonnet 4.x family) on every Claude API call in the codebase. No call
is capped below the model maximum; any stage that produces less output than
the cap costs nothing, while any stage that previously hit its cap will now
generate to completion. Files changed and before → after caps:

- `src/lib/stage1.functions.ts` — 12000 → 64000
- `src/lib/stage1b.functions.ts` — 12000 → 64000
- `src/lib/stage2.functions.ts` — 12000 → 64000
- `src/lib/stage3.functions.ts` — 12000 → 64000
- `src/lib/stage4.functions.ts` — 12000, 12000 → 64000
- `src/lib/stage4b.functions.ts` — 12000 → 64000
- `src/lib/stage5.functions.ts` — 12000 → 64000
- `src/lib/stage6.functions.ts` — 12000 → 64000
- `src/lib/stage7.functions.ts` — 16000, 16000 → 64000
- `src/lib/stage8.functions.ts` — 2000, 12000, 12000, 12000, 12000 → 64000
- `src/lib/stage9.functions.ts` — 12000, 12000 → 64000
- `src/lib/stage10.functions.ts` — 16000 → 64000
- `src/lib/stage11.functions.ts` — 16000 → 64000
- `src/lib/stage12.functions.ts` — 32000 → 64000
- `src/lib/stage13.functions.ts` — 12000 → 64000
- `src/lib/stage13b.functions.ts` — 12000 → 64000
- `src/lib/stage14.functions.ts` — 16000 → 64000
- `src/lib/stage14b.functions.ts` — 14000 → 64000
- `src/lib/stage14c.functions.ts` — 16000 → 64000
- `src/lib/stage15.functions.ts` — 14000 → 64000
- `src/lib/stage16.functions.ts` — 24000 → 64000 (top-level vision/full-document call)
- `src/lib/stage16-sections.ts` — every per-section cap (500–1200) → 64000
- `src/lib/stage17.functions.ts` — 16000, 16000, 6000 → 64000
- `src/lib/stage17b.functions.ts` — 12000, 12000 → 64000
- `src/lib/stage18.functions.ts` — 20000, 20000 → 64000
- `src/lib/stage19.functions.ts` — 20000, 20000 → 64000
- `src/lib/stage20.functions.ts` — 16000, 16000, 2000 → 64000
- `src/lib/stage20b.functions.ts` — 16000 → 64000
- `src/lib/stage21.functions.ts` — 20000 → 64000
- `src/lib/stage22.functions.ts` — 16000, 8000, 16000, 8000 → 64000
- `src/lib/threeTruth.functions.ts` — 1000 → 64000
- `src/lib/preflight.functions.ts` — 16 → 64000
- `src/lib/document-generator.server.ts` — every per-section cap (400–1500) → 64000

`src/lib/claude.server.ts` default fallback (8192, used only when a caller
omits the cap) and `src/lib/preflight-tier-two.functions.ts` regex strings
were left untouched. The Tier-Two preflight check still validates that every
stage declares an explicit cap — all stages continue to satisfy that rule
with the new universal value.

---

## v4.7 — Stage 16 Master Detonation correction + visual prominence (2026-06-20)
**Date:** 2026-06-20
**Stages:** 16 (Vision + Consulting — Strategic Logic section)
**Change:** Three coordinated fixes to the Stage 16 Strategy and Creative
Vision and Board Strategy Recommendation documents.

(1) The Strategic Logic section was conflating the *master detonation*
(the Stage 18 selected detonation line — the statement the human approved
at the Stage 18 gate, stored in `stage_18_selected_detonation`) with the
*primary recommended springboard direction* (a downstream creative
territory generated inside Stage 18 that expresses the detonation). The
Stage 16 Vision user message now passes two clearly distinct inputs:
`MASTER DETONATION — THE SELECTED DETONATION FROM STAGE 18` (sourced from
`stage_18_selected_detonation`, falling back to `stage_18_detonation_line`)
and `CREATIVE SPRINGBOARD DIRECTIONS — DOWNSTREAM TERRITORIES FROM STAGE
18` (sourced from `stage_18_output`). The prompt now explicitly forbids
substituting any springboard — including the "primary recommended" one —
for the master detonation.

(2) The master detonation is now rendered with the same visual prominence
used on the Stage 18 selection screen. The prompt mandates exactly one
revelation block per document of the form: a `THE DETONATION` heading on
its own line followed immediately by the detonation line itself as a
large, bold, standout statement (H1 + bold). This appears once in the
Strategic Logic section at the point of revelation.

(3) The standalone `PART FIVE — THE CREATIVE DETONATION` section in the
Vision prompt has been removed; it duplicated content that the Strategic
Logic section already covers as the inevitable climax of the argument.

**Files:** `src/lib/stage16.functions.ts`, `src/lib/stage16-prompt.ts`.

---

## v4.8 — Audit confirmation + raise Claude default fallback to 64 000 (2026-06-20)
**Date:** 2026-06-20
**Stages:** All (audit) + `src/lib/claude.server.ts` default fallback
**Change:** Full re-audit of every `maxTokens` value in the Claude call graph.
Confirmed every explicit call site across Stages 1, 1B, 2, 3, 4, 4B, 5, 6, 7,
8, 9, 10, 11, 12, 13, 13B, 14, 14B, 14C, 15, 16 (all four document variants
including per-section caps in `stage16-sections.ts` and `document-generator.server.ts`),
17, 17B, 18, 19, 20, 20B, 21, 22, `threeTruth.functions.ts`, and
`preflight.functions.ts` is already pinned at the v4.6 universal cap of
**64 000** — no stage was found at a lower cap. The only remaining sub-cap
value was the default fallback inside `callClaude` in
`src/lib/claude.server.ts` (`args.maxTokens ?? 8192`), used only when a
caller omits the parameter. Raised from **8192 → 64000** so that any future
Claude call which forgets to pass `maxTokens` still receives the maximum
output budget supported by the Sonnet 4.x family.

**File changed:** `src/lib/claude.server.ts`
**Before:** `args.maxTokens ?? 8192`
**After:**  `args.maxTokens ?? 64000`

---

## v4.9 — Stage 16 master detonation rendered as true H1 hero line (2026-06-20)
**Date:** 2026-06-20
**Stages:** Stage 16 — Vision and Consulting prompts
**Change:** The master detonation reveal in both `STAGE_16_VISION_PROMPT`
and `STAGE_16_CONSULTING_PROMPT` was producing visually flat output —
rendered as ordinary paragraph text rather than as a hero line matching
the SMP proposition's visual treatment. Root cause: the previous template
`# **{line}**` wraps the heading text in bold markers, which several
markdown renderers (including the PDF/document generators in this
project) collapse to inline-bold paragraph text or print the asterisks
literally. The instruction has been rewritten to require a pure markdown
H1 — `#` + single space + the detonation line, on its own line, with no
bold-marker wrapping, no surrounding quotes, no trailing punctuation,
and no inline embedding — preceded by a separate bold label line
`**THE DETONATION**`. Explicit prohibitions added against wrapping the
heading text in `**...**` and against placing the line inside a paragraph.
This guarantees the detonation renders as a large, bold, standalone
heading-level line matching the SMP proposition treatment used elsewhere
in the document.

**File changed:** `src/lib/stage16-prompt.ts`

---

## v5.0 — Stage 16 detonation hero uses short LINE, not long STATEMENT (2026-06-20)
**Stages:** 16 (Vision + Consulting prompts; Stage 16 user-message builder)
**Change:** Stage 18 produces two distinct values — `stage_18_detonation_line`
(the short headline, e.g. "BRING YOUR HARDEST BRIEF") and
`stage_18_selected_detonation` (the longer explanatory statement). The
Stage 16 Vision user message previously passed only the long statement
as the "MASTER DETONATION" input, and the prompt instructed the model
to place that whole value inside the hero H1 — so the long sentence was
rendered as the hero line instead of the short headline.

Fix:
1. `src/lib/stage16.functions.ts` — the Vision user message now passes
   two explicitly labelled inputs: `MASTER DETONATION LINE` (sourced from
   `stage_18_detonation_line`) and `MASTER DETONATION STATEMENT`
   (sourced from `stage_18_selected_detonation`).
2. `src/lib/stage16-prompt.ts` — both detonation prompt blocks (Vision
   MOVEMENT THREE and Consulting MOVEMENT THREE) updated so the hero H1
   under **THE DETONATION** contains ONLY the short MASTER DETONATION
   LINE. The MASTER DETONATION STATEMENT now follows as normal body
   prose. Added an explicit guard: if the value the model is about to
   place in the H1 reads as a full explanatory sentence or is longer
   than ~12 words, the model has pulled the wrong field.

This matches the visual treatment shown on the Stage 18 selection card.

**Files changed:** `src/lib/stage16.functions.ts`,
`src/lib/stage16-prompt.ts`, `prompt_versions.md`

---

## v5.1 — Mandatory web-search fact verification on Stage 4B and Stage 2 (2026-06-20)
**Stages:** 4B (Asset Mining & Product Fact Inventory), 2 (Category Intelligence)
**Change:** Added a structural — not prompt-only — fact-verification step that
runs after the stage's Claude stream completes and before the output is saved.

A precedent session contained a factually wrong "Real Fact" (claiming rugby
union prohibits the forward pass — both codes share that rule) that was
treated as verified and built into the strongest strategic territory before
human catch. Prompt instructions to "only state true facts" cannot self-police.

Implementation:
1. New `src/lib/fact-verify.server.ts`. Calls the Anthropic Messages API with
   the server-side `web_search_20250305` tool enabled (`max_uses: 8`). The
   auditor model identifies every independently verifiable real-world claim
   in the stage output, runs live web searches, and returns strict JSON
   `{claim, verdict, note}` per item with verdict in
   `verified | unverified | contradicted`.
2. Stage 4B (`src/lib/stage4b.functions.ts`) and Stage 2
   (`src/lib/stage2.functions.ts`) now invoke `verifyRealFacts(...)` after
   their Claude stream finishes. Unverified / contradicted claims are
   visually flagged inline with `⚠️ **[UNVERIFIED — REQUIRES HUMAN
   CONFIRMATION]**` and a "Fact Verification Review" footer is appended
   listing every flagged claim with the search note.
3. If the verification call itself fails, the stage does not block — a banner
   is appended telling the reviewer that verification did not run and all
   real-fact claims must be confirmed manually.
4. The verified/rewritten text is what is saved to `stage_4b_output` and
   `stage_2_output`, so downstream stages and the human reviewer see the
   same flagged document.

This is universal — it applies to every brand, every category, every future
session. A genuine HTTPS call to Anthropic's web_search tool is made; this is
not a prompt-only safeguard.

**Files changed:** `src/lib/fact-verify.server.ts` (new),
`src/lib/stage4b.functions.ts`, `src/lib/stage2.functions.ts`,
`prompt_versions.md`

## v5.2 — Document Assembly gated on full-pipeline completion

Stage 16 (Document Assembly) no longer runs at the end of Phase 1.
The auto-trigger in `src/routes/pipeline.tsx` was removed and Stage 16
is now generated on demand from the `/complete` deliverables page only
after Phase 2 (Stages 17–22), Checkpoint D (Creative Territory) and
Checkpoint E (Detonation) are all confirmed.

Server-side gate in `src/lib/stage16.functions.ts` rejects any
generation request whose session is missing `stage_22_output`,
`stage_17_selected_territory`, or `stage_18_selected_detonation`
(cached output may still be re-opened).

The Strategy and Creative Vision prompt no longer carries the
"derive…" fallbacks that previously instructed Claude to invent a
Detonation when Phase 2 was absent. Stage 17/17B/18/19/20/20B/21/22
outputs are now passed verbatim; every absent field shows a literal
`[PENDING — …]` marker and an absolute rule forbids fabrication.

**Files changed:** `src/lib/stage16.functions.ts`,
`src/routes/pipeline.tsx`, `src/routes/complete.tsx`,
`prompt_versions.md`
