# Scoring, Validation & Gating Systems — Code-Verified Inventory

Compiled 18 September 2026 by reading the current source directly, stage by
stage. Every entry cites the file and symbol. Anything marked CORRECTION
differs from what prior documentation states.

---

## Phase 1 — Strategy pipeline

### 1. Stage 8 code-enforced generation gates
- **Where:** `src/lib/stage8.functions.ts` (`runStage8`), `src/lib/stage8-disruption.server.ts` (`enforceBaseLengthGate`, `enforceBaseAnchorGate`), `src/lib/stage8-prompt.ts`.
- **Six code-enforced gates:** (1) upstream presence — Stages 2, 3 and 7 outputs must exist or the stage throws; (2) territory minimum — fewer than 2 territories triggers an automatic Stage 7 re-run with `enforceMinimum`; still fewer than 3 after the re-run hard-fails the session (`status: interrupted`); (3) territory cap — maximum 5 territories consumed per run (`MAX_TERRITORIES`); (4) completeness — parsed proposition count must equal territory count, with up to 3 continuation passes, else the stage interrupts with partial output preserved; (5) hard length gate — every base and disruption-engine line outside 4–12 words is sent to a compression pass (max 2 retries) (`MIN/MAX_PROPOSITION_WORDS` in `stage8-disruption-engines.ts`); (6) the Universal Anchor Gate (entry 3).
- **Prompt-level standards (not code-enforced):** CRAB (Clear, Relevant, Appealing, Believable) and a machine-parseable output format.
- **Docs:** consistent.

### 2. Stage 8 Disruption Engines (Breach / Fuse / Flashpoint)
- **Where:** `src/lib/stage8-disruption.server.ts` (`runStage8DisruptionEngines`), `src/lib/stage8-disruption-engines.ts`.
- Three generative engines fired per territory and merged as sibling candidates (A·BASE, B·BREACH, C·FUSE, D·FLASHPOINT). Each candidate passes the same length gate and anchor gate; an anchor-gate failure renders the candidate struck-through with the failure reason — it is not silently dropped. Engine failure never fails Stage 8.
- **Docs:** consistent with `platform-metrics.ts` (`STAGE_8_DISRUPTION_ENGINE_KEYS`).

### 3. Universal Proposition Anchor Gate
- **Where:** `src/lib/proposition-anchor.server.ts` (`enforcePropositionAnchor`), `src/lib/proposition-anchor.ts` (`AnchorVerdict`, `renderAnchorFailure`).
- **Criteria:** every proposition must be defensible by one real, specific brand capability; a competitor being able to credibly run the same line is a fail, not a markdown. Delivery-speed anchors are explicitly deprecated unless the line is genuinely about time.
- **Verdicts:** `anchored: true | false` with capability, anchor line, and reason. Shared by Stage 8 base, the 3 disruption engines, and the 13 LOC engines — single implementation.
- **Docs:** consistent.

### 4. Stage 9 Distinctiveness & Ownership Review (v3.0)
- **Where:** `src/lib/stage9-prompt.ts`, `src/lib/stage9-banned-words.ts`, `src/lib/stage9-disposition.ts`.
- **Mechanisms:** Strategic-Impossibility Analysis per proposition (four failure modes a–d against each named competitor); a banned-word guard with two physically separate lists — `UNIVERSAL_BANNED_STAGE9` (nothing relaxes) and `CONDITIONALLY_BANNED_STAGE9` (blocked only when a named competitor owns the word); and a mandatory CANDIDATE DISPOSITION ledger with verdicts **SURVIVED / REBUILT INTO \<SMP\> / REJECTED — reason**, with code-side coverage checking and targeted retry for unaccounted ids.
- **Docs:** CORRECTION if any document still describes Stage 9 as a "surprise-scored" compression pass — v3.0 (July 2026) removed that framing.

### 5. Left-of-Centre weighted validation (13 engines)
- **Where:** `src/lib/loc/validation.ts` (`runValidationPass`, `computeWeighted`, `DIMENSION_WEIGHTS`, `HARD_FLOORS`).
- **Dimensions/weights:** Fame 30, Truth Strength 20, Competitive Impossibility 15, Brand Permission 10, Clean Air 10, Commercial Precedent 5 (weights sum to 90; each scored 0–10).
- **Hard floors:** Truth Strength ≥ 5, Competitive Impossibility ≥ 6. Below a floor: `failsFloor = true`, proposition disqualified.
- **Verdicts:** per-engine weighted score 0–90 plus fail/disqualify flag; no elimination verdicts — elimination happens at Stage 12.
- **Docs:** consistent (deliberately excluded from the two headline scoring figures in `platform-metrics.ts`).

