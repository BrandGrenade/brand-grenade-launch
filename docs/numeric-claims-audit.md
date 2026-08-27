# Numeric Claims Audit — marketing site + client-facing documents

Every hardcoded numeric claim found on the marketing surface and in the
client-facing document templates, with its status: **derived** (computed from
code/session data), **now derived** (fixed in this pass), **constant-ok**
(architectural constant with a single definition), or **asserted** (still a
bare literal — listed so it cannot surface as a surprise later).

Single sources of truth:
- `src/lib/platform-metrics.ts` — scoring dimensions, proposition volume, checkpoint count
- `src/lib/stage-manifest.ts` — `NUMBERED_STAGE_COUNT` (22), `TOTAL_PIPELINE_STEPS` (28)
- `src/lib/stimulus/lenses.ts` — `LENS_COUNT` (37)
- `src/lib/rooms.ts` — `ROOM_DEFS` (5)
- `src/lib/minto-content.ts` — `STRUCTURED_OUTPUT_COUNT` (16 + 7 = 23)

## Marketing site (`src/routes/index.tsx`)

| Claim | Location | Status | Source of truth |
|---|---|---|---|
| "6 strategic / 8 creative scoring dimensions, plus validation rubrics" (was "14") | hero stat | **now derived** | `STRATEGY_SCORING_DIMENSIONS`, `CREATIVE_SCORING_DIMENSIONS` |
| "~20 divergent propositions … shortlisted to 3–5" (was "20+") | hero stat | **now derived** | `PROPOSITIONS_HEADLINE_CEILING`, shortlist constants (real range 6–23) |
| "37 creative lenses" | hero stat | **now derived** | `LENS_COUNT` |
| "23 structured outputs" | hero stat | **now derived** | `STRUCTURED_OUTPUT_COUNT` (pipeline 16 + detonation 7) |
| "Five connected rooms" (meta said "Four", body said "five") | head meta + body | **now derived / fixed** | `ROOM_DEFS.length` |
| "2–4 hrs raw intelligence to finished direction" | hero stat | **asserted** | No run-duration telemetry aggregated; observed range only |
| "50+ methodologies" (×2: meta + Room 03 facts) | meta, room card | **asserted but true** | `docs/methodology-inventory.md` lists 55; not code-derived |
| "16 lateral engines" | Room 03 facts | **asserted but true** | 13 LOC engines (`src/lib/loc/`) + 3 Stage 8 disruption engines |
| "Six-dimension strategic validation" | Room 03 facts | **constant-ok** | Matches `STRATEGY_SCORING_DIMENSION_NAMES` (6) |
| "Eight-dimension creative scoring" | Room 04 facts | **constant-ok** | Matches `RATING_SYSTEM_PROMPT` (8) |
| "37 divergent creative territories" (×2 room copy) | room descriptions | **asserted but true** | Equals `LENS_COUNT`; prose, not interpolated |
| "14 claims · 9 externally verifiable" | Room 01 proof card | **asserted — illustrative** | Static sample card, not a platform claim |
| "Approved territory → 6 channels" | Room 04 proof card | **asserted — illustrative** | Static sample card |
| "Fame 8 · Uniqueness: search-verified" | Room 03 proof card | **asserted — illustrative** | Static sample card |

## Client-facing documents

