# Brand Grenade — Scoring & Verification Systems Register

Extraction only. No build, design or placement decisions. Every entry below is
what the deployed code actually does, not what the overview deck claims.

---

## 0. Direct answer to the framing question

**Confirmed: these are genuinely separate systems, not one scoring model.**

The overview deck's five references map to five different mechanisms, built at
different times, in different files, with different scales, different owners and
different failure behaviour:

| Deck phrase | Actual system | Where it lives |
| --- | --- | --- |
| "six-dimension weighted proposition scoring framework" with "two hard elimination floors" | **Two** systems sharing a rubric: Stage 10 SMP Scoring and Left-of-Centre Validation. Same six dimension names and weights, but *different floor values* (see §1 and §2). | `stage10-prompt.ts` + `stage12-filter.ts`; `loc/validation.ts` |
| "eight-dimension creative scoring system" | Gate One Direction Rating — unrelated to the six-dimension framework; qualitative High/Medium/Low, never averaged into a shown score | `stimulus/rating-prompts.ts`, `rating-score.ts` |
| "five conditions that trigger mandatory human review" | Not one list. There are **two distinct families**: six hard Checkpoint Gates (A–F), plus a set of automated escalation triggers spread across Stage 20, Gate One, Gate Two, WAD, CD and fidelity. Consolidated in §12. | `checkpoint-gate.ts` and elsewhere |
| "confidence calibration on research/intelligence" | Research Synthesiser claim classification + Stage 13B self-rated reference confidence — two separate things | `synthesiser/`, `stage13b-prompt.ts` |
| "live-search verification of public claims" | Real-Fact Web Verification (Stages 2, 4B, Synthesiser) and, separately, Creative Uniqueness search in Gate One | `fact-verify.server.ts`; `stimulus/rate.server.ts` |

There is also a third scoring system the deck does not mention at all: the
**Stage 20 Master Detonation Brief Quality Scorer** (five dimensions, out of 50,
hard 40-point approval floor) — see §3. It is the only system in the platform
with a single combined number that hard-blocks a human approval.

---

# PART A — SCORING SYSTEMS

## 1. Stage 10 SMP Scoring — Six-Dimension Weighted Validation

**Stage:** Stage 10, scoring every Single-Minded Proposition candidate generated
at Stage 8. Re-run independently whenever the locked SMP text changes after
Stage 10 (median of three model passes).
**Files:** `stage10-prompt.ts`, `stage12-filter.ts`, `rescore-smp.server.ts`

**Dimensions — each 1–10 integer:**

| Dimension | Weight | What it actually measures |
| --- | --- | --- |
| Fame | 30% | Will people notice, talk about and remember the brand because of this. |
| Truth Strength | 20% | Is it grounded in something real, specific and owned by the brand — not a platitude. |
| Competitive Impossibility | 15% | Could a *named* competitor credibly say this next week. |
| Brand Permission | 10% | Does the brand have standing to make this claim today. Any deduction requires named evidence. |
| Clean Air | 10% | Is the territory unoccupied by a named competitor claim. Below 8 requires named evidence. |
| Commercial Precedent | 5% | Has a named brand made this move successfully. Recency-weighted: post-2000 full weight, 1980–99 partial, pre-1980 illustrative only and cannot alone justify 7+. |

**Scale:** weighted composite out of **100**, computed in code
(`computeWeightedComposite`), not by the model. The model's own stated verdict is
discarded and overwritten by `applyStage10CodeGate`.

**Hard elimination floors (two):**
- Truth Strength **≥ 5**
- Competitive Impossibility **≥ 6**

Fail either → `codeVerdict = ELIMINATED`.

**What happens to failures:**
- Eliminated propositions are stripped before Stage 11/12 (`filterValidatedFromStage11`).
- Set-level rule: if fewer than two SMPs clear the floors, the set is HELD and
  Stage 8 regenerates — a retry, not a downgrade.