### 6. Stage 10 SMP Scoring — V6 Unified Six-Dimension Framework
- **Where:** `src/lib/stage10-prompt.ts` (`STAGE_10_SYSTEM_PROMPT`), code enforcement in `src/lib/stage12-filter.ts` (`STAGE_10_FLOORS`, `evaluateStage10Verdict`, `computeWeightedComposite`), mirrored for documents in `src/lib/minto-content.ts` (`DIMENSIONS`).
- **CONFIRMED EXACTLY AS DOCUMENTED:** six dimensions, weights Fame 30 / Truth Strength 20 / Competitive Impossibility 15 / Brand Permission 10 / Clean Air 10 / Commercial Precedent 5, weighted composite out of **/90**, hard floors **Truth Strength ≥ 5** and **Competitive Impossibility ≥ 6** (ELIMINATE below either). Fame < 6, Brand Permission < 5, Clean Air < 5, Commercial Precedent < 4 are human flags only.
- PASS/ELIMINATED and the composite are computed **in code**, not by the model; the code verdict overrides any LLM verdict. Set-level verdict: READY FOR STAGE 11 YES/HOLD (HOLD if fewer than 2 SMPs clear the floors).
- **Docs:** consistent.

### 7. Stage 11 Proposition Pressure Test (V2 — fatal/flagged split)
- **Where:** `src/lib/stage11-prompt.ts` (`STAGE_11_SYSTEM_PROMPT`, `STAGE_11_LOGIC_VERSION = 2`), parser in `src/lib/stage12-filter.ts` (`parseStage11Verdicts`).
- **Tests — eight named, T1–T8, but T8 is conditional:** T1 Factual Falsity, T2 Logical Incoherence, T3 Permission Failure, T4 Forbidden Zone Violation (Tier One — FATAL); T5 Competitive Counter-Vulnerability (with mandatory EXPOSES-UNTRUTH / COMPETES-FOR-TERRITORY / UNCERTAIN discriminator; UNCERTAIN defaults to FATAL), T6 Time Decay (3-year horizon), T7 Interpretation Drift (Tier Two — FLAGGED, never fatal); T8 Iconic Tier Sustainability (only for Iconic-Tier-flagged propositions; HOLDS/DOWNGRADE, never fatal). The prompt header itself states "7 (+ T8 conditional)".
- **Verdicts:** VALIDATED / VALIDATED — EXPOSED / VALIDATED WITH STRATEGIC NOTE / REWRITTEN / ELIMINATED, plus machine-readable `[FATAL: …]` and `[FLAGS: …]` lines that are authoritative over the prose verdict in code. Set minimum: ≥ 2 survivors.
- **Docs:** consistent, with the T8-conditional nuance.

### 8. Stage 12 selection filter (code layer)
- **Where:** `src/lib/stage12-filter.ts`, `src/lib/stage12-prompt.ts`.
- Code reclassifies Stage 11 verdicts (a prose ELIMINATED with `[FATAL: NONE]` is restored; a competition-only T5 crack becomes VALIDATED — EXPOSED), honours rewrites (the rewritten line carries forward; the original is kept only as a "do not use" reference), strips ELIMINATED propositions from the Stage 12 input, and freezes Stage 10 scores verbatim into the selection cards. Selection itself is human (Checkpoint C) — there is no Stage 12 scoring rubric.
- **Docs:** consistent.

### 9. Stage 13 Brand Fit Validation (V1)
- **Where:** `src/lib/stage13-prompt.ts`.
- **CONFIRMED:** the six credibility dimensions — Product Truth Alignment, Audience Permission, Tonal Compatibility, Behavioural Capacity, Cultural Authority, Historical Consistency (same six as documented; the prompt lists them in a different order). Each scored 1–10; no composite is computed. Most Vulnerable Credibility Dimension identified.
- **Verdicts:** CONFIRMED — PROCEED / CONFIRMED WITH ADJUSTMENTS — PROCEED / HUMAN REVIEW REQUIRED / RETURN TO STAGE 12 — RESELECT SMP.
- **Additional test:** Section 2B Forcing Proposition Test, mandatory when any operational dimension (Behavioural Capacity, Tonal Compatibility, Product Truth Alignment, Historical Consistency) scores ≤ 5 — verdicts FORCING PROPOSITION / GENUINE MISMATCH.
- **Docs:** consistent.

