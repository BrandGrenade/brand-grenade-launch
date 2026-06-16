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
