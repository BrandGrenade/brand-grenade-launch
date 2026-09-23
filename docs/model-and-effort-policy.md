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
