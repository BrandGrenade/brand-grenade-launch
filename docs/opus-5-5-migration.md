# Claude Opus 5.5 migration — test record

Model id: `claude-opus-5-5`. Policy lives in `src/lib/model-policy.ts`
(`STAGE_MODEL` ledger + `HIGH_EFFORT_STAGES`), applied in
`src/lib/claude.server.ts` via `resolveModel()` / `effortConfig()`.
A stage absent from `STAGE_MODEL` stays on `claude-opus-5`.

## Item 1 — forced tool use

Codebase search for `tool_choice` across `src/`, `scripts/`, `supabase/`:
zero occurrences. Only two tool-using call sites exist —
`src/lib/fact-verify.server.ts:131` and `src/lib/stimulus/rate.server.ts:86` —
both pass `tools: [web_search_20250305]` with no `tool_choice`, so the model
chooses freely.

Live tests (real Anthropic API):
- `tool_choice: {type:"any"}` → HTTP 400 on `claude-opus-5-5`, 200 on `claude-opus-5`.
  Confirms the breaking change is real and that we are not exposed to it.
- Both call-site request shapes replayed on 5.5 with `output_config.effort: high`:
  both PASS, `web_search_requests` = 1 and 4, JSON returned as expected.
  `server_tool_use` blocks still present, so `rate.server.ts`'s structural
  search-count check keeps working on 5.5.

## Item 2 — reasoning effort