- Below-threshold scores on the four non-floor dimensions do **not** eliminate;
  they attach human-facing warning flags (e.g. "FAME: this proposition may not
  cut through in market"). Flag thresholds: Fame <6, Brand Permission <5,
  Clean Air <5, Commercial Precedent <4.
- Scores are frozen and injected verbatim into the Stage 12 prompt so the
  selection model cannot recalculate or alter them.

**Client-facing:** Yes. Per-dimension scores, the /100 composite and the
PASS/ELIMINATED verdict appear in Stage 12 selection cards and in the Strategy
Executive Summary / Phase 1 documents.

---

## 2. Left-of-Centre Proposition Validation

**Stage:** Runs after all 13 LOC engines return (internally labelled
"9-loc-validation"), feeding Stage 12 selection.
**File:** `loc/validation.ts`

Same six dimension names and same weights as §1. **The floors differ:**

- Truth Strength **≥ 5** (same as Stage 10)
- Competitive Impossibility **≥ 5** (Stage 10 uses **6**)

This is a genuine inconsistency between two systems presenting as one framework,
flagged here rather than silently reconciled.

**Scale:** 0–10 per dimension, clamped in code; weighted score 0–100.

**What happens to failures:** Propositions below a floor are marked
`failsFloor: true` with a `floorFailures` list and are disqualified — but the
weighted score is deliberately **preserved and still shown**, for transparency.
If the validator returns no entry for an engine, that engine carries a null score
and surfaces as "Validation failed — scores unavailable" rather than vanishing.

---

## 3. Stage 20 Master Detonation Brief Quality Scorer

**Stage:** Stage 20, immediately after the Master Detonation Brief is generated,
by a separate model call that did not write the brief. Any score the generating
model self-reported is discarded.
**File:** `stage20-scorer.ts`

**Dimensions — each 1–10, unweighted:**

| Dimension | What it measures |
| --- | --- |
| Emotional Clarity | Does the brief name the precise emotional response required. |
| Fame Invitation | Does it license work that can earn unpaid cultural conversation. |
| Distinctive Asset Integration | Does it specify which brand assets appear and how they build memory structures. |
| Psychological Leverage | Does it instruct teams on how the work should operate on fast, associative processing. |
| Creative Share of Voice Ambition | Does it set a specific quality-multiplier ambition against the category. |

**Scale:** composite = sum of the five = **out of 50**, recomputed in code.
**Threshold:** PASS at **≥ 40**, otherwise REVIEW.

**What happens to failures:**
1. REVIEW returns a `failing_dimensions` list (anything scoring <7) with a
   one-sentence strengthening instruction each.
2. The brief is **automatically rewritten once** against those instructions and
   re-scored. The higher-scoring of the two drafts is kept — the rewrite is
   discarded if it made things worse.
3. **Hard human gate:** `approveStage20` refuses approval below 40/50
   ("Brief Quality Score must be 40 or above to approve"). This is the only
   numeric score in the platform that blocks a human sign-off.

Manual section edits recompute the composite but do not re-run the five
judgements.

**Client-facing:** Yes — rendered in the Master Detonation Brief as a scored
table with each dimension /10, the composite /50 and PASS/REVIEW.

---

## 4. Gate One — Eight-Dimension Creative Rating

**Stage:** Room 04 (Creative Stimulus Engine), on directions that survived the
human Tissue Check.
**Files:** `stimulus/rating-prompts.ts`, `rating-score.ts`, `rate.server.ts`

Stated design principle in the prompt: *"Each dimension is scored independently.
Nothing here is averaged into a single number — deliberately."*

| # | Dimension | Scale | What it measures |
| --- | --- | --- | --- |
| 1 | Strategic Compliance | Direct / Supporting / Tangential | Which specific SMP element the work delivers, whether it dramatises the anchored strategic tension, and its journey placement. |
| 2 | Brand Glue | High / Medium / Low | Reusable brand equity versus a one-off execution. |
| 3 | CRAB | Four sub-ratings, each High / Medium / Low | Clear, Relevant (must rest on a genuine human truth), Appealing, Believable. |
| 4 | Fame | High / Medium / Low | Would this get talked about outside the category. |
| 5 | Creative Uniqueness | High / Medium / Low | Whether this has been done before — requires live web search, minimum 2 searches, records prior executions found. |
| 6 | Creative Ambition | High / Medium / Low | One holistic craft-and-boldness judgement. Explicitly not a formula and not sub-scored. |
| 7 | Producibility | pass / fail | Budget, timeline, legal and rights feasibility only. Must never influence the seven other ratings. |
| 8 | Brand Integrity Check | Flag only, no rating | Third-party IP, trademark, celebrity likeness. Brand Grenade flags; it never decides, blocks or adjudicates. |

**No elimination floor.** Nothing is killed by its ratings; all eight are shown
independently whatever the values.

**Internal composite:** a 0–1 index averaging six of the eight (Producibility and
Brand Integrity excluded) exists **solely** to detect near-ties. It is never
displayed and never persisted as "the score."

**Trigger:** if two or more rated directions sit within **0.06** of the top index
value, a **Seasoned CD tie-breaker pass** fires — an 80–150 word first-person
creative-director opinion, explicitly forbidden from producing scores, rankings
or tables. Can also be manually forced.

**Gate One confirmation** requires at least one human-approved direction; there is
no score threshold. Approval freezes a snapshot of the ratings at that moment.

---

## 5. Stage 21 / Channel Adaptation Fidelity Check

**Stage:** Stage 21 (Channel Detonation Briefs) and, using the same checker, Room
04 Step 3 channel adaptation.
**Files:** `stage21-fidelity*.ts`, `stimulus/adaptation-fidelity.server.ts`

**Checks:**
1. **Verbatim line check** (deterministic, in code) — is the locked campaign line
   literally present, after normalising quotes, dashes, case and whitespace.
2. **Meaning fidelity** (model) — does the channel brief carry the decided idea's
   meaning rather than its vocabulary; has it landed in the named misreading the
   system must avoid; which of the five non-negotiables are missing.

**Scale:** verdict `pass` / `drift` (same idea, weakened or narrowed — fixable) /
`break` (a different idea, or the named misreading — must not propagate), plus a
0–10 score.

**Combining rule:** if the line is not verbatim, the verdict is capped at `drift`
however well the idea survived — a contract failure regardless.

**What happens to failures:**
- Room 04 adaptation: exactly **one** automatic regenerate-and-recheck. A channel
  is only surfaced as failed after failing twice consecutively.
- Stage 21: the report is stored and surfaced for human review; there is **no
  automatic block** on `break` in code.
- A check that errors is recorded as `drift`, never a silent pass.
- No locked lead expression → every channel scored `drift`, score 0, with an
  instruction to lock one first.

---

## 6. Gate Two — Mandate Compliance

**Stage:** Room 04, per finished orchestrated production prompt.
**Files:** `stimulus/gate-two-rules.ts`, `orchestration-prompts.ts`

**Verdicts:** `present` (unmistakably in the work, with a quotable carrier
phrase), `weak` (traceable but buried or over-abstracted), `absent` (not present,
or a different idea in similar words). The carrier phrase must be copied verbatim
from the prompt text or the verdict is forced to `absent`.

**Blocking conditions — Gate Two cannot be confirmed if:**
- no prompt has been signed off;
- **any** active prompt is `absent` — the block names the offending channels and
  states that no amount of human sign-off unblocks the set;
- any active prompt still has no explicit decision.

This is the only place where an automated verdict overrides human sign-off.

**Failure paths:** send a single prompt back with notes, or retry the whole active
set with an amendment. Both reset approval and re-run the craft and CD passes.

---

## 7. Writer/AD Craft Pass (WAD)

**Stage:** Room 04 orchestration, per production prompt, before the CD pass.
**Checks:** craft quality of language (specific versus generic filler);
production choices suited to the idea and the tool; "Perfect Imperfection" (a
deliberate craft flaw is required).
**Scale:** `pass` / `fail` — explicitly no numeric score.
**Failure:** exactly one automatic revision. Pass on retry → `revised`. Still
failing, or no revised prompt returned → `flagged` for a human. Never dropped.

---

## 8. Creative Director Cohesion Pass

**Stage:** Room 04 orchestration, across the whole prompt set, after WAD.
**Checks:** does the set read as one campaign; accept or reject each propagated
cross-reference suggestion.
**Scale:** `pass` / `fail` — the prompt states "never a score, never a rubric."
**Failure:** one automatic cohesion revision on flagged prompts, then the set is
re-judged. Still failing → `flagged` for a human before Gate Two.

---

## 9. Idea Collision Check and Convergence Ledger

**Stage:** Room 04, during and after the 37-Lens Sweep.
- **In-sweep collision check:** each lens's root tension checked against all prior
  lenses. Output `CLEAR` or `COLLIDES WITH <lens> — <reason>`. The model is
  instructed to rebuild rather than ship a collision.
- **Convergence ledger:** a second full-set pass comparing every idea against
  every other, not just prior-in-sequence. Verdicts `CLEAR` / `COLLIDES` with the
  colliding lens ids and reasoning. Clusters of three or more are all flagged.
- **Coverage enforcement:** up to two retries for missing verdicts; anything still
  missing is force-recorded as `CLEAR, forced: true` — recorded unaudited rather
  than dropped.
- **No automatic elimination.** The ledger goes to the human at Tissue Check.

---

## 10. Campaign Line On-Strategy Check

**Stage:** Room 04, applied to all 37 campaign lines, independently of the idea
rationale.
**Verdicts:** `on_strategy`, `drift` (clear and appealing but a different idea
from the proposition), `generic` (passes the swap test — works unchanged with a
competitor's name).
**Scale:** no numeric score, no elimination floor. Each verdict stores what the
line actually says, the reasoning, and the swap-test result. Malformed output
defaults to `drift`.

---

## 11. Non-scoring gates worth registering

- **Tissue Check** — human only, statuses `keep`, `keep_in_play`, `revise`,
  `kill`, `generated`. Only `keep` and `keep_in_play` reach Gate One rating.
- **Stage 9 Candidate Disposition Ledger** — every enumerated Stage 8 / LOC
  candidate must receive `SURVIVED`, `REBUILT INTO <SMP>` or `REJECTED — reason`.
  Coverage checked in code; missing rows trigger a targeted retry, then a forced
  `REJECTED` row. Nothing is silently dropped.
- **Output Banned-Word Gate** — lexical pass/fail against a fixed jargon list, up
  to three retries naming the offending terms, then deterministic substitution in
  live mode (or a thrown error in test mode).
- **Content Integrity Certification** — ten binary criteria (COMPLETE, CLEAN,
  VOICE, CONSISTENT, PROMISED, PLACED, DUPLICATE, SCHEMA, DISPOSITION,
  CHECKPOINT) applied to rendered document HTML. Findings block publication.
- **LOC Integrity Assertion** — structural health check on a persisted LOC run
  (all engines reported, anchors present, minimum character floors, freshness
  within one hour). Binary; throws with every violated rule listed.
- **Preflight Severity Classification** — engineering QA only, never applied to
  client content: BLOCKER, DEGRADED, HARNESS, TRANSIENT (auto-escalates to
  BLOCKER if it recurs).
- **Retired:** the Universal Proposition Quality Gate was removed in June 2026
  and is now an empty stub kept only so imports compile.

---

## 12. Consolidated: what triggers mandatory human review

The deck's "five conditions" understates it. The real set is two families.

**Family 1 — hard checkpoint gates (six).** Re-read from the database at the
start of every downstream stage; a stage throws rather than proceeding.

| Checkpoint | Gates | Condition |
| --- | --- | --- |
| A | Stage 2 | `checkpoint_a_confirmed` true |
| B | Stage 9 | `checkpoint_b_confirmed` true |
| C | Stage 13 | `checkpoint_c_confirmed` true **and** a non-empty selected SMP |
| D | Stages 17B / 18 | a territory has been selected |
| E | Stage 19 | a detonation has been selected |
| F | Stage 21 | Stage 20 approved (which itself requires ≥40/50) |

**Family 2 — automated escalations to a human.**

| Trigger | Exact condition |
| --- | --- |
| Stage 8 regeneration | Fewer than two SMPs clear both Stage 10 floors |
| Stage 20 approval block | Brief quality composite < 40/50 |
| Gate One tie-breaker | Two or more directions within 0.06 of the top internal index |
| Gate Two hard block | Any active prompt's mandate compliance is `absent` |
| WAD flag | Craft pass still failing after one automatic revision |
| CD flag | Cohesion still failing after one automatic revision |
| Channel adaptation flag | Fidelity fails twice consecutively |
| Fact verification flag | Any claim returns `unverified` or `contradicted`, or the verification call itself fails |
| Stage 13B | Fewer than three qualifying historical references found |
| Document publication block | Any content-integrity finding |

---

# PART B — VERIFICATION AND CONFIDENCE MECHANISMS

## V1. Real-Fact Live Web Verification

**Runs at:** Stage 2 (Category Intelligence), Stage 4B (Asset Mining), and the
Research Synthesiser — after the stage output is written, plus on demand via an
admin re-verify.
**File:** `fact-verify.server.ts`

**What is checked, against what:** every independently verifiable real-world
factual claim in the output — product composition, competitor facts, regulation,
statistics, anything tagged "Real Fact" — checked against **live web search**
(Claude with the native search tool, maximum 8 searches, up to 25 claims).
Strategic interpretation, opinion and explicitly perceived-fact framing are
excluded by design. The Synthesiser variant additionally excludes anything marked
client-supplied proprietary data.

**Status vocabulary:** `verified` (credible corroborating source found),
`unverified` (search ran, no clear corroboration), `contradicted` (a credible
source contradicts the claim). Any unrecognised value defaults to `unverified`.

**How it is recorded and carried forward:** the stage output itself is rewritten
in the database.
- All clear → an appended "Fact Verification Review" footer stating N claims
  checked and all corroborated.
- Any flag → an inline annotation at the exact sentence
  (`[UNVERIFIED — REQUIRES HUMAN CONFIRMATION]` /
  `[CONTRADICTED — REQUIRES HUMAN CONFIRMATION]`), the "Real Fact" badge stripped
  from that line, and a footer listing every flagged claim with the standing
  instruction: *do not promote any flagged claim to downstream insight, territory
  or proposition until independently confirmed.*
- A live status line streams to the UI as the stage runs.

**If verification cannot run:** the call has a hard 200-second wall-clock ceiling.
On timeout, API error or unparseable response the output is **not** rolled back or
blocked; instead a "VERIFICATION CALL FAILED" banner is appended stating every
claim must be confirmed manually. Verification failure never fails the pipeline —
it degrades to a manual-review flag.

---

## V2. Research Synthesiser Claim Classification

**Runs at:** Room 00, when research documents are uploaded. Two-phase.

**Phase 1 — classification.** Every extracted claim is tagged with one or more
input categories (primary consumer, brand health, competitive audit, cultural
trends, audience segmentation, intel pack) and a source type:
`externally_verifiable` or `client_proprietary`. Ambiguous cases default to
`client_proprietary`, on the stated reasoning that wrongly flagging real
proprietary data as unverified is the worse failure.

**Phase 2 — verification.** Only externally verifiable claims go through V1.
Client-proprietary claims are never web-searched.

**Status vocabulary:** `verified`, `unverified`, `contradicted`, `client_supplied`,
`not_checked`. Verification results are matched back to claims by word-overlap
scoring with a 0.5 threshold; no match above threshold → `unverified` with the
note "Not corroborated in the verification pass."

**How it is carried forward:** each claim renders with its source document and a
status label — "Verified", "UNVERIFIED — requires human confirmation",
"CONTRADICTED by live search", "Client-supplied — not independently checked",
"Not checked" — and those rendered fields become the text that populates the
Intelligence Lab inputs. Run metadata (status, claim count, applied date) is
persisted and surfaced on the Deliverables page.

**Budgets and failure:** per-document extraction failures become warnings rather
than killing the run. Verification has a six-minute budget; claims not reached are
returned unverified with a warning rather than losing the synthesis.

---

## V3. Stage 13B Historical Reference Confidence

**Runs at:** Stage 13B (Strategic Territory Reference Layer).
**Important distinction:** this is **not** a live check. No search tool is
attached. It is the model self-rating its own certainty about training-data
recall.
**Scale:** `HIGH` / `MEDIUM` / `LOW`, with the instruction to flag LOW for any
reference it is not certain is accurate, and never to fabricate a campaign.
**Carried forward:** written into the stage output as prose. Nothing in code reads
or acts on the value. If fewer than three qualifying references exist, the output
must carry "HUMAN REVIEW REQUIRED" at the top.

---

## V4. Creative Uniqueness Live Search (Gate One dimension 5)

**Runs at:** Gate One rating, Room 04.
**What is checked, against what:** whether the creative direction has been done
before — prior executions by other brands — against live web search, maximum four
searches.

**The anti-fabrication control:** whether a search actually happened is determined
**structurally**, by inspecting the model response for real search tool-use
blocks, not by trusting the model's own claim. `web_search_performed` and the list
of queries run are overwritten in code from what was observed.

**If no search ran:** the uniqueness verdict text is force-prefixed with
*"NOT VERIFIED BY LIVE SEARCH — no web_search call was made, so this uniqueness
read is model assertion only."* Related control: if Strategic Compliance is not
`Direct` and the required "what can save it" note is missing, code substitutes an
instruction to re-run the rating before acting on it.

---

## V5. Current State vs Recommended Change — Status Derivation

**Runs at:** document build time.
**What it does:** re-derives verification status from the ingested corpus text
rather than performing a new check, so client documents state provenance in prose
instead of leaking internal markers.
**Vocabulary (rendered verbatim, deliberately as words not icons):**
"independently confirmed", "not independently verified",
"as supplied by the client, unconfirmed", or nothing where no marker exists.
**Carried forward:** attached to each fact and rendered next to the claim, with
numbered footnote citations. Verification-only fragments are folded onto the
parent claim rather than rendered as orphan bullets.
**If no baseline exists:** the section states plainly that the source material
contains no statement of what is currently in market, and that nothing has been
assumed in its place — it does not fabricate one.

---

## V6. Document Source Authority

**Runs at:** document assembly. Confirms a document is quoting the exact
Intelligence Lab run that fed the brief, via an embedded provenance marker plus a
strict text-equality check between the two sources. Binary — no confidence scale.
A missing or mismatched marker means the content is not traceable to a specific
Intelligence run.

---

# PART C — Is there a single unified score?

**No.** Nothing anywhere combines two different scoring systems into one number.

Three aggregates exist, and each is confined to its own system's dimensions:

1. **Stage 10 / LOC composite, /100** — six dimensions of one rubric.
   **Client-facing.**
2. **Stage 20 Brief Quality composite, /50** — five dimensions of one rubric.
   **Client-facing**, and the only aggregate that hard-blocks approval.
3. **Gate One composite index, 0–1** — six of eight dimensions, existing only to
   detect near-ties. **Never displayed, never persisted as a score, never reaches
   a document.**

So the client-facing side always shows each system's output separately:

**Shown to the client:** Stage 10 per-dimension scores, the /100 composite and the
PASS verdict; Stage 20 per-dimension scores, the /50 composite and PASS/REVIEW;
Stage 13 brand-fit verdict and its credibility dimensions; per-channel fidelity
verdict and score /10; the Gate One ratings table and the /80 sweep rating total
in the Creative Showcase; the CD cohesion verdict; verification status wording on
research claims.

**Internal only:** the Gate One tie-break index; the model's self-reported Stage 20
score (discarded); the raw code verdict, composite, flag and basis lines from the
Stage 10 gate (stripped before rendering); the category knowledge confidence
marker; preflight severity classes; LOC integrity assertions.

---

## Open items flagged for review

1. **Floor mismatch.** Competitive Impossibility floors at **6** in Stage 10 but
   **5** in LOC validation, while both present as the same six-dimension
   framework. One of the two is wrong.
2. **LOC weight comment.** The LOC validation header says ten weight points are
   "reserved / distributed by the model", but the code hard-codes the six
   dimensions to exactly 100. The comment is stale.
3. **Stage 21 fidelity has no teeth.** A `break` verdict — explicitly defined as
   "must not propagate" — does not block anything in code. It is reported only.
   The Room 04 adaptation path does enforce a retry; Stage 21 does not.
4. **Stage 13B confidence is inert.** HIGH/MEDIUM/LOW is written but never read,
   and it is easily mistaken for live verification because it sits next to
   systems that are. It is model self-report only.
5. **Deck accuracy.** The deck's "six-dimension framework with two hard floors"
   describes two systems with different floors; its "five conditions for
   mandatory human review" is really six checkpoint gates plus ten automated
   escalations; and it omits the Stage 20 scorer entirely, which is the strictest
   gate in the platform.