### 10. Stage 15 Strategic Consistency Audit (V2)
- **Where:** `src/lib/stage15-prompt.ts`.
- **CONFIRMED — nine checks:** 1 Derivation Chain Integrity, 2 Constraint Integrity, 3 SMP Overlap Check, 4 Category Convention Contamination, 5 Brand Fit Consistency, 6 STRL Differentiation, 7 Language Compliance, 8 Voice Consistency Audit (three sub-tests: poison-word sweep, tone-register consistency, brand-voice authenticity), 9 Specificity Audit (brand-name-removal test).
- **Severity scale:** CRITICAL / SUBSTANTIVE / MINOR; findings classified HARMFUL DRIFT / PRODUCTIVE EVOLUTION / UNCERTAIN ALIGNMENT (UA capped at 2).
- **Clearance verdicts:** CLEARED / CLEARED WITH ACCEPTED EXCEPTIONS / CLEARED WITH UNCERTAIN ALIGNMENT ADVISORIES / PENDING RESOLUTION.
- **Docs:** consistent.

## Phase 2 — Detonation pipeline

### 11. Stage 17 SMP Alignment Check
- **Where:** `src/lib/stage17-detonation-territory-prompt.ts`.
- A mandatory qualitative four-step check per territory (state SMP, read territory, test human expressibility, test specificity of connection). **No numeric rubric exists at Stage 17** — confirmed by full read of the prompt.
- **Docs:** consistent.

### 12. Stage 18 Eight-Dimension Stress Test
- **Where:** `src/lib/stage18-the-detonation-prompt.ts`.
- **CONFIRMED — eight dimensions, each 1–10:** 1 Ubiquity of Expression, 2 Temporal Durability, 3 Executional Infinity, 4 Competitive Immunity, 5 Cultural Participation, 6 Semiotic Distinctiveness, 7 Psychological Potency, 8 Share of Voice Efficiency. Threshold: only candidates scoring **72 or above** may be output; STATUS PASS / REVIEW.
- **CORRECTION — internal inconsistency in the current code:** the prompt labels the composite "[n]/90" and the threshold "72 out of 90", but eight dimensions × 10 has a maximum of **80**. The /90 figure appears to have been inherited from the Stage 10 convention. The effective pass bar is 72 out of a real maximum of 80. Any document quoting "72/90" repeats this defect.
- Also includes the Courage Requirement (STRATEGIC DISCOMFORT PRESENT/ABSENT) and Compounding Assessment (CAMPAIGN/PLATFORM) — qualitative, not scored.

### 13. Stage 20 Independent Brief Quality Scorer
- **Where:** `src/lib/stage20-scorer.ts` (`scoreStage20Brief`, `formatScorerBlock`, `buildRewriteInstruction`).
- **CONFIRMED — replaced the hard-coded 45/50 placeholder** (stated in the file header comment). Five dimensions, each 1–10: Emotional Clarity, Fame Invitation, Distinctive Asset Integration, Psychological Leverage, Creative SoV Ambition. Composite = sum, out of **/50**; **PASS ≥ 40**, else REVIEW with named failing dimensions; a REVIEW feeds a mandatory rewrite instruction back into generation. Model-self-reported scores from the generation step are ignored — scoring is independent.
- **Docs:** consistent.

### 14. Stage 21 Channel Fidelity gate
- **Where:** `src/lib/stage21-fidelity.server.ts` (`runChannelFidelityCheck`), `src/lib/stage21-fidelity-gate.ts` (`fidelityBlockReason`, `overrideCoversReport`), `src/lib/stage21-fidelity-gate.server.ts` (`requireNoFidelityBreak`).
- Every channel brief judged against the locked campaign big idea: verdicts **pass / drift / break** with a 0–10 score. A **break** is a hard gate — downstream consumers refuse to run until the brief is regenerated or a human records a written override bound to the exact report (stale overrides do not unblock). A check that fails to complete records "drift", never a silent pass.

## Cross-cutting integrity systems

