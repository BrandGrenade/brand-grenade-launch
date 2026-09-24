# Model and reasoning-effort policy (permanent reference)

Authoritative code: `src/lib/model-policy.ts`. Applied in `src/lib/claude.server.ts`
(`resolveModel()` + `effortConfig()`), which is the only place a request body is built
for pipeline stages. Tests: `src/lib/model-policy.test.ts`.

## Rule 1 — reasoning effort lives at `output_config.effort`

There is **no top-level `effort` field**. Sending one returns HTTP 400
("Extra inputs are not permitted"). The correct shape is:

```json
{ "model": "claude-opus-5-5", "output_config": { "effort": "high" } }
```

Values: `low | medium | high | xhigh | max`.

Opus 5 defaulted to high effort; Opus 5.5 defaults to **medium**. Any stage whose
quality depends on reasoning depth must therefore set `high` explicitly — that list is
`HIGH_EFFORT_STAGES` in `model-policy.ts` (scoring, selection, integrity gates,
territory reasoning, Briefing Room diagnosis/tension, anchor gate). Formatting and
extraction stages intentionally run on the model default.

## Rule 2 — not every model accepts it (Haiku rejects it outright)

Verified live 23 Sep 2026 against the real API:

| Model | `output_config.effort` |
|---|---|
| claude-opus-5 | accepted |
| claude-opus-5-5 | accepted |
| claude-sonnet-5 | accepted |
| claude-sonnet-4-6 | accepted |
| **claude-haiku-4-5** | **HTTP 400 — "This model does not support the effort parameter."** |
| claude-sonnet-4-5 | not sent (treated as unsupported) |

`claude-haiku-4-5` is in live use — the preflight Claude API health check
(`src/lib/preflight.functions.ts`) pins it explicitly.

## Rule 3 — the capability guard

`modelSupportsEffort(model)` in `model-policy.ts` is the single allow-list, and
`effortConfig()` is the only constructor of `output_config`. If effort is requested —
explicitly, or implied by a stage being in `HIGH_EFFORT_STAGES` — for a model that
does not accept it, the field is **stripped** (the call cannot 400) and a warning is
logged naming the stage and the model:

```
[MODEL-POLICY] effort="high" requested for stage=10 on model="claude-haiku-4-5",
which does not accept output_config.effort. Stripping it — the call will run at the
model default. Fix the stage/model pairing in src/lib/model-policy.ts.
```

This covers both future failure modes: a refactor that passes effort uniformly, and a
stage moved onto Haiku. Proof (`tmpscripts/haiku-effort-guard.ts`, run 23 Sep 2026):

- raw control, effort sent directly to Haiku → `400 "This model does not support the effort parameter."`
- guarded path, `callClaude({ model: "claude-haiku-4-5", stageNumber: "10", effort: "high" })`
  → warning logged twice (prepare + telemetry), `effort=model-default`, reply `"READY"`, 958 ms.

## Rule 4 — no forced tool choice

`tool_choice: {type:"any"|"tool"}` is rejected by Opus 5.5 (HTTP 400). The codebase
uses none; do not introduce it. Tool-using call sites: `src/lib/fact-verify.server.ts`
and `src/lib/stimulus/rate.server.ts`, both on `claude-sonnet-4-5`, both free choice.

## Rule 5 — `temperature` on Opus

Opus 4.8+ rejects `temperature`. `claude.server.ts` forwards it only to non-Opus models.

## Migration ledger

`STAGE_MODEL` in `model-policy.ts` is the record of which stages have moved to Opus 5.5.
A stage absent from it stays on `claude-opus-5`. Per-stage test evidence lives in
`docs/opus-5-5-migration.md`. Stage 11 is **blocked** from migration until its heading
contract is hardened and re-tested (5.5 dropped required headings there).

### Fact-bound migration gate

Every fact-bound stage must pass an input-grounding check before its model route can
move to Opus 5.5. Its side-by-side record must state whether either model introduced
any factual claim absent from the identical supplied inputs. Superlative and
comparative claims (for example "biggest", "most", "first" or "more than any other")
receive an explicit source check: the source must be present in the supplied inputs
and support the comparison, or the output must label the claim as a perception rather
than established fact. An unsourced new claim blocks migration even when the output is
otherwise stronger or structurally valid. Apply this gate first to Stage 4B, Stage 5,
and Briefing Room Steps 1–2 and 4–5; Step 2's truth extraction is highest risk because
its output becomes the source-tagged evidence set used downstream.

This is enforced at two levels: the fact-bound prompts carry the evidence-boundary
and comparative-claim rule (Stage 4B, Stage 5, and the shared Briefing Room discipline
block), and the migration record contains the human semantic audit against the exact
input. A lexical scan is only a locator because words such as "first" and "most" also
occur in ranking instructions and strategic judgements; it cannot replace checking
whether the sentence makes a factual claim and whether its cited input supports it.

## Reclassifications — 24 Sep 2026

Every model call now carries a stage id, and each id sits on exactly one list:
`HIGH_EFFORT_STAGES` or `DEFAULT_EFFORT_STAGES`. `model-policy.test.ts` scans
the real source for every `callClaude`/`streamClaude` call and fails if one has
no literal `stageNumber`, or has one that is unclassified or on both lists.
Negative control: removing preflight's id makes the test fail naming
`preflight.functions.ts:150`. A second test fails on any new direct
`api.anthropic.com` call site that isn't on the reviewed allow-list.

Moved from the formatting list to high:
- **Stage 17 (Detonation Territory)** — it authors the territory the client
  selects at the Stage 17 checkpoint, and everything in 17B–21 builds on it.
  That is strategic authorship, not formatting. The original list classified it
  by output shape (structured blocks) instead of by what it decides.
- **Stage 22 (Brand Architecture)** — it settles the relationships between brand,
  sub-brands and territory, a judgement the client acts on directly. Same
  mistake: structured output, but the content is a strategic decision.
- **Stages 4, 4B, 5, 6, 7** — strategic-space generation, asset mining, insight
  generation/validation and territory synthesis. Stage 4 based on the
  side-by-side in `docs/opus-5-5-migration.md`.
- **Creative Stimulus**: cs-bigidea, cs-ledger, cs-linecheck, cs-regen.

Default, on purpose: 1, 1B, 2, 3, 19, BR3, cs-channel, cs-offline, three-truth,
preflight. **Preflight** is not a pipeline stage. Before this change its
health-check ping had no stage id at all, so no classification covered it; it
now carries id `preflight` on the default list. It is pinned to
`claude-haiku-4-5`, which rejects effort, so the capability guard would strip
the setting anyway.