| Claim | Location | Status | Source |
|---|---|---|---|
| "pipeline stages run" = 28 | `summary-document.ts` build band | **now derived** | `TOTAL_PIPELINE_STEPS` |
| "human checkpoints signed off" = n/6 | `summary-document.ts` | **now derived** | `HUMAN_CHECKPOINT_COUNT` (gates A–F) |
| "scoring dimensions applied" | `summary-document.ts` | **derived — relabelled** | `scoring.rows.length`; now reads "strategic scoring dimensions applied" so it can't be read as the platform total |
| "creative lenses swept" fallback 37 | `summary-document.ts` | **now derived** | `extras.lensesSwept \|\| LENS_COUNT` |
| "propositions considered" | `summary-document.ts` | **derived** | `extractPropositionsField().length` — Stage 12 shortlist (2–7 observed) |
| "stages completed" = 28 | `exec-summary-sections.ts:867` | **derived** | `TOTAL_PIPELINE_STEPS` |
| "Stage 8 of 22" nav labels | `brand-register.ts`, `TopNav.tsx`, `pipeline.tsx` | **derived** | `NUMBERED_STAGE_COUNT` |
| "six-dimension framework" prose (×3) | `summary-document.ts`, `minto-content.ts` | **constant-ok** | Matches Stage 10 rubric |
| "composite /100", "/10" score suffixes | `minto-content.ts`, `doc-00A-minto.ts` | **constant-ok** | Rubric scale definitions |
| "SMPS RECEIVED FROM STAGE 10: n / PRESSURE TESTS PER SMP: n" | `minto-content.ts` | **derived** | Parsed from Stage 10/11 output |
| Section index numbers ("10", "11", …) | `minto.ts`, `summary-document.ts` | **constant-ok** | Canonical section spec |
| "Medium term (12–24 months)" | `doc-00A-minto.ts` | **constant-ok** | Fixed horizon label |
| Research/claim counts, verification counts, directions generated/rated | `summary-document.ts` bands | **derived** | Per-session arrays |
| "20+ propositions searched per brief" | `proposition-anchor.ts:43` | **now derived** | `PROPOSITION_VOLUME_CLAIM` |

## Remaining asserted claims (accepted, with reason)

1. **"2–4 hrs"** — no aggregated run-duration metric exists. To derive it we'd need session start/finish timestamps rolled up; worth doing if the claim is challenged.
2. **"50+ methodologies"** — the inventory is a doc (55 entries), not a code array. Deriving it would mean moving the inventory into a typed module.
3. **"16 lateral engines"** — true but split across two modules; derivable if `LOC_ENGINES.length + DISRUPTION_ENGINES.length` is exported.
4. **Sample proof cards** — deliberately illustrative UI, not platform claims. Should stay clearly framed as examples.

## Rule going forward

No marketing surface or document template may introduce a new numeric claim as
a literal. Add the figure to `platform-metrics.ts` (or the owning module) and
import it.

## Repositioning pass (marketing site rebuild)

New derived constants in `platform-metrics.ts`: `GOVERNANCE_GATE_COUNT`,
`HUMAN_CONFIRMATIONS_TYPICAL_RUN` (15, observed), `METHODOLOGY_COUNT` (55) with
`METHODOLOGY_HEADLINE` ("50+"), `LATERAL_ENGINE_COUNT` (LOC engines + Stage 8
disruption engines = 16), `PROCESSING_HOURS_MIN/MAX` (asserted, flagged in copy
as observed rather than telemetry-aggregated).

All new pages (`/demo`, `/for-cmos`, `/for-consultancies`, `/for-agencies`,
`/methodology`, `/enterprise`) import these; no page states a numeric claim as
a bare literal.

Open discrepancy: `STRUCTURED_OUTPUT_COUNT` currently evaluates to the live
appendix lengths in `minto-content.ts`, not the "23" quoted in the brief. The
site shows the derived value.

## UNRESOLVED — structured output count: 23 (earlier audit) vs 21 (derived)

The two figures read **different sources** and are not measuring the same thing.

- **Earlier "16 + 7 = 23"** counted *numbered pipeline stages* (Stage 1–16 = 16;
  detonation stages 17, 17b, 18, 19, 20, 20b/21, 22 ≈ 7). That is a count of
  stages that run, not of documents/appendix outputs that exist.
- **Current "15 + 6 = 21"** is `PIPELINE_APPENDIX.length + DETONATION_APPENDIX.length`
  in `src/lib/minto-content.ts` — the actual structured outputs assembled into
  client-facing documents.

Entries present as stages but absent from the appendix lists:
- **Stage 16 — Document Assembly** (excluded by design: it *is* the deliverable
  builder, not an appendix section)
- **Stage 20b — Channel Strategy & Audience Intelligence** (candidate genuine omission)
- **Stage 21 — Channel Detonation Briefs** (candidate genuine omission)

So the 16 was counting stage numbers, not outputs, and was wrong as an output
claim. **21 is the real, current, code-derived number and is what the site
shows.** Open question for confirmation: whether Stage 20b and Stage 21 should
be added to `DETONATION_APPENDIX` — if both are added the derived figure becomes
23 legitimately.