### 15. Checkpoint gates A–F
- **Where:** `src/lib/checkpoint-gate.ts` (`requireConfirmedSelection`).
- Six hard human gates: A (gates Stage 2), B (gates Stage 9), C + selected_smp (gates Stage 13), D / Stage 17 selection (gates 17B/18), E / Stage 18 selection (gates 19), F / Stage 20 approval (gates 21). Each re-reads the session row and throws; there is no silent advance path.
- **Docs:** consistent with `HUMAN_CHECKPOINT_COUNT = 6`.

### 16. Fact verification
- **Where:** `src/lib/fact-verify.server.ts` (`FACT_VERIFIED_STAGES`, `runStageFactVerification`).
- Claim-level web-search verification with verdicts **verified / unverified / contradicted**; unverified claims are annotated in the output, contradicted claims flagged ❌, and a failed verification call appends a visible review banner. Applied to Stage 2 (Category Intelligence), Stage 4B (Asset Mining), and the Research Synthesiser — each with a stage-specific claim-focus list (max 25/25/20 claims).

### 17. Document certification gates
- **Where:** `src/lib/summary-gate.ts` (`summaryGateFailures` — checks C1–C11: section order/presence, heading ownership, orphaned headings, truncation, internal artifacts, foreign-session content, duplication, locked-proposition traceability, locked-idea verbatim carriage, required prose, footer integrity), `src/lib/document-gate.ts` (`gateDocument`), `src/lib/content-integrity.ts` (`certifyDocument`, `assertPublishable`), `src/lib/document-standard.ts` (`universalStructureFailures`, verdict-as-rationale repair).
- Pass/fail; a failing document is thrown, never rendered.

### 18. Severity-Graded Preflight (Tier Two)
- **Where:** `src/lib/preflight-tier-two.functions.ts` (`CHECK_DEFS`), `src/lib/preflight-severity.ts` (`classifyResult`, `summariseSeverities`, `shouldBlockPresentation`).
- **Severity tiers CONFIRMED — four:** BLOCKER / DEGRADED / HARNESS / TRANSIENT, plus SKIPPED as a rendered state (not a severity). Only BLOCKERs stop live presentation; a transient recurring in 3 consecutive runs escalates to BLOCKER.
- **CORRECTION — "12 Tier-Two integrity checks" is stale:** `CHECK_DEFS` currently lists **15**: stage_1_brief_analysis, phase1a_chain_2_to_7, stage_8_checkpoint_b, stage_prompts_integrity, stage_9_edt_guard_output, stage_10_11_evaluation_chain, stage_12_smp_selection, phase1_completion_13_to_16, sanitiser_and_token_caps, phase2_detonation_chain, canvas_to_detonation_navigation, concurrent_session_integrity, loc_track_integrity, smp_verbatim_carriage_20_20b_21, synthesiser_skip_leaves_lab_unchanged.

### 19. Pipeline gate ("Platform Not Verified")
- **Where:** `src/lib/pipeline-gate.functions.ts` (`getPipelineGate`).
- Gates creation of new pipeline runs on preflight status/freshness — a platform-level admission check, not a content score.

### 20. LOC run health assertion
- **Where:** `src/lib/loc-integrity.server.ts` (`assertLocRunHealthy`).
- Pass/fail assertions over a LOC run row (engine outputs present, anchors, validation, persistence) — the failure class behind the `loc_track_integrity` preflight check.

## Room 00 — Research Synthesiser

### 21. Synthesiser claim verification
- **Where:** `src/lib/synthesiser/synthesise.server.ts` (`overlapScore`, verification merge), `src/lib/synthesiser/types.ts` (`VerificationStatus`).
- Claims are matched against verified results by lexical overlap (threshold **0.5**); statuses **verified / unverified / contradicted / client_supplied** (client-proprietary data is excluded from external verification by design). Externally-verifiable claims also go through the shared fact-verification system (entry 16).

## Room 01 — Intelligence Lab

### 22. Territory evaluation contract
- **Where:** `src/lib/intelligence/output-contract.ts` (`OUTPUT_CONTRACT`), `src/lib/intelligence/system-prompt.ts`.
- Per territory: two numeric scores — **Brand Permission (1–10)** and **First Mover (1–10)** — plus structured categorical assessments: white-space (perceptual/emotional/cultural/motivational), cultural adaptation (high/moderate/low/counterproductive), audience readiness (high/moderate/low/resistant), historical-validation risk (low/medium/high/very_high), investment and budget thresholds (low/moderate/high/scale-independent).
- **Verdict:** `strategic_recommendation`: **claim / do_not_claim / claim_with_conditions**, plus a single `recommended_primary_territory_id`. There is no weighted composite — scores and ratings are reported independently.

