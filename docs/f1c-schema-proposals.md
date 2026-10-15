# F1c — Structured output proposals (PROPOSAL ONLY, nothing changed)

Principle for all four: the text output stays exactly as now (documents, exports and parsers keep reading it). A second, schema-validated JSON is produced **from the same model call** via a trailing fenced block (`<<<STRUCTURED_JSON ... >>>`), split off before the text is saved, validated with zod, and stored in a new nullable `stage_N_structured jsonb` column. If validation fails, the text still saves and `stage_N_structured_error` records why; nothing downstream depends on it until a later prompt switches readers over. (Forced tool use is not an option on Opus 5.5 — it returns HTTP 400.)

## Stored-output consistency (non-test sessions, today)

| Stage | Runs with output | Finding |
|---|---|---|
| 9 | 10 | 8 contain a ranking, 9 a SELF-EXECUTING/PLATFORM class; no machine-readable markers at all — field boundaries are inferred. |
| 10 | 7 | All 7 have six-dimension lines; only **3 of 7** have a `SMPS SCORED: n` header that matches the number of score blocks (Dan Murphy's header 5 / blocks 1; CommBank 4/1; EY 5/6; KPMG 5/6). |
| 11 | 7 | 0 of 7 have `[FLAGS:]`, 6 of 7 have no `[FATAL:]` (all stored runs predate the current bracket format); verdict counts vs Stage 10 blocks disagree on Qantas (2 vs 1), Dan Murphy's (4 vs 1), CommBank (3 vs 1). |
| 13 | 7 | All 7 score the six credibility dimensions and give a Section 1 verdict; Section 2B appears in 2 (it is conditional). |

The header/block mismatches are why a structured record is worth having: today the count is whatever a regex finds.

## Stage 9 — Single-Minded Propositions
Prompt asks per proposition: SMP (4–12 words, active promise), Foundation (territory, truth, reinterpretation), Strategic-Impossibility Analysis (one line per named Stage 2 competitor), Creative Territory, Creative Function (SELF-EXECUTING | PLATFORM + rationale); then a ranking with one-sentence rationales and a top 1–2 recommendation. No numeric scores (five stress tests are pass-before-present, not reported).
```json
{ "propositions": [{ "id": "P1", "smp": "string(4-12 words)", "field_name": "string",
    "foundation": { "territory": "string", "truth": "string", "reinterpretation": "string" },
    "impossibility": [{ "competitor": "string (must be a Stage 2 CMM name)", "why_they_cannot": "string" }],
    "creative_territory": "string",
    "creative_function": { "class": "SELF-EXECUTING|PLATFORM", "rationale": "string" } }],
  "ranking": [{ "id": "P1", "rank": 1, "rationale": "string" }],
  "recommended": ["P1"] }
```
Checks in code: 5–7 propositions; every CMM competitor appears in every impossibility list; ranks are 1..n unique.

## Stage 10 — SMP Scoring (V6, six dimensions)
Prompt: each dimension integer 1–10 with anchor justification; weights Fame 30, Truth Strength 20, Competitive Impossibility 15, Brand Permission 10, Clean Air 10, Commercial Precedent 5; hard floors Truth Strength 5, Competitive Impossibility 6; evidence requirements (named competitor + claim below 10 for CI; named evidence for BP deductions; named competitor below 8 for Clean Air; named brand + campaign + year for precedent). No verdict line — PASS/ELIMINATED and composite are computed in code.
```json
{ "smps_scored": 5, "selection_rule": "string",
  "scores": [{ "smp": "string", "field_name": "string",
    "fame": { "score": 1-10, "justification": "string" },
    "truth_strength": { "score": 1-10, "justification": "string" },
    "competitive_impossibility": { "score": 1-10, "justification": "string", "competitor": "string|null", "competitor_claim": "string|null" },
    "brand_permission": { "score": 1-10, "justification": "string", "evidence": "string|null" },
    "clean_air": { "score": 1-10, "justification": "string", "occupier": "string|null", "occupying_claim": "string|null" },
    "commercial_precedent": { "score": 1-10, "justification": "string", "precedents": [{ "brand": "string", "campaign": "string", "year": 2004 }] } }] }
```
Code (unchanged method) adds `composite` and `code_verdict` after parsing. Check: `smps_scored === scores.length === input proposition count`; evidence fields non-null where the prompt requires them.

## Stage 11 — Pressure Test (V2 fatal/flagged)
Prompt: T1–T4 fatal tier, T5–T7 flagged tier, T8 only for Iconic Tier; each test CRACKS/WOBBLES/HOLDS with rationale; T5 classification EXPOSES-UNTRUTH | COMPETES-FOR-TERRITORY | UNCERTAIN; SMP VERDICT of five values; FATAL and FLAGS lists; exposure/strategic notes; optional rewrite; Iconic final status; set-level report and surviving set.
```json
{ "blocks": [{ "smp": "string", "field_name": "string", "iconic_tier": true,
    "tests": { "T1": { "result": "HOLDS|WOBBLES|CRACKS", "rationale": "string" }, "...": "T2-T7 same",
      "T5": { "result": "...", "counter_line": "string", "classification": "EXPOSES-UNTRUTH|COMPETES-FOR-TERRITORY|UNCERTAIN", "rationale": "string" },
      "T7": { "result": "...", "misreading": "string", "guard_rail": "string", "rationale": "string" },
      "T8": { "result": "HOLDS|WOBBLES|CRACKS|N/A", "rationale": "string|null" } },
    "verdict": "VALIDATED|VALIDATED — EXPOSED|VALIDATED WITH STRATEGIC NOTE|REWRITTEN|ELIMINATED",
    "fatal": ["T1"], "flags": ["T5-COMPETITIVE"], "exposure_note": "string|null", "strategic_note": "string|null",
    "rewrite": { "line": "string", "reason": "string" } | null, "iconic_final": "CONFIRMED|DOWNGRADED|N/A" }],
  "surviving_set": ["string"], "exposed_count": 0, "divergence_preserved": true }
```
Check: one block per Stage 10 proposition; Stage 10 ELIMINATED ⇒ verdict ELIMINATED with `STAGE10-FLOOR` in fatal; verdict consistent with the verdict logic applied in code. Stage 11 stays on Opus 5 (heading drift on 5.5) — the schema helps there because heading drift no longer loses data.

## Stage 13 — Brand Fit
Prompt: Section 1 verdict (four values) + paragraph; Section 2 six credibility dimensions 1–10 with one-sentence justification and Most Vulnerable dimension; Section 2B conditional (any of Behavioural Capacity, Tonal Compatibility, Product Truth Alignment, Historical Consistency ≤5) FORCING PROPOSITION | GENUINE MISMATCH with path; Section 3 own/behave/sustain; Section 4 3–5 adjustments; Section 5 guardrails or operational requirements (5–10); Section 6 3–5 commitments.
```json
{ "verdict": "CONFIRMED — PROCEED|CONFIRMED WITH ADJUSTMENTS — PROCEED|HUMAN REVIEW REQUIRED|RETURN TO STAGE 12 — RESELECT SMP", "verdict_reason": "string",
  "credibility": { "product_truth_alignment": { "score": 1-10, "justification": "string" }, "audience_permission": {}, "tonal_compatibility": {}, "behavioural_capacity": {}, "cultural_authority": {}, "historical_consistency": {} },
  "most_vulnerable": "behavioural_capacity",
  "forcing_test": { "triggered": true, "verdict": "FORCING PROPOSITION|GENUINE MISMATCH", "path_or_reason": "string" } | null,
  "ownership": { "own": "string", "behave": "string", "sustain": "string" },
  "adjustments": [{ "what": "string", "why": "string", "downstream": "string" }],
  "section5": { "mode": "GUARDRAILS|OPERATIONAL_REQUIREMENTS", "items": [{ "text": "string", "dimension": "string|null", "horizon": "string|null" }] },
  "commitments": ["string"] }
```
Check: `forcing_test` non-null exactly when a trigger dimension is ≤5; section5 mode matches the 2B verdict.

## Current position (score the brand's existing proposition)
- **Source, in order:** (1) a human-entered "current proposition" on the brief (new optional brief field, with source + date); (2) else the Briefing Room / Intelligence Lab stored current positioning (`sessions.brand_positioning`), only if it is a single line the brand actually uses publicly; (3) else none — the slot shows "No current proposition supplied" and is not invented.
- **Method:** the same Stage 10 prompt, rubric, anchors, evidence rules, weights and code-computed composite/verdict — run as one extra proposition marked `is_current: true` in the same Stage 10 call, so it is scored in identical conditions. It is excluded from Stage 11/12 selection.
- **Output:** a `current_position` entry in the Stage 10 structured JSON (same shape as a score row plus `source`, `source_date`), shown as a baseline row above the strongest 3 new propositions with per-dimension deltas (new − current).

## Diagnostic run
- `sessions.run_mode text NOT NULL DEFAULT 'full' CHECK (run_mode IN ('full','diagnostic'))`, chosen at start, immutable once Stage 1 begins.
- Diagnostic runs execute Stages 1–13 exactly as full runs, with Checkpoints A, B and C still required. After Stage 13 completes the orchestrator stops (no 13B–16, no Phase 2) and the run is marked complete, which auto-locks it.
- Deliverable: a Diagnostic document built from Stages 9–13 (+ current position). A diagnostic run can later be "continued to full" only by starting a new full run whose `bg_source_id` points at it, so the locked diagnostic is never altered.