The parameter is **not** a top-level `effort` field (400 "Extra inputs are not
permitted"). Correct location is `output_config.effort`, values
low | medium | high | xhigh | max. Supported: opus-5, opus-5-5, sonnet-5,
sonnet-4-6. Rejected (400): haiku-4-5. `temperature` is rejected outright by
opus-5-5.

High effort is set explicitly for scoring/selection (8, 9, 9-loc,
9-loc-validation, 10, 11, 12, 13, 13b, 15, 16, 18, 20, 20b, 21, 21f), territory
and intelligence reasoning (14, 14b, 14c, 00a, ie, ie-r), Briefing Room
(br1, br2, br4, br5) and anchor-gate. Formatting/extraction stages (1b, 2, 3,
17, 19, 22, preflight, document assembly) take the model default.

Side-by-side Stage 11 on the real Dan Murphy's session, identical input,
`output_config.effort: high`:

| | Opus 5 | Opus 5.5 |
|---|---|---|
| duration | 322.0 s | 287.6 s |
| output | 24,057 chars / 3,688 words | 25,640 chars / 3,954 words |
| fatal-test failures found | 9 | 11 |

5.5 caught four evidence-base faults Opus 5 did not: BWS mislabelled as a
competitor (Endeavour sister banner since the 2021 demerger), an incomplete
scoring record on one proposition, a proposition scored twice on different
frameworks, and a category-intelligence contradiction of a differentiation
claim. Reasoning depth is better.

**But** 5.5 deviated from the Stage 11 output contract: it dropped the
`## Stage 11 — Proposition Pressure Test` and `## Per-Proposition Pressure
Blocks` headings and promoted per-proposition blocks from `###` to `##`.
Nothing parses those headings today (Stage 11 output is displayed, and sliced
into `rescore-smp.server.ts`), so it is cosmetic — but Stage 11 does not
migrate until the prompt's format instruction is hardened and re-tested.

## Item 3 — intermediate progress text

Streaming through the platform's own `streamClaude` path, effort high:

| model | deltas | first delta | max silent gap |
|---|---|---|---|
| opus-5-5 | 191 | 4,126 ms | 4,126 ms |
| opus-5 | 172 | 7,356 ms | 7,356 ms |

Text still arrives as `text_delta`; no silent-progress problem. With tools on,
5.5 interleaves `thinking` blocks between tool calls where Opus 5 did not — but
both tool-using call sites are non-streaming and stay on sonnet-4-5, and every
streamed stage has no tools, so nothing in the UI is affected.

## Rollout

Wave 1: `1b` only. Verified end-to-end on the real Dan Murphy's session through
`callClaude` with the live policy: routed to `claude-opus-5-5`, PASS in 5.7 s,
valid contract output (`## BRIEF SUFFICIENT — ADVANCE TO STAGE 2`).
Later waves add stages one at a time, each with a real run before the next.

## Effort capability guard (23 Sep 2026)

`effortConfig()` now strips `output_config.effort` for any model outside the
`modelSupportsEffort()` allow-list and logs a loud `[MODEL-POLICY]` warning
naming the stage and model, instead of letting the call 400. Live proof
(`tmpscripts/haiku-effort-guard.ts`): raw Haiku call with effort → HTTP 400
"This model does not support the effort parameter."; the same request through
`callClaude` (model `claude-haiku-4-5`, stage `10`, effort `high`) → warning
logged, `effort=model-default`, reply "READY" in 958 ms. Unit coverage in
`src/lib/model-policy.test.ts` (6 tests). Permanent rules documented in
`docs/model-and-effort-policy.md`.

## Wave 2 — Stage 3 (Strategic Frameworks)

Classification: formatting/structure, not scoring — runs on the model default
effort. Routed via `STAGE_MODEL["3"] = OPUS_5_5`.

Real run on the live Dan Murphy's session (`c5142f1d`), through `callClaude`
with the live policy: model `claude-opus-5-5`, 43.9 s, 7,663 chars.
Structural contract check against what Stage 4 consumes
(`countSections(stage_3_output)` = `##` heading count):

- 5 `##` framework headings (contract: 3-6) — `countSections` = 5
- `**The opportunity:**` / `**What this excludes:**` / `**Why it is available:**`
  present 5/5/5, one per framework
- output begins immediately with `## ` (no header block / metadata)

VERDICT PASS. Stage 11 remains on Opus 5, blocked pending a hardened heading
instruction and re-test.

Stage 3 → 5.5 (model default effort): PASS, 5 frameworks, all labels present.
Stage 4 → 5.5 (model default effort): real Dan Murphy's run, 38.2 s, 5 frameworks in →
5 universes out, every universe has its `>` tension line and `---` divider, output
opens on the first `## ` heading. PASS.

## Stage 4 side-by-side (24 Sep 2026, Dan Murphy's session c5142f1d, same input)
| | Opus 5 @ high | Opus 5.5 @ high | Opus 5.5 @ default (medium) |
|---|---|---|---|
| Time / chars | 41s / 8,301 | 44s / 9,469 | 38s |
| Universes / tension lines | 5/5, 5/5 | 5/5, 5/5 | 5/5, 5/5 |
Finding: 5.5 high tension lines are more two-sided and human; 3 of 5 reuse a "…to whoever…" closing formula (watch item). Opus 5 lines are terser and more contrarian. Medium was not structurally worse. Decision: Stage 4 classified reasoning-critical → high effort on 5.5. All stage ids now explicitly classified (test enforced).

### Stage 4 re-run after tension-line variety instruction (24 Sep 2026)
Opus 5.5 @ high, 51s, 5/5 universes, 5/5 tension lines. "whoever" occurrences: 0 (was 3 of 5). Five distinct constructions (clause + reversal, paradox, rhetorical question, imperative-conditional, appositive). Stage 4 stays migrated.

## Stage 4B side-by-side (24 Sep 2026, same session, both @ high) — NOT MIGRATED
| | Opus 5 | Opus 5.5 |
|---|---|---|
| Time / chars | 163s / 21,745 | 139s / 24,375 |
| Heading contract | 3 parts, as specified | **5 parts** — promoted liability reinterpretation and top-3 facts to their own parts |
| Priority combination | Founder's published wine writing + price guarantee retiring the price argument | Possessive name + "more Australian occasions pass through Dan's than any other retailer" |
| Fact discipline | Anchor is a real, checkable historical fact | **Anchor is an unsourced superlative, stated as fact** (not in the brief), in the stage whose job is raw verifiable facts |
Downstream parses 4B as free text (stage5-prompt.ts), so the part drift would not break Stage 5 — but it is contract drift of the Stage 11 kind, and the fact lapse is a quality regression. Decision: 4B stays on Opus 5 (high). Re-test after hardening the part structure and fact-sourcing rule.

### Fact-bound checks for all subsequent migrations

From Stage 4B onward, every fact-bound side-by-side includes a claim-origin audit
against the exact inputs used for both models. It records whether Opus 5.5 added any
claim not present in those inputs, with a separate check for sourced or explicitly
perception-labelled superlatives/comparatives. Any unsourced introduced claim blocks
migration. Stage 5 and Briefing Room truth-producing Steps 1–2 and 4–5 are the first
priority; Step 2 receives the strictest treatment because its source-tagged truths
become downstream evidence.

### Stage 4B hardened re-test (24 Sep 2026, same Dan Murphy's input, both @ high)

| | Opus 5 | Opus 5.5 |
|---|---|---|
| Time / chars | 96.7 s / 14,557 | 152.7 s / 18,027 |
| Exact three-part contract | PASS — exactly 3 required level-two headings | PASS — exactly 3 required level-two headings |
| Input-absent factual claims | **FAIL** — introduced unsupported absolutes including the brand having spent its "entire existence" proving only price, attendance at "every occasion in the country", and "the best advice in the country" | **PASS — none found.** It explicitly excluded unavailable founding/store/range facts, treated the brief's comparative data-depth claims as assertions requiring audit, and did not claim the named person was a founder |
| Comparative/superlative discipline | Several strategic superlatives escaped without input support | Comparative factual statements cite the supplied brief; unverifiable comparisons are labelled as brief assertions and held for audit |

The prior 5.5 failures are gone: the output now has exactly the three permitted parts,
and the unsourced "more Australian drinking occasions ... than any other retailer"
claim did not recur. 5.5 showed materially better evidence discipline than Opus 5 on
this re-test. Decision: **Stage 4B migrated to Opus 5.5 at high effort**. Stage 5 and
the shared Briefing Room truth discipline now carry the same input-bound comparative
claim rule before their own migrations; each still requires a real side-by-side and
semantic claim-origin audit.