## Room 04 — Creative Stimulus Engine

### 23. Gate One rating system (eight dimensions)
- **Where:** `src/lib/stimulus/rating-prompts.ts` (`RATING_SYSTEM_PROMPT`, `DirectionRatings`), `src/lib/stimulus/rate.server.ts`, `src/lib/stimulus/rating-score.ts`.
- **CONFIRMED — eight dimensions:** 1 Strategic Compliance (Direct/Supporting/Tangential), 2 Brand Glue (High/Medium/Low), 3 CRAB (Clear/Relevant/Appealing/Believable, each High/Medium/Low), 4 Fame (H/M/L), 5 Creative Uniqueness (H/M/L — live web search mandatory; if no search was performed the verdict is stamped "NOT VERIFIED BY LIVE SEARCH"), 6 Creative Ambition (H/M/L holistic judgement), 7 Producibility (pass/fail feasibility only), 8 Brand Integrity Check (concerns list; flags, never blocks).
- Dimensions are scored **independently — never averaged**. A 0–1 composite index exists solely to trigger the seasoned-CD tie-breaker when top directions sit within **0.06** of each other (max 5 candidates).
- **Docs:** consistent with `CREATIVE_SCORING_DIMENSION_NAMES` in `platform-metrics.ts`.

### 24. Gate Two mandate compliance + admission rules
- **Where:** `src/lib/stimulus/orchestrate.server.ts` (mandate compliance: **present / weak / absent**, with a code-side carrier check that downgrades a model "present" to "absent" if the carrying phrase is not actually in the prompt; orchestration self-critique: **pass / fail** with a named deliberate imperfection), `src/lib/stimulus/gate-two-rules.ts` (`gateTwoBlockReason`).
- Gate Two cannot be confirmed while any mandated element is absent, any prompt is undecided, or zero prompts are approved — a mandate is binding and no human sign-off overrides it.

### 25. Campaign line on-strategy check
- **Where:** `src/lib/stimulus/line-check.server.ts` (`checkCampaignLines`).
- Each of the 37 campaign lines judged blind (without the idea's rationale) against the SMP: verdicts **on_strategy / drift / generic**, with an explicit competitor swap test.

### 26. Channel adaptation fidelity
- **Where:** `src/lib/stimulus/adaptation-fidelity.server.ts` (`checkAndStoreAdaptationFidelity`, `carriesLineVerbatim`).
- Two checks per channel adaptation: a deterministic verbatim-carriage check of the locked campaign line (no model), plus the Stage 21 fidelity check reused verbatim (pass/drift/break). A missing locked line forces at least "drift" regardless of model verdict.

### 27. Convergence ledger
- **Where:** `src/lib/stimulus/convergence-ledger.server.ts`.
- Cross-direction collision audit: every direction id receives a **CLEAR / COLLIDES** verdict row; code enforces full coverage and a missing id triggers correction. Unresolved collisions default to COLLIDES.

### 28. Stimulus corpus selection (embedding ranking)
- **Where:** `src/lib/loc/stimulus-select.server.ts`.
- LOC stimulus fragments are ranked by embedding distance to the session context, with nearest-quantile rejection when the pool is large, then domain-diversified random selection. A ranking/selection mechanism, not a quality score.

---

## Corrections vs prior documentation (summary)

1. **Stage 18 composite "/90" is wrong in the code itself** — 8 dimensions × 10 maxes at 80; the ≥72 threshold stands, but "/90" is a defect inherited from the Stage 10 convention.
2. **"12 Tier-Two integrity checks" is stale** — the current code lists 15.
3. **Stage 11 "eight tests"** — correct count, but T8 is conditional (Iconic Tier only); the prompt itself says "7 (+ T8 conditional)".
4. **Stage 9** — if any document describes it as a surprise-scored compression pass, that predates v3.0 (July 2026): it is now a distinctiveness/ownership review.
5. **Stage 17 has no numeric rubric** — only the qualitative four-step SMP Alignment Check.

Everything else checked (Stage 10 six dimensions /90 with floors TS≥5/CI≥6; Stage 13 six credibility dimensions and four verdicts; Stage 15 nine checks; Stage 20 five-dimension /50 scorer with PASS ≥40 replacing the 45/50 placeholder; Gate One eight dimensions; four preflight severities; six checkpoint gates) matches prior documentation exactly.
